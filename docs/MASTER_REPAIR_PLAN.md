# Skyline master repair plan

Date: 10 October 2026
Status: Historical planning record. Implementation has since progressed; consult REPAIR_VERIFICATION.md and PROBLEM_STATEMENT_TECH_STACK.md for current evidence and remaining work.
Priority: Correctness, authorization, dynamic data and reproducible local operation. Payment development is paused.

## 1. Scope and confirmed decisions

- Make future application changes directly in the user's local project and commit reviewed changes to Odoo-apex.
- Confirmed project root: E:\Odoo-apex-main\Odoo-apex-main. Application: skyline beneath that root.
- The outer and inner folders currently have no .git metadata. Establish a real Git checkout before implementation; never create unrelated replacement history or overwrite local files.
- Preserve the existing visual design, styles, layout and component appearance. Functional OTP fields, role selectors, approval controls and validation feedback use existing components. No visual redesign.
- User authorized deleting all current application users and operational/test records AFTER making a private backup. External Razorpay records are outside this reset.
- Only the designated initial Staff account may approve or reject requested roles. Other Staff may manage operational modules but cannot grant roles.
- Three initial accounts only: Member, Staff and Treasurer, using the identities specified below. New accounts are created dynamically through registration.
- OTP delivery/provider configuration is deferred at the user's request. Implement the workflow and delivery adapter, but do not claim email verification works end to end until a real inbox receives and successfully verifies an OTP.
- No new payment gateway work until these repairs are verified. Preserve existing payment safety guards; do not activate Live Mode.

## 2. Known findings and audit requirements

The preceding application has the following verified weaknesses to address:
- Expense requests do not reliably record the claimant, reviewer, decision reason or approval timestamp.
- Current email verification uses emailed token links rather than an OTP flow.
- All login roles currently land on My events, making role differences unclear.
- Shared browser tabs share one session cookie; they are not independent role sessions.
- The canonical schema says SQLite, while the wrapper can generate a PostgreSQL schema. Clearly document the active provider and eliminate setup ambiguity.
- Existing code contains densely formatted server actions; no shared formatting workflow is configured in package.json.
- Existing event validation is extensive but needs systematic boundary, date/time and concurrent-capacity checks.

Audit the exact downloaded version before applying patches. Compare it with remote main and the previously published version; do not assume that matching filenames mean matching code. Enumerate every route, server action, route handler, database model, job and privilege check. Produce a defect register with reproduction steps, expected/actual behavior, severity and verification evidence. Review console/server failures, stale sessions, timezone conversions, null/empty values and missing revalidation.

## 3. Phase A - Establish one local source of truth

1. Inventory the user's downloaded files and ignored local configuration without printing secrets.
2. Preserve local edits and .env privately before establishing Git metadata.
3. Fetch the real remote history and connect this local tree to it, checking for differences before checkout or merge. If a clean clone is needed, preserve this folder and tell the user the final canonical path; do not silently keep building in CodeSentinel/team-publish.
4. Use a codex/skyline-reliability branch rooted in remote main. Never force-push or rewrite existing collaborator history.
5. Ensure .env, backups, uploaded private files, generated Prisma output, build artifacts and dependency folders are ignored.
6. Confirm skyline/package-lock.json exists and corresponds to package.json. Avoid installing from the outer directory by mistake.
7. Record the exact app path, Node version, package manager, active database target and startup command in local setup documentation.

Completion: one Git-managed local application, known remote/base commit, preserved configuration and no unreviewed overwritten files.

## 4. Phase B - Baseline and controlled data reset

Do not reset first and diagnose later. First validate database connectivity and inventory the current schema and application tables.

