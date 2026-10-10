# Verification record and checklist

## Supabase migration — 10 October 2026

- Working runtime/schema connection: Supabase session pooler. Direct IPv6 runtime address was unreachable from this Windows computer and was replaced locally.
- Fresh private SQLite export and file backup retained. Imported original member (1), membership (1), event (1), inventory items (3), transactions (2), ticket (1), tasks (3), announcement (1); other migrated tables were empty. Counts and identifiers match; ledger balance preserved.
- All 17 application tables have RLS enabled and SELECT revoked for Supabase anon/authenticated roles.
- Temporary hosted records verified concurrent final-seat booking, duplicate rejection, active-member/guest pricing, QR token generation, cancellation, FIFO held offers, expiry/next-person promotion, reminder deduplication and atomic one-time check-in. All temporary records were removed and source counts rechecked.
- npm run verify passed PostgreSQL schema validation, TypeScript and the production build using .next-supabase-release.
- Browser: public event listing loads the migrated Spring Gala from Supabase. App runs locally on port 3001; this is not public hosting.
- Local reminder/waitlist worker runs against Supabase. No cloud scheduler is configured.
- Resend API key authenticated successfully, but no sending domain is verified. Outbound email disabled locally by blank EMAIL_FROM. Actual email delivery remains unverified.
- First staff account created from owner-supplied local credentials. Browser sign-in succeeded against Supabase; staff administration and event management pages loaded. Browser sign-out returned to login and revoked its Supabase session (zero remaining sessions). One-time BOOTSTRAP_PASSWORD removed from .env. No credentials or account details published. Physical-camera scanning, public hosting, cloud scheduling and gateway payments remain outside these verification results.

## Event and account expansion — earlier SQLite results

Verified in an isolated SQLite copy, without changing the club's saved records:

- Browser: account sign-in, member final-seat registration at the member price,
  private QR display, waitlist position, cancellation with QR removal, reserved
  offer and claim, staff attendance count, wrong-event rejection, valid check-in,
  and duplicate check-in rejection with the recorded entry time.
- Business checks: two concurrent last-seat requests produced one registration;
  duplicate booking and taking another user's held seat were rejected; FIFO
  promotion and expiry/next-person promotion worked; guest/member pricing was
  selected by membership; two job runs created one reminder notice and email row.
- Anonymous attendee export returned 403; a job without the secret returned 401;
  forged role/session cookies redirected personal event access to login.
- SQLite schema and offline PostgreSQL schema validation passed.
- Final `npm run verify` passed schema validation, TypeScript, page generation,
  and production file tracing with `.next-event-final` (10 October 2026).
- The local job command ran and accurately reported email was not configured.

At that stage, hosted database checks were pending; the migration results above supersede that limitation. Physical-camera scanning, actual Resend delivery, public hosting and cloud scheduling remain unverified. No payment gateway was added.

The older results below are historical. The practice role selector has been
replaced, and the previously missing event-specific check-in/reporting is now built.

Date: 10 October 2026. This record distinguishes observed results from planned
checks. It does not claim an automated business-workflow test suite exists.

## Confirmed for this publication checkout

- `npm ci` succeeded using the committed lockfile.
- Its postinstall hook originally generated a custom Prisma Client; the release
  correction now generates Prisma Client 6.19.3 in `node_modules/@prisma/client`.
- `npm run typecheck` completed successfully.
- `npm run verify` passed Prisma validation and TypeScript checks, then correctly exited with code 1 on the production build error. Its tracing failure involved the Windows Cookies directory; the direct build failure involved Application Data.
- `.env`, SQLite files, generated Prisma output, and node_modules are ignored by Git.
- The direct Windows-only SWC dependency was removed from package.json and the lockfile regenerated.
- Installation audit reported 12 vulnerabilities: 2 moderate, 9 high, 1 critical.
  These have not been remediated; upgrading is separate release work.

## Earlier browser checks on the source workspace

These checks were observed on the matching application code in a local development
preview. They are not a claim that all routes and mutations were retested from a
fresh published clone.

- Member search changed the visible results and showed an empty-state message.
- Changing merchandise quantity changed the total before submission.
- Selecting Staff redirected to the overview and updated the displayed role.
- An unknown ticket code produced a visible rejection without changing saved tickets.
- Mobile navigation opened, linked to a page, and closed.
- Saving a task with its existing status succeeded without changing its status.
- Success confirmation stayed visible through the data refresh after the feedback-provider fix.
- The ledger and noticeboard rendered their saved records and forms.
- No browser console errors were observed in the checked preview session.

## Production build

The earlier source-workspace build failed during Windows file tracing with an
EPERM scandir error involving `C:\Users\mahes\Application Data`. A successfully
rendered development server is not evidence of a successful production build.
The publication checkout reproduced that failure: `npm run build` exited with code 1 during file tracing, followed by a webpack action-assets error.

### Release correction, 10 October 2026

- Switched the application and seed to the standard `@prisma/client` import.
- Bounded Next.js tracing to the application directory and resolved the source
  alias from the config file location.
- `npm run db:generate` succeeded without resetting or seeding the database.
- `SKYLINE_DIST_DIR=.next-production-fixed npm run build` completed successfully,
  including TypeScript validation, page generation, and file tracing.
- Started that build with `npm start -- --port 3002`.
- Read-only HTTP requests returned 200 for `/`, `/login`, `/members`, `/events`,
  `/events/check-in`, `/merchandise`, `/fundraisers`, `/treasurer`, and `/announcements`.
- A Prisma read confirmed one member, one event, and two transactions in this
  checkout's SQLite file. This is not a claim about another checkout's data.

The production build and local startup are now verified. Public deployment,
full mutation checks, and cross-device behavior remain unverified. No saved
records were reset or reseeded during this correction.

## Reproducible verification command

From `skyline`, create the local `.env`, install dependencies, and run:

```powershell
npm run verify
```

This command runs Prisma validation, TypeScript checking, then Next.js production
build. It stops at the first failure and does not report unrun checks as passed.
Build output defaults to `.next-verify` to avoid corrupting the active dev directory.
It does not reset or seed the database, and it is not a unit or end-to-end test suite.

## Manual workflow checklist: not completed as a full suite

Use a disposable local database. The existing seed command deletes club data.

- Add a member; verify duplicate emails are rejected.
- Record dues; verify membership and DUES income change together.
- Repeat activation while membership is active; verify no second dues entry.
- Create a future event and confirm active-member versus guest pricing.
- Book the last seat; confirm another booking is rejected.
- Check in a newly booked ticket; confirm second entry is rejected.
- Confirm event-specific door validation is still missing, rather than claiming it passed.
- Order a size variant; check its stock and ledger income.
- Submit above-stock and concurrent orders; verify no negative stock or partial order records.
- Move a task to another column; confirm task and overview counts update.
- Publish a notice; confirm the noticeboard and dashboard show it.
- Submit an expense; confirm it is pending and balance is unchanged.
- Approve as Treasurer; confirm balance changes exactly once.
- Check fresh-clone setup, phone layouts, keyboard navigation, empty states, and error recovery.

No automatic concurrency test, payment-provider verification, email delivery
verification, receipt-upload test, or live deployment check has been completed.
