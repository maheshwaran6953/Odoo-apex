# Verification record and checklist

Date: 10 October 2026. This record distinguishes observed results from planned
checks. It does not claim an automated business-workflow test suite exists.

## Confirmed for this publication checkout

- `npm ci` succeeded using the committed lockfile.
- Its postinstall hook generated Prisma Client 6.19.3 in `src/generated/prisma`.
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
The publication checkout reproduced that failure: `npm run build` exited with code 1 during file tracing, followed by a webpack action-assets error. Production build and live deployment remain unverified.

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
