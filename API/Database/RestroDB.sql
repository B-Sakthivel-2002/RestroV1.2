-- =====================================================================
-- RestroDB.sql  -  complete database for FoodApiService (PostgreSQL 13+)
--
-- HOW TO USE
--   1. Create an empty database, e.g.   CREATE DATABASE restro;
--   2. Connect to it and run this whole file (pgAdmin Query Tool / psql -f).
--   3. Set ConnectionStrings:SSConnectionString in appsettings.json to it.
--   4. Start the API and log in as:   A2B / super123
--      (outlet owner of A2B). Then set up from the app: categories (Status On),
--      items, tax, floors and tables, and open the day before taking orders.
--
-- Intended for a NEW, EMPTY database. It is safe to run again on the same
-- database (IF NOT EXISTS / ON CONFLICT DO NOTHING), but it never alters or
-- deletes rows that already exist. Running it again on an older database also
-- adds any tables/columns introduced since (e.g. waitlist_token, table states).
--
-- TENANCY MODEL
--   outlet 1..n  ->  branch 1..n
--   Nothing is shared between branches: every business table carries branchid
--   (menu: kitchen, categories, item, choice, itemchoice, mealtype; tax, discount,
--   extracharge, customers; floor, "Table", tablebookings, timeslots, waiter,
--   waitlist_token, table_history;
--   "user", userroles; workperiods, "Order", orderdetail, billheader, billdetail).
--   Only the built-in system lookups are shared (outletid NULL): ordertype, role.
--     Order type ids 1/2/3 are referenced directly by the UI and API.
--
-- ROLES
--   SuperAdmin = outlet owner: sees and manages every branch of their own outlet.
--   Admin      = branch head: sees and manages their own branch only.
--   Others     = staff of their own branch.
-- =====================================================================

BEGIN;

-- =====================================================================
-- SCHEMA
-- =====================================================================

