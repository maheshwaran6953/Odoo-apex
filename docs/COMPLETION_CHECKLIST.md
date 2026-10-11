# Skyline completion checklist

Updated: 11 October 2026. Reviewed implementation: commit `d56a26e` plus its preceding application changes. This is a completion/acceptance checklist, not a claim that every browser test has passed.

Use [the manual testing guide](MANUAL_TESTING_GUIDE.md) for exact actions. Use [repair verification](REPAIR_VERIFICATION.md) for checks already executed. Payments remain paused. This update changes documentation only; it does not run tests against user records or send email.

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

- [ ] **P0:** Attendee CSV Route Handler checks STAFF role but omits verified/approved account-state checks. A rejected former Staff can retain STAFF role and obtain a restricted session after login; protect the handler itself and pass TC80 before review with real attendee data. This is source-inspection evidence; browser exploit reproduction has not been performed.
- [ ] **P1 before gateway review:** CSV hardcodes USD and simulated-payment wording even for INR/Test Mode records. Make labels match stored currency/payment mode and pass TC81. Current Practice/USD export is the supported ordinary path.

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

- [ ] Correct stale interface guidance that says Staff can confirm email identity. Current OTP policy disables that bypass; references remain in event detail/My events and a defensive waitlist error. This is a confirmed copy mismatch, not permission to bypass verification.
- [ ] Verify event dates across calendar, server-rendered labels, browser-local inputs and deployment timezone; standardize display if reviewers see inconsistent times.
- [ ] Decide whether assigned volunteers should update their own tasks. Current board is read-only for Member/Treasurer; only Staff updates status. Member self-service requires new scoped authorization and tests.
- [ ] Decide whether receipt uploads are required. Current workflow accepts optional HTTPS links; upload/storage/access controls are not implemented.
- [ ] Decide whether finance needs date/category filters and downloadable semester statements. Current Treasurer page provides the ledger and per-currency summaries, not a dedicated report-export feature.
- [ ] Decide whether merchandise needs replenishment/editing/cancellation/returns. Current UI adds variants, orders stock and records collection; it is not a complete stock-adjustment/return system.
- [ ] Add pagination/search if needed beyond the current latest-100 merchandise-order and notification views; validate attendee pagination with a larger isolated dataset.
- [ ] Clarify public browsing behavior for signed-in pending users: protected layout currently redirects them to verification/approval despite Browse public events links. Agree on the intended policy before changing it.
- [ ] Review double-submit/network-retry behavior for every create form. Supported idempotent decisions do not establish duplicate prevention for all record creation (notably new expenses/tasks/products/events).

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
