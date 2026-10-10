# Skyline event workflow and Supabase setup

## What is implemented

- Real email/password accounts: scrypt password hashes, opaque seven-day sessions
  stored as hashes, HTTP-only cookies, production Secure cookies, session revocation,
  per-email failed-login throttling, and server-side role/ownership checks.
- Registration, email verification and password reset with expiring one-use tokens.
  Verification/reset messages are queued; they are not claimed delivered without a provider.
- Staff-controlled role assignment, account disabling, and explicit in-person
  identity/email confirmation. There is no public role switcher or automatic staff signup.
- Public event discovery with search and Upcoming/Past/Cancelled/All filters.
- Event schedule, organizer contact, registration deadline, calendar download,
  editable details, attendee change notices, and event cancellation.
- One registration per verified account per event. Member pricing is based on the
  linked membership on the server. Seat allocation is serialized per event, with retries.
- Personal registrations and tickets; QR display/download, backup code, printing,
  ownership checks, and cancellation with QR revocation.
- Camera QR decoding using @zxing/browser, manual/keyboard scanner fallback,
  selected-event verification, atomic single check-in, and duplicate entry rejection.
- Staff attendee search, status filters, pagination, CSV export with formula escaping,
  attendance counts, registered ticket value, and check-in history.
- FIFO waitlist, positions, leaving, automatic offers on cancellation/capacity changes,
  reserved seat offers lasting up to two hours, claim, expiry, and next-person promotion.
- In-app event reminders within 24 hours of the start, registration/change/cancellation
  notices, waitlist offers, unread state, email preferences, and deduplication.
- Resend email outbox with claims, retry limits, provider idempotency keys, stale-message
  cancellation, error visibility, and explicit status for unconfigured delivery.
- Local reminder worker and protected scheduler endpoint. Event views refresh every
  20 seconds while visible; this is polling, not a streaming connection.

Payments remain simulated. A PAID ticket in this prototype means a confirmed local
registration, not a gateway settlement. Cancellation voids its linked simulated
income entry; no real refund is performed. Legacy tickets without linked ledger IDs
require treasurer reconciliation. A verified matching member can claim legacy
registrations; older duplicate tickets for the same event remain visible to staff.

## Routes

Public: `/events`, `/events/[eventId]`, `/login`, `/register`, `/forgot-password`,
`/reset-password`, `/verify-email`, and event calendar downloads.

Personal: `/my-events`, `/tickets/[ticketId]`, `/notifications`, `/account`.

Staff: `/events/[eventId]/manage`, `/events/check-in`, `/admin/users`.
Members directory: Staff or Treasurer. Full ledger: Treasurer. Expense submission
remains available from My account. Other club modules require a valid account.

Ticket entry opens 12 hours before an event and closes 12 hours after its start.
Cancelled or checked-in registrations cannot be used for entry. The public event
page never displays attendee email addresses or registration lists.

## Run locally without deleting club records

From `skyline`:

```powershell
npm ci
npm run db:push
# Do NOT seed an existing database.
npm run dev -- --port 3001
```

Stop this checkout's dev/production processes before generating Prisma on Windows;
the native engine DLL can be locked by a running server. The schema setup command
creates a missing SQLite file, changes the schema, and regenerates the client. It
never requests --accept-data-loss or resets the database. Existing records are retained.

New accounts start as Member. Create the first Staff account once by setting these
values privately in `.env`:

```dotenv
BOOTSTRAP_EMAIL="your-own-email"
BOOTSTRAP_NAME="your-name"
BOOTSTRAP_PASSWORD="a-unique-password-of-at-least-12-characters"
APP_URL="http://localhost:3001"
```

```powershell
npm run account:bootstrap
```

Remove BOOTSTRAP_PASSWORD after success, then sign in normally. The command refuses
an existing email and refuses to run when an enabled Staff account already exists.
Staff can assign roles and verify identity in `/admin/users`. A verified email is
linked to a matching club membership; being a registered account alone does not
create a paid membership.

The sample-data seed still deletes club sample records and is now blocked once
accounts exist. Use it only in a disposable database. No account passwords are seeded.

## Supabase: migrated and verified on 10 October 2026

Project URL supplied by the owner: https://webkrhiyflubauchtdgt.supabase.co

The active source workspace now uses Supabase PostgreSQL. The original direct runtime address was unreachable from this computer; both runtime and schema operations use the verified session pooler. The private SQLite export and database backup remain under skyline/backups. All original record counts, identifiers and the ledger balance match after import. RLS is enabled and anon/authenticated table reads are revoked on all 17 application tables. No credentials are committed.

The following is the repeatable migration procedure for a fresh target; do not rerun import on the populated database.

