# Skyline Student Organization System — Local Reference

Updated: 11 October 2026. This file describes the existing Skyline student organization project, not LoomFlow.

## 1. Quick start: the basic run command

Open PowerShell in the application folder:

```powershell
cd E:\Odoo-apex-main\Odoo-apex-main\skyline
npm run dev -- --port 3001
```

Open **http://localhost:3001/login**. Stop the server with **Ctrl+C**.

This is the normal development command when dependencies, Prisma Client and the private `.env` are already present. It watches source changes. If another Skyline server already occupies port 3001, stop that server first; do not stop unrelated Node processes.

### First run after cloning or restoring dependencies

The repository folder is `E:\Odoo-apex-main\Odoo-apex-main`; commands below run from its `skyline` subfolder.

```powershell
cd E:\Odoo-apex-main\Odoo-apex-main\skyline
node --version
npm --version
npm ci
npm run db:generate
npm run db:validate
npm run dev -- --port 3001
```

`npm ci` installs the versions recorded in package-lock.json. Its postinstall also generates Prisma Client; the explicit generate command is useful for troubleshooting. Internet access is required for installation, Supabase and outgoing email.

Keep the configured `.env` in `skyline`. A Git clone does not include private configuration. Do not run seed, bootstrap, import or reset during ordinary startup: the configured Supabase database already contains the initial accounts and subsequently entered records.

### Production-style local run

Stop the development/production server before building:

```powershell
cd E:\Odoo-apex-main\Odoo-apex-main\skyline
npm run build
npm run start -- --port 3001
```

Use either `dev` or `start` on port 3001. `start` needs a successful build and does not watch source changes. Never overwrite `.next` with a build while a production server is using it.

### Background jobs: reminders, waitlists and queued email

Open a second PowerShell terminal:

```powershell
cd E:\Odoo-apex-main\Odoo-apex-main\skyline
npm run events:watch
```

It processes immediately, then approximately every five minutes. Keep it running for unattended event processing. A single pass is:

```powershell
npm run events:jobs
```

The worker handles event updates, waitlist offers/expiry, reminders and queued messages. It also invokes the existing payment reconciliation code; payment development remains paused. Do not activate Razorpay events or Live Mode as part of this startup. Registration/resend dispatch their own OTP immediately and do not require this worker for that immediate attempt.

### Easier navigation

Skyline uses a top navigation bar on desktop and a fixed bottom bar on phones. Four frequent destinations are visible for each role:

- Member: My events, Events, Club shop, Volunteers.
- Staff: Overview, Events, Members, Volunteers.
- Treasurer: Finance, Members, Events, Overview.

Use **More** for the remaining permitted pages. Staff can reach Door check-in there; only the designated approving Staff account sees User access. My account, My updates and Sign out remain available in the header. More closes when a destination is selected, when clicking outside it, or with Escape. Existing server permission checks still protect restricted pages. Public visitors can browse Events and sign in.

## 2. What the application does

Skyline brings membership, event registration, attendance, club merchandise, volunteer tasks, notices and financial records into one workspace. Its operational records come from the database and user actions. There is no automatic demo seed on startup.

Example: Staff creates a campus workshop, a Member registers and receives a QR ticket, Staff verifies admission at the door, and the Treasurer sees the associated practice ledger entry. Separately, a student can submit an expense request for workshop supplies; another authorized Treasurer reviews it. Recording approval does not transfer money to a bank account.

## 3. Actual technology stack

| Area                  | Technology in this repository                               | Purpose                                                                   |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| Application framework | Next.js 15 App Router                                       | Pages, routing, server rendering and server operations in one application |
| Frontend              | React 18 and TypeScript 5                                   | Typed components, forms and interactive browser controls                  |
| Styling               | Tailwind CSS 3, custom CSS, PostCSS and Autoprefixer        | Existing responsive club UI and glass-style panels                        |
| Components            | Project-specific club components, CVA, clsx, tailwind-merge | Consistent buttons, inputs, panels and styles                             |
| Icons                 | Lucide React                                                | Interface icons                                                           |
| Backend               | Next.js Server Actions and Route Handlers on Node.js        | Authentication, validation, mutations, exports and job endpoints          |
| Database              | Supabase-hosted PostgreSQL                                  | Current persistent application data                                       |
| ORM                   | Prisma 6.19.3                                               | Typed queries, data models and transactions                               |
| Input validation      | Zod 3 and shared validation helpers                         | Server input constraints and structured errors                            |
| Authentication        | Custom database-backed cookie sessions                      | Identifies the signed-in user; this is not JWT or Supabase Auth           |
| Password protection   | Node crypto scrypt with random salts                        | Stores password hashes instead of plain passwords                         |
| Session protection    | Random session tokens, SHA-256 hashes in database           | Server-side expiry and revocation                                         |
| Authorization         | Server role/account/ownership checks                        | Controls both routes and data-changing actions                            |
| Email                 | Nodemailer through Gmail SMTP; optional Resend adapter      | OTP, reset and queued notification email                                  |
| Email OTP             | Cryptographic six-digit code, keyed digest                  | Verifies control of a registration email address                          |
| QR display            | qrcode.react                                                | Renders ticket QR codes                                                   |
| QR scanning           | @zxing/browser                                              | Reads QR codes using the browser camera                                   |
| Formatting and checks | Prettier 3, ESLint 8, TypeScript compiler                   | Consistent style, lint and type checks                                    |
| Version control       | Git and GitHub                                              | Local commits and remote collaboration                                    |
| Existing payment work | Razorpay integration code                                   | Paused; not a completed live payment/refund workflow                      |