1. Stop scheduled jobs and prevent concurrent application writes during the maintenance window.
2. Export all application tables, schema/version metadata and record counts to an ignored, access-restricted local backup. Session/password-hash records are private too.
3. Verify the export parses, relation keys/counts are consistent and the restore procedure is documented. Prefer validating a restore against an isolated database before deletion.
4. Build a maintenance-only reset command with explicit confirmation, resolved database target and a dry-run mode. It must not be exposed as a public web endpoint or run during startup/install.
5. Delete child records before parents or use a carefully reviewed transaction compatible with the active schema. Clear users, sessions, verification/reset tokens, login attempts, membership records, events, tickets, queues, notifications, email outbox, merchandise orders/stock, tasks, notices, ledger and application payment/webhook records.
6. Do not delete Supabase platform accounts, unrelated schemas/tables, the project itself or remote provider records. Supabase hosts the app database; app users are not Supabase Auth users.
7. Create exactly three initial accounts through an explicit administrative bootstrap, not a recurring demo seed. Store scrypt password hashes, never plaintext passwords.
8. Mark these initial identities as administratively verified/approved with a recorded bootstrap reason; do not falsely claim they completed email OTP verification.
9. Designate the initial Staff user by immutable database ID and a protected capability. Do not identify the approver by comparing an editable email on every request.
10. Count every table afterward: exactly three users, no old sessions and no operational/demo records. Retain audit evidence of the reset/bootstrap without preserving fake business records.
11. Do not invoke the old db:seed in normal setup. Disable or clearly separate example fixtures from real initialization.

Initial account identities (passwords intentionally omitted from this committed document):
| Role | Email | Purpose |
| --- | --- | --- |
| MEMBER | maheshwaranpalanisamy1@gmail.com | Student account |
| STAFF | balajivasun@gmail.com | Designated role approver and operations account |
| TREASURER | smohamedanas02@gmail.com | Finance account |

Read the user-supplied initial passwords from a private local bootstrap configuration. Never place them in source, seed.ts, README, logs or commits. Provide secure instructions for entering them locally and recommend changing them after initialization.

## 5. Phase C - Account lifecycle, requested roles and OTP

Separate email verification, approval status, granted role and paid club membership. None substitutes for another.

Proposed lifecycle:
REGISTERED/UNVERIFIED -> EMAIL_VERIFIED/PENDING_APPROVAL -> APPROVED -> ACTIVE ACCESS.
Rejection retains a decision record and provides a non-privileged explanation. Disabled users lose all active sessions.

Registration:
- Name, email, password, confirm password and requested role (Member, Staff, Treasurer).
- Requested role is an application request, never the effective authorization role.
- An unverified/pending user may access only verification, approval status, permitted profile corrections and logout; public events remain readable.
- Only the designated Staff approver can approve/reject any requested role, including Member. Newly approved Staff do not inherit approver authority.
- Record applicant, requested role, previous/granted role, decision, reviewer ID, timestamp and reason. Repeated submissions/decisions must be idempotent.
- Prevent self-promotion, approval of unverified identities, last-approver disablement and unintended permission changes through forged payloads.
- Revoke sessions after role/approval/disablement changes, or enforce current database state on each protected request.
- Keep access approval distinct from membership activation and dues/discount eligibility.

OTP specification:
- Six numeric digits generated using cryptographic randomness; 10-minute expiry.
- Store a keyed digest bound to user, purpose and challenge ID. Ordinary unkeyed hashes alone are insufficient protection for low-entropy six-digit codes.
- Purpose-specific challenges for email verification; keep password-reset semantics independently protected.
- Five incorrect attempts per challenge, 60-second resend cooldown and bounded hourly/account/IP request limits.
- A resend invalidates previous challenges and stale unsent outbox messages. Successful verification consumes the challenge atomically.
- Preserve leading zeros. Reject wrong-length/non-digit inputs, expired/used challenges, wrong-account challenges and concurrent replay.
- No OTP or reset token in logs, URLs, production UI or committed fixtures. A mock adapter may be used only for isolated automated tests.
- Maintain queued/sent/failed email delivery states and retry bounds. A queued email is not proof of inbox delivery.
- Provider configuration and real-inbox acceptance are deferred. Do not silently fall back to approving new users without email verification.

