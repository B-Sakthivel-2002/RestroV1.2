-- =====================================================================
-- 02-branch-add-outlet.sql  -  BRANCH server: the customer's outlet
--
-- Run once on the branch database after 01-branch-setup.sql.
-- Use EXACTLY the same values as 02-server-add-outlet.sql on the online
-- server (same id, name and code).
-- Change the values below, then run the whole file.
-- =====================================================================
DO $$
DECLARE
    v_outletid integer := 1;              -- same as on the online server
    v_name     text    := 'A2B';
    v_code     text    := 'A2B';
    v_phone    text    := '';
    v_email    text    := '';
BEGIN
    IF v_outletid < 1 THEN
        RAISE EXCEPTION 'v_outletid must be 1 or more';
    END IF;
    IF trim(v_name) = '' THEN
        RAISE EXCEPTION 'Set v_name';
    END IF;

    INSERT INTO outlet (outletid, outletname, code, phone, email, status)
    VALUES (v_outletid, trim(v_name), nullif(trim(v_code), ''), nullif(trim(v_phone), ''), nullif(trim(v_email), ''), true)
    ON CONFLICT (outletid) DO UPDATE
        SET outletname = EXCLUDED.outletname, code = EXCLUDED.code,
            phone = EXCLUDED.phone, email = EXCLUDED.email, status = true;

    PERFORM setval(pg_get_serial_sequence('outlet', 'outletid'), (SELECT max(outletid) FROM outlet));
    RAISE NOTICE 'Outlet % (%) is ready on this branch server', v_outletid, v_name;
END $$;