CREATE TABLE IF NOT EXISTS outlet (
    outletid   serial,
    outletname varchar(100) NOT NULL,
    code       varchar(20),
    phone      varchar(15),
    email      varchar(100),
    status     boolean DEFAULT true,
    CONSTRAINT outlet_pkey PRIMARY KEY (outletid)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_outlet_code ON outlet (upper(code)) WHERE code IS NOT NULL;

CREATE TABLE IF NOT EXISTS branch (
    branchid     serial,
    branchname   varchar(100),
    addressline1 text,
    addressline2 text,
    city         varchar(100),
    country      varchar(100),
    phone1       varchar(15),
    phone2       varchar(15),
    email        varchar(100),
    website      varchar(100),
    outletid     integer,
    code         varchar(20),
    CONSTRAINT branch_pkey PRIMARY KEY (branchid),
    CONSTRAINT fk_branch_outlet FOREIGN KEY (outletid) REFERENCES outlet (outletid)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_branch_code ON branch (upper(code)) WHERE code IS NOT NULL;

-- Kitchens of a branch, each with its own KOT printer (Windows printer name as installed on the
-- API computer, e.g. "EPSON TM-T82" or a shared one "\\KITCHEN-PC\EPSON").
CREATE TABLE IF NOT EXISTS kitchen (
    kitchenid   serial,
    kitchenname varchar(100) NOT NULL,
    printername varchar(200),
    status      boolean NOT NULL DEFAULT true,
    outletid    integer,
    branchid    integer NOT NULL,
    CONSTRAINT kitchen_pkey PRIMARY KEY (kitchenid),
    CONSTRAINT fk_kitchen_branch FOREIGN KEY (branchid) REFERENCES branch (branchid) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_kitchen_branch_name ON kitchen (branchid, lower(kitchenname));

CREATE TABLE IF NOT EXISTS categories (
    categoryid   serial,
    categoryname varchar(100),
    branchid     integer,
    flag         boolean NOT NULL DEFAULT false,
    outletid     integer,
    CONSTRAINT categories_pkey PRIMARY KEY (categoryid)
);

CREATE TABLE IF NOT EXISTS item (
    itemid       serial,
    categoryid   integer NOT NULL,
    itemname     varchar(100),
    description  text,
    defaultprice numeric,
    qty          integer,
    code         varchar(100),
    outletid     integer,
    branchid     integer,
    active       boolean DEFAULT true,
    CONSTRAINT item_pkey PRIMARY KEY (itemid),
    CONSTRAINT fk_category FOREIGN KEY (categoryid) REFERENCES categories (categoryid) ON DELETE CASCADE
);

-- The kitchen whose printer gets this item's KOT. Required by the item screen; items saved before
-- kitchens existed (NULL) print on PrinterSettings:KitchenPrinter in appsettings.json.
ALTER TABLE item ADD COLUMN IF NOT EXISTS kitchenid integer;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_item_kitchen') THEN
        ALTER TABLE item ADD CONSTRAINT fk_item_kitchen FOREIGN KEY (kitchenid) REFERENCES kitchen (kitchenid);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS choice (
    choiceid     serial,
    choicename   varchar(100),
    description  text,
    isfree       boolean,
    additioncost numeric,
    outletid     integer,
    branchid     integer,
    CONSTRAINT choice_pkey PRIMARY KEY (choiceid)
);

CREATE TABLE IF NOT EXISTS itemchoice (
    itemchoiceid serial,
    itemid       integer NOT NULL,
    choiceid     integer NOT NULL,
    description  text,
    price        numeric,
    outletid     integer,
    branchid     integer,
    CONSTRAINT itemchoice_pkey PRIMARY KEY (itemchoiceid),
    CONSTRAINT fk_choice FOREIGN KEY (choiceid) REFERENCES choice (choiceid) ON DELETE CASCADE,
    CONSTRAINT fk_item FOREIGN KEY (itemid) REFERENCES item (itemid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customers (
    customerid    serial,
    name          varchar(100),
    contactnumber varchar(15),
    email         varchar(100),
    address       text,
    outletid      integer,
    branchid      integer,
    CONSTRAINT customers_pkey PRIMARY KEY (customerid)
);

CREATE TABLE IF NOT EXISTS discount (
    discountid          serial,
    discountname        varchar(100),
    discountrate        numeric,
    discounttype        varchar(200),
    discountfrom        numeric(18,2),
    discountto          numeric(18,2),
    discountrangestatus boolean,
    outletid            integer,
    branchid            integer,
    CONSTRAINT discount_pkey PRIMARY KEY (discountid)
);

CREATE TABLE IF NOT EXISTS extracharge (
    extrachargeid     integer GENERATED ALWAYS AS IDENTITY,
    extrachargename   varchar(100),
    extrachargerate   numeric(18,2),
    extrachargefrom   numeric(18,2),
    extrachargeto     numeric(18,2),
    extrachargetype   varchar(200),
    extrachargestatus boolean,
    outletid          integer,
    branchid          integer,
    ordertypeid       integer,
    CONSTRAINT extracharge_pkey PRIMARY KEY (extrachargeid)
);

CREATE TABLE IF NOT EXISTS tax (
    taxid          serial,
    taxname        varchar(100),
    taxrate        numeric,
    taxfrom        numeric(18,2),
    taxto          numeric(18,2),
    taxtype        varchar(200),
    taxrangestatus boolean,
    outletid       integer,
    branchid       integer,
    CONSTRAINT tax_pkey PRIMARY KEY (taxid)
);

CREATE TABLE IF NOT EXISTS mealtype (
    mealtypeid   serial,
    mealtypename varchar(100),
    outletid     integer,
    branchid     integer,
    CONSTRAINT mealtype_pkey PRIMARY KEY (mealtypeid)
);

CREATE TABLE IF NOT EXISTS ordertype (
    ordertypeid   serial,
    ordertypename varchar(100),
    outletid      integer,
    branchid      integer,
    status        boolean DEFAULT true,
    CONSTRAINT ordertype_pkey PRIMARY KEY (ordertypeid)
);

CREATE TABLE IF NOT EXISTS role (
    roleid      serial,
    rolename    varchar(100) NOT NULL,
    description text,
    status      boolean DEFAULT true,
    outletid    integer,
    branchid    integer,
    CONSTRAINT role_pkey PRIMARY KEY (roleid)
);

CREATE TABLE IF NOT EXISTS floor (
    floorid     serial,
    branchid    integer NOT NULL,
    floorname   varchar(100),
    capacity    integer,
    description text,
    status      boolean,
    outletid    integer,
    CONSTRAINT floor_pkey PRIMARY KEY (floorid),
    CONSTRAINT fk_branch FOREIGN KEY (branchid) REFERENCES branch (branchid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Table" (
    tableid     serial,
    floorid     integer NOT NULL,
    tablename   varchar(100),
    description text,
    status      boolean,
    outletid    integer,
    branchid    integer,
    capacity    integer     NOT NULL DEFAULT 4,
    tablestate  varchar(20) NOT NULL DEFAULT 'Available',
    statesince  timestamp without time zone,
    CONSTRAINT "Table_pkey" PRIMARY KEY (tableid),
    CONSTRAINT fk_floor FOREIGN KEY (floorid) REFERENCES floor (floorid) ON DELETE CASCADE
);

-- Seating columns, added for databases created before table states existed.
-- tablestate: Available | Occupied | Reserved | Cleaning | Blocked
-- (a table with open orders is always shown as Occupied, whatever is stored here).
ALTER TABLE "Table" ADD COLUMN IF NOT EXISTS capacity   integer     NOT NULL DEFAULT 4;
ALTER TABLE "Table" ADD COLUMN IF NOT EXISTS tablestate varchar(20) NOT NULL DEFAULT 'Available';
ALTER TABLE "Table" ADD COLUMN IF NOT EXISTS statesince timestamp without time zone;

-- Table merge: a table joined to another one points at it; its orders are billed on that table.
ALTER TABLE "Table" ADD COLUMN IF NOT EXISTS mergedinto integer;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_table_mergedinto') THEN
        ALTER TABLE "Table" ADD CONSTRAINT fk_table_mergedinto FOREIGN KEY (mergedinto) REFERENCES "Table" (tableid) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS timeslots (
    timeslotid serial,
    starttime  timestamp without time zone,
    endtime    timestamp without time zone,
    outletid   integer,
    branchid   integer,
    CONSTRAINT timeslots_pkey PRIMARY KEY (timeslotid)
);

CREATE TABLE IF NOT EXISTS tablebookings (
    bookingid      serial,
    tableid        integer NOT NULL,
    timeslotid     integer NOT NULL,
    bookingdate    timestamp without time zone,
    numberofguests integer,
    status         boolean,
    customerid     integer,
    outletid       integer,
    branchid       integer,
    CONSTRAINT tablebookings_pkey PRIMARY KEY (bookingid),
    CONSTRAINT fk_table FOREIGN KEY (tableid) REFERENCES "Table" (tableid) ON DELETE CASCADE,
    CONSTRAINT fk_timeslot FOREIGN KEY (timeslotid) REFERENCES timeslots (timeslotid) ON DELETE CASCADE
);

CREATE SEQUENCE IF NOT EXISTS login_userid_seq;
CREATE TABLE IF NOT EXISTS "user" (
    userid   integer NOT NULL DEFAULT nextval('login_userid_seq'::regclass),
    username varchar(100) NOT NULL,
    password varchar(255) NOT NULL,
    status   boolean DEFAULT true,
    branchid integer,
    outletid integer,
    CONSTRAINT login_pkey PRIMARY KEY (userid)
);
ALTER SEQUENCE login_userid_seq OWNED BY "user".userid;
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_username_lower ON "user" (lower(username));

CREATE TABLE IF NOT EXISTS userroles (
    userroleid serial,
    userid     integer NOT NULL,
    roleid     integer NOT NULL,
    outletid   integer,
    branchid   integer,
    CONSTRAINT userroles_pkey PRIMARY KEY (userroleid)
);

CREATE TABLE IF NOT EXISTS waiter (
    waiterid      serial,
    waitername    varchar(100),
    shift         varchar(50),
    contactnumber varchar(15),
    datejoined    date,
    status        boolean,
    outletid      integer,
    branchid      integer,
    CONSTRAINT waiter_pkey PRIMARY KEY (waiterid)
);

CREATE TABLE IF NOT EXISTS workperiods (
    id       integer GENERATED ALWAYS AS IDENTITY,
    date     date NOT NULL,
    openedat timestamp without time zone NOT NULL,
    closedat timestamp without time zone,
    status   varchar(20) DEFAULT 'open'::character varying,
    openedby integer,
    closedby integer,
    branchid integer NOT NULL,
    outletid integer,
    CONSTRAINT workperiods_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "Order" (
    orderid         serial,
    waiterid        integer NOT NULL,
    ordernumber     varchar(50),
    tableid         integer,
    timedate        timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customerid      integer,
    bookingid       integer,
    qty             integer,
    price           numeric,
    totalprice      numeric,
    billingid       integer,
    ordertypeid     integer,
    status          varchar,
    printed_f       boolean,
    complimentary_f boolean,
    comments        varchar(100),
    remarks         varchar(100),
    branchid        integer,
    createdby       integer,
    businessdate    timestamp without time zone,
    outletid        integer,
    guestlabel      varchar(30),
    CONSTRAINT "Order_pkey" PRIMARY KEY (orderid)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_order_branch_ordernumber ON "Order" (branchid, ordernumber);

-- Split bill: orders of one table are grouped per guest and billed separately (NULL = first guest).
-- Added for databases created before split bill existed.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS guestlabel varchar(30);

CREATE TABLE IF NOT EXISTS orderdetail (
    orderdetailid serial,
    orderid       integer NOT NULL,
    itemid        integer NOT NULL,
    qty           integer NOT NULL,
    price         numeric(10,2) NOT NULL,
    sumofprice    numeric,
    "KOTStatus"   varchar,
    outletid      integer,
    branchid      integer,
    CONSTRAINT orderdetail_pkey PRIMARY KEY (orderdetailid),
    CONSTRAINT fk_order FOREIGN KEY (orderid) REFERENCES "Order" (orderid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS billheader (
    billid              serial,
    billnumber          varchar(50) NOT NULL,
    datetime            timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customerid          integer,
    phone               varchar(15),
    address             text,
    billname            varchar(100),
    gstin               varchar(15),
    notes               text,
    totalamount         numeric(10,2) DEFAULT 0,
    subtotal            numeric(10,2) DEFAULT 0,
    tax                 numeric(10,2) DEFAULT 0,
    extraamount         numeric(10,2) DEFAULT 0,
    discount            numeric(10,2) DEFAULT 0,
    taxid               integer,
    discountid          integer,
    paidamount          numeric(18,2),
    paymentmode         varchar(100),
    status              varchar(100),
    created_by          integer,
    iscomplementary     boolean,
    complementaryreason varchar(500),
    branchid            integer,
    updatedby           integer,
    lifecyclestatus     varchar(100),
    businessdate        timestamp without time zone,
    outletid            integer,
    CONSTRAINT billheader_pkey PRIMARY KEY (billid)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_billheader_branch_billnumber ON billheader (branchid, billnumber);

CREATE TABLE IF NOT EXISTS billdetail (
    billdetailid  serial,
    billid        integer NOT NULL,
    orderid       integer NOT NULL,
    taxid         integer,
    discountid    integer,
    extraamountid integer,
    outletid      integer,
    branchid      integer,
    CONSTRAINT billdetail_pkey PRIMARY KEY (billdetailid),
    CONSTRAINT fk_bill FOREIGN KEY (billid) REFERENCES billheader (billid) ON DELETE CASCADE,
    CONSTRAINT fk_order FOREIGN KEY (orderid) REFERENCES "Order" (orderid) ON DELETE CASCADE
);

-- Per-branch, per-business-day counter for race-free order/bill numbers.
CREATE TABLE IF NOT EXISTS doc_sequence (
    branchid  integer     NOT NULL,
    doctype   varchar(10) NOT NULL,
    bizdate   date        NOT NULL,
    lastvalue integer     NOT NULL,
    CONSTRAINT doc_sequence_pkey PRIMARY KEY (branchid, doctype, bizdate)
);

-- Walk-in waitlist: one token per waiting party, numbered T-001.. per branch and business day.
-- status: Waiting -> Called (table held for them) -> Seated, or Cancelled / NoShow.
CREATE TABLE IF NOT EXISTS waitlist_token (
    tokenid      serial,
    tokencode    varchar(20)  NOT NULL,
    bizdate      date         NOT NULL,
    customername varchar(100) NOT NULL,
    mobile       varchar(20)  NOT NULL,
    email        varchar(150),
    guests       integer      NOT NULL,
    notes        text,
    status       varchar(20)  NOT NULL DEFAULT 'Waiting',
    tableid      integer,
    assignmode   varchar(10),
    createdat    timestamp without time zone NOT NULL DEFAULT now(),
    calledat     timestamp without time zone,
    seatedat     timestamp without time zone,
    closedat     timestamp without time zone,
    createdby    integer,
    updatedby    integer,
    outletid     integer,
    branchid     integer      NOT NULL,
    CONSTRAINT waitlist_token_pkey PRIMARY KEY (tokenid),
    CONSTRAINT ck_waitlist_token_guests CHECK (guests > 0),
    CONSTRAINT fk_waitlist_token_branch FOREIGN KEY (branchid) REFERENCES branch (branchid) ON DELETE CASCADE,
    CONSTRAINT fk_waitlist_token_table FOREIGN KEY (tableid) REFERENCES "Table" (tableid) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_waitlist_token_code ON waitlist_token (branchid, bizdate, tokencode);
-- A table can be held for only one token at a time (blocks double assignment under concurrency).
CREATE UNIQUE INDEX IF NOT EXISTS ux_waitlist_token_table_held ON waitlist_token (tableid) WHERE status = 'Called';
CREATE INDEX IF NOT EXISTS ix_waitlist_token_queue ON waitlist_token (branchid, bizdate, status);

-- Everything that happens to a table: state changes, token holds, seating, transfers, merges.
CREATE TABLE IF NOT EXISTS table_history (
    historyid      serial,
    tableid        integer     NOT NULL,
    event          varchar(30) NOT NULL,
    fromstate      varchar(20),
    tostate        varchar(20),
    relatedtableid integer,
    tokenid        integer,
    orderid        integer,
    notes          text,
    userid         integer,
    createdat      timestamp without time zone NOT NULL DEFAULT now(),
    outletid       integer,
    branchid       integer     NOT NULL,
    CONSTRAINT table_history_pkey PRIMARY KEY (historyid),
    CONSTRAINT fk_table_history_table FOREIGN KEY (tableid) REFERENCES "Table" (tableid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_table_history_table ON table_history (tableid, createdat DESC);

-- =====================================================================
-- SEED DATA
-- =====================================================================

-- Outlets and branches ------------------------------------------------
-- One outlet with its first branch (the SuperAdmin's home branch: orders, bills and
-- day open/close happen there). Add more branches from the Branch screen.
INSERT INTO outlet (outletid, outletname, code, status) VALUES
    (1, 'A2B', 'A2B', true)
ON CONFLICT DO NOTHING;

INSERT INTO branch (branchid, branchname, city, country, outletid, code) VALUES
    (1, 'A2B Chennai', 'Chennai', 'India', 1, 'A2BCHN')
ON CONFLICT DO NOTHING;

-- Global lookups ------------------------------------------------------
-- Role names must match [Authorize(Roles = ...)] in the API and the UI route guards.
INSERT INTO role (roleid, rolename, description, status) VALUES
    (1, 'SuperAdmin',    'Outlet owner - all branches of own outlet', true),
    (2, 'Admin',         'Branch head - own branch', true),
    (3, 'Captain',       'Own branch', true),
    (4, 'Chef',          'Own branch', true),
    (5, 'Cashier',       'Own branch', true),
    (6, 'Manager',       'Own branch', true),
    (7, 'Waiter',        'Own branch', true),
    (8, 'Kitchen Staff', 'Own branch', true)
ON CONFLICT DO NOTHING;

-- Ids 1/2/3 are hardcoded in the UI routes and API.
-- "Takeaway" / "Homedelivery" names are matched by the takeaway / home delivery screens.
INSERT INTO ordertype (ordertypeid, ordertypename, status) VALUES
    (1, 'Dine-in',      true),
    (2, 'Takeaway',     true),
    (3, 'Homedelivery', true)
ON CONFLICT DO NOTHING;




-- User (password stored in plain text, as the current login expects) ----
--   A2B / super123   SuperAdmin (outlet owner of A2B, home branch A2B Chennai)
INSERT INTO "user" (userid, username, password, status, branchid, outletid) VALUES
    (1, 'A2B', 'super123', true, 1, 1)
ON CONFLICT DO NOTHING;

INSERT INTO userroles (userroleid, userid, roleid, branchid, outletid) VALUES
    (1, 1, 1, 1, 1)
ON CONFLICT DO NOTHING;

-- Move every id generator past the explicitly seeded ids ---------------
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT * FROM (VALUES
        ('outlet', 'outletid'), ('branch', 'branchid'), ('kitchen', 'kitchenid'), ('categories', 'categoryid'),
        ('item', 'itemid'), ('choice', 'choiceid'), ('itemchoice', 'itemchoiceid'),
        ('customers', 'customerid'), ('discount', 'discountid'), ('tax', 'taxid'),
        ('mealtype', 'mealtypeid'), ('ordertype', 'ordertypeid'), ('role', 'roleid'),
        ('floor', 'floorid'), ('"Table"', 'tableid'), ('timeslots', 'timeslotid'),
        ('tablebookings', 'bookingid'), ('"user"', 'userid'), ('userroles', 'userroleid'),
        ('waiter', 'waiterid'), ('"Order"', 'orderid'), ('orderdetail', 'orderdetailid'),
        ('billheader', 'billid'), ('billdetail', 'billdetailid')) AS v(tbl, col)
    LOOP
        EXECUTE format(
            'SELECT setval(pg_get_serial_sequence(%L, %L), GREATEST((SELECT coalesce(max(%I), 0) FROM %s), 1), (SELECT count(*) > 0 FROM %s))',
            r.tbl, r.col, r.col, r.tbl, r.tbl);
    END LOOP;
END $$;

COMMIT;