1. Stop writes and retain the SQLite file backup. With DATABASE_PROVIDER=sqlite,
   run `npm run db:export`. This creates an ignored private snapshot under `backups`.
   It contains personal records and password hashes: do not share or commit it.
2. Copy the connection strings from the Supabase project's Connect panel. For a
   serverless app, use the transaction pooler URL as DATABASE_URL and a reachable
   direct or session pooler URL as DIRECT_URL. URL-encode password characters when
   required. Do not put either credential in NEXT_PUBLIC variables.
3. Set these `.env` values:

```dotenv
DATABASE_PROVIDER="postgresql"
DATABASE_URL="the-runtime-postgresql-connection-string"
DIRECT_URL="the-schema-postgresql-connection-string"
```

4. Run `npm run db:push` against a new, empty dedicated database/schema. The script
   derives a PostgreSQL Prisma schema from the SQLite source model definitions,
   initializes tables, enables RLS, revokes access from Supabase anon/authenticated
   API roles, and generates the matching client. Prisma must use an owner/service
   database role. This app accesses data through its server, not browser Data API calls.
5. Run `npm run db:import`. Import refuses a nonempty target and is transactional.
   It preserves IDs, relations, timestamps, roles, password hashes and club records.
   Sessions and account verification/reset tokens are intentionally excluded.
6. Compare table counts and club balance, then validate account login, pricing,
   cancellation, capacity and QR entry against PostgreSQL before deployment.
7. Retain the SQLite backup until the hosted workflow is confirmed. Rollback means
   restoring DATABASE_PROVIDER=sqlite, the file connection, and regenerating the
   SQLite client. Writes made only in PostgreSQL are not automatically copied back.

PostgreSQL schema validation, hosted connection, data import, RLS/access checks and event concurrency checks passed. Public application deployment and a cloud scheduler remain pending.
The script uses Prisma 6.19.3; it does not upgrade Prisma during migration.

See the official integration guide: https://supabase.com/docs/guides/database/prisma

## Reminders and email delivery

In a second local terminal, with the same database environment:

```powershell
npm run events:watch
```

This processes due reminders and seat offers every five minutes. Keep the process
running; no background worker starts automatically with `npm run dev`. For one run:

```powershell
npm run events:jobs
```

Staff can also process reminders/offers in the event management page or User access.
Booking and cancellation transactions protect seats even between scheduler runs.
An expired offer stops reserving a seat at its deadline; the next offer is created
by the next job or seat mutation. Joining order is timestamp then ID.

For email, configure locally:

```dotenv
RESEND_API_KEY="your-private-key"
EMAIL_FROM="Skyline <events@your-verified-sending-domain>"
APP_URL="the-actual-https-app-address"
CRON_SECRET="a-long-random-secret"
```

Use a verified Resend sender. Run jobs or click Deliver queued emails. SENT means
accepted by the provider, not confirmed delivered to the recipient's inbox. Failed
messages retain an error and retry up to five times. Ambiguous retries beyond the
safe idempotency window are marked REVIEW. Old account links, expired offers and
obsolete reminders are cancelled before delivery. If no provider is configured,
in-app notices work and emails remain queued; the interface states this explicitly.

Schedule `GET` or `POST /api/jobs/events` every five minutes with
`Authorization: Bearer <CRON_SECRET>` using the chosen hosting scheduler. The
endpoint rejects calls without the secret. No cloud scheduler has been provisioned.

Provider guidance: https://resend.com/docs/dashboard/emails/idempotency-keys

## Current verification and limits

Verified locally in a private disposable SQLite database: sign-in; final-seat
registration; active-member price; personal QR display; waitlist position; cancellation
and QR revocation; offered seat reservation and claim; staff attendance counts;
wrong-event rejection; check-in; second-entry rejection; concurrent last-seat integrity;
FIFO offer order; expiry and next promotion; duplicate booking protection; held-seat
protection; one reminder per ticket/start time; anonymous export/job rejection; forged
role/session rejection. SQLite and PostgreSQL schema validation passed. Final `npm run verify` passed schema, TypeScript and production build checks. See
VERIFICATION.md for the complete local verification record.

Camera decoding is implemented but has not been exercised with a physical camera.
The Resend key was validated, but there are zero verified sending domains. EMAIL_FROM is blank locally to prevent failed delivery attempts; queued messages remain queued. With no owned domain/DNS access, production email delivery remains unavailable. In-app notifications and the local reminder/waitlist worker operate against Supabase. Actual provider acceptance/inbox delivery has not been tested.
Email webhook delivery tracking, MFA, password-policy administration, distributed
rate limiting, a production audit trail, actual payments and refunds are outside
this slice. Do not describe these as implemented.
