using System.IO.Compression;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Npgsql;

namespace FoodApiService.Service.Sync;

public sealed record SyncItem(string T, string Op, long Id, int? B, string? Data);

public sealed record SyncBatch(int Branch, List<SyncItem> Items);

// Branch server only: every Sync:IntervalSeconds sends the rows inserted, changed or deleted since the
// last accepted upload to the online server (POST api/Sync/Ingest), gzipped, in batches.
//
// Where it got to is kept as (transaction id, running number) of the last row the online server accepted.
// Only rows of transactions older than every transaction still running are read, so a slow save that
// commits late is never skipped. The position moves only after the online server accepts a batch; when
// the internet is down nothing moves and the next round sends the same rows again (the online server
// simply replaces what it has). Billing never waits for any of this. With nothing new it still checks in
// every 15 minutes so the owner can see the branch is online.
public sealed class SyncUploader : BackgroundService
{
    private static readonly TimeSpan Heartbeat = TimeSpan.FromMinutes(15);
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly SyncSettings _settings;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<SyncUploader> _logger;
    private readonly string _readSql;
    // "" = not known yet (just started): the first result is written to sync_state without a log line.
    private string? _lastProblem = "";

    public SyncUploader(SyncSettings settings, IHttpClientFactory http, ILogger<SyncUploader> logger)
    {
        _settings = settings;
        _http = http;
        _logger = logger;
        _readSql = BuildReadSql();
    }

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        if (!_settings.IsBranch)
            return;
        if (string.IsNullOrWhiteSpace(_settings.ServerUrl) || string.IsNullOrWhiteSpace(_settings.Key))
        {
            _logger.LogWarning("Sync: Sync:ServerUrl or Sync:Key is empty; this branch works offline only and uploads nothing");
            return;
        }

        var target = new Uri(new Uri(_settings.ServerUrl.Trim().TrimEnd('/') + "/"), "api/Sync/Ingest");
        var every = TimeSpan.FromSeconds(Math.Max(10, _settings.IntervalSeconds));
        _logger.LogInformation("Sync: uploading branch {Branch} to {Url} every {Seconds} s", _settings.BranchId, target, every.TotalSeconds);

