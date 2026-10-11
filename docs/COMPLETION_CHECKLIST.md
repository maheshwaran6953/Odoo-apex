# Skyline completion checklist

Updated: 11 October 2026. Includes the operational repairs and private receipt implementation. Recorded evidence: OPERATIONAL_FEATURES.md and REPAIR_VERIFICATION.md. Unchecked manual/production gates remain open.

Use [the manual testing guide](MANUAL_TESTING_GUIDE.md) for 91 exact cases and [operational instructions](OPERATIONAL_FEATURES.md) for the new controls. Payment work remains paused. Existing business records are preserved.

## Status meanings

- **Implemented / checked:** code exists and the recorded code/service or limited browser checks passed.
- **Acceptance pending:** code exists, but its complete real-user/provider/device journey still needs confirmation.
- **Not complete:** implementation or operational work remains.
- An unchecked item below remains open. Do not equate passing compilation, queued mail, simulated money or a screenshot with completed external integration.

## Already implemented

- [x] Local source lives in `E:\Odoo-apex-main\Odoo-apex-main`; changes are committed/pushed to GitHub.
- [x] Next.js/React/TypeScript application; Prisma with configured Supabase PostgreSQL persistence.
- [x] Old application data reset after a private backup; no automatic demo seeding at startup. Later user-entered records are preserved.
- [x] Account login/logout, scrypt password hashing, opaque cookie sessions and server role/ownership checks.
- [x] Requested role selection, OTP rules and designated Staff-only role approval; manual email-verification bypass disabled.
- [x] Member dues setup/recording, annual validity, early renewal and expiry/reminder job logic.
- [x] Event creation/editing, capacity/deadline rules, member pricing and registration ownership.
- [x] QR/backup tickets, attendance recording, atomic duplicate-entry rejection, cancellation and exports.
- [x] Waitlist queue, reserved seat offers, claim/expiry and in-app notifications.
- [x] Merchandise variants, stock checks, membership discounts, order history and Staff collection recording.
- [x] Staff volunteer task assignment/status tracking; notice archive and announcement notification fan-out.
- [x] Expense submission, optional safe HTTPS receipt metadata, Treasurer approval/rejection, self-review prevention and currency-separated ledger.
- [x] Fundraiser receipts entry and duplicate-submission protection for supported operations.
- [x] Gmail SMTP connection/TLS/authentication checked; Prettier, lint, TypeScript and production build passed on the preceding application changes.
- [x] Scoped basic/event/finance/OTP/simulated-email service checks passed; fixtures cleaned by exact IDs.
- [x] Desktop top navigation and mobile bottom navigation; role shortcuts, More disclosure and limited three-role browser checks.
- [x] README and application README aligned with the actual stack.

## P0: complete before the next review

### Email and new-user access

- [ ] Receive an actual registration OTP in a mailbox you control; verify inbox/spam and expiry (TC04–TC08).
- [ ] Complete registration → OTP → pending role → designated Staff approval → correct landing page for all three requested roles (TC04, TC09–TC11).
- [ ] Confirm ordinary Staff cannot approve roles, and rejected/disabled accounts lose access (TC12–TC14).
- [ ] Receive a real password-reset email, use its one-time link and confirm old sessions/password are invalidated on a disposable account (TC15–TC16).
- [ ] Receive actual event, waitlist, announcement and membership messages; separate provider acceptance from inbox delivery (TC36–TC39, TC49, TC58, TC73).

### Confirmed source-level gaps to fix

- [x] **P0 repaired:** Attendee CSV requires approved, verified, active Staff. Ineligible-account regression passed; full manual former-Staff TC80 remains separate.
- [x] **P1 repaired:** Attendee CSV uses stored currency/payment-mode columns and spreadsheet-safe escaping. INR/Test Mode regression passed without provider payment calls; manual TC81 remains separate.

### Complete manual acceptance

- [ ] Execute the role access matrix and ownership checks, including direct URLs, not just hidden links (TC17–TC19).
- [ ] Exercise dues, pricing, event creation/editing and deadlines with valid/invalid inputs (TC20–TC33).
- [ ] Run cancellation, waitlist order/claim/expiry and concurrent last-seat cases (TC34–TC39).
- [ ] Scan a real QR on intended camera hardware, confirm entry once, reject reuse/cancellation/wrong event and concurrent scans (TC40–TC46).
- [ ] Order every relevant size, validate last-unit competition and mark collection exactly once (TC50–TC56).
- [ ] Test tasks, notices, expense decisions, self-review and exact financial deltas with real browser sessions (TC47–TC49, TC57–TC66).
- [ ] Check timezones, mobile/tablet layout, keyboard navigation, exports, network failures and recovery (TC29, TC69–TC77).
- [ ] Record each result and issue; fix critical/high failures and rerun affected cases. No unchecked case should be presented as passed.

### Preparation for a reliable review

- [ ] Prepare intentional review records in a dedicated review/test dataset, or use actual user-entered records. Do not reintroduce hardcoded business arrays.
- [ ] Keep credentials privately available and use isolated browser sessions for roles.
- [ ] Start the app and required worker before review; ensure database/network connectivity.
- [ ] Use Practice/USD events while payment work is paused. Explain that these ticket/shop ledger postings are simulated.
- [ ] Rehearse the review sequence at the end of the manual guide, including a deliberate duplicate-scan rejection.