## 6. Phase D - Central RBAC and ownership checks

Use a central permission map and server authorization helpers. Check authentication, account state, capability and record ownership at every mutation/read boundary. Deny by default. Sidebar visibility must reflect the same permission map but is not a security control.

| Area | Member | Staff | Treasurer | Designated Staff approver |
| --- | --- | --- | --- | --- |
| Own account, updates, registrations/tickets | Own records | Own records plus event administration | Own records | Staff rights |
| Public event catalogue | Read | Read/manage | Read | Staff rights |
| Event creation, attendee list, check-in | No | Yes | No | Yes |
| Membership directory and dues | Own status | Manage | Financial/dues access | Staff rights |
| Volunteer board | Read assigned/published tasks | Manage | Read | Staff rights |
| Shop | Place own orders | Inventory/order operations | Financial reporting | Staff rights |
| Expense submission/history | Own claims | Own claims | Own claims and review queue | Own claims |
| Ledger/expense decisions | No | No | Yes, excluding own claims | No unless separately authorized |
| User role approval/rejection | No | No | No | Yes |
| Operational user verification/disablement | No | Restricted; cannot bypass OTP or role approval | No | Yes with protected approver safeguards |

Validate this scope against current pages; implement essential missing operations using existing controls, not a redesign. No standalone unrestricted ADMIN role is required. A denied page must return a friendly access-denied response rather than an unhandled server exception.

Add identity and effective role using the existing account/header presentation, without changing visual styling. Redirect approved users to existing appropriate pages: Member to My events, Staff to operational overview, Treasurer to Treasurer desk. Pending users go to status/verification. Preserve safe internal return URLs only; reject open redirects.

## 7. Phase E - Dynamic data throughout the application

Audit dashboard totals, charts, event cards, notices, tasks, shop items, membership states, financial summaries and role/account displays. Remove production fallback arrays, fixed attendance values and fabricated totals.

- All business content comes from persisted records and authenticated identity.
- Zero records produces an honest zero/empty state, never generated example business data.
- Fixed labels, enum options, validation limits and visual design tokens remain legitimate code constants.
- Company/club configuration, currency and membership terms are persisted settings where they affect business behavior.
- Currency is explicit; never total different currencies as if interchangeable. Disable currency changes that invalidate existing records, or group balances by currency.
- Revalidate affected routes after mutations. Define where refresh/polling is required; do not claim instant real-time updates without implementation.
- Link orders, expenses, memberships and notifications to their actual users; do not infer ownership from a role or browser field.

## 8. Phase F - Event correctness

Audit create, edit, publish/registration state, capacity, pricing, cancellation, tickets, waitlist, attendance, exports and jobs together.

- Name/description/location limits and whitespace handling; valid optional organizer email and safe rendered text.
- Validate dates on the server, including invalid dates, timezone conversion, registration close versus start, past scheduling and editing near deadline.
- Use explicit registration availability boundaries; never allow bookings after deadline/start/cancellation. Do not add a registration-open field unless the business rule requires it.
- Positive integer capacity; zero/negative/fractional/NaN/infinite/out-of-range counts rejected.
- Nonnegative price; free events allowed in practice mode; exact currency minor-unit conversion without float drift; keep dormant gateway restrictions intact.
- Capacity cannot be reduced below confirmed attendees plus valid offers and checkout holds.
- Concurrent registration, cancellation, seat offer and check-in remain transactionally safe with duplicate constraints.
- Account approval/email verification required. Duplicate booking and cross-user ticket manipulation denied.
- Member pricing requires an active unexpired membership, not MEMBER role alone.
- Event edits do not retrospectively change ticket prices. Appropriate details updates create notifications and invalidate reminders safely.
- Cancellation revokes QR eligibility, stops new bookings and reminders, closes waitlists and informs affected users without claiming a completed refund.
- Selected-event QR/backup-code verification; enforce entry window, reject cancellation and repeat use, allow only one concurrent entry update.
- Expired offers release capacity fairly; jobs are idempotent; failed email must not prevent database notifications.
- CSV exports role-restricted and escaped against spreadsheet formula injection.

