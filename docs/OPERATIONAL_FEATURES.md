# Skyline operational features and acceptance

Updated: 11 October 2026. Work was performed in the local clone at E:\Odoo-apex-main\Odoo-apex-main. Styling is preserved. Payment-provider work remains paused.

## 1. Assigned volunteers update their own tasks

1. Sign in as approved Staff and open Volunteers.
2. Expand Add a volunteer task.
3. Enter a title (3–200 characters), optional notes (up to 3,000 characters), optional future date, and the volunteer from the member directory.
4. Add task. Its initial state is To do.
5. The assigned volunteer signs in with the account linked to that directory identity and opens Volunteers.
6. That task exposes its status selector. Choose In progress or Done, then Update status.
7. The saved task moves columns, counts change, and dashboard data is revalidated.
8. Another volunteer can read the board but cannot change this task. Staff can update every task.

Assignment uses the linked Member ID; an unlinked directory person cannot sign in merely because their name appears on the board. Account approval and email verification are required. Changing status does not grant edit/assignment permissions or send automatic volunteer email.

## 2. Treasurer filters and CSV reports

1. Sign in as Treasurer and open Finance.
2. Use From date, To date, Currency, Category, Status, Entry type and Description contains.
3. Date filters use UTC calendar days. To date includes that entire UTC day.
4. Click Apply filters. The URL preserves the selection.
5. Filtered balance is matching posted income minus matching posted expenses, within each currency.
6. Pending requests appear in Awaiting review but do not change the balance. Rejected, voided and test entries are excluded from posted totals.
7. The table shows 25 rows per page; Previous and Next preserve filters.
8. Export filtered CSV downloads every matching entry, up to 10,000, rather than only the visible page.
9. Clear restores the complete ledger.
10. Invalid dates, reversed ranges, unknown filters and repeated query-parameter values are rejected. Broader reports exceeding 10,000 entries require narrower filters; totals are not silently truncated.

CSV columns: ID, Created at (UTC), Type, Category, Description, Amount, Currency, Status, Claimant, Reviewer, Reviewed at (UTC), Decision reason. Amount is decimal numeric text plus a separate currency column. Names and descriptions are quoted/escaped and formula-leading fields are protected for spreadsheets. Downloads are private and not cached. CSV contains financial/personal data; keep it private.

The server route is /api/finance/export. Member, Staff, signed-out, unverified, pending, rejected and disabled accounts cannot use it. The report is accounting visibility; approval does not transfer money.

## 3. Staff receives and adjusts merchandise stock

1. Sign in as Staff, open More → Club shop.
2. Add a product/size variant first if none exists.
3. Expand Receive or adjust merchandise stock.
4. Select the exact product and size. Its currently available stock is shown.
5. Enter a positive whole quantity to receive stock, or a negative whole quantity to remove stock.
6. Enter a reason of 3–300 characters, such as New supplier delivery or Damaged at collection desk.
7. Click Record stock adjustment.
8. Resulting stock must remain between 0 and 1,000,000. Zero adjustment, decimals, excessive quantities and invalid reasons are rejected.
9. Recent adjustments show Date, Product/size, Change, Before → after, Reason and recorded Staff.
10. A network retry using the same submission key cannot apply the adjustment twice. Reusing that key with changed input is rejected. A fresh intentional adjustment has a new submission key.
11. Concurrent stock operations use a transaction and conditional update; conflicting changes cannot overwrite each other or make stock negative.

Only approved, verified Staff can adjust stock. Merchandise orders keep their original price snapshots. Adjustments do not create finance entries or implement customer returns/cancellations. Recent audit history displays the latest 30 adjustments.

## 4. Private receipt uploads

### Configuration