## P1: workflow gaps and clarification

- [x] Corrected event/My events/waitlist guidance to require OTP verification and designated Staff role approval.
- [x] Standardized operational display to campus timezone, default Asia/Kolkata. Timezone regression passed. Finance filter/export UTC is labelled explicitly. Full manual TC29 remains pending.
- [x] Assigned volunteers update their own task status; Staff manages all tasks. Ownership/account-state checks passed; manual TC82 pending.
- [x] Private PDF/PNG/JPEG receipt upload implemented with validation, claimant/Treasurer authorization, expense idempotency and cleanup. Real Storage/HTTP checks passed; full manual TC86–TC89 pending.
- [x] Finance date/currency/category/status/type/search filters, 25-row pagination and filtered CSV implemented. Role/filter/date/export regression and INR browser filter passed; full manual TC85 pending.
- [x] Staff merchandise replenishment/corrections implemented with audited quantity deltas and request keys. Role/concurrency/retry checks passed. Price editing, returns and order cancellation remain future work.
- [ ] Add pagination/search if needed beyond the current latest-100 merchandise-order and notification views; validate attendee pagination with a larger isolated dataset.
- [x] Pending/unverified accounts can browse public events; operational routes/registration remain gated. Manual regression TC90 pending.
- [ ] Review remaining create-form retries for tasks/products/events/merchandise orders. Expense claims now use scoped submission keys and payload hashes; stock adjustments are idempotent. Not every create operation is idempotent.

## P1: payments — explicitly deferred

Resume only after the current workflows are accepted. Existing Test Mode code is not a finished gateway release.

- [ ] Resolve Test Mode refund failure/provider balance limitation and confirm provider-backed refund status.
- [ ] Configure and verify public webhook delivery, signature validation and duplicate/out-of-order event handling end to end.
- [ ] Repeat event checkout success/failure/abandonment, hold expiry, amount/currency/owner validation and ticket issuance checks.
- [ ] Confirm cancellation/refund/reconciliation consistency without duplicate tickets, seats or ledger postings.
- [ ] Build online merchandise payment if needed by the original problem statement; current shop collects no gateway payment.
- [ ] Design dues collection separately if desired; current dues records separately received money.
- [ ] Plan Live Mode credentials/onboarding, real settlement and operational refund procedures separately. Test success is not Live Mode acceptance.

Payment execution is deliberately excluded from the current manual run. TC78 is read-only page/access coverage; TC79 is a deferred payment acceptance list.

## P0 before public production release

- [ ] Upgrade the older Next.js/Prisma dependency stack through a reviewed compatibility/security migration; resolve known critical/high audit findings and rerun regression checks.
- [ ] Establish a versioned PostgreSQL migration process; verify schema changes against staging instead of using ad hoc production schema pushes.
- [ ] Perform a full isolated backup restore rehearsal and document recovery steps/access/retention.
- [ ] Deploy with HTTPS, correct APP_URL, private environment variables and reachable Supabase connections; public deployment is not verified.
- [ ] Configure a reliable unattended scheduler, prevent overlapping unsafe jobs and verify email outbox retry/uncertain-delivery recovery.
- [ ] Verify deployment-specific proxy trust, registration/login/OTP abuse limits and security headers/session handling.
- [ ] Add operational monitoring for database/job/mail failures, with redacted logs and ownership of incident response.
- [ ] Add append-only administrative audit history if required; current role decisions store the latest decision metadata.
- [ ] Define record retention, access and account recovery procedures, including designated-approver recovery.

## Suggested order and team ownership

| Order | Owner                             | Work                                                                          | Completion evidence                                       |
| ----- | --------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1     | Testing — SMDANAS02               | Execute P0 cases, record evidence and report exact failures                   | Completed case log; issues linked to failing case IDs     |
| 2     | Backend — KishorePrabakar         | Fix business-rule/RBAC/validation failures; email/worker behavior             | Affected manual cases and service checks pass             |
| 3     | Database/deployment — Balajivasun | Provider connectivity, isolated test database, backups, scheduler and staging | Restore rehearsal, mailbox receipts and staging checks    |
| 4     | Frontend — maheshwaran6953        | Fix verified form/copy/responsive issues with current visual style            | Browser/device/keyboard checks pass                       |
| 5     | Team                              | Accept baseline, then resume gateway work                                     | Baseline sign-off followed by payment-specific acceptance |

These assignments do not imply the work has been completed by each person. Fixes should be separate, reviewable commits. Keep secrets and testing passwords out of Git.

## Additional acceptance and release tasks

- [x] One explicitly authorized real email reached the owner Inbox; application SENT, sent=1, failed=0; recipient confirmed receipt. TC91 passed. Registration/reset/reminder journeys are separate.
- [x] Private database snapshot retained; additive operational PostgreSQL change recorded in skyline/prisma/changes/20261011-operational-features.sql; server-only table privileges applied.
- [ ] Execute TC82–TC90 completely with browser/user-created test records and record results.
- [ ] Rotate credentials exposed in chat, update ignored configuration and recheck connectivity. No credentials were committed or copied into docs.
- [ ] Back up private Storage objects separately from database JSON; rehearse restoring receipt metadata and bytes together.
- [ ] Add receipt orphan reconciliation/retention and malware scanning if required for production.
