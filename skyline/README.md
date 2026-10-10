> Current repair/setup instructions: [Local runbook](../docs/LOCAL_RUNBOOK.md). Old review/demo data was removed. Do not run demo seed. New accounts require OTP verification and designated Staff approval; real OTP email delivery is currently deferred.

# Skyline Student Organization System

Members, events, merchandise, volunteer work, and club finances in one workspace.
The interface uses the existing Skyline glass-panel design on desktop and phones.

## Run the application

Use Node.js 20+ and npm. From this folder in PowerShell:

```powershell
Copy-Item .env.example .env # Only if .env does not already exist
npm ci
npm run db:push
npm run dev -- --port 3001
```

Open http://localhost:3001/events. Do not seed an existing club database. Stop this
checkout's running app before regenerating Prisma on Windows to avoid DLL locks.
`npm run db:seed` is optional for a disposable empty database and is blocked after
accounts exist. It deletes existing club sample records.

## Accounts and staff setup

The old practice role switcher has been replaced by account sign-in. New accounts
start as Member. Booking and waitlists require email verification or explicit staff
identity confirmation. Paid club membership is separate from account registration.

Configure BOOTSTRAP_EMAIL, BOOTSTRAP_NAME and BOOTSTRAP_PASSWORD privately in `.env`,
then run `npm run account:bootstrap` once to create the first Staff account. Use a
unique password of at least 12 characters and remove it from `.env` afterward.
Staff assigns other roles and confirms identities at `/admin/users`.

## Events, tickets and reminders

- `/events`: public discovery, filters, dates, availability and event details.
- `/my-events`: your registrations, waitlist positions and offered seats.
- `/tickets/[ticketId]`: private QR ticket, download, print and cancellation.
- `/events/[eventId]/manage`: Staff attendee list, CSV, attendance and event editing.
- `/events/check-in`: selected-event QR/camera or manual-code verification.
- `/notifications`: your saved changes, seat offers and reminders.
- `/account`: verification, email preferences and reimbursement submission.

Run `npm run events:watch` in a separate terminal for reminders and offer expiry
processing every five minutes. Staff can also trigger jobs manually. Email remains
queued until RESEND_API_KEY and EMAIL_FROM are configured. Camera scanning requires
HTTPS or localhost. Event views refresh every 20 seconds while visible.

Practice events retain simulated registration. INR events can now use Razorpay
Test Mode: a matching captured payment must be verified on the server before a QR
ticket is issued. Test transactions move no real money and do not increase posted
club income. Cancellation revokes the ticket immediately; a refund is a separate,
provider-confirmed operation. Live Razorpay keys are rejected.

`/payments` shows your checkout history. `/payments/[paymentId]` provides payment
status, bounded seat holds, retry/reconciliation and ticket links. Staff and
Treasurer use `/admin/payments` for reconciliation and full test refunds.

Read [payment setup and operation](../docs/PAYMENTS.md) and
[the implementation plan](../docs/PAYMENT_IMPLEMENTATION_PLAN.md).

## Database and Supabase

The active workspace uses Supabase PostgreSQL through its session pooler and
Prisma 6.19.3. Fresh checkouts default to SQLite (`prisma/dev.db`) until private
PostgreSQL connection strings are configured. The project URL alone does not grant
database access. Do not overwrite an existing `.env` or reseed an existing database.

Read [the complete setup and event guide](../docs/EVENTS_AND_SUPABASE.md) before
changing providers. It covers backups, staff bootstrap, migration, server-only table
access, email configuration, scheduler setup and the remaining deployment boundaries.

## Release commands

```powershell
npm run db:validate
npm run typecheck
$env:SKYLINE_DIST_DIR = '.next-build'
npm run build
# Only after a successful build, in the same terminal:
npm start -- --port 3001
```

Use the same SKYLINE_DIST_DIR for build and start. `npm run verify` runs schema,
TypeScript and build checks in an isolated output directory. Public deployment and
actual email delivery remain unverified until their services are configured.
