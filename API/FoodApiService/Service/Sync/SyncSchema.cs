using Npgsql;

namespace FoodApiService.Service.Sync;

// Run once at API start (Branch and Cloud mode only; Standalone is left exactly as before).
//
// Both:   sync_seq, columns syncxid / syncseq on every synced table, the status tables.
// Branch: triggers that stamp each insert / update with the writing transaction and a running number,
//         a log of deleted rows, and the id range of this branch.
// Cloud:  drops the foreign keys of the synced tables (rows arrive in the order they changed on the
//         branch, which is not always parent-first) and the unique username index (two branches may
//         both have a "cashier"). Online the data is only read, so nothing depends on them there.
public static class SyncSchema
{
    public static async Task EnsureAsync(SyncSettings settings, ILogger logger)
    {
        if (!settings.IsBranch && !settings.IsCloud)
            return;

        await using var conn = new NpgsqlConnection(settings.ConnectionString);
        await conn.OpenAsync();

        await ExecAsync(conn, """
            CREATE SEQUENCE IF NOT EXISTS sync_seq;

            -- Branch: rows deleted here, so the online server deletes them too.
            CREATE TABLE IF NOT EXISTS sync_deleted (
                syncseq   bigint PRIMARY KEY DEFAULT nextval('sync_seq'),
                syncxid   bigint NOT NULL DEFAULT pg_current_xact_id()::text::bigint,
                tablename text   NOT NULL,
                rowid     bigint NOT NULL,
                branchid  integer,
                deletedat timestamp without time zone NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_sync_deleted_sync ON sync_deleted (syncxid, syncseq);

            -- Branch: how far the upload got (one row).
            CREATE TABLE IF NOT EXISTS sync_state (
                id            integer PRIMARY KEY,
                cursorxid     bigint  NOT NULL DEFAULT 0,
                cursorseq     bigint  NOT NULL DEFAULT 0,
                lastattemptat timestamp with time zone,
                lastsentat    timestamp with time zone,
                lasterror     text,
                sentrows      bigint  NOT NULL DEFAULT 0
            );
            INSERT INTO sync_state (id) VALUES (1) ON CONFLICT DO NOTHING;

            -- Cloud: when each branch last uploaded (shown to the owner).
            CREATE TABLE IF NOT EXISTS sync_branch_status (
                branchid     integer PRIMARY KEY,
                lastuploadat timestamp with time zone,
                lastrows     integer NOT NULL DEFAULT 0,
                totalrows    bigint  NOT NULL DEFAULT 0,
                skippedrows  bigint  NOT NULL DEFAULT 0
            );
            """);

        foreach (var t in SyncTables.All)
            await ExecAsync(conn, $"ALTER TABLE {t.Quoted} ADD COLUMN IF NOT EXISTS syncxid bigint, ADD COLUMN IF NOT EXISTS syncseq bigint;");

        if (settings.IsBranch)
            await PrepareBranchAsync(conn, settings, logger);
        else
            await PrepareCloudAsync(conn, logger);
    }

    private static async Task PrepareBranchAsync(NpgsqlConnection conn, SyncSettings settings, ILogger logger)
    {
        int branch = settings.BranchId;
        if (branch < 1 || branch > SyncTables.MaxBranchId)
            throw new InvalidOperationException($"Sync:BranchId must be 1..{SyncTables.MaxBranchId} in appsettings.json (it is {branch}).");
        if (await ScalarAsync<long>(conn, "SELECT count(*) FROM branch WHERE branchid = @b", ("b", branch)) == 0)
            throw new InvalidOperationException($"Sync:BranchId is {branch}, but this database has no branch with id {branch}. Run Database/Branch/03-branch-add-branch.sql first.");

        await ExecAsync(conn, """
            CREATE OR REPLACE FUNCTION sync_stamp() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                NEW.syncxid := pg_current_xact_id()::text::bigint;
                NEW.syncseq := nextval('sync_seq');
                RETURN NEW;
            END $$;

            CREATE OR REPLACE FUNCTION sync_log_delete() RETURNS trigger LANGUAGE plpgsql AS $$
            DECLARE r jsonb := to_jsonb(OLD);
            BEGIN
                INSERT INTO sync_deleted (tablename, rowid, branchid)
                VALUES (TG_TABLE_NAME, (r ->> TG_ARGV[0])::bigint, (r ->> 'branchid')::integer);
                RETURN OLD;
            END $$;
            """);

        foreach (var t in SyncTables.All)
        {
            string ix = "ix_sync_" + t.Name.ToLowerInvariant();
            await ExecAsync(conn, $"""
                DROP TRIGGER IF EXISTS sync_stamp ON {t.Quoted};
                CREATE TRIGGER sync_stamp BEFORE INSERT OR UPDATE ON {t.Quoted} FOR EACH ROW EXECUTE FUNCTION sync_stamp();
                DROP TRIGGER IF EXISTS sync_delete ON {t.Quoted};
                CREATE TRIGGER sync_delete AFTER DELETE ON {t.Quoted} FOR EACH ROW EXECUTE FUNCTION sync_log_delete('{t.Key}');
                CREATE INDEX IF NOT EXISTS {ix} ON {t.Quoted} (syncxid, syncseq);
                UPDATE {t.Quoted} SET syncseq = NULL WHERE syncxid IS NULL;
                """);
        }

        await ApplyRangesAsync(conn, branch, logger);
    }