## 9. Phase G - Treasurer and reimbursement correctness

Implement a real recorded approval workflow before connecting payments.

- Expense fields: claimant user ID, description, amount in minor units, currency, status and submission time.
- Review fields: reviewer ID, decision time, optional/required decision reason and approved/rejected state.
- Only Treasurer can approve/reject pending expenses; no self-approval. A Treasurer's own claim waits for a different authorized Treasurer. The Staff approver can approve another Treasurer account but does not automatically become a financial reviewer.
- Ensure the single initial Treasurer can review other users' claims; explain their own blocked claim instead of inventing an approver.
- Pending/rejected expenses never reduce posted balance. Approval posts exactly one corresponding ledger entry in the same transaction.
- Duplicate/concurrent approval, approve-versus-reject race, unauthorized edits and missing/deleted requests handled safely.
- No editing the approved amount/claimant silently; corrections require a traceable reversal/adjustment policy.
- Ledger is append-oriented with clear statuses and linked source records; actual payout remains separate from approval.
- Accurate same-currency posted income minus posted expenses; excluded test/void/pending entries never counted as cash.
- Preserve distinct dues, ticket, merchandise and reimbursement categories and reject duplicate source posting.
- Show claimant on pending claims and decision status in own expense history using existing table/form patterns.
- Receipt attachments are not part of this repair unless subsequently requested; do not imply attachment-based verification exists.

## 10. Phase H - Input validation and error handling across all modules

Shared Zod schemas on server boundaries; client constraints mirror them for feedback but never replace them.

| Input | Rules and cases |
| --- | --- |
| Name/username | Trim names; bounded length; meaningful non-whitespace; support legitimate Unicode names; treat names as non-unique unless a username field explicitly requires uniqueness |
| Email | Trim/lowercase lookup; validated structure/length; case-insensitive uniqueness; handle existing registered identity safely |
| Password | Preserve exact characters; 12-256 characters; confirmation match; no silent trimming/truncation; supplied initial passwords satisfy length policy |
| OTP | Exactly six ASCII digits, leading zeros retained, expiry/attempt/replay restrictions |
| Dates | Parse validity, explicit timezone, ordering and boundary rules; reject malformed or impossible values |
| Money | Finite, bounded, explicit currency/minor units; expenses positive; allowed event prices nonnegative; reject excess decimals/exponent/blank inputs |
| Counts/stock | Safe bounded integers; capacity/order quantity positive; available stock nonnegative; prevent stock underflow |
| IDs/status/roles | Validate expected values, existence, account state, ownership and permitted transitions; never trust hidden inputs |
| Optional text/phone | Length/format limits; normalize empty to null consistently; safe rendering |

Test blank/whitespace, negative/zero, fractions, very large numbers, NaN/Infinity, duplicate submissions, stale forms, missing records, disabled accounts, failed database/network calls and concurrent changes. Return field-specific safe errors, preserve entered values, and prevent raw Prisma/provider diagnostics from leaking. Avoid catch-all messages hiding actionable validation failures.

## 11. Phase I - Readable code and formatting

- Configure Prettier for TS/TSX/JS/JSON/Markdown/Prisma as supported; configure compatible ESLint rules for this installed Next.js version.
- Add format, format:check and lint scripts; do not apply unsafe automated upgrades while fixing correctness.
- Ignore generated output, builds, private backups, dependencies and local secrets.
- Expand compressed actions into named validation, authorization and transaction steps. Extract reusable money/date/account validation utilities.
- Keep routes/components/actions/services logically separated, strong types and explicit state transitions.
- Formatting/refactoring must preserve existing UI styles and behavior. Commit large mechanical formatting separately from functional changes.

## 12. Phase J - Verification and completion gates

Use isolated fixtures or a separate test database. Never reseed the live user database for tests. Clean test records by exact IDs.