        using var timer = new PeriodicTimer(every);
        try
        {
            do
            {
                try
                {
                    await UploadAsync(target, stop);
                }
                catch (Exception ex) when (!stop.IsCancellationRequested)
                {
                    await ProblemAsync("upload failed: " + ex.Message, ex);
                }
            } while (await timer.WaitForNextTickAsync(stop));
        }
        catch (OperationCanceledException) when (stop.IsCancellationRequested)
        {
            // API is stopping
        }
    }

    private async Task UploadAsync(Uri target, CancellationToken stop)
    {
        await using var conn = new NpgsqlConnection(_settings.ConnectionString);
        await conn.OpenAsync(stop);

        long cursorXid, cursorSeq;
        DateTimeOffset? lastSent;
        await using (var cmd = new NpgsqlCommand("SELECT cursorxid, cursorseq, lastsentat FROM sync_state WHERE id = 1", conn))
        await using (var r = await cmd.ExecuteReaderAsync(stop))
        {
            await r.ReadAsync(stop);
            cursorXid = r.GetInt64(0);
            cursorSeq = r.GetInt64(1);
            lastSent = r.IsDBNull(2) ? null : r.GetFieldValue<DateTimeOffset>(2);
        }

        int batchSize = Math.Clamp(_settings.BatchSize, 50, 2000);
        while (true)
        {
            var rows = await ReadBatchAsync(conn, cursorXid, cursorSeq, batchSize, stop);
            var items = rows
                .Where(x => SyncTables.ByName.TryGetValue(x.Item.T, out var t) && SyncTables.BelongsTo(t, x.Item.Id, x.Item.B, _settings.BranchId))
                .Select(x => x.Item)
                .ToList();
            bool heartbeatDue = lastSent == null || DateTimeOffset.UtcNow - lastSent.Value >= Heartbeat;
            // Rows of other branches (copies in this database) are skipped: the position still moves past them.
            bool send = items.Count > 0 || (rows.Count == 0 && heartbeatDue);

            if (send)
            {
                if (!await SendAsync(target, items, stop))
                {
                    await SaveAsync(conn, cursorXid, cursorSeq, 0, sentNow: false, stop);
                    return;
                }
                lastSent = DateTimeOffset.UtcNow;
            }

            if (rows.Count > 0)
            {
                cursorXid = rows[^1].Xid;
                cursorSeq = rows[^1].Seq;
            }
            await SaveAsync(conn, cursorXid, cursorSeq, send ? items.Count : 0, sentNow: send, stop);
            await ProblemAsync(null, null);

            if (rows.Count < batchSize)
                return;
        }
    }

    private async Task<List<(SyncItem Item, long Xid, long Seq)>> ReadBatchAsync(NpgsqlConnection conn, long cx, long cs, int limit, CancellationToken stop)
    {
        var list = new List<(SyncItem, long, long)>();
        await using var cmd = new NpgsqlCommand(_readSql, conn);
        cmd.Parameters.AddWithValue("cx", cx);
        cmd.Parameters.AddWithValue("cs", cs);
        cmd.Parameters.AddWithValue("n", limit);
        await using var r = await cmd.ExecuteReaderAsync(stop);
        while (await r.ReadAsync(stop))
        {
            var item = new SyncItem(
                r.GetString(0),
                r.GetString(1),
                r.GetInt64(2),
                r.IsDBNull(3) ? null : r.GetInt32(3),
                r.IsDBNull(6) ? null : r.GetString(6));
            list.Add((item, r.GetInt64(4), r.GetInt64(5)));
        }
        return list;
    }

    // One statement: the snapshot that decides which transactions are finished is the one the rows are read in.
    private static string BuildReadSql()
    {
        var parts = new List<string>();
        foreach (var t in SyncTables.All)
        {
            string strip = string.Concat((t.Private ?? []).Select(c => $" - '{c}'"));
            parts.Add($"""
                (SELECT '{t.Name}'::text AS t, 'u'::text AS op, x."{t.Key}"::bigint AS id, (to_jsonb(x) ->> 'branchid')::integer AS b,
                        x.syncxid AS xid, x.syncseq AS seq, (to_jsonb(x) - 'syncxid' - 'syncseq'{strip})::text AS data
                 FROM {t.Quoted} x, s
                 WHERE (x.syncxid, x.syncseq) > (@cx, @cs) AND x.syncxid < s.xmin
                 ORDER BY x.syncxid, x.syncseq LIMIT @n)
                """);
        }
        parts.Add("""
            (SELECT d.tablename, 'd'::text, d.rowid, d.branchid, d.syncxid, d.syncseq, NULL::text
             FROM sync_deleted d, s
             WHERE (d.syncxid, d.syncseq) > (@cx, @cs) AND d.syncxid < s.xmin
             ORDER BY d.syncxid, d.syncseq LIMIT @n)
            """);
        return "WITH s AS (SELECT pg_snapshot_xmin(pg_current_snapshot())::text::bigint AS xmin)\n"
             + "SELECT * FROM (\n" + string.Join("\nUNION ALL\n", parts) + "\n) q ORDER BY xid, seq LIMIT @n";
    }

    private async Task<bool> SendAsync(Uri target, List<SyncItem> items, CancellationToken stop)
    {
        byte[] body = JsonSerializer.SerializeToUtf8Bytes(new SyncBatch(_settings.BranchId, items), Json);
        using var zipped = new MemoryStream();
        using (var z = new GZipStream(zipped, CompressionLevel.Fastest, leaveOpen: true))
            z.Write(body);

        using var content = new ByteArrayContent(zipped.ToArray());
        content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        content.Headers.ContentEncoding.Add("gzip");
        using var request = new HttpRequestMessage(HttpMethod.Post, target) { Content = content };
        request.Headers.Add(SyncHeaders.Branch, _settings.BranchId.ToString());
        request.Headers.Add(SyncHeaders.Key, _settings.Key);

        var client = _http.CreateClient(nameof(SyncUploader));
        client.Timeout = TimeSpan.FromSeconds(90);
        try
        {
            using var response = await client.SendAsync(request, stop);
            if (response.IsSuccessStatusCode)
                return true;
            string answer = await response.Content.ReadAsStringAsync(stop);
            await ProblemAsync((int)response.StatusCode == 401
                ? "the online server does not accept this branch's key (check Sync:Key here and Sync:BranchKeys online)"
                : $"the online server answered {(int)response.StatusCode}: {Shorten(answer)}", null);
        }
        catch (HttpRequestException ex)
        {
            await ProblemAsync("the online server cannot be reached (" + ex.Message + ")", null);
        }
        catch (TaskCanceledException) when (!stop.IsCancellationRequested)
        {
            await ProblemAsync("the online server did not answer in time", null);
        }
        return false;
    }

    private static async Task SaveAsync(NpgsqlConnection conn, long xid, long seq, int sent, bool sentNow, CancellationToken stop)
    {
        const string sql = """
            UPDATE sync_state SET cursorxid = @x, cursorseq = @s, lastattemptat = now(),
                   lastsentat = CASE WHEN @sent THEN now() ELSE lastsentat END,
                   sentrows = sentrows + @n
            WHERE id = 1;
            DELETE FROM sync_deleted WHERE (syncxid, syncseq) <= (@x, @s);
            """;
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("x", xid);
        cmd.Parameters.AddWithValue("s", seq);
        cmd.Parameters.AddWithValue("sent", sentNow);
        cmd.Parameters.AddWithValue("n", (long)sent);
        await cmd.ExecuteNonQueryAsync(stop);
    }

    // Logged once per problem (not every minute during a long outage) and kept for the Settings screen.
    private async Task ProblemAsync(string? why, Exception? ex)
    {
        if (why == _lastProblem)
            return;
        if (why == null)
        {
            if (_lastProblem != "")
                _logger.LogInformation("Sync: upload is working again");
        }
        else if (ex != null)
            _logger.LogWarning(ex, "Sync: upload is waiting: {Why}", why);
        else
            _logger.LogWarning("Sync: upload is waiting: {Why}", why);
        _lastProblem = why;
        try
        {
            await using var conn = new NpgsqlConnection(_settings.ConnectionString);
            await conn.OpenAsync();
            await SyncSchema.ExecAsync(conn, "UPDATE sync_state SET lasterror = @e, lastattemptat = now() WHERE id = 1", ("e", (object?)why ?? DBNull.Value));
        }
        catch
        {
            // the database itself is unavailable; the log has it
        }
    }

    private static string Shorten(string s) => s.Length > 300 ? s[..300] + "..." : s;
}

public static class SyncHeaders
{
    public const string Branch = "X-Sync-Branch";
    public const string Key = "X-Sync-Key";
}