There is no separate Express backend. Next.js runs frontend and backend as a modular monolith. The current UI does not require an external chart service or Odoo installation.

### Why the checked-in schema says SQLite

`skyline/prisma/schema.prisma` is the base schema and retains the SQLite provider. `skyline/scripts/database.mjs` reads `DATABASE_PROVIDER=postgresql` from local configuration and produces an ignored PostgreSQL schema, including DIRECT_URL. The configured runtime uses Supabase PostgreSQL, not local SQLite. Use the project's `db:*` commands rather than running Prisma directly against the base schema.

## 4. Private configuration

The local file is `E:\Odoo-apex-main\Odoo-apex-main\skyline\.env`.

| Variable                   | Meaning                                                         |
| -------------------------- | --------------------------------------------------------------- |
| DATABASE_PROVIDER          | `postgresql` for the current Supabase setup                     |
| DATABASE_URL               | Private database runtime connection string                      |
| DIRECT_URL                 | Private schema-management connection string                     |
| APP_URL                    | `http://localhost:3001` locally; used in application links      |
| EMAIL_PROVIDER             | `smtp` for the current Gmail setup                              |
| SMTP_HOST                  | `smtp.gmail.com`                                                |
| SMTP_PORT                  | `465` for the current encrypted connection                      |
| SMTP_SECURE                | `true` for port 465                                             |
| SMTP_USER                  | Sending Gmail mailbox                                           |
| SMTP_PASSWORD              | Google App Password; not the Skyline or ordinary Gmail password |
| EMAIL_FROM                 | Sending address matching SMTP_USER for Gmail                    |
| EMAIL_VERIFICATION_ENABLED | `true` in the current local setup                               |
| OTP_SECRET                 | Private digest secret, at least 32 characters; keep stable      |

Do not copy actual passwords, database strings, OTPs or API keys into this document, screenshots or commits. Other private variables may exist for existing background jobs and paused payment code; preserve them.

As of this update, SMTP connection, TLS and authentication passed `npm run email:check`. Email verification was enabled and the local app restarted. **A successful SMTP handshake does not establish inbox delivery. The real registration → received OTP → verification → approval flow still needs user acceptance testing.**

## 5. Roles and initial users

| Role             | Initial email                    | Login destination | Main responsibilities                                                                                        |
| ---------------- | -------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Member / Student | maheshwaranpalanisamy1@gmail.com | `/my-events`      | Own registrations/tickets, event browsing, club shop, own expense requests, account and updates              |
| Staff            | balajivasun@gmail.com            | `/`               | Events and attendee management, door check-in, inventory, volunteer tasks, notices and membership operations |
| Treasurer        | smohamedanas02@gmail.com         | `/treasurer`      | Ledger and expense decisions, membership/dues operations, currency-separated financial visibility            |

Passwords were supplied privately and are intentionally omitted. The three initial users are already approved and administratively email-verified.

**Only the designated initial Staff identity, Balaji, can approve every requested role through `/admin/users`.** A new Staff account does not automatically gain this power. Selecting a role during registration is a request, not immediate access.

Some club pages are shared across roles. A Treasurer can open their own ticket because they may also attend an event. Staff can inspect tickets for attendee support. Seeing a ticket is different from having permission to scan and record admission: door check-in is Staff-only. Members and Treasurers cannot use another person's ticket through normal ownership-protected access.

Ordinary tabs in one browser share the session cookie. Use separate browsers or an incognito session to compare roles simultaneously, or sign out before each different login.

## 6. Application and data flow