    // New rows of this branch get ids from its own range. Refuses to start when ids already went past it.
    private static async Task ApplyRangesAsync(NpgsqlConnection conn, int branch, ILogger logger)
    {
        long start = SyncTables.RangeStart(branch);
        long end = start + SyncTables.RangeSize;
        foreach (var t in SyncTables.All.Where(t => t.Ranged))
        {
            string? seq = await ScalarAsync<string?>(conn, "SELECT pg_get_serial_sequence(@t, @c)", ("t", t.Quoted), ("c", t.Key));
            if (seq == null)
            {
                logger.LogWarning("Sync: {Table}.{Key} has no id generator; its new rows are not range-checked", t.Name, t.Key);
                continue;
            }

            long max = await ScalarAsync<long>(conn, $"SELECT coalesce(max(\"{t.Key}\"), 0) FROM {t.Quoted}");
            if (max >= end)
                throw new InvalidOperationException(
                    $"Table {t.Name} has ids up to {max}, past the range of branch {branch} ({start}..{end - 1}). Is Sync:BranchId right for this database?");

            long last = await ScalarAsync<long>(conn, $"SELECT last_value FROM {seq}");
            if (last < start)
                await ExecAsync(conn, "SELECT setval(@s::regclass, @v, false)", ("s", seq), ("v", start));
            else if (last >= end)
                throw new InvalidOperationException($"The id generator of {t.Name} is at {last}, past the range of branch {branch}.");

            long foreign = await ScalarAsync<long>(conn,
                $"SELECT count(*) FROM {t.Quoted} WHERE \"{t.Key}\" >= @r AND (\"{t.Key}\" < @s OR \"{t.Key}\" >= @e)",
                ("r", SyncTables.RangeSize), ("s", start), ("e", end));
            if (foreign > 0)
                logger.LogWarning("Sync: {Table} holds {Count} row(s) from another branch's id range; they are not uploaded from here", t.Name, foreign);
        }
        logger.LogInformation("Sync: branch {Branch}, new ids from {Start}", branch, start);
    }

    private static async Task PrepareCloudAsync(NpgsqlConnection conn, ILogger logger)
    {
        var names = SyncTables.All.Select(t => t.Name).ToArray();
        var drops = new List<string>();
        await using (var cmd = new NpgsqlCommand("""
            SELECT format('ALTER TABLE %s DROP CONSTRAINT %I', c.conrelid::regclass, c.conname)
            FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace
            WHERE c.contype = 'f' AND n.nspname = 'public' AND r.relname = ANY(@names)
            """, conn))
        {
            cmd.Parameters.AddWithValue("names", names);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                drops.Add(reader.GetString(0));
        }
        foreach (var sql in drops)
            await ExecAsync(conn, sql);
        if (drops.Count > 0)
            logger.LogInformation("Sync (online): removed {Count} foreign key(s) of the synced tables", drops.Count);

        await ExecAsync(conn, "DROP INDEX IF EXISTS ux_user_username_lower;");
        // Columns kept on the branch (passwords) arrive empty.
        foreach (var t in SyncTables.All.Where(t => t.Private != null))
            foreach (var c in t.Private!)
                await ExecAsync(conn, $"ALTER TABLE {t.Quoted} ALTER COLUMN \"{c}\" DROP NOT NULL;");
        foreach (var t in SyncTables.All)
            await ExecAsync(conn, $"DROP TRIGGER IF EXISTS sync_stamp ON {t.Quoted}; DROP TRIGGER IF EXISTS sync_delete ON {t.Quoted};");
    }

    internal static async Task ExecAsync(NpgsqlConnection conn, string sql, params (string Name, object Value)[] args)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var (name, value) in args)
            cmd.Parameters.AddWithValue(name, value);
        await cmd.ExecuteNonQueryAsync();
    }

    internal static async Task<T> ScalarAsync<T>(NpgsqlConnection conn, string sql, params (string Name, object Value)[] args)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var (name, value) in args)
            cmd.Parameters.AddWithValue(name, value);
        object? result = await cmd.ExecuteScalarAsync();
        return result is null or DBNull ? default! : (T)Convert.ChangeType(result, Nullable.GetUnderlyingType(typeof(T)) ?? typeof(T));
    }
}
