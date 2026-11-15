# Offline branch servers + online view

Each branch bills on **its own server and database** in the shop. Billing, KOT, printing and the
take-away display never need the internet. One **online server per customer** receives a copy from
every branch so the owner can see bills, orders and sales from anywhere. The online server is
**view only**: nothing can be changed there.

```
Chennai PC: API (Sync:Mode Branch, BranchId 1) + PostgreSQL   ◄── LAN ── billing PCs / tablets / phones
        │  uploads new and changed rows about every minute (gzipped, only when something changed)
        ▼
Online server: API (Sync:Mode Cloud) + PostgreSQL, IIS site e.g. https://a2b.yourdomain.com  ◄── owner
        ▲
Madurai PC: API (Sync:Mode Branch, BranchId 2) + PostgreSQL   ◄── LAN ── billing devices
```

All servers run the same build. `"Sync"` in `appsettings.json` decides what each one is:

| Mode | Where | What it does |
|---|---|---|
| `Standalone` (default) | anywhere | As before: one server, no upload |
| `Branch` | PC in the shop | Full app. Uploads to the online server; without internet it waits and sends everything later |
| `Cloud` | IIS on the internet | Receives uploads. Reports, dashboard, bills and orders of every branch. Read only |

## How ids are kept apart

Every branch numbers new rows from its own range: branch N uses ids `N × 60,000,000` and up
(branch 1: 60,000,000…, branch 2: 120,000,000…). So the online database can hold every branch in the
same tables, and the existing reports work there unchanged. Branch ids **1 to 34** are possible per
customer. The API sets this up by itself at start-up (Branch mode) and refuses to start if
`Sync:BranchId` does not fit the database, so a wrongly set server can never mix up ids.

## Setting it up

Step-by-step instructions with checklists are in **Setup-Guide.pdf** (this folder). The scripts:

| Online server: `Server/` | Each branch PC: `Branch/` |
|---|---|
| `01-server-setup.sql`: all tables, removes the foreign keys / unique-username index (online copy only) | `01-branch-setup.sql`: all tables, sync triggers, this branch's id range (set `v_branchid` first) |
| `02-server-add-outlet.sql`: the customer | `02-branch-add-outlet.sql`: same outlet, same values |
| `03-server-add-branch.sql`: every branch, once each | `03-branch-add-branch.sql`: this branch only (refuses a different id) |
| `04-server-add-user.sql`: owner / branch-head login for the online view | `04-branch-add-user.sql`: logins of this branch |

`RestroDB.sql` stays the script for a single Standalone server (it includes the A2B sample outlet, branch and login).
The `Server/` and `Branch/` setup scripts hold the same tables without the sample data. When a table changes in
`RestroDB.sql`, change it in both setup scripts too.

appsettings.json, online server: `"Sync": { "Mode": "Cloud", "BranchKeys": { "1": "<key>", "2": "<key>" } }`
appsettings.json, branch server: `"Sync": { "Mode": "Branch", "BranchId": 2, "ServerUrl": "https://...", "Key": "<key>", "IntervalSeconds": 60 }`

Passwords typed into the add-user scripts are hashed when the API starts: restart that API after adding a login.
Branch logins reach the online server without their password and cannot sign in there.

## What is uploaded

Bills, orders and order lines; cash day and cash entries; work periods; customers; and the masters the
reports need (categories, items, choices, kitchens, meal types, order types, tax, discount, extra charges,
floors, tables, waiters, users without passwords, user roles, the branch row).
Not uploaded: waitlist tokens, table bookings, time slots, table history, number sequences.

Every insert, change and delete is recorded by database triggers on the branch. The upload sends them
in the order they happened, in batches of 500. The branch remembers what the online server has
accepted. If a batch fails, nothing is lost: the same rows are sent again next time. A branch key can
only send rows of its own branch. The online server refuses anything else.

## Checking it

- **Settings → Sync Status** (Admin / SuperAdmin): on a branch, "Up to date · last upload 1 min ago" or why it
  is waiting (no internet, wrong key, …). Online, every branch with its last upload, shown in red when it is
  more than 30 minutes old (the branch checks in every 15 minutes even when nothing changed).
- The dashboard shows the same in short.
- Branch log: `Sync: upload is waiting: …` once when a problem starts, `Sync: upload is working again` when it ends.

## WhatsApp while offline

Customer messages (order placed, payment received, …) are kept while the internet is down and retried
(30 s, growing to 5 min) until sent, for up to 6 hours. They are kept in memory, so messages still waiting
when the API restarts are lost.