```text
Browser page / form
        |
        v
Next.js Server Component or Server Action / Route Handler
        |
        v
Session + verified/approved account + role + ownership validation
        |
        v
Domain service and input validation
        |
        v
Prisma query or database transaction
        |
        v
Supabase PostgreSQL
        |
        v
Updated UI / revalidated page + notification or private email outbox
```

Email dispatch connects server-side to Gmail over encrypted SMTP. Browser code does not receive the database password or SMTP password. Database tables are configured for server-only access rather than direct public Supabase API access.

Primary records: User, Session, EmailOtp, AccountToken, Member, Membership, Event, Ticket, WaitlistEntry, Notification, EmailMessage, InventoryItem, MerchandiseOrder, MerchandiseOrderLine, Task, Transaction and Announcement. Payment and PaymentWebhook support the paused payment module.

## 7. End-to-end workflows

### A. New account, email verification and role approval

1. Open `/register`; enter name, email, password/confirmation and requested Member, Staff or Treasurer role.
2. Server validates inputs and duplicate email, hashes the password and creates an unverified pending account.
3. The application creates a six-digit OTP challenge and immediately attempts delivery of that account's queued message. Go to `/verify-email`.
4. Read the latest code from inbox/spam and enter it. Codes expire after 10 minutes. Five wrong attempts invalidate the challenge; resend has a 60-second cooldown and a five-request/hour account limit. A newer code replaces the older challenge.
5. Successful verification leads to `/access-status`. It verifies email only; protected operations still require approval.
6. Balaji signs in, opens `/admin/users`, reviews the verified applicant and approves or rejects the request. Unverified applicants cannot be approved by bypassing OTP.
7. On approval, the account receives the granted role and can enter protected pages. Approval metadata records the reviewer, time and reason where applicable.
8. Sign in as the new user and check the role's destination and permitted actions. Pending users can sign out from the restricted screens.

### B. Events, registration and ticket ownership

1. Staff opens `/events` and creates an event with name, description, venue, start time, registration deadline, capacity and member/non-member prices.
2. Use practice registration while payment work remains paused. Practice ledger entries do not prove money was collected.
3. An approved user opens `/events/[eventId]` and registers. The server derives identity from the session rather than trusting an arbitrary browser-supplied user ID.
4. The server checks that the event is open, the user is eligible and capacity remains. Transactions coordinate competing bookings; the same account cannot receive duplicate registrations for an event.
5. Active membership determines discount eligibility; merely holding the Member role does not automatically mean dues are current.
6. A successful practice registration creates/updates the ticket, associated ledger record and notification. The user opens it from `/my-events` at `/tickets/[ticketId]`.
7. Allowed cancellation revokes the ticket QR and voids the corresponding practice ledger entry. A checked-in ticket or an event that has started cannot be canceled through normal attendee cancellation.

### C. QR scanning and duplicate prevention

1. The attendee opens their ticket and presents its QR or backup code.
2. Staff opens `/events/check-in`, chooses the correct event and scans with the camera or types the code.
3. Scanning fills the verification input. Staff clicks **Verify & record entry** to submit the check-in operation.
4. The server checks Staff permissions, ticket identity, selected event, event cancellation, ticket state and the admission window: 12 hours before to 12 hours after the event start.
5. A valid paid ticket is conditionally updated to `CHECKED_IN`, with `checkedInAt` recorded.
6. A second attempt returns an already-checked-in response. Concurrent scans cannot both succeed because the update only matches the eligible pre-check-in state.
7. A copied QR cannot create a second admission, although it cannot prove who physically presented the first copy. Staff should compare attendee details when identity checks are needed.

Camera permission requires HTTPS or localhost. A phone opening the computer's LAN IP over ordinary HTTP may not have camera access. Manual codes remain available. Camera compatibility on actual review devices still needs verification.

### D. Waitlists and reminders

1. When an open event has no free seat, an eligible user joins its waitlist rather than overbooking.
2. On released capacity, processing considers waiting users in chronological order and excludes ineligible accounts.
3. An offer reserves a seat temporarily. The offer expires after up to two hours, bounded by the event/registration deadline.
4. The user follows the notification and confirms registration before expiration. Joining the waitlist alone does not create a valid admission ticket.
5. If an offer expires, processing releases it and can offer the next eligible person.
6. The worker creates reminders for eligible upcoming ticket holders within the 24-hour reminder window and processes queued email. Do not promise exact-time or unattended delivery unless the worker is running.
7. Event changes/cancellation trigger related notifications and cancel obsolete work as defined by the services. Email arrival remains dependent on provider and recipient delivery.

### E. Treasurer and reimbursement approval

