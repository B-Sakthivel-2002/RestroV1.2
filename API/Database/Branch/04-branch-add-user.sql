-- =====================================================================
-- 04-branch-add-user.sql  -  BRANCH server: a login of this branch
--
-- Run on the branch database after 03-branch-add-branch.sql, once per login
-- (the first one is usually the branch head, role Admin; more staff can then
-- be added from the Users screen of the app).
-- These logins work on this branch server only. They are copied to the online
-- server WITHOUT the password, so they cannot sign in online
-- (online logins: 04-server-add-user.sql).
--
-- The password is stored as typed and turned into a one-way hash when the
-- branch API starts: RESTART the branch API after running this, before the
-- user signs in. Then put the password back to CHANGE_ME in this file.
-- =====================================================================
DO $$
DECLARE
    v_username     text    := 'chennai_admin';
    v_password     text    := 'CHANGE_ME';
    v_role         text    := 'Admin';      -- Admin, Manager, Cashier, Captain, Waiter, Chef, Kitchen Staff, SuperAdmin
    v_branchid     integer := 1;            -- this branch
    v_setup_branch bigint;
    v_roleid       integer;
    v_outletid     integer;
    v_userid       integer;
BEGIN
    IF v_password = 'CHANGE_ME' OR length(v_password) < 6 THEN
        RAISE EXCEPTION 'Set v_password (6 characters or more) first';
    END IF;
    IF trim(v_username) = '' THEN
        RAISE EXCEPTION 'Set v_username';
    END IF;
    EXECUTE format('SELECT last_value / 60000000 FROM %s', pg_get_serial_sequence('billheader', 'billid')) INTO v_setup_branch;
    IF v_setup_branch <> v_branchid THEN
        RAISE EXCEPTION 'This database belongs to branch %, not %', v_setup_branch, v_branchid;
    END IF;
    SELECT outletid INTO v_outletid FROM branch WHERE branchid = v_branchid;
    IF v_outletid IS NULL THEN
        RAISE EXCEPTION 'No branch with id % (run 03-branch-add-branch.sql first)', v_branchid;
    END IF;
    SELECT roleid INTO v_roleid FROM role WHERE rolename = v_role;
    IF v_roleid IS NULL THEN
        RAISE EXCEPTION 'Unknown role % (see the list next to v_role)', v_role;
    END IF;
    IF EXISTS (SELECT 1 FROM "user" WHERE lower(username) = lower(trim(v_username))) THEN
        RAISE EXCEPTION 'Login % already exists on this branch server', v_username;
    END IF;

    -- Ids come from this branch's range (set by 01-branch-setup.sql).
    INSERT INTO "user" (username, password, status, branchid, outletid)
    VALUES (trim(v_username), v_password, true, v_branchid, v_outletid)
    RETURNING userid INTO v_userid;

    INSERT INTO userroles (userid, roleid, branchid, outletid)
    VALUES (v_userid, v_roleid, v_branchid, v_outletid);

    RAISE NOTICE 'Login % (%) created. Restart the branch API before signing in.', v_username, v_role;
END $$;
