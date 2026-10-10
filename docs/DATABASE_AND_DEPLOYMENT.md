# Database and deployment notes

For the current account, event, waitlist, reminder and Supabase setup, use
`EVENTS_AND_SUPABASE.md`. The active source workspace now uses Supabase PostgreSQL via its session pooler, migrated and checked on 10 October 2026. Fresh checkouts still default to SQLite until privately configured. Do not replace an existing `.env` or reseed club records.

## Fresh local checkout

Use Node.js 20 or newer with npm. From the repository root:

```powershell
cd skyline
Copy-Item .env.example .env
npm ci
npm run db:push
# Optional, only in a fresh/disposable database:
npm run db:seed
npm run dev
```

`npm ci` runs `prisma generate` via postinstall, producing the standard client in
`node_modules/@prisma/client`. If installation scripts were disabled, run
`npm run db:generate` explicitly. Never commit this generated client or its
platform-specific engine binaries. Do not commit `.env` or SQLite database files.

The direct Windows-only SWC dependency was removed; Next.js selects its optional
platform dependency. Teammates should use the committed lockfile with `npm ci`.

The seed script deletes all existing club data before creating example records.
Do not run it to upgrade or repair an existing database. The seeded gala is dated
April 2026 and is now a past event; create a future event using the Staff UI to
use booking. Expiry and fundraiser dates are examples, not a current semester schedule.

## Current deployment status

The Windows production build now succeeds (10 October 2026). Prisma uses its
standard client location, and Next.js file tracing is bounded to the application
directory. An isolated production server on port 3002 returned HTTP 200 for the
overview, login, members, events, door desk, merchandise, tasks, ledger, and
announcements. Prisma read the existing SQLite records successfully.

These are local release checks. Public hosting and deployment are not complete.

SQLite is a local file. A release must use persistent, writable storage shared
appropriately by the app, or migrate to a hosted database. An ephemeral filesystem
will not preserve club records reliably. The updated app has account identity and
ticket ownership checks. Hosted service configuration, PostgreSQL verification
and deployment hardening remain required.

## Isolate development and build output

```powershell
$env:SKYLINE_DIST_DIR = '.next-build'
npm run build
# Only after the build succeeds:
npm start
```

The same directory override must be used for build and start. Development can use
`.next-preview` on a separate port. Clear the override to return to `.next`:

```powershell
Remove-Item Env:SKYLINE_DIST_DIR
```

## Release work still required

- Reproduce the successful local production build on the chosen hosting environment.
- Review dependency audit findings before a production release; do not force-upgrade blindly.
- Set the deployment database URL and provision durable storage and backups.
- Initialize schema using a controlled setup process; do not reseed production.
- Verify role/login behavior, event booking, stock updates, and financial balances.
- Practice role switching has been replaced by account sign-in. Bootstrap the
  first Staff account privately and verify deployment access controls.
- Clearly retain simulated-payment labels unless payment settlement is implemented.
