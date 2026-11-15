-- =====================================================================
-- 03-server-add-branch.sql  -  ONLINE server: one branch
--
-- Run once PER BRANCH on the online database (change the values each time).
-- The branch id is fixed for life and used in three places:
--   1. here,
--   2. 01-branch-setup.sql and 03-branch-add-branch.sql on that branch's PC,
--   3. "Sync": { "BranchId": ... } in that branch server's appsettings.json,
-- plus "Sync": { "BranchKeys": { "<id>": "<key>" } } in this server's appsettings.json.
-- Use 1..34, never reuse an id. Running it again with the same id renames it.
-- Do not add branches from the Branch screen once sync is used.
-- =====================================================================
DO $$
DECLARE
    v_branchid integer := 1;              -- 1..34
    v_name     text    := 'A2B Chennai';
    v_code     text    := 'A2BCHN';       -- short code, unique
    v_city     text    := 'Chennai';
    v_outletid integer := 1;              -- from 02-server-add-outlet.sql
BEGIN
    IF v_branchid < 1 OR v_branchid > 34 THEN
        RAISE EXCEPTION 'v_branchid must be 1..34 (it is %)', v_branchid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM outlet WHERE outletid = v_outletid) THEN
        RAISE EXCEPTION 'No outlet with id % (run 02-server-add-outlet.sql first)', v_outletid;
    END IF;

    INSERT INTO branch (branchid, branchname, city, country, outletid, code)
    VALUES (v_branchid, trim(v_name), trim(v_city), 'India', v_outletid, nullif(trim(v_code), ''))
    ON CONFLICT (branchid) DO UPDATE
        SET branchname = EXCLUDED.branchname, city = EXCLUDED.city,
            outletid = EXCLUDED.outletid, code = EXCLUDED.code;

    PERFORM setval(pg_get_serial_sequence('branch', 'branchid'), (SELECT max(branchid) FROM branch));
    RAISE NOTICE 'Branch % (%) is ready on the online server. Give it an upload key under Sync:BranchKeys:%', v_branchid, v_name, v_branchid;
END $$;
