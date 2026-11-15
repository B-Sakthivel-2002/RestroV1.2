-- =====================================================================
-- 04-server-add-user.sql  -  ONLINE server: a login for the online view
--
-- Run on the online database, once per login. Branch logins are copied online
-- WITHOUT their passwords, so whoever should see the online reports gets a
-- login here:
--   SuperAdmin = the owner: sees every branch of the outlet
--   Admin      = a branch head: sees only v_branchid
-- The online server is view only for every login.
--
-- The password is stored as typed and turned into a one-way hash when the
-- online API starts: RESTART the online IIS site after running this, before
-- signing in. Then put the password back to CHANGE_ME in this file.
-- These logins get ids from 2,100,000,000 up, which no branch ever uses.
-- =====================================================================
DO $$
DECLARE
    v_username text    := 'a2b_owner';
    v_password text    := 'CHANGE_ME';
    v_role     text    := 'SuperAdmin';     -- SuperAdmin or Admin
    v_branchid integer := 1;                -- home branch (Admin: the only branch they see)
    v_userid   integer;
    v_roleid   integer;
    v_outletid integer;
BEGIN
    IF v_password = 'CHANGE_ME' OR length(v_password) < 6 THEN
        RAISE EXCEPTION 'Set v_password (6 characters or more) first';
    END IF;
    IF trim(v_username) = '' THEN
        RAISE EXCEPTION 'Set v_username';
    END IF;
    IF v_role NOT IN ('SuperAdmin', 'Admin') THEN
        RAISE EXCEPTION 'v_role must be SuperAdmin or Admin';
    END IF;
    SELECT roleid INTO v_roleid FROM role WHERE rolename = v_role;
    SELECT outletid INTO v_outletid FROM branch WHERE branchid = v_branchid;
    IF v_outletid IS NULL THEN
        RAISE EXCEPTION 'No branch with id % (run 03-server-add-branch.sql first)', v_branchid;
    END IF;
    IF EXISTS (SELECT 1 FROM "user" WHERE lower(username) = lower(trim(v_username)) AND password IS NOT NULL) THEN
        RAISE EXCEPTION 'Online login % already exists', v_username;
    END IF;

    SELECT GREATEST(coalesce(max(userid), 0) + 1, 2100000000) INTO v_userid FROM "user" WHERE userid >= 2100000000;
    INSERT INTO "user" (userid, username, password, status, branchid, outletid)
    VALUES (v_userid, trim(v_username), v_password, true, v_branchid, v_outletid);

    INSERT INTO userroles (userroleid, userid, roleid, branchid, outletid)
    SELECT GREATEST(coalesce(max(userroleid), 0) + 1, 2100000000), v_userid, v_roleid, v_branchid, v_outletid
    FROM userroles WHERE userroleid >= 2100000000;

    RAISE NOTICE 'Online login % (%) created. Restart the online API before signing in.', v_username, v_role;
END $$;