1. An approved user opens `/account` and submits an expense request with description, positive amount, currency and receipt information where applicable.
2. The server assigns the signed-in claimant; a user cannot claim another person's request by changing an input.
3. The request remains pending and does not yet reduce the posted balance.
4. Treasurer opens `/treasurer`, inspects the claim and approves or rejects it. Rejection requires a reason.
5. The reviewer cannot approve or reject their own claim. With only one initial Treasurer, their own expense needs another separately approved Treasurer to review it.
6. The server conditionally records one decision with reviewer/time metadata. Repeat or competing decisions cannot post the expense twice.
7. Approval posts the expense; rejection keeps it excluded. This is ledger authorization, not a bank reimbursement transfer.
8. For each currency, balance = included posted income minus included approved/posted expenses. Pending, rejected, void and test financial entries are excluded from real posted totals. USD and INR are never added together as one balance.

### F. Membership, merchandise, tasks and notices

- Staff/Treasurer manage `/members` and dues records. Dues confirmation updates membership and its ledger record, with duplicate-posting protection. Dues approval is distinct from account-role approval.
- Staff adds real inventory in `/merchandise`. Authorized purchasers order available stock; stock/order/ledger updates use server validation and transactions. Existing shop amounts are USD. This is a practice shop flow, not an integrated online payment promise.
- Staff creates, assigns and moves tasks in `/fundraisers` through TODO, DOING and DONE. Other roles can view the board; task management remains Staff-controlled.
- Staff and Treasurer publish club notices in `/announcements`; `/notifications` contains the signed-in user's operational updates.
- `/account` contains personal account settings and expense history. Sign out ends the current server session.

## 8. Route reference

Dynamic bracket segments mean a real database ID, not a literal URL segment to type.

| Route                                 | Purpose / restriction                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `/login`                              | Sign in                                                                      |
| `/register`                           | New identity and requested role                                              |
| `/verify-email`                       | Session-bound OTP verification                                               |
| `/access-status`                      | Pending/rejected approval feedback                                           |
| `/access-denied`                      | Insufficient permission feedback                                             |
| `/forgot-password`, `/reset-password` | Account recovery; email arrival needs live verification                      |
| `/`                                   | Shared club overview; Staff's landing page                                   |
| `/events`, `/events/[eventId]`        | Browse events and permitted registration actions                             |
| `/my-events`                          | Own registrations and waitlist activity                                      |
| `/tickets/[ticketId]`                 | Own ticket; Staff support access                                             |
| `/events/[eventId]/manage`            | Staff attendee/event management                                              |
| `/events/check-in`                    | Staff door desk                                                              |
| `/members`                            | Staff and Treasurer membership operations                                    |
| `/merchandise`                        | Catalog/orders; Staff inventory controls, Treasurer cannot place shop orders |
| `/fundraisers`                        | Volunteer board; Staff task controls                                         |
| `/treasurer`                          | Treasurer financial desk                                                     |
| `/announcements`                      | Club noticeboard; Staff/Treasurer publication controls                       |
| `/notifications`                      | Personal updates                                                             |
| `/account`                            | Account preferences and own expense requests                                 |
| `/admin/users`                        | Designated Staff role approver only                                          |
| `/payments`, `/payments/[paymentId]`  | Existing personal payment screens; payment work paused                       |
| `/admin/payments`                     | Existing Staff/Treasurer test payment desk; payment work paused              |

Calendar/attendee export Route Handlers, event jobs and the existing Razorpay webhook are server endpoints, not extra sidebar screens. Unknown routes render the application's not-found screen. Navigation visibility alone is not authorization: protected server operations also check access.

## 9. Maintenance commands

Run from the app folder:

```powershell
npm run email:check
npm run format:check
npm run lint
npm run typecheck
```

`email:check` verifies SMTP connection, TLS and login without sending a message. `npm run format` formats source files. Build with the server stopped when checking the production build.

Only after an intentional reviewed schema change:

```powershell
npm run db:push
```

This updates the configured database schema and generates the client. It is not a daily startup command. Production versioned migrations remain future work; do not add destructive flags to resolve unexpected schema warnings.

Optional integration verification:

```powershell
npm run verify:otp
npm run verify:email
npm run verify:events
npm run verify:finance
```

These scripts create scoped temporary records in the configured database and clean their own exact IDs. Prefer a separate test database for repeated testing. Simulated email tests send no provider email and do not prove inbox delivery. Payment verification is outside the current paused work.

## 10. Common startup problems

