# Skyline manual test results

Created: 11 October 2026. This is the fill-in log for [the manual testing guide](MANUAL_TESTING_GUIDE.md). Creating the log did not execute the cases. TC91 now has actual recipient-confirmed evidence; other NOT RUN entries still require their full manual procedure. Prior service/browser evidence remains in REPAIR_VERIFICATION.md.

Copy this file for a new run or complete the cells below. Record the actual source commit, tester/date, browser/device, role and private test-run prefix. For each row replace NOT RUN with PASS, FAIL or BLOCKED only after following its procedure. TC79 remains DEFERRED while payments are paused.

Run prefix: ______ Commit: ______ Tester/date: ______ Browsers/devices: ______

Keep credentials, full ticket/OTP/reset codes and personal attendee exports out of this file. Link redacted evidence/issues only.

| Case | Feature                                                    | Status   | Actual result / redacted evidence / issue                                                          |
| ---- | ---------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| TC01 | Start and confirm persistence                              | NOT RUN  |                                                                                                    |
| TC02 | Three-role login and identity                              | NOT RUN  |                                                                                                    |
| TC03 | Navigation at desktop/mobile and logout                    | NOT RUN  |                                                                                                    |
| TC04 | Real new Member registration and verification              | NOT RUN  |                                                                                                    |
| TC05 | Registration validation and duplicate email                | NOT RUN  |                                                                                                    |
| TC06 | OTP format, wrong attempts and cooldown                    | NOT RUN  |                                                                                                    |
| TC07 | Latest code, expiry and reuse                              | NOT RUN  |                                                                                                    |
| TC08 | OTP hourly limit and unavailable delivery                  | NOT RUN  |                                                                                                    |
| TC09 | Designated Staff approves a verified Member                | NOT RUN  |                                                                                                    |
| TC10 | Requested Staff approval and ordinary Staff permissions    | NOT RUN  |                                                                                                    |
| TC11 | Requested Treasurer approval                               | NOT RUN  |                                                                                                    |
| TC12 | Approval cannot bypass unverified email                    | NOT RUN  |                                                                                                    |
| TC13 | Rejection and later explicit approval                      | NOT RUN  |                                                                                                    |
| TC14 | Disable and re-enable a disposable user                    | NOT RUN  |                                                                                                    |
| TC15 | Wrong login, lockout and recovery                          | NOT RUN  |                                                                                                    |
| TC16 | Reset link, password change, reuse and expiry              | NOT RUN  |                                                                                                    |
| TC17 | Direct-route permission matrix                             | NOT RUN  |                                                                                                    |
| TC18 | Ownership across tickets, expenses and updates             | NOT RUN  |                                                                                                    |
| TC19 | Pending/disabled account and stale form access             | NOT RUN  |                                                                                                    |
| TC20 | Directory search and filters                               | NOT RUN  |                                                                                                    |
| TC21 | Add directory member and validate identity                 | NOT RUN  |                                                                                                    |
| TC22 | Set dues for an account-created Member                     | NOT RUN  |                                                                                                    |
| TC23 | Record dues and verify exact ledger change                 | NOT RUN  |                                                                                                    |
| TC24 | Repeated/concurrent dues recording                         | NOT RUN  |                                                                                                    |
| TC25 | Early renewal preserves remaining paid time                | NOT RUN  |                                                                                                    |
| TC26 | Membership expiry and renewal notification                 | NOT RUN  |                                                                                                    |
| TC27 | Create an event with complete details                      | NOT RUN  |                                                                                                    |
| TC28 | Event field/date/capacity/price validation                 | NOT RUN  |                                                                                                    |
| TC29 | Timezone and calendar download                             | NOT RUN  |                                                                                                    |
| TC30 | Public discovery, filters and empty state                  | NOT RUN  |                                                                                                    |
| TC31 | Register and confirm server-selected price                 | NOT RUN  |                                                                                                    |
| TC32 | Duplicate registration, phone and closed bookings          | NOT RUN  |                                                                                                    |
| TC33 | Edit event and notify without repricing old tickets        | NOT RUN  |                                                                                                    |
| TC34 | Cancel own registration and re-register safely             | NOT RUN  |                                                                                                    |
| TC35 | Staff desk registration and cancellation                   | NOT RUN  |                                                                                                    |
| TC36 | Ordered queue, seat offer and claim                        | NOT RUN  |                                                                                                    |
| TC37 | Leave queue or offer and promote next attendee             | NOT RUN  |                                                                                                    |
| TC38 | Offer expiry and closed queue                              | NOT RUN  |                                                                                                    |
| TC39 | Event reminders and repeated worker runs                   | NOT RUN  |                                                                                                    |
| TC40 | Ticket download, print and backup code                     | NOT RUN  |                                                                                                    |
| TC41 | Manual code admission                                      | NOT RUN  |                                                                                                    |
| TC42 | Real camera QR and explicit confirmation                   | NOT RUN  |                                                                                                    |
| TC43 | Duplicate scan and two-door race                           | NOT RUN  |                                                                                                    |
| TC44 | Wrong event, invalid/revoked code and timeframe            | NOT RUN  |                                                                                                    |
| TC45 | Camera denied, unavailable and released                    | NOT RUN  |                                                                                                    |
| TC46 | Attended ticket cannot be cancelled or reused              | NOT RUN  |                                                                                                    |
| TC47 | Register search, statuses, pagination and CSV              | NOT RUN  |                                                                                                    |
| TC48 | Cancel a complete test event                               | NOT RUN  |                                                                                                    |
| TC49 | Cross-session live refresh and notification links          | NOT RUN  |                                                                                                    |
| TC50 | Add variants and input validation                          | NOT RUN  |                                                                                                    |
| TC51 | Select size, quantity and pricing                          | NOT RUN  |                                                                                                    |
| TC52 | Order and reconcile stock/history/ledger                   | NOT RUN  |                                                                                                    |
| TC53 | Last unit competition                                      | NOT RUN  |                                                                                                    |
| TC54 | Collection and duplicate collection                        | NOT RUN  |                                                                                                    |
| TC55 | Shopper privacy and sold-out state                         | NOT RUN  |                                                                                                    |
| TC56 | Order retry/refresh behavior                               | NOT RUN  |                                                                                                    |
| TC57 | Task creation, assignment, progress and boundaries         | NOT RUN  |                                                                                                    |
| TC58 | Publish, recipient fan-out and notice email                | NOT RUN  |                                                                                                    |
| TC59 | Preference opt-out and read markers                        | NOT RUN  |                                                                                                    |
| TC60 | Submit expense with receipt and ownership                  | NOT RUN  |                                                                                                    |
| TC61 | Expense amount/description/receipt validation              | NOT RUN  |                                                                                                    |
| TC62 | Approve another user's reimbursement                       | NOT RUN  |                                                                                                    |
| TC63 | Reject with reason and no balance effect                   | NOT RUN  |                                                                                                    |
| TC64 | Repeat/concurrent review and permission denial             | NOT RUN  |                                                                                                    |
| TC65 | Treasurer self-review                                      | NOT RUN  |                                                                                                    |
| TC66 | Fundraiser income and currency-isolated arithmetic         | NOT RUN  |                                                                                                    |
| TC67 | Overview reflects the database                             | NOT RUN  |                                                                                                    |
| TC68 | Ledger reconciliation by hand                              | NOT RUN  |                                                                                                    |
| TC69 | One complete club-day acceptance journey                   | NOT RUN  |                                                                                                    |
| TC70 | Desktop, tablet and phone coverage                         | NOT RUN  |                                                                                                    |
| TC71 | Keyboard and accessible feedback                           | NOT RUN  |                                                                                                    |
| TC72 | Empty/not-found/denied states                              | NOT RUN  |                                                                                                    |
| TC73 | Real delivery and stale-message suppression                | NOT RUN  |                                                                                                    |
| TC74 | Protected HTTP exports/jobs                                | NOT RUN  |                                                                                                    |
| TC75 | Network/database failure and uncertain save                | NOT RUN  |                                                                                                    |
| TC76 | Restart, backup and isolated restore                       | NOT RUN  |                                                                                                    |
| TC77 | Special characters, validation and create-form retries     | NOT RUN  |                                                                                                    |
| TC78 | Read-only payment page/navigation coverage                 | NOT RUN  |                                                                                                    |
| TC79 | Deferred payment acceptance gate                           | DEFERRED |                                                                                                    |
| TC80 | Former Staff denied attendee export after access rejection | NOT RUN  |                                                                                                    |
| TC81 | Export price/currency labels and payment-mode wording      | NOT RUN  |                                                                                                    |
| TC82 | Assigned volunteer status and ownership                    | NOT RUN  | Service regression passed; full manual procedure pending                                           |
| TC83 | Merchandise receive/correct and audit                      | NOT RUN  | Service regression passed; Staff empty-state browser check passed                                  |
| TC84 | Stock invalid/unauthorized/concurrent adjustments          | NOT RUN  | Scoped concurrency/role/retry regression passed                                                    |
| TC85 | Finance filters, pagination and CSV                        | NOT RUN  | INR filter/browser and service date/export checks passed; full manual dataset run pending          |
| TC86 | Private upload and receipt review                          | NOT RUN  | Live Storage/HTTP and Member PNG/download browser checks passed; complete Treasurer review pending |
| TC87 | Receipt type/size/input validation                         | NOT RUN  | Service file rejection checks passed                                                               |
| TC88 | Receipt URL access boundaries                              | NOT RUN  | Live Storage/HTTP and Member PNG/download browser checks passed; complete Treasurer review pending |
| TC89 | Expense retry and storage failure                          | NOT RUN  | In-memory transport regression passed                                                              |
| TC90 | Pending/unverified public event browsing                   | NOT RUN  | Public/protected HTTP checks passed; full manual OTP/approval journey pending                      |
| TC91 | Authorized real mailbox delivery                           | PASS     | 11 Oct 2026: application SENT, sent=1, failed=0; owner confirmed Received in Inbox                 |
