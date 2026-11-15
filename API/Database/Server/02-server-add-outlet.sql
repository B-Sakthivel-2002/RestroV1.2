-- =====================================================================
-- 02-server-add-outlet.sql  -  ONLINE server: the customer's outlet
--
-- The outlet is the restaurant group (e.g. A2B); its branches belong to it.
-- Run once on the online database after 01-server-setup.sql.
-- Use the SAME values in 02-branch-add-outlet.sql on every branch database,
-- so the outlet has the same id everywhere.
-- Change the values below, then run the whole file. Running it again with
-- the same id updates the outlet.
-- =====================================================================
DO $$
DECLARE
    v_outletid integer := 1;              -- normally 1 (one customer per online database)
    v_name     text    := 'A2B';
    v_code     text    := 'A2B';          -- short code, unique
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
    RAISE NOTICE 'Outlet % (%) is ready on the online server', v_outletid, v_name;
END $$;
