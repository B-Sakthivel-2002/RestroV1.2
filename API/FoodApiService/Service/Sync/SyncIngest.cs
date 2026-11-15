using System.Collections.Concurrent;
using System.Text.Json;
using Npgsql;

namespace FoodApiService.Service.Sync;

// Online server: saves one uploaded batch of a branch. The branch holds the master copy, so each row simply
// replaces the stored one (or is deleted). Everything is applied in one transaction, in the order the rows
// changed on the branch; a repeated batch changes nothing. A row the branch may not send (another branch's
// id) is refused, and a row that cannot be saved (e.g. from a newer app version) is skipped and logged, so
// one bad row never stops a branch from uploading.
public sealed class SyncIngest
{
    private readonly SyncSettings _settings;
    private readonly ILogger<SyncIngest> _logger;
    private readonly ConcurrentDictionary<string, string> _upserts = new();

    public SyncIngest(SyncSettings settings, ILogger<SyncIngest> logger)
    {
        _settings = settings;
        _logger = logger;
    }

    public async Task<(int Accepted, int Skipped)> ApplyAsync(int branch, IReadOnlyList<SyncItem> items, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(_settings.ConnectionString);
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        int accepted = 0, skipped = 0;
        for (int i = 0; i < items.Count; i++)
        {
            var item = items[i];
            if (!SyncTables.ByName.TryGetValue(item.T ?? "", out var table))
            {
                skipped++;
                continue;
            }

            try
            {
                await using var cmd = new NpgsqlCommand { Connection = conn, Transaction = tx };
                if (item.Op == "d")
                {
                    if (!SyncTables.BelongsTo(table, item.Id, item.B, branch))
                    {
                        skipped++;
                        continue;
                    }
                    cmd.CommandText = $"SAVEPOINT r; DELETE FROM {table.Quoted} WHERE \"{table.Key}\" = @id; RELEASE SAVEPOINT r;";
                    cmd.Parameters.AddWithValue("id", item.Id);
                }
                else
                {
                    // Ownership is checked on the row itself, not on what the item says about it.
                    if (item.Data == null || !TryReadOwner(item.Data, table.Key, out long id, out int? rowBranch)
                        || !SyncTables.BelongsTo(table, id, rowBranch, branch))
                    {
                        skipped++;
                        continue;
                    }
                    cmd.CommandText = "SAVEPOINT r; " + await UpsertSqlAsync(conn, tx, table, ct) + "; RELEASE SAVEPOINT r;";
                    cmd.Parameters.AddWithValue("data", item.Data);
                }
                await cmd.ExecuteNonQueryAsync(ct);
                accepted++;
            }
            catch (PostgresException ex)
            {
                await using var undo = new NpgsqlCommand("ROLLBACK TO SAVEPOINT r", conn, tx);
                await undo.ExecuteNonQueryAsync(ct);
                skipped++;
                _logger.LogWarning("Sync: branch {Branch}: skipped {Op} {Table} {Id}: {Error}", branch, item.Op, item.T, item.Id, ex.MessageText);
            }
        }

        await using (var status = new NpgsqlCommand("""
            INSERT INTO sync_branch_status (branchid, lastuploadat, lastrows, totalrows, skippedrows)
            VALUES (@b, now(), @a, @a, @s)
            ON CONFLICT (branchid) DO UPDATE SET lastuploadat = now(), lastrows = @a,
                totalrows = sync_branch_status.totalrows + @a, skippedrows = sync_branch_status.skippedrows + @s
            """, conn, tx))
        {
            status.Parameters.AddWithValue("b", branch);
            status.Parameters.AddWithValue("a", accepted);
            status.Parameters.AddWithValue("s", (long)skipped);
            await status.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);
        return (accepted, skipped);
    }

    private static bool TryReadOwner(string data, string key, out long id, out int? branch)
    {
        id = 0;
        branch = null;
        try
        {
            using var doc = JsonDocument.Parse(data);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty(key, out var k) || !k.TryGetInt64(out id))
                return false;
            if (root.TryGetProperty("branchid", out var b) && b.ValueKind == JsonValueKind.Number)
                branch = b.GetInt32();
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    // INSERT ... ON CONFLICT DO UPDATE over the columns this database has (columns the branch does not send
    // are left empty). Private columns (passwords) are never overwritten here.
    private async Task<string> UpsertSqlAsync(NpgsqlConnection conn, NpgsqlTransaction tx, SyncTables.Table table, CancellationToken ct)
    {
        if (_upserts.TryGetValue(table.Name, out var sql))
            return sql;

        var columns = new List<string>();
        await using (var cmd = new NpgsqlCommand("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = @t AND is_generated = 'NEVER'
              AND column_name NOT IN ('syncxid', 'syncseq')
            ORDER BY ordinal_position
            """, conn, tx))
        {
            cmd.Parameters.AddWithValue("t", table.Name);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
                columns.Add(r.GetString(0));
        }

        string list = string.Join(", ", columns.Select(c => $"\"{c}\""));
        var updates = columns
            .Where(c => c != table.Key && !(table.Private ?? []).Contains(c))
            .Select(c => $"\"{c}\" = EXCLUDED.\"{c}\"");
        sql = $"INSERT INTO {table.Quoted} ({list}) OVERRIDING SYSTEM VALUE "
            + $"SELECT {list} FROM json_populate_record(NULL::{table.Quoted}, @data::json) "
            + $"ON CONFLICT (\"{table.Key}\") DO UPDATE SET {string.Join(", ", updates)}";
        _upserts[table.Name] = sql;
        return sql;
    }
}
