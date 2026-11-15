-- =====================================================================
-- 03-branch-add-branch.sql  -  BRANCH server: this shop's own branch
--
-- Run once on the branch database after 02-branch-add-outlet.sql.
-- v_branchid must be the SAME as in 01-branch-setup.sql, on the online server
-- (03-server-add-branch.sql) and in "Sync": { "BranchId": ... } of this
-- server's appsettings.json. The script refuses a different id.
-- Only this branch is added here; the online server holds all branches.
-- Change the values below, then run the whole file.
-- =====================================================================
DO $$
DECLARE
    v_branchid     integer := 1;              -- this branch (1..34)
    v_name         text    := 'A2B Chennai';  -- same name and code as on the online server
    v_code         text    := 'A2BCHN';
    v_city         text    := 'Chennai';
    v_outletid     integer := 1;
    v_address1     text    := '';
    v_address2     text    := '';
    v_phone        text    := '';
    -- Features of this branch (can also be changed later on the Branch screen)
    v_expressstall boolean := false;          -- Express Stall order screen
    v_ordercancel  boolean := false;          -- settled bills may be cancelled
    v_orderedit    boolean := false;          -- settled bills may be reopened and edited
    v_setup_branch bigint;
BEGIN
    IF v_branchid < 1 OR v_branchid > 34 THEN
        RAISE EXCEPTION 'v_branchid must be 1..34 (it is %)', v_branchid;
    END IF;
    -- The id range set by 01-branch-setup.sql tells which branch this database is.
    EXECUTE format('SELECT last_value / 60000000 FROM %s', pg_get_serial_sequence('billheader', 'billid')) INTO v_setup_branch;
    IF v_setup_branch <> v_branchid THEN
        RAISE EXCEPTION 'This database was set up for branch % (01-branch-setup.sql), not %', v_setup_branch, v_branchid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM outlet WHERE outletid = v_outletid) THEN
        RAISE EXCEPTION 'No outlet with id % (run 02-branch-add-outlet.sql first)', v_outletid;
    END IF;

    INSERT INTO branch (branchid, branchname, city, country, outletid, code, addressline1, addressline2, phone1,
                        expressstall, ordercancel, orderedit)
    VALUES (v_branchid, trim(v_name), trim(v_city), 'India', v_outletid, nullif(trim(v_code), ''),
            nullif(trim(v_address1), ''), nullif(trim(v_address2), ''), nullif(trim(v_phone), ''),
            v_expressstall, v_ordercancel, v_orderedit)
    ON CONFLICT (branchid) DO UPDATE
        SET branchname = EXCLUDED.branchname, city = EXCLUDED.city, outletid = EXCLUDED.outletid,
            code = EXCLUDED.code, addressline1 = EXCLUDED.addressline1, addressline2 = EXCLUDED.addressline2,
            phone1 = EXCLUDED.phone1, expressstall = EXCLUDED.expressstall,
            ordercancel = EXCLUDED.ordercancel, orderedit = EXCLUDED.orderedit;

    PERFORM setval(pg_get_serial_sequence('branch', 'branchid'), (SELECT max(branchid) FROM branch));
    RAISE NOTICE 'Branch % (%) is ready on this branch server', v_branchid, v_name;
END $$;
