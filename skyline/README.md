# Skyline Student Organization System

## Local setup

Requirements: Node 20+, npm, and SQLite through Prisma.

    cp .env.example .env
    npm install
    npx prisma generate
    npm run db:push
    npm run db:seed
    npm run dev

Open http://localhost:3000.

The prototype uses demo data and simulated payments. Do not add real credentials. The main build contract is in ../docs/SKYLINE_VIBE_CODING_SPEC.md.

## Useful checks

    npm run typecheck
    npm run build

The current vertical slice includes the dashboard, membership activation, merchandise stock, event ticketing, check-in, fundraiser tasks, treasurer ledger, and announcements.

## Club workspace UI

The app now shares a glass-panel layout, desktop sidebar, phone navigation drawer,
clear action feedback, and a consistent Skyline visual identity across all routes.
Dashboard figures come from the database; no static live counters are displayed.

- **Member desk:** browse members and tasks, book future events, order merchandise,
  read updates, and submit reimbursement requests.
- **Staff desk:** add members, record dues, create events, check tickets, assign
  volunteer tasks, change task status, and publish notices.
- **Treasurer desk:** record member dues, review the complete ledger, approve pending
  reimbursements, and publish notices.

Choose a practice role at `/login`. `Leave desk` clears the role and returns there.
This is a practice role switcher, not production authentication. Orders and tickets
record local payments only. Camera scanning, card charging, and email delivery
are not connected.

Members can be searched by name/email and filtered by membership status. Recording
dues activates membership for one year, with duplicate active dues rejected.
Merchandise sizes have independent stock, and changing quantity updates the shown
total. Ticket codes appear after booking and cannot be checked in twice. Expenses
stay pending until the treasurer approves them; only posted expenses affect cash.

Older events remain visible but cannot accept new bookings. To make an upcoming
event, switch to Staff, open Events & tickets, and expand “Put an event on the
calendar.” Existing database records do not need to be reset.

For an isolated preview without sharing the running app's build directory, use
PowerShell from this folder:

```powershell
$env:SKYLINE_DIST_DIR = '.next-preview'
npm run dev -- --port 3001
```

Use `.next-build` instead when verifying a build separately. Run `npm start` with
the same `SKYLINE_DIST_DIR` used for that build. Clear the override using
`Remove-Item Env:SKYLINE_DIST_DIR` to return to the default `.next` directory.