The app uses its existing authentication, not Supabase Auth. Keep the server credential in skyline/.env, never in a NEXT_PUBLIC variable, documentation or Git.

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-key
SUPABASE_RECEIPTS_BUCKET=skyline-receipts
```

The key must be this project's legacy service_role key or a server secret key. An anon/publishable key is rejected. Run from skyline:

```powershell
npm run storage:setup
```

This creates/configures a private bucket allowing PDF, PNG and JPEG only, maximum 2 MB. An existing public bucket causes setup and file operations to fail closed. Public policies/anonymous access must not be added to the receipt bucket. The setup is configuration work, not a startup requirement.

### User workflow

1. Any approved, verified role opens My account → Submit a club expense. Treasurer can also use the Finance form.
2. Choose a private receipt file: PDF, PNG or JPEG, nonempty and up to 2 MB.
3. Enter description, positive amount (up to 100,000 with at most two decimals), and USD or INR.
4. Leave Receipt link empty when using a file. Alternatively use a validated HTTPS link with no file; supplying both is rejected.
5. Submit for review. Success creates one pending claim and stores receipt metadata; it does not post an expense or send money.
6. The claimant's My expense requests includes Open receipt. Treasurer sees the same protected link in Finance.
7. Open receipt downloads through /api/receipts/EXPENSE_ID, with an authenticated account-state and ownership check on every request.
8. Only the claimant or an approved, verified Treasurer can download. Other Members and Staff receive no file, even if they know the URL. Signed-out users receive 401.
9. The browser gets a download response with private/no-store, attachment disposition, nosniff and sandbox headers. It never receives the Supabase server key or a public/signed storage URL.
10. Treasurer reviews the request using the existing approve/reject controls; self-review is still blocked.

Content signatures and declared MIME types must agree; executable HTML/SVG, mismatched types, empty files and oversized files are rejected. Signature checking is not malware scanning; add scanning/quarantine before production if required. The server-action body limit is 3 MB to accommodate a 2 MB receipt plus form fields. Larger requests can be rejected before the action executes.

Repeated submissions use a claimant-scoped key plus a payload/file hash. A matching retry returns the existing outcome; changed content under the same key is rejected. Failed upload creates no claim. If saving the claim fails, the new unlinked upload is removed when its lack of ownership can be confirmed. A process crash or ambiguous database outage can leave a private orphan object; reconcile storage against receiptPath references before deleting any objects. Never bulk-delete the bucket.

External HTTPS links retain their external access policy; only uploaded files use this private access flow.

## 5. Event access and display repairs

- Attendee export checks verified, approved, active Staff directly in the Route Handler.
- CSV includes the stored currency and payment mode, rather than labelling all ticket amounts USD.
- Rejected former Staff, pending/unverified accounts and disabled users cannot export attendees.
- Public event browsing works for signed-in pending/unverified accounts. Registration, waitlist, ticket history and other operational routes remain gated.
- Staff event-create/manage/check-in shortcuts are not exposed to ineligible accounts.
- Registration guidance points to OTP and designated Staff approval; no manual Staff email-verification bypass is implied.
- Event, ticket, notification, door and waitlist timestamps use the campus timezone. Default: Asia/Kolkata. NEXT_PUBLIC_CLUB_TIME_ZONE sets the build-time display zone; rebuild after changing it.
- Date entry still converts the user's local datetime to an ISO instant. Calendar files retain UTC instants so calendar applications display the attendee's local time. Finance date filtering/export timestamps explicitly use UTC.

## 6. Verification and actual boundaries

Run these against an isolated database when possible. They create narrowly identified disposable fixtures and remove their exact records. Do not run multiple fixture suites concurrently: their baseline-preservation checks expect stable data.

```powershell
npm run typecheck
npm run lint
npm run format:check
npm run verify:operations
npm run verify:finance
npm run verify:events
npm run verify:basics
npm run verify:otp
npm run verify:email
```

verify:operations covers task ownership, stock limits/audit/retries/concurrency, expense idempotency, private download ownership, file rejection, upload failures/compensation, finance filters/UTC boundaries, attendee account-state and currency/mode labels, formula escaping, timezone stability and exact fixture cleanup. Its receipt transport is an in-memory adapter, not a claim of real provider acceptance.

For actual private Storage acceptance, after configuration:

```powershell
npm run verify:receipts -- --base-url http://localhost:3001
```

The app must be running for the HTTP portion. This uploads a harmless temporary PDF, checks real byte-identical owner/Treasurer downloads, denies unauthorized users and anonymous public URLs, then removes its exact object, claim, sessions and users. It does not send mail or collect money.

For an explicitly authorized real email check:

```powershell
npm run email:acceptance -- --send --to YOUR_APPROVED_MAILBOX
```

This dispatches only that unique test-message key; it does not flush other queued mail. SMTP acceptance and inbox receipt are separate. The owner confirmed the 11 October test reached Inbox. That establishes transport/inbox acceptance for this test message; real registration OTP, password-reset and reminder journeys remain separate manual cases.

The private JSON backup covers database receipt metadata and stock audit records, not the receipt file bytes. Plan a separate encrypted Storage backup and restore rehearsal. The schema change is recorded in skyline/prisma/changes/20261011-operational-features.sql and is additive; existing records were retained.

## 7. Local run

```powershell
cd E:\Odoo-apex-main\Odoo-apex-main\skyline
npm ci
npm run db:generate
npm run dev -- --port 3001
```

Do not reset or seed the database to start the app. Stop the current app and worker before dependency installation/Prisma regeneration. Use npm run build then npm run start -- --port 3001 for a production-style local run. Run the reminder worker separately only when its recipients/jobs are authorized.

Manual procedures: MANUAL_TESTING_GUIDE.md, cases TC82–TC91. Remaining release work is listed in COMPLETION_CHECKLIST.md. Payment refund/webhook work, physical camera acceptance, framework upgrades, HTTPS deployment, unattended scheduling, and full backup restore remain separate completion gates.

## Form startup safety

Forms use POST and remain disabled until JavaScript hydration attaches their submit handler. A disabled-JavaScript browser gets an explicit enable-JavaScript message; login fields cannot fall back to a credential-bearing GET URL. A named empty receipt file is rejected, while leaving the file selector empty is valid for an optional receipt. These behaviors are included in final rendered-HTML/browser acceptance.

For an older PostgreSQL deployment requiring this exact additive change, the database owner can apply skyline/prisma/changes/20261011-operational-features.sql through Prisma db execute using the generated PostgreSQL schema, then use npm run db:push to synchronize table security and regenerate the client. Back up and review first; do not use accept-data-loss to bypass an unexplained schema warning.

## Database connection bounds

The application uses a bounded Prisma PostgreSQL pool (default 3 connections per process). DATABASE_CONNECTION_LIMIT accepts a whole number from 1 to 5; an existing explicit pool_timeout is retained, otherwise 10 seconds is used. SQLite URLs are unchanged. Restart the app after changing the setting. Keep a single local app instance and run database fixture suites sequentially; the Supabase session pool is shared with workers and administrative tools. Do not print connection URLs in diagnostics.

Stop the app/worker before npm ci. Do not run concurrent dependency installations in the same folder or edit database records during fixture-preservation checks. The app was observed failing to resolve framework and TypeScript dependencies while node_modules was being replaced; dependencies must remain stable throughout verification.

Optional file inputs are normalized before multipart encoding: unselected unnamed empty browser placeholders are omitted, while selected named empty files still reach server validation and are rejected. This distinction was verified through the actual browser expense form.

Next.js build-worker concurrency is set to one for reliable builds on the local laptop. Stop the dev server before building; an earlier multi-worker build failed from low available system memory, and the complete single-worker rerun passed.
