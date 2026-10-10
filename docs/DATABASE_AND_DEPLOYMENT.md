# Database and deployment notes

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

`npm ci` runs `prisma generate` via postinstall, producing the custom client at
`src/generated/prisma`. If installation scripts were disabled, run
`npm run db:generate` explicitly. Never commit this generated client or its
platform-specific engine binaries. Do not commit `.env` or SQLite database files.

The direct Windows-only SWC dependency was removed; Next.js selects its optional
platform dependency. Teammates should use the committed lockfile with `npm ci`.

The seed script deletes all existing club data before creating example records.
Do not run it to upgrade or repair an existing database. The seeded gala is dated
April 2026 and is now a past event; create a future event using the Staff UI to
use booking. Expiry and fundraiser dates are examples, not a current semester schedule.

## Current deployment status

Deployment is not complete. A Windows production build of the source workspace
failed during Next.js file tracing with an EPERM scandir error on
`C:\Users\mahes\Application Data`. Do not advertise the development preview as
an independently verified production deployment.

SQLite is a local file. A release must use persistent, writable storage shared
appropriately by the app, or migrate to a hosted database. An ephemeral filesystem
will not preserve club records reliably. The existing prototype also needs real
identity and stricter record ownership before handling real users.

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

- Resolve and reproduce a successful production build on the target environment.
- Review dependency audit findings before a production release; do not force-upgrade blindly.
- Set the deployment database URL and provision durable storage and backups.
- Initialize schema using a controlled setup process; do not reseed production.
- Verify role/login behavior, event booking, stock updates, and financial balances.
- Replace practice role switching before exposing real member information.
- Clearly retain simulated-payment labels unless payment settlement is implemented.
