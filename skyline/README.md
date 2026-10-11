# Skyline application

This folder contains the Next.js application for the Skyline Student Organization System. Updated: **11 October 2026**.

See the [repository README](../README.md) for the verified current tech stack, implemented features, role permissions, routes and limitations. Use the [local reference](../reference.md) and [local runbook](../docs/LOCAL_RUNBOOK.md) for detailed operation.

## Current stack

Next.js 14.2.35 App Router, React 18.3.1, TypeScript 5.9.3, Tailwind CSS 3.4.19/custom glass styling, Lucide React, Prisma 6.19.3 and **Supabase PostgreSQL**. Next.js Server Actions and Route Handlers provide the backend. Authentication uses custom cookie sessions and scrypt password hashes; it does not use JWT or Supabase Auth.

Ticket QR rendering uses qrcode.react; camera scanning uses @zxing/browser. OTP and queued email use Nodemailer/Gmail SMTP, with an optional Resend adapter. The tsx worker handles reminders and waitlists. Razorpay Test Mode work remains paused.

## Run the configured local app

From this folder:

```powershell
npm run dev -- --port 3001
```

Open http://localhost:3001/login. Stop with Ctrl+C. For first installation, configure the ignored `.env` first, then run:

```powershell
npm ci
npm run db:generate
npm run db:validate
npm run dev -- --port 3001
```

The current private configuration selects PostgreSQL. The checked-in example defaults to SQLite; do not overwrite an existing `.env`. The database wrapper generates the appropriate schema from `DATABASE_PROVIDER`, `DATABASE_URL` and `DIRECT_URL`.

Do not run seed/reset/bootstrap/import during normal startup. Demo seeding is disabled; existing accounts and dynamically entered records remain in Supabase. Only apply `npm run db:push` for an intentional reviewed schema change.

## Accounts and navigation

New users request MEMBER, STAFF or TREASURER access during registration, verify their email with OTP, then wait for the designated Staff account to approve the request. Ordinary Staff cannot approve roles. Paid club membership is separate from account approval.

Desktop has top navigation; mobile has bottom navigation. More contains other permitted pages. Members land at `/my-events`, Staff at `/`, and Treasurers at `/treasurer`. Server role/ownership checks protect restricted actions and private records.

## Worker and production run

In a separate terminal:

```powershell
npm run events:watch
```

OTP issuance attempts immediate delivery; queued updates and unattended reminders need background processing. SMTP authentication passed, but real recipient inbox delivery remains unverified. Camera scanning requires HTTPS or localhost.

For a production-style local run, stop the app server first:

```powershell
npm run build
npm run start -- --port 3001
```

Do not rebuild `.next` while its server is using it, or run two app servers on the same port. Stop app and worker before Prisma regeneration/reinstallation on Windows.

## Code checks

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run build
```

Scoped service checks: `verify:basics`, `verify:events`, `verify:finance`, `verify:otp`, `verify:email`. They create/clean temporary fixtures; simulated email checks do not prove inbox delivery. See [repair verification](../docs/REPAIR_VERIFICATION.md) for current evidence and [the repository README](../README.md#verification-and-current-limits) for remaining release work.

## Operational additions — 11 October 2026

Assigned volunteers update only their own status; Staff receives/corrects stock with audit records; Treasurer filters/exports finance; expense claims support private Supabase Storage files (PDF/PNG/JPEG, max 2 MB) and idempotent submission. See the repository docs/OPERATIONAL_FEATURES.md for full instructions.

Setup: npm run storage:setup after privately configuring SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_RECEIPTS_BUCKET. Verification: npm run verify:operations; npm run verify:receipts -- --base-url http://localhost:3001. The latter explicitly creates/removes a real temporary receipt and requires a running app. Never publish server keys.

Ordinary startup remains npm run dev -- --port 3001; do not reset or seed current data. One authorized email reached Inbox. Full manual coverage is 91 cases; service success does not imply all browser/device/provider acceptance is complete. Payments remain paused.