Required checks:
1. Schema validation/generation, typecheck, lint, formatting check and production build.
2. Approved initial account login, role landing, logout and session isolation using separate browser profiles.
3. Registration requested role grants no immediate privilege; pending users cannot book/administer; designated approver only; denial and session revocation.
4. OTP lifecycle automated checks with mock delivery; actual inbox test marked deferred until configured.
5. User A cannot access User B's personal tickets/claims/orders; Staff ticket inspection is deliberate authorized behavior.
6. Event creation/edit boundary cases; no overbooking; cancellation; waitlist promotion; duplicate and wrong-event check-in rejection.
7. Expense submit -> pending -> approve/reject; self-review denial; ownership; exactly-once ledger updates; no mixed-currency balance.
8. Shop stock, member dues, task/notice permissions and honest empty dashboards after reset.
9. No secrets/plaintext passwords/OTP/fake production data committed; no broken navigation/unhandled permission errors.
10. Run documented clean-install steps from the canonical local clone, including worker operation and production mode.

Evidence must distinguish compiled code, mocked services, browser-tested flows and verified external delivery. Do not claim 'everything perfect' based only on a successful build.

## 13. Commit strategy

After each bounded verified repair, commit from the canonical local repository. Separate logical commits: local tooling; schema/account lifecycle; OTP; RBAC; events; finance; remaining validation; formatting; verification/runbook. Preserve the requested author mappings when instructed, while descriptions reflect actual changes; attribution is not evidence of implementation ownership.

Before push: inspect diff/status, run relevant checks, scan for secrets, fetch remote, confirm fast-forward ancestry. Push normally; do not force. Report commit hashes, verification and remaining blockers. If pushing fails, ask the user with the actual error as requested.

## 14. Local runbook to deliver after implementation

The final README must provide tested commands using the actual local app path, not an assumed cloud workspace:

1. Open PowerShell at E:\Odoo-apex-main\Odoo-apex-main\skyline (or the documented canonical path if Git setup changes it).
2. Verify Node/npm compatibility against package engines and installed dependencies.
3. Install from the app's lockfile using npm ci.
4. Create local .env from .env.example; set active PostgreSQL provider, Supabase connection URLs and app base URL. Keep secrets local.
5. Generate and validate Prisma using the project's wrapper scripts.
6. Apply the documented reviewed schema migration/setup; ordinary startup must never reset the database.
7. Run bootstrap only on intentional initial setup, using private credentials. Do not run the old demo seed.
8. Start development server with an explicit port and matching APP_URL; list the resulting URL.
9. Start the event/email worker in a separate terminal when background processing is required.
10. Verify Member/Staff/Treasurer separately using incognito/different browsers; create business records through forms.
11. Document build and production start commands, camera HTTPS/localhost requirements, shutdown and common troubleshooting.
12. Finish real email-provider configuration and OTP inbox verification when the user is ready. Unconfigured email must be clearly reported, not bypassed.

Existing scripts currently include db:generate, db:validate, db:push, account:bootstrap, events:watch, typecheck and build. Future commands and final migration/reset/bootstrap details must be documented only once implemented and verified.

## 15. Execution order and remaining decisions

Order: local Git/source baseline -> private backup -> account/schema and validation foundations -> controlled reset/bootstrap -> RBAC and role approval -> events and finance repairs -> remaining modules/dynamic data -> formatter and verification -> runbook -> deferred real-email activation -> payment reconsideration.

OTP internal code can be implemented earlier with controlled tests; real email activation remains last per user request. New registrations will not be fully usable until OTP delivery works; existing administrative bootstrap accounts remain available for verified development.

Confirmed decisions: local path supplied; designated Staff approves all roles; full app-data reset authorized after private backup; email provider deferred; no UI redesign.

Implementation must investigate concrete review failures as well as the listed requirements. Ask for any reviewer screenshots/error text or reproduction steps without blocking the baseline audit. Track discovered regressions until resolved, and state any deferred external-service gate explicitly.