| Symptom                                 | Action                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Prisma Client did not initialize        | Run `npm run db:generate` from `skyline`, then restart                                                      |
| Missing packages                        | Stop server and run `npm ci`                                                                                |
| Port 3001 already in use                | Stop the previous Skyline server with Ctrl+C                                                                |
| Database unreachable                    | Check private connection settings, internet and Supabase availability                                       |
| SMTP authentication fails               | Check sender account and Google App Password; do not use the application password                           |
| OTP does not arrive                     | Check inbox/spam, provider configuration, latest OTP challenge and delivery feedback; resend after cooldown |
| Verified user still pending             | Balaji must approve the requested role                                                                      |
| Same account in several tabs            | Tabs share cookies; use separate browser sessions or sign out                                               |
| Member cannot enter finance/admin pages | Expected role restriction                                                                                   |
| Treasurer cannot decide own expense     | Expected self-review protection; use another approved Treasurer                                             |
| Duplicate QR rejected                   | Expected one-entry ticket protection                                                                        |
| Empty event/store/ledger screen         | Create real operational data; demo seeding is deliberately disabled                                         |

## 11. What is verified and what remains

- Prior repair checks passed TypeScript, lint, formatting and a production build, plus scoped OTP, email-queue, event and finance checks. All three initial role logins were checked. These are point-in-time checks, not a guarantee against every bug.
- Gmail SMTP authentication passed on 11 October 2026. Local verification is enabled. Actual OTP inbox delivery and the complete new-user approval journey still need confirmation.
- Existing data was reset with authorization after a private backup. Private backups remain ignored; an isolated restore rehearsal is still pending.
- Physical QR camera/device acceptance and external reminder/reset delivery need real-device/provider verification.
- Razorpay work is paused. Real refund and public webhook completion are unresolved; no completed live gateway is claimed.
- Known dependency security advisories in the older Next.js/Prisma stack require a deliberate supported-version upgrade before public production release.
- Versioned production migrations, an append-only account approval audit trail and deployment-specific abuse protection remain further hardening.
- The app currently runs locally while using a hosted database. This does not establish that a public deployment exists.

## 12. Git reference

Repository: https://github.com/maheshwaran6953/Odoo-apex

Source edits belong in the local repository, with reviewable commits. Run Git from the repository parent, not the outer downloaded folder:

```powershell
cd E:\Odoo-apex-main\Odoo-apex-main
git status
git diff
```

Stage only files belonging to the intended change. Never stage `.env`, backups or private bootstrap credentials. Pull/integrate shared changes before pushing; do not force-push over teammates' work. The existing working branch is `codex/skyline-reliability`.

Team responsibility mapping: frontend — maheshwaran6953; backend — KishorePrabakar; database/deployment — Balajivasun; testing/reference verification — SMDANAS02. A Git author label is contribution attribution, not authentication as that person's GitHub account.

Related guides: `docs/LOCAL_RUNBOOK.md`, `docs/EMAIL_VERIFICATION.md`, `docs/MASTER_REPAIR_PLAN.md`, and `docs/REPAIR_VERIFICATION.md`. This reference records the newer successful SMTP handshake; older guide status paragraphs may still describe the earlier pending setup.

## 13. Original problem-statement coverage update

See [Problem Statement Coverage and Technology Stack](docs/PROBLEM_STATEMENT_TECH_STACK.md) for the six original semester scenarios and their exact implementation/evidence.

The latest audit adds dues setup, 30-day renewal reminders, early renewal preserving paid time, announcement notifications and queued mailing, active-membership shop prices, personal/Staff order collection history, fundraiser income entry and optional safe HTTPS receipt links. Existing UI styles are preserved. Start the worker for scheduled renewals and notice mailing. The shop remains a practice ordering flow and payment work remains paused.

Run `npm run verify:basics` for the new scoped checks; it sends no real provider email and cleans its own temporary records. SMTP authentication has passed, but inbox delivery needs confirmation.

## Operational additions — 11 October 2026

Assigned volunteers update only their own status; Staff receives/corrects stock with audit records; Treasurer filters/exports finance; expense claims support private Supabase Storage files (PDF/PNG/JPEG, max 2 MB) and idempotent submission. See the repository docs/OPERATIONAL_FEATURES.md for full instructions.

Setup: npm run storage:setup after privately configuring SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_RECEIPTS_BUCKET. Verification: npm run verify:operations; npm run verify:receipts -- --base-url http://localhost:3001. The latter explicitly creates/removes a real temporary receipt and requires a running app. Never publish server keys.

Ordinary startup remains npm run dev -- --port 3001; do not reset or seed current data. One authorized email reached Inbox. Full manual coverage is 91 cases; service success does not imply all browser/device/provider acceptance is complete. Payments remain paused.
