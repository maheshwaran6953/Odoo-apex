# Skyline complete manual testing guide

Updated: 11 October 2026. Baseline application: `d56a26e` and its preceding commits. Companion: [completion checklist](COMPLETION_CHECKLIST.md).

**This is a testing procedure, not an executed test report.** All new cases start NOT RUN. Prior service checks/limited browser checks are recorded in [repair verification](REPAIR_VERIFICATION.md). The guide covers every current page/module, negative inputs, permissions, data effects and important failure paths. Payment execution is deferred.

## 1. Before testing

1. Open `E:\Odoo-apex-main\Odoo-apex-main\skyline` in PowerShell.
2. Keep the existing private `.env`. Confirm the selected database is the one you intend to test; the current clone uses Supabase PostgreSQL.
3. Prefer a separate Supabase test database. Creating records through the UI is dynamic data, but it still changes that database. Do not run a reset/seed against the existing shared database to get an empty screen.
4. In an already configured clone, run `npm run dev -- --port 3001`; open `http://localhost:3001/login`. If dependencies/client are missing, use the README first-run instructions. Stop any previous Skyline server before starting another on this port.
5. In a second terminal from the same folder, start `npm run events:watch` only when testing jobs/email. It processes immediately and approximately every five minutes. Starting it can send queued messages in the selected database. Only use recipient accounts/mailboxes authorized for this test. Otherwise leave it stopped and mark mail-dependent cases BLOCKED.
6. Keep three isolated sessions: browser/profile A for Member, B for Staff, C for Treasurer. A normal tab and another normal tab share cookies; an incognito window also shares cookies with other windows in that same incognito session. Separate browsers/profiles avoid accidental account switching.
7. Verify each session's email in My account before mutations. Use the header Sign out button to switch accounts.
8. Use the existing passwords privately. Do not paste passwords, OTPs, full ticket tokens, reset URLs, .env contents or database rows into GitHub issues.
9. Choose a unique run prefix such as `QA-20261011-01`. Prefix all test business descriptions/names. Record IDs/URLs privately so the same records can be traced. Do not overwrite real events to test cancellation.
10. Record initial directory/event/task counts, stock and separate USD/INR ledger totals. All expected financial results below are **deltas from that baseline**; no existing balance is assumed to be zero.

### Roles used

| Session     | Existing account                        | Purpose                                                  |
| ----------- | --------------------------------------- | -------------------------------------------------------- |
| A           | maheshwaranpalanisamy1@gmail.com        | Member workflows                                         |
| B           | balajivasun@gmail.com                   | Staff and designated role approval                       |
| C           | smohamedanas02@gmail.com                | Treasurer workflows                                      |
| D, optional | New account using a mailbox you control | OTP/pending/rejected/disabled/ordinary-Staff tests       |
| E, optional | Second approved Treasurer you control   | Concurrent decisions and reviewing Treasurer's own claim |

Do not disable/reset passwords of the three initial accounts. Use disposable approved accounts for destructive access/password tests. OTP delivery blocks new-account testing until a real email is received; do not bypass it.

### Test data worksheet

Fill relative dates using the actual current time; do not reuse expired sample dates.

| Alias      | Data entered through UI                                                                                                                                            | Reason                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| MAIN       | `PREFIX Campus Social`; Practice/USD; starts now + 6 hours; deadline now + 3 hours; capacity 5; member price 10.00; guest price 20.00; location Student Union Hall | Registration, price, edit, QR and attendance    |
| QUEUE      | `PREFIX Queue Workshop`; Practice/USD; starts tomorrow; deadline now + 6 hours; capacity 1; prices 5.00 / 10.00                                                    | Cancellation and waitlist order/claim           |
| EXPIRY     | `PREFIX Short Offer`; starts now + 3 hours; deadline now + 8 minutes; capacity 1; prices 5.00 / 10.00                                                              | Deadline/offer expiry without waiting two hours |
| FAR        | `PREFIX Next Week`; starts now + 7 days; deadline now + 6 days; capacity 3                                                                                         | Check-in too early                              |
| CANCEL     | `PREFIX Cancelled Social`; starts tomorrow; capacity 3                                                                                                             | Whole-event cancellation                        |
| RACE       | `PREFIX Last Seat`; starts tomorrow; capacity 1                                                                                                                    | Concurrent registration                         |
| FREE       | `PREFIX Free Meeting`; starts tomorrow; prices 0.00 / 0.00                                                                                                         | Allowed free Practice registration              |
| Product    | `PREFIX Skyline Hoodie`; Category Hoodie; size M stock 3, size L stock 2; regular 30.00, member 25.00                                                              | Variant selection, discount and collection      |
| Last unit  | `PREFIX Last Hoodie`; size M stock 1; regular/member 12.00 / 10.00                                                                                                 | Concurrent last stock unit                      |
| Task       | `PREFIX Bake-sale setup`; assign approved Member; due tomorrow; notes `Bring tablecloth and signs to the student union.`                                           | Task board                                      |
| Notice     | `PREFIX Volunteer meeting`; body `Meet at the Student Union at 10:00 tomorrow. Bring the setup checklist.`                                                         | Archive, in-app updates and email               |
| Expenses   | `PREFIX Printing` USD 12.50; `PREFIX Snacks` USD 8.00; `PREFIX Travel` INR 50.00                                                                                   | Approval/rejection and currency separation      |
| Fundraiser | `PREFIX Bake-sale receipts` USD 100.00                                                                                                                             | Income posting                                  |

For each event, use a description of at least 10 characters, such as `Campus gathering for Skyline members and guests.` Use a controlled organizer mailbox if testing organizer email. Schedule example: `Doors open 30 minutes before the start. Step-free access at the east entrance.`

Registration limits valid-shaped attempts to ten per hour for the same client/IP budget, including attempts using an existing email. Spread account creation across time or use a reviewed isolated fixture set; do not bypass rate limits. Reuse controlled disposable accounts where their required state matches the case, and track which account each case uses.

Prepare new inbox-controlled users only as needed. Staff/Treasurer can attend events, so the existing three identities can exercise a three-person waitlist without manufacturing extra students. Staff can order merchandise; Treasurer cannot.

## 2. How to record results

For each case record:

| Case | Tester/date | Build/commit | Browser/device/role | Actual result | PASS / FAIL / BLOCKED / NOT RUN | Redacted evidence / issue |
| ---- | ----------- | ------------ | ------------------- | ------------- | ------------------------------- | ------------------------- |
| TC01 | Fill in     | Fill in      | Fill in             | Fill in       | NOT RUN                         | Fill in                   |

PASS means every expected result was observed, including the data effect after refresh. BLOCKED means a missing prerequisite (such as email/hardware), not a successful test. For failures record exact steps, safe inputs, expected vs actual, time/timezone, page URL without secrets and severity. Screenshots must hide OTPs/ticket codes/private credentials.

- Critical: unauthorized access, incorrect money, lost records, duplicate admission/overbooking.
- High: blocked registration, broken approval, orders/expenses incorrectly saved, wrong expiry behavior.
- Medium: incorrect messages/filter/export/time display.
- Low: cosmetic/usability issue without lost behavior.

A browser validation bubble proves client validation only. The provided service verification scripts exercise server constraints; direct-URL tests exercise page access. Do not claim that this manual guide alone is a penetration test or proof of every concurrent interleaving.

## 3. Startup, login and navigation

### TC01 — Start and confirm persistence

1. Start the configured app; visit `/login` and `/events` signed out.
2. Confirm pages render and no database exception appears.
3. Sign in as Staff, observe current counts, then refresh.
4. Stop/restart only this app server and revisit the same page.

**Expected:** Existing records persist. No seed/reset runs at startup; missing business records produce honest empty states. Database unavailability is handled separately in TC75.

### TC02 — Three-role login and identity

1. Sign in in separate sessions A/B/C with the correct existing credentials.
2. Check landing routes: Member `/my-events`, Staff `/`, Treasurer `/treasurer`.
3. Open My account and verify each account's name/email/role.
4. Refresh and navigate between permitted pages.

**Expected:** Identity remains correct and isolated; one role's records are not attributed to a different account. An attendee's own ticket is available regardless of their role; entry verification is Staff-only.

### TC03 — Navigation at desktop/mobile and logout

1. On desktop, check the role's four shortcuts and open More.
2. Member: My events / Events / Club shop / Volunteers. Staff: Overview / Events / Members / Volunteers. Treasurer: Finance / Members / Events / Overview.
3. Select a More link; confirm destination and active section. Repeat opening More then click outside it; repeat with Escape.
4. At phone width, confirm the five-item bottom bar stays visible while scrolling and does not cover the last form action.
5. Use My updates/My account header controls. Sign out, use Back, then refresh a protected page.

**Expected:** More closes correctly; Escape returns focus when appropriate. Sign-out returns to `/login` and protected data is unavailable after a fresh request. Do not assume browser Back instantly clears previously painted content without a reload.

## 4. Registration, OTP and approval

### TC04 — Real new Member registration and verification

1. In session D signed out, open Create account (`/register`).
2. Enter a unique controlled email, full name `PREFIX New Student`, a private password of 12–256 characters and matching confirmation; choose Student / Member.
3. Click Create account. Confirm `/verify-email` shows the exact intended email.
4. Inspect that mailbox's inbox/spam for the Skyline OTP and record receipt time, not the code itself.
5. Enter the latest six-digit code and click Verify email; follow View approval status.
6. Try `/my-events` before Staff approval.

**Expected:** Email verifies, but role access remains PENDING and protected operations are blocked. No paid membership or dues posting is created merely by signup. If no email arrives, record BLOCKED and investigate delivery rather than approving manually.

### TC05 — Registration validation and duplicate email

1. Before creating another account, test each separately: blank/name one character; malformed email; 11-character password; mismatched confirmation.
2. Try boundary-valid name/password lengths, then lengths over 100/256 where entry is permitted.
3. Attempt signup with an already registered email; repeat with different letter casing/outer whitespace.
4. Keep every other field valid while changing only the tested field.

**Expected:** Invalid inputs do not create accounts. Valid registration preserves the requested role only as a request. Normalized duplicate email does not create a second identity. Long fields may be constrained by the input itself; note that limitation instead of calling it a server test.

### TC06 — OTP format, wrong attempts and cooldown

1. On an unverified disposable account, submit blank, five-digit and alphabetic codes.
2. Submit a wrong six-digit code, chosen so it is not the real received code, five times.
3. Attempt the correct current code after exhausting attempts.
4. Click Send a new code; immediately click it again before 60 seconds.
5. Wait at least 60 seconds, request a new code, receive it and verify.

**Expected:** Bad format/wrong code fails safely; five wrong attempts exhaust that challenge. Immediate resend is rejected; a new challenge resets its attempt budget subject to request limits. Codes are never shown in the application.

### TC07 — Latest code, expiry and reuse

1. Request code A on an unverified test account; wait 60 seconds and request code B.
2. Enter A: expect failure. Enter B within 10 minutes: expect success.
3. Attempt B again or reopen the verification page.
4. On another unverified account, request a code, wait beyond 10 minutes, then enter it. Request a fresh code and retry.

**Expected:** Only the latest unexpired code works; successful verification is not repeat-consumed. Expired challenge cannot grant access. Leading zeros must be entered intact if a real random code starts with zero; do not force a code by editing production records.

### TC08 — OTP hourly limit and unavailable delivery

1. On a disposable unverified account, request five codes within one hour including initial signup issuance, spacing requests at least 60 seconds apart.
2. Attempt a sixth; after the recorded window ends request again.
3. For configuration failure testing, use a separate test environment with delivery disabled/unavailable; register there and inspect verification status.

**Expected:** Sixth request is rejected until its hourly window expires. Configuration failure never silently marks the user verified or approved. This is a scheduled long-running case; do not change the operating-system clock or shared credentials to accelerate it.

### TC09 — Designated Staff approves a verified Member

1. Sign in as designated Staff in B; More → User access (`/admin/users`).
2. Find the TC04 user; inspect Requested, Granted, PENDING and Verified labels.
3. Select Approve requested role and click Record decision.
4. Refresh session D. Its old session should be revoked; sign in again.
5. Check `/my-events`, account role and the Member directory in B.

**Expected:** Approval grants MEMBER, records the decision and links a directory identity. Dues remain unconfigured/unpaid until explicitly set/recorded. Only a new sign-in grants the new effective access.

### TC10 — Requested Staff approval and ordinary Staff permissions

1. Register a controlled disposable account requesting Staff; perform real OTP verification.
2. Before approval try `/events/check-in`, `/admin/users` and creating an event.
3. Designated Staff approves; applicant signs in again.
4. Confirm Staff landing and event/task/inventory controls.
5. Try `/admin/users` as this ordinary Staff.

**Expected:** No privilege before approval. Approved ordinary Staff gains operational Staff permissions but cannot approve users. Staff role and designated approval capability are separate.

### TC11 — Requested Treasurer approval

1. Register a controlled account requesting Treasurer; verify OTP, then inspect pending status.
2. Try `/treasurer` before approval; designated Staff approves, then sign in again.
3. Confirm Finance landing; try Door check-in, event management and User access.

**Expected:** Finance access only after verification/approval. Staff-only operations remain forbidden. This account can later review another Treasurer's claim for TC65.

### TC12 — Approval cannot bypass unverified email

1. Register a disposable account but do not submit its received OTP.
2. As designated Staff, attempt Approve requested role for that user.
3. Recheck its status and try protected routes as the applicant.

**Expected:** Action rejects approval with verification guidance; no privileged access. Any stale UI text suggesting manual Staff identity confirmation is a copy defect; that bypass is disabled in the current server implementation.

### TC13 — Rejection and later explicit approval

1. On a disposable pending user, choose Reject request with an empty/one-character reason; submit.
2. Supply `Testing rejection explanation` and Record decision.
3. Re-sign in as the applicant; inspect status/reason and try a protected action.
4. If the email is verified, designated Staff explicitly approves that same test user; applicant signs in again.

**Expected:** Rejection requires a reason of at least three characters. Rejected user cannot operate the club. A later explicit approval grants their requested role and revokes previous sessions.

### TC14 — Disable and re-enable a disposable user

1. Sign in an approved disposable account in D and leave a protected page open.
2. Designated Staff selects Disable access for that account and records it.
3. Refresh D; attempt sign-in and a stale form submission.
4. Designated Staff explicitly approves the verified account to re-enable it; sign in again.
5. Inspect designated Staff's own card: no self-disable/role-decision control should be offered.

**Expected:** Disabled account loses existing sessions and cannot mutate records. Re-enabling is an explicit decision. Initial designated approver is protected; do not use an initial account for this case.

## 5. Recovery, session security and RBAC

### TC15 — Wrong login, lockout and recovery

1. On a disposable account, enter a wrong password once; repeat until five failures are recorded for that email.
2. Try its correct password while locked; wait 15 minutes and retry.
3. Try a nonexistent email and inspect the wording; do not use initial accounts for the lockout exercise.
4. After successful login, refresh a protected page and sign out.

**Expected:** Incorrect email/password uses a generic error. Five failures trigger the 15-minute retry restriction. Successful login clears the failure record. No password/hash appears in the UI.

### TC16 — Reset link, password change, reuse and expiry

1. On a disposable approved account, open My account → Change password via reset link, or `/forgot-password` signed out.
2. Enter its controlled email and Request reset link; run the authorized worker/single job so queued reset email can be delivered.
3. Receive the link in the mailbox and open it. Enter a new private password of at least 12 characters; click Save new password yourself.
4. Confirm the old password fails, new password succeeds and another existing session for that user is revoked after refresh.
5. Reopen the consumed link: expect an invalid/expired/used message. Test `/reset-password` without a token and with an invented token.
6. For expiry, use a separate disposable account/link and wait over one hour before submitting. Test unknown-email reset request: response should not confirm account existence.

**Expected:** One-time reset updates only the intended account and revokes sessions. Required external email receipt must be observed, not assumed from queued status. Do not reset the three review accounts.

### TC17 — Direct-route permission matrix

For each role, type each route into the address bar, not only click its visible links. For event management, use a real test event ID. After denied navigation, confirm no confidential records or active controls rendered.

| Destination                                      | Signed out | Approved Member                   | Approved Staff           | Approved Treasurer                |
| ------------------------------------------------ | ---------- | --------------------------------- | ------------------------ | --------------------------------- |
| `/events`, event detail                          | Public     | Allowed                           | Allowed                  | Allowed                           |
| `/`, `/my-events`, `/account`, `/notifications`  | Login      | Allowed                           | Allowed                  | Allowed                           |
| `/members`                                       | Login      | Denied                            | Allowed                  | Allowed                           |
| `/events/[id]/manage`, `/events/check-in`        | Login      | Denied                            | Allowed                  | Denied                            |
| `/merchandise`, `/fundraisers`, `/announcements` | Login      | Allowed with role-limited actions | Allowed                  | Allowed with role-limited actions |
| `/treasurer`                                     | Login      | Denied                            | Denied                   | Allowed                           |
| `/admin/users`                                   | Login      | Denied                            | Designated approver only | Denied                            |
| `/admin/payments`                                | Login      | Denied                            | Allowed                  | Allowed                           |

**Expected:** Redirect, restricted-desk UI or denial is acceptable according to the current page; unauthorized data/actions must remain inaccessible. Shared Overview currently shows currency-separated club balance even to Members; detailed finance/review stays Treasurer-only. If the intended privacy policy differs, record a requirement change rather than pretending that balance is hidden today.

### TC18 — Ownership across tickets, expenses and updates

1. Register Member A for a test event; save its private ticket URL in the test worksheet.
2. As Treasurer C, open A's URL; as a different Member, repeat if available.
3. As Staff B, open that URL for attendee support.
4. Inspect My events, My orders, My expense requests and My updates in each session.
5. Create an expense/update for A and verify it is absent from C's personal lists, while permitted finance/staff views show only their authorized scope.

**Expected:** A sees their own ticket; Staff can inspect it; non-owner Treasurer/Member cannot. Personal lists are scoped to signed-in identity. Staff sees club shop orders; Treasurer's shop history is only their own legacy records, not all buyers.

### TC19 — Pending/disabled account and stale form access

1. As a disposable pending user, try `/`, `/members`, `/my-events`, `/merchandise` and `/treasurer`.
2. With an approved disposable Staff account, open an event edit form, then disable that account through designated Staff in another session.
3. Attempt Save in the stale tab; refresh and try the page again.
4. For session expiry, schedule a check after the actual seven-day expiry, or request a reviewed isolated fixture from the developer. Do not change the system clock.

**Expected:** Unverified user is redirected to verification; verified pending/rejected user to approval status. Revoked/expired session cannot perform the queued action. Do not call a normal browser restart an expiry test. Signed-in pending users currently may be redirected even by Browse public events; log this navigation-policy mismatch separately.

## 6. Membership and dues

### TC20 — Directory search and filters

1. Staff opens Members (`/members`); record In the directory, Active memberships and Needs attention.
2. Search by part of name, full email and different capitalization.
3. Select All memberships, Active, Pending dues and Expired.
4. Search an unmatched value, then clear it.

**Expected:** Visible rows/count update correctly; no-match state is honest. Active means status ACTIVE plus an unexpired membership. The directory is not the user-approval screen.

### TC21 — Add directory member and validate identity

1. Staff expands + Add a member.
2. Enter `PREFIX Directory Student`, a controlled unique email and Annual dues 50.00; Add to directory.
3. Refresh and search that email; repeat Add with the same email.
4. Separately test one-character/blank name, invalid email, dues blank/0/negative/three decimals/100000.01.

**Expected:** One directory record and PENDING membership exist; no login/password or verified/approved account is created by directory entry. Invalid/duplicate inputs do not add records. A directory-only address receives no account notifications until a verified approved account is linked.

### TC22 — Set dues for an account-created Member

1. Use the newly approved Member from TC09 whose membership is unconfigured; find them in Members.
2. Open Set up dues, enter 50.00 USD and Save dues.
3. Check Pending dues, amount and My account's linked membership; refresh Finance.
4. Change the amount to 55.00 through Set annual dues, then restore 50.00 for the next case.

**Expected:** Dues setup changes the configured amount without posting income or activating discounts. For active memberships, changing annual dues alone must not erase current validity or rewrite previously posted income.

### TC23 — Record dues and verify exact ledger change

1. Confirm TC22 membership is pending and configured at 50.00. Record initial USD ledger income/balance and Active memberships count.
2. Staff or Treasurer clicks Record dues once after treating this test as a record of separately received dues, not online collection.
3. Refresh Members, My account, Overview and Treasurer desk.
4. Check a DUES income entry of 50.00; record expiry and eligibility.

**Expected:** Membership ACTIVE for one additional year, active count +1, USD posted income/balance +50.00, no bank charge. This test changes records; use the test dataset.

### TC24 — Repeated/concurrent dues recording

1. On a fresh pending test membership, open its Record dues control as Staff and Treasurer before either submits.
2. Submit near-simultaneously; refresh both views.
3. Retry using a stale control or refresh the member row after success.

**Expected:** Exactly one activation/DUES posting for that eligible period. Once active and not due within 30 days, the control becomes Up to date or stale submission is rejected; no repeated year extension or double income.

### TC25 — Early renewal preserves remaining paid time

**Prerequisite:** An isolated test membership genuinely expires within 30 days; there is no UI expiry editor. Developer-prepared dated fixtures or scheduled real-time testing are needed. Do not edit the shared database manually.

1. Record current expiry and dues amount.
2. Staff/Treasurer clicks Record renewal before expiry.
3. Verify new expiry is one calendar year after the previous expiry, not one year from today.
4. Confirm exactly one new DUES entry and no repeated renewal after refresh.

**Expected:** Remaining paid time is preserved. If the fixture is unavailable, record BLOCKED for manual acceptance; prior `verify:basics` evidence covers this service rule but is not this browser run.

### TC26 — Membership expiry and renewal notification

**Prerequisite:** Isolated dated memberships: one active within 30 days, one just expired, one not due; each linked to a controlled approved verified user.

1. Run `npm run events:jobs` in the selected authorized test environment.
2. Inspect Members, each My account and each My updates.
3. Run the job again; inspect for duplicate notices.
4. Receive opted-in membership messages; renew the eligible member, then ensure obsolete queued messages do not arrive after renewal.

**Expected:** Due membership gets renewal notice; expired membership loses active benefits and shows EXPIRED; not-due membership gets no renewal notice. Repeat jobs do not create duplicate notifications for the same membership/expiry/stage. Inbox acceptance remains separately recorded.

## 7. Event creation, discovery and booking

### TC27 — Create an event with complete details

1. As Staff, Events → + Put an event on the calendar.
2. Select Practice — simulated registration and USD; enter MAIN worksheet data, description, schedule and controlled organizer email.
3. Click Create event & open bookings; find it in Upcoming and open View details.
4. Refresh and check date/time/location/deadline/capacity/prices/schedule and Ask the organizer link.

**Expected:** Persisted event and open booking state; initial availability 5, no fabricated attendees. Member/Treasurer cannot create events. Static page illustrations/branding are not business data.

### TC28 — Event field/date/capacity/price validation

Repeat creation with only one changed invalid field per attempt:

1. Blank/event name 2 characters; description 9 characters; blank location; invalid organizer email.
2. Start in the past; deadline in the past; deadline later than start.
3. Capacity 0, −1, 1.5, 10001; prices −1, blank, 1.999, 100000.01.
4. After each failure, verify no event with that attempted name was created.
5. Create FREE with both prices 0.00 and no optional deadline/contact; also verify positive integer capacity 1 is valid.

**Expected:** Invalid values rejected and no partial event. Zero Practice prices are valid; blank is not zero. Practice requires USD. Do not submit Razorpay test checkout merely to test this module; its execution remains deferred.

### TC29 — Timezone and calendar download

1. Enter MAIN start in your local timezone; note exact local time and timezone (for this team, Asia/Kolkata).
2. Compare event listing/detail, edit field and ticket date/time.
3. Click Add to calendar; download the `.ics` and import/open it in a calendar without inviting anyone.
4. Confirm the calendar entry represents the same instant, location and event title.
5. Compare event/ticket/waitlist labels: campus timezone is Asia/Kolkata by default, regardless of the server timezone. Calendar clients display the same stored instant in their local zone.

**Expected:** Stored instant and calendar are correct; editing without changing time does not shift it. Server-rendered operational labels use the configured campus zone. A deployment timezone change must not alter the displayed instant; report inconsistencies.

### TC30 — Public discovery, filters and empty state

1. Signed out, visit `/events`; search MAIN by name and Student Union by location, Apply filters.
2. Select Upcoming/Past/Cancelled/All events using appropriate test data.
3. Search a nonexistent event; Reset filters.
4. Open View details and Sign in to register.

**Expected:** Filtered records match the selected state, sorted by start time; public detail exposes event information but not private attendees/tickets. No-match state offers recovery. Cancelled event is not presented as bookable.

### TC31 — Register and confirm server-selected price

1. Before activation, use a approved Member with no active membership to register for MAIN; note guest price 20.00.
2. Use another approved active Member after TC23 to register for MAIN; note member price 10.00.
3. Leave optional phone blank in one registration; in another use a safe test-formatted number such as `+1 202 555 0143` (no message is sent).
4. Click Confirm registration, open the provided ticket/My events; inspect attendee identity, type, recorded price and status.
5. Staff checks Manage event; Treasurer checks the corresponding practice TICKET entries.

**Expected:** One ticket per account/event; server eligibility selects price, never a user-selected discounted type. Availability decreases once and practice ledger delta matches the stored price; no real payment is taken. If A's membership is already active, use the fresh approved unpaid Member for the first step; do not revoke initial membership just for testing.

### TC32 — Duplicate registration, phone and closed bookings

1. After TC31, revisit MAIN: expect View my QR ticket rather than another booking.
2. Attempt a stale duplicate registration from another tab already open under that same account.
3. On a different event, enter alphabetic phone text or over 30 characters while all other inputs are valid; retry with blank phone.
4. On EXPIRY wait until the registration deadline passes, then try booking; repeat after an event starts.

**Expected:** No duplicate ticket/ledger/capacity effect; invalid phone rejected, blank allowed. No new registration after deadline/start or cancellation. Test exact boundary near deadline by noting server response time, not relying only on the page's old label.

### TC33 — Edit event and notify without repricing old tickets

1. As Staff open MAIN → Manage event → Edit event details.
2. Change location to `Student Union East Hall`, schedule and future start; maintain a future valid deadline and save.
3. Check public page, existing ticket, registered users' My updates and waitlisted users if present; receive email in authorized inboxes with worker processing.
4. Change member/guest price for future registrations; inspect existing tickets/ledger for unchanged recorded prices.
5. Attempt capacity below registered + active offers/holds and attempt changing checkout mode/currency after ticket history exists.

**Expected:** Valid updates persist and relevant recipients get event-change notifications. Existing ticket amounts remain snapshots. Capacity reduction below commitments fails; mode/currency lock applies even after cancelled booking history. If repeated focus refresh discards partially entered edit values, log it for correction.

## 8. Cancellation, waitlist and reminders

### TC34 — Cancel own registration and re-register safely

1. Use a fresh paid Practice ticket on QUEUE before its start; record availability and linked TICKET posting.
2. Ticket → Can’t make it? → Cancel registration & release seat.
3. Check My events shows Cancelled; ticket has no usable QR and Finance linked income is Voided.
4. Try the old downloaded QR/backup code at the correct door; expect rejection.
5. If booking is still open and no offer holds the seat, register again; check one active ticket and new price/code effects, without resurrecting old QR.

**Expected:** Seat released or offered to the queue; prior simulated income excluded from posted totals. Repeated cancellation cannot void unrelated records. Do not count revoked screenshots as still-valid admission.

### TC35 — Staff desk registration and cancellation

1. As Staff, QUEUE → Manage event → Register a verified attendee at the desk.
2. Select an approved verified controlled account and Confirm registration.
3. Verify target attendee's My events, not Staff's own history; check capacity and price.
4. On the attendee row expand Cancel registration → Confirm cancellation.
5. If an unapproved/unverified/disabled target appears in a stale selector, attempt it only with a disposable test identity.

**Expected:** Authorized Staff can create a Practice booking for an eligible attendee; underlying service rejects ineligible identities even if the selector is stale. Desk registration cannot bypass test-payment mode. Cancellation revokes only that ticket.

### TC36 — Ordered queue, seat offer and claim

1. Create QUEUE capacity 1. Member A registers. Treasurer C joins its waitlist; Staff B joins afterward as an attendee.
2. Check C position 1, B position 2 in My events and Staff management.
3. Attempt repeat waitlist join using a stale form; cancel A's registration.
4. Check C gets OFFERED, B stays WAITING, and available seats remain held rather than offered to everyone.
5. As C open offer via My updates/Event details and Claim my seat before expiry.
6. Check registered ticket, offer CLAIMED, queue counts and exactly one new TICKET posting.

**Expected:** Joining order respected; no duplicate queue entry, no charge/ticket merely for waiting, one held seat only for its offered user. Claim creates a real persisted Practice registration, not a gateway payment. If refreshing jobs is needed, use Staff Refresh offers & reminders or an authorized job run.

### TC37 — Leave queue or offer and promote next attendee

1. On another capacity-1 test event, fill it and join C then B.
2. As C waiting, click Leave waitlist; confirm C disappears from active personal queue and B moves to position 1.
3. Repeat with C offered a released seat: leave before claiming.
4. Check B receives the next offer, and C cannot claim the released old offer without current availability/eligibility.

**Expected:** LEFT entries do not reserve seats; promotion preserves queue rules. No extra income/QR for simply joining/leaving. Event management retains status history even if personal list no longer shows LEFT.

### TC38 — Offer expiry and closed queue

1. On EXPIRY fill the seat with A; C and B join the queue.
2. Cancel A while deadline is still several minutes away; C's offer expiry is no later than the deadline, even though offers ordinarily last up to two hours.
3. Do not claim. Wait past displayed expiry; run Refresh offers & reminders or `events:jobs`.
4. Inspect C and B statuses and try claiming/booking after the deadline.
5. For promotion while booking remains open, use a separate open event and let a full two-hour offer expire, or use reviewed isolated dated fixtures; record this extended check separately.

**Expected:** C offer expires; no expired claim accepted. At closed deadline remaining WAITING/OFFERED entries close and no new offer is created. A deadline-closing test does not prove the separate next-person promotion while still open.

### TC39 — Event reminders and repeated worker runs

1. With a PAID ticket on MAIN starting within 24 hours, run authorized jobs; inspect My updates for Your event is coming up and its ticket link.
2. Receive the reminder in an opted-in controlled mailbox; run jobs again.
3. Cancel a separate test registration before dispatch; ensure it receives no valid upcoming reminder afterward.
4. Reschedule a registered event outside 24 hours; ensure queued reminder for its old start is suppressed, then test its new reminder when eligible.
5. Repeat with email preference off: in-app update persists, email is not sent.

**Expected:** One reminder per ticket/current-start; cancelled/checked-in/past tickets do not get current upcoming reminders. Changing a schedule invalidates stale delivery and permits a reminder for the new start. Provider acceptance and actual receipt are separate evidence.

## 9. QR ticket and admission

### TC40 — Ticket download, print and backup code

1. As its registered attendee, open MAIN ticket through My events.
2. Check attendee, event, date/location, ticket category and recorded price; confirm QR is present only while valid.
3. Download QR: open the saved `.svg` and scan it in TC42. Keep that file private.
4. Print ticket: inspect print preview/PDF; verify navigation is omitted and QR/text are legible.
5. Copy code and paste it into a private local scratch field; compare to displayed backup code.

**Expected:** Download contains scannable QR; print is usable; copy returns the exact code or fails without falsely claiming a copy. It is a QR SVG download, not an invoice/PDF generator. Do not include the code in public evidence.

### TC41 — Manual code admission

1. Ensure MAIN starts within the door window (12 hours before/after start) and ticket is still PAID.
2. Staff → More → Door check-in; choose MAIN under Event at this door and Open this event.
3. Paste the attendee's backup code into Scanned QR or backup code; click Verify & record entry.
4. Check success names the correct attendee/event; Recently welcomed shows the timestamp.
5. Refresh Manage event and attendee's ticket/My events.

**Expected:** Exactly one transition PAID → CHECKED_IN with timestamp; management attendance +1, ticket Already attended and reusable QR no longer displayed. Verification is a server/database decision, not the QR reader's verdict.

### TC42 — Real camera QR and explicit confirmation

1. Use a second unconsumed MAIN ticket; display QR on another device/screen or use its printed copy.
2. As Staff on the scanner device, open the correct door, click Scan QR with camera and grant that app's camera permission yourself.
3. Point at QR; check it fills the code and scanning stops.
4. Before pressing Verify & record entry, check attendee status is still Registered.
5. Click Verify & record entry; inspect the same effects as TC41.

**Expected:** Scanning alone records no attendance; explicit server confirmation records entry once. A phone browsing `http://<laptop-LAN-IP>:3001` is not browsing its own localhost and camera may be blocked on that insecure origin. Use an HTTPS test deployment for phone-to-server camera testing. Do not mark manual-code success as camera success.

### TC43 — Duplicate scan and two-door race

1. Reuse TC41/TC42 consumed QR or backup code; click Verify & record entry.
2. Confirm rejection includes already-used guidance and no new attendance timestamp/count.
3. For the concurrent case, prepare a fresh unconsumed ticket and two Staff sessions/door tabs on the same event.
4. Fill the same code in both; click verification near-simultaneously and refresh management.

**Expected:** Exactly one successful entry; the other is rejected as already used/just used. Original checkedInAt remains stable. Two scanners must not permit two admissions even if both had stale Registered pages.

### TC44 — Wrong event, invalid/revoked code and timeframe

1. Select another valid event's door and submit a MAIN code.
2. Submit a made-up `SKY-INVALID-TEST`, an empty code and an unrelated QR string.
3. Submit a cancelled ticket's saved QR/code on the original event.
4. Use FAR's real valid ticket while it starts more than 12 hours away.
5. For too-late entry use a dedicated event after 12 hours past start (scheduled/isolated fixture); do not alter system time.

**Expected:** Wrong/invalid/cancelled code rejected; too-early/late code rejected; no attendance recorded. Door event list may omit too-old events, which is valid UI behavior; a server boundary requires a service check or reviewed fixture.

### TC45 — Camera denied, unavailable and released

1. On scanner device deny camera permission; click Scan QR with camera.
2. Check explanation and manual field remain usable; verify a separate valid ticket manually.
3. Allow camera on a device with it available; start then Stop camera.
4. Start again, navigate away, and check device's camera-use indicator stops.
5. If hardware is absent, record this case as BLOCKED for real-device acceptance; still test the visible fallback.

**Expected:** No blank/crashed screen; fallback works; scanning stops on stop/navigation and does not silently record entry. No microphone permission is requested by this scanner.

### TC46 — Attended ticket cannot be cancelled or reused

1. As TC41 attendee open the now-checked-in ticket; inspect Already attended/timestamp and absence of cancellation/valid QR.
2. Try cancellation from a stale previously open ticket form before refreshing.
3. As Staff inspect row status and try a stale registration-cancellation form.

**Expected:** Checked-in ticket cannot be cancelled; registered/attendance totals remain consistent. A copied QR identifies an admission token, not the physical holder's identity; Staff should compare the displayed attendee details with the student under the club's entry procedure.

## 10. Attendee management and whole-event cancellation

### TC47 — Register search, statuses, pagination and CSV

1. Staff opens MAIN Manage event; check Registered/capacity, Checked in/attendance %, Waiting/held and simulated ticket value.
2. Search attendee name, email and private code; apply Registered/Checked in/Cancelled and All statuses.
3. Check columns: attendee, contact, code, type/price, status, entry time and actions.
4. Export CSV; open in a spreadsheet and compare rows/statuses/prices to the event's database-backed management view, not just the first visible page.
5. For pagination, use a separately prepared event with more than 20 authorized attendees: Next/Previous should preserve filters and not duplicate/omit records. Mark this part BLOCKED if that dataset is absent.
6. Signed out/Member/Treasurer tries `/api/events/REAL_EVENT_ID/attendees`; none should download private attendee data.

**Expected:** Correct filtering/counts/export and Staff-only attendee disclosure. Literal special-character names/text do not become executable spreadsheet formulas; if formula-like cells are not escaped, report that export defect. Preserve ticket codes privately.

### TC48 — Cancel a complete test event

1. Use CANCEL with registered attendees and a waitlist; capture capacity, ticket statuses and linked ledger entries.
2. Staff Manage event → Cancel this event. Attempt submission without its confirmation checkbox, then select it and Confirm event cancellation.
3. Inspect public Cancelled state, registered users' tickets/My updates, management queue and Finance.
4. Try new registration, old QR entry, edit controls and a repeated stale cancellation.

**Expected:** Event cancelled, entry/booking closed, active tickets revoked and applicable practice ticket ledger entries voided. Waitlist closes; recipients get cancellation updates. No real refund occurs. Already-recorded attendance should remain internally coherent; any inconsistent counts/history are a defect to record.

### TC49 — Cross-session live refresh and notification links

1. Keep attendee's event/My events/My updates page visible while Staff edits/cancels a test event or issues a waitlist offer.
2. Allow approximately 20 seconds for the existing visible-page polling; also blur/refocus the tab.
3. Click View details on each notification; verify it opens the correct event, ticket or personal page.
4. Repeat after hard refresh, including a ticket whose status changed in another session.

**Expected:** Supported event/ticket/update pages refresh current persisted data; no Supabase subscription is implied. Overview/shop/finance may need navigation/manual refresh. In-app notification content is not proof an email was delivered.

## 11. Merchandise

### TC50 — Add variants and input validation

1. Staff opens Club shop → Add inventory item; create Product size M stock 3 regular 30.00 member 25.00, then same product name/category size L stock 2.
2. Confirm one grouped product card with both size choices and correct per-size stock.
3. Separately try empty/one-character product, blank category, stock −1/1.5/1000001, invalid money and member price greater than regular.
4. Add a separate one-size item with size blank, stock 0, price 0.00 and member price blank.

**Expected:** Valid variants persist; invalid additions create no item. Stock is a nonnegative integer, zero-stock sold-out is supported, blank member price means no discount. Size is free text, not a enforced S/M/L/XL-only enum. Repeated same-size variants should be reviewed for ambiguity rather than assuming a unique-SKU rule exists.

### TC51 — Select size, quantity and pricing

1. As active Member open Product; select M, quantity 2: verify total 50.00.
2. Switch to L: quantity resets to 1 and availability reflects L, not M.
3. As approved unpaid/expired Member, check regular 30.00 applies; as Treasurer, check order button is disabled.
4. Try quantity 0/negative/1.5/greater than stock/greater than 10; leave a blank amount where possible.

**Expected:** Client display and server order agree on eligible price; quantity limited to positive integers, max 10 and available stock. No fabricated discount from account role alone. Optional fixtures are required for an expired member; do not change initial membership records arbitrarily.

### TC52 — Order and reconcile stock/history/ledger

1. Record M stock and USD balance; active Member orders M quantity 2 with Place club order.
2. Read success, refresh shop and My club orders.
3. Staff checks Club orders and collection, buyer, line quantities/unit prices and total.
4. Treasurer checks corresponding MERCHANDISE posting.

**Expected:** M stock −2, L unchanged; owned history stores quantity 2 × 25.00 = 50.00, awaiting collection; USD practice posting +50.00. No Razorpay window/online charge. A price later changed in controlled test data must not rewrite old order unit prices.

### TC53 — Last unit competition

1. Staff creates Last unit stock 1; sign in Member A and Staff B in separate sessions, both opening that variant before either buys.
2. Submit quantity 1 from both near-simultaneously; record responses and refresh stock/orders/ledger.

**Expected:** Exactly one successful order and one matching income posting; stock 0, never negative. Loser receives stock-change/unavailable feedback, no partial order. Treasurer cannot be used as a shopper for this race.

### TC54 — Collection and duplicate collection

1. Staff finds TC52 order and clicks Mark collected.
2. Refresh and check Collected plus collection date; Member refreshes owned order history.
3. Try a stale second Staff tab's Mark collected control.
4. Compare stock, order total and ledger before/after collection.

**Expected:** One FULFILLED/collection timestamp; no further stock decrement or income posting. Member/Treasurer cannot mark club collection. Collected is not shipped/delivered/payment-settled.

### TC55 — Shopper privacy and sold-out state

1. Member checks My club orders; compare another attendee's account if available.
2. Treasurer checks their own history: no other buyer details or Staff collection controls.
3. Staff can see relevant club orders (latest 100), with buyer name/email.
4. Select sold-out variant and try ordering from a stale pre-sale page.

**Expected:** Personal histories do not expose other customers. Current sold-out button unavailable; stale submission fails safely. Latest-100 view is not full paginated archival history.

### TC56 — Order retry/refresh behavior

1. Place one order on an isolated variant while watching the loading/success feedback.
2. Reload after successful completion; confirm reload alone creates no new order.
3. Simulate an uncertain network response only in the isolated test environment; restore connectivity and inspect order/stock before any retry.
4. Record whether explicitly submitting again creates another intentional order. Do not assume every order form has a stable idempotency key.

**Expected:** Reload does not resubmit; failed/uncertain responses are reconciled before retry. Any accidental duplicate from one user action should be reported. Multiple deliberate separate orders can be valid purchases; they are not the same scenario as a repeated acknowledgement of one submission.

## 12. Volunteer board and announcements

### TC57 — Task creation, assignment, progress and boundaries

1. Staff → Volunteers → + Add a volunteer task. Enter worksheet Task, assign approved Member, due tomorrow, notes; Add task.
2. Confirm To do count/card, assignee and due date; use its status selector → In progress → Update status, then Done → Update status.
3. Refresh Overview; finished task is no longer in its open-task previews. Move it back to To do for another valid test.
4. Create one Unassigned task with optional date/notes blank; test short title, >200 title, >3000 notes and past/today-midnight deadline separately.
5. The assigned Member opens the board and changes their task status; another Member/Treasurer has no status control on it. Staff retains create/all-task status controls. For overdue styling, use a scheduled task whose future date has now elapsed or an isolated fixture.

**Expected:** Persisted TODO/DOING/DONE transitions and column counts; notes/assignment visible; invalid creation rejected. Date-only deadlines are interpreted at midnight, so use tomorrow, not today, for a normal valid case. Assigned account may update only its task status; it cannot create tasks or edit another volunteer assignment. Test unlinked/unassigned identities separately in TC82.

### TC58 — Publish, recipient fan-out and notice email

1. Staff → More → Noticeboard; enter worksheet title/body → Publish to noticeboard.
2. Check dated archived notice and Overview latest notices; refresh.
3. Approved verified Member/Treasurer inspect My updates and View details; receive email in opted-in controlled mailboxes after authorized worker processing.
4. Treasurer publishes a second notice; Member only sees archive/shared-space text, not publish controls.
5. Test title below 3/above 120, message below 10/above 4000 and whitespace-only content where applicable.
6. Submit a stale repeat of the same publication, then verify one notice/recipient update per supported request key; a new deliberately created notice is separate.

**Expected:** Dynamic archived notice, recipient-specific in-app updates, eligible email queue; no messages to directory-only/pending/unverified/disabled accounts. No recipient address list shown to ordinary Members. Formatting is literal text, not executable markup.

### TC59 — Preference opt-out and read markers

1. Member My account → uncheck Email me event reminders, seat offers, membership renewals and club notices → Save preferences; reload.
2. Publish a controlled test notice/update; confirm in-app update exists but no corresponding optional email is sent.
3. In My updates click Mark read on one new item, then Mark all as read; reload and compare another user's unread markers.
4. Re-enable preference and publish a new notice; verify delivery separately. For opt-out-after-queue, stop test worker before publishing, opt out, then restart it.

**Expected:** Preference persists, applies at delivery for supported notices, and does not suppress required OTP/reset mail. Read actions affect only that user's notifications. Re-enabling does not promise retroactive delivery of every earlier skipped message.

## 13. Expense requests and financial management

### TC60 — Submit expense with receipt and ownership

1. Member → My account → Submit a club expense.
2. Enter PREFIX Printing, USD, 12.50 and an HTTPS receipt link you control and the reviewer can access; Submit for review.
3. Inspect My expense requests; Staff checks they cannot see another user's personal claims through My account.
4. Treasurer opens Finance; find exact claimant, amount, pending status and Open receipt.
5. Create a second valid request without a receipt URL.

**Expected:** Pending expense, owned history, optional link opens safely in a new tab. Pending affects Awaiting review, not posted Money out/Club balance. Private file upload is covered in TC86–TC89; this case covers HTTPS links. No bank transfer occurs.

### TC61 — Expense amount/description/receipt validation

1. Repeat on an isolated account with one invalid value at a time: description blank/2 characters/>200; amount blank/0/−1/1.999/100000.01.
2. Try `http://example.com/receipt`, malformed URL, a URL containing credentials such as `https://user:pass@example.com/r`, and a link with embedded whitespace.
3. Try valid 0.01 USD and 50.00 INR with optional link empty.
4. Inspect pending list after each attempt; no invalid record should exist.

**Expected:** Positive money up to 100000 with max two decimals; safe HTTPS metadata only. Zero is invalid for expenses, although it is valid for free Practice event/product prices. The server does not fetch or upload external receipts.

### TC62 — Approve another user's reimbursement

1. Record baseline USD Money out/Club balance and Awaiting review.
2. Treasurer finds TC60 Printing pending 12.50; check receipt/claimant, click Approve reimbursement.
3. Refresh Finance and Member's My expense requests.
4. Check Posted/Approved, reviewer name/time and removal of review controls.

**Expected:** USD expenses +12.50, balance −12.50, pending amount/count decreases; claimant sees Approved. Approval does not establish that actual bank reimbursement occurred.

### TC63 — Reject with reason and no balance effect

1. Member submits PREFIX Snacks USD 8.00.
2. Treasurer finds it and tries Reject request with empty/2-character reason; then use `Receipt details are incomplete` and submit.
3. Check Member's request reason/review date; refresh Finance totals.

**Expected:** Invalid reason does not decide. Valid rejection shows Rejected, recorded reason/reviewer/time; pending decreases but posted expense/balance remains unchanged.

### TC64 — Repeat/concurrent review and permission denial

1. Prepare a fresh pending expense; open it in two Treasurer sessions before either acts (same Treasurer across isolated profiles or second approved Treasurer).
2. Approve in one while reject-with-valid-reason in the other; refresh.
3. Attempt the stale decision again; inspect totals and request status.
4. Member/Staff should have no expense-review access; test Finance direct URL through TC17.

**Expected:** Exactly one final decision and one financial effect, no later overwrite of approved/rejected history. Unauthorized role cannot review; server checks are separate from button visibility.

### TC65 — Treasurer self-review

1. Treasurer submits PREFIX Treasurer supplies USD 4.00 using Submit an expense in Finance or My account.
2. Inspect their ledger row and personal history.
3. Confirm own approval/reject controls absent and Another approved Treasurer must review guidance present.
4. If TC11 created a second approved Treasurer, sign in there and review the first Treasurer's request.

**Expected:** Claimant cannot approve their own expense. With one Treasurer it remains pending; lack of a second reviewer is a workflow prerequisite, not permission to self-approve. Second eligible Treasurer can decide once.

### TC66 — Fundraiser income and currency-isolated arithmetic

1. Record baseline USD/INR income, expenses and balance.
2. Treasurer → Record fundraiser receipts: PREFIX Bake-sale receipts, USD 100.00 → Record income.
3. Confirm one FUNDRAISER posted income and USD income/balance +100.00; repeat a stale duplicate submission of the same request if available.
4. Submit Member INR 50.00 expense; pending does not change INR balance. Approve it as another Treasurer relative to the claimant: INR expense +50.00, balance −50.00, USD unchanged.
5. Reject another INR claim; no posted effect. Inspect existing test/void entries if any: neither contributes posted totals.
6. Try blank/0/negative/three decimals/over-limit fundraiser amount and too-short description; Member/Staff cannot use fundraiser-income form.

**Expected:** One posting per supported fundraiser request key, only Treasurer records receipts, and no USD/INR conversion or addition together. Current balance is sum(posted income) − sum(posted expenses) within each currency; pending/rejected/void/test are excluded. Entering this income records separately received receipts, not a payment collection.

## 14. Overview, reconciliation and integrated journeys

### TC67 — Overview reflects the database

1. As Staff visit Overview (`/`); record directory/active-member counts, upcoming events, open tasks, notices and per-currency club balance.
2. Create one valid test event/task/notice and activate one eligible test membership using earlier cases.
3. Revisit/refresh Overview and compare exact counts/previews.
4. Mark the task Done and cancel the test event; revisit again.
5. Inspect Overview as Member/Treasurer through More or their shortcut: shared aggregate information is currently permitted.

**Expected:** No hardcoded business totals. Active membership rules, uncancelled future events and non-DONE tasks agree with domain pages. Balance reflects posted entries within each currency. Historical-event fallback may appear under From our event calendar; it must not be labelled a future live event incorrectly.

### TC68 — Ledger reconciliation by hand

1. Use your worksheet IDs and initial per-currency baseline.
2. Add only posted income changes: recorded dues, uncancelled Practice ticket amounts, merchandise orders and fundraiser receipts.
3. Subtract posted approved expenses. Exclude pending/rejected/void/test records. Exclude cancelled ticket income after voiding; do not remove merchandise income merely because collection occurred.
4. Compare resulting USD and INR balances to Finance and refreshed Overview separately.
5. As an isolated illustration, if these were the only USD changes: dues 50 + active ticket 10 + merchandise 50 + fundraiser 100 − approved expense 12.50 = **197.50** additional balance. Your run may differ because other tests add/cancel records; use the worksheet, not this total blindly.

**Expected:** Exact minor-unit arithmetic and matching categories/statuses. Practice postings are system records, not verified settled bank cash. The finance page has no dedicated date-filtered semester statement export today; record that as future scope, not a missing clickable feature to test.

### TC69 — One complete club-day acceptance journey

1. Complete new Member registration/OTP/approval; configure and record their dues as a test posting.
2. Staff creates a Practice event and product; Member books eligible-price ticket, orders a size and sees owned history.
3. Staff publishes notice/assigns task; Member receives in-app updates; Staff moves task through progress.
4. Member presents QR; Staff confirms entry and intentionally retries to demonstrate rejection.
5. Member submits expense; Treasurer reviews it; Staff marks merchandise collected.
6. Refresh all involved pages and reconcile ledger/stock/attendance against the recorded actions.

**Expected:** One connected persisted workflow, not unrelated static screens. OTP inbox receipt, QR-camera success and each database effect must be separately observed. Use separate test events for cancellation/waitlist so this attended ticket does not conflict with those tests.

## 15. Responsive, accessibility, exports and failures

### TC70 — Desktop, tablet and phone coverage

1. Test desktop about 1280×900, tablet about 768×1024 and phone about 390×844 using browser responsive tools or real devices.
2. On each, visit login/register, Events/detail, My events/ticket, Members, shop/orders, tasks, notices, Finance, Account, Updates and User access where authorized.
3. Scroll long pages and tables; open More, create/edit disclosures and all form sections.
4. Check large amounts, long names/emails, multiline notices and keyboard appearing on a real phone.

**Expected:** No page-level horizontal overflow except intentional table scroll regions; actions/labels remain reachable, bottom navigation does not cover them and More fits the viewport. Test both portrait and landscape. Responsive emulation is not camera/hardware acceptance.

### TC71 — Keyboard and accessible feedback

1. Without a mouse, Tab from page start to Skip to content; Enter should focus the content region.
2. Tab through navigation, More summary/links and forms; open More with Enter/Space, close with Escape and verify focus remains understandable.
3. Submit invalid required fields; identify which input needs correction and read success/error feedback.
4. Zoom to 200%; optionally use the operating system/browser screen reader for labels, headings, status feedback and QR explanation.
5. Check focus styles, disabled buttons and text/status names; do not rely only on badge colors.

**Expected:** Operable controls, visible focus, meaningful labels and no inaccessible action. No blanket accessibility certification is implied; record issues per screen.

### TC72 — Empty/not-found/denied states

1. Use search/filter no-match results for Members/Events/attendees rather than deleting records.
2. On a genuinely empty test database/account inspect My events, waitlists, shop orders, updates and expenses.
3. Visit a nonexistent event/ticket URL and an arbitrary nonexistent route.
4. Try unauthorized Finance/User access and follow sign-in/recovery links.

**Expected:** Clear empty/not-found/restricted state with usable navigation, no private data or raw SQL/configuration error. A protected unknown route may redirect to login before a 404 if signed out; retest authenticated. Not every error state has an independent route.

### TC73 — Real delivery and stale-message suppression

1. Use authorized controlled accounts and worker configuration; record event/offer/notice/membership messages from earlier cases by actual inbox arrival time.
2. Stop the test worker; queue a notice then opt out, or queue an event reminder then reschedule/cancel before dispatch.
3. Restart/run one job; check stale/opted-out messages are not delivered, current required ones are delivered as appropriate.
4. Inspect a delivery failure only in the isolated test environment, without replacing shared SMTP credentials; record recovery needs and safe provider error metadata.

**Expected:** Queue state and provider acceptance are distinguishable from recipient inbox. Obsolete supported messages are suppressed; required verification/reset remain independent of optional preference. SMTP uncertain delivery requires review, not repeated blind retries; there is no full outbox operations UI today.

### TC74 — Protected HTTP exports/jobs

1. Staff downloads valid attendee CSV through TC47; signed-out/Member/Treasurer attempt the same endpoint and should receive 403 without data.
2. Open `/api/jobs/events` in a normal browser without secret header, both signed out and as Staff.
3. An authorized developer later verifies the secret-protected scheduler against the isolated database using a secure secret source; keep token out of URL, screenshots and issue logs.
4. Test calendar endpoint for a real public event and a nonexistent ID.

**Expected:** Jobs without valid authorization return 401 and do not execute. Public event calendar can be downloaded; nonexistent calendar returns not found. Authenticated Staff without verified/approved state needs the additional regression in TC80; the handler now enforces approved/verified Staff; TC80 checks its regression.

### TC75 — Network/database failure and uncertain save

1. In the isolated test environment, use browser developer tools Network → Offline for the browser; try page navigation and a harmless unsaved preference form.
2. Restore online access and refresh; confirm actual stored preference before retrying.
3. For actual database failure, ask the deployment owner to run a separate test process with an intentionally unreachable test connection; browser Offline alone does not disconnect the server from Supabase.
4. Attempt a test form once, restore connection, inspect records and retry only after reconciling whether it saved.

**Expected:** Meaningful failure/retry behavior without false success or duplicated records. Inputs should remain recoverable; record if lost. There is no offline queue/offline-first mode. A lost response may still accompany a completed server mutation, so do not assume no record exists.

### TC76 — Restart, backup and isolated restore

1. Capture test record IDs/counts privately; restart only the app and worker, then verify those records and states persist.
2. For a private export, database owner may run `npm run db:export` from the app folder; use the reported ignored backup location and keep it private (contains account/security data).
3. Database owner validates snapshot completeness/counts, then rehearses import/restore only into a separately provisioned disposable database using a reviewed procedure.
4. After restore compare memberships, tickets/order lines, queue status, finance links and permissions; ensure no real outbound messages run unintentionally.

**Expected:** Restart persistence and a demonstrable restore, not merely creation of a JSON backup. Full restore remains pending. Do not run `db:import`, reset/bootstrap, destructive schema flags or replay backups into the current shared database as part of this manual run.

### TC77 — Special characters, validation and create-form retries

1. In test-only names/notices use apostrophes, Unicode and literal `<b>QA text</b>`; verify text renders safely and does not execute markup.
2. For every create form, submit once, observe Saving/success/error and inspect exact records after refresh. Rapid clicks must not produce unexplained extra records.
3. Try whitespace-only fields and over-limit text where possible; note browser constraints vs observed server rejection.
4. As a developer-only follow-up in staging, alter submitted role/status/ID/amount fields and verify server authorization/validation independently using existing service checks or approved request tests. The novice tester should not forge arbitrary production requests.

**Expected:** Safe text rendering, bounded values and recorded duplicate-submission behavior. Idempotent dues/collection/reviews/notices/fundraiser receipts do not imply all create forms are idempotent. No numeric field may become negative merely through malformed/stale input; a legitimately negative club balance from expenses exceeding income is mathematically allowed and is not an invalid expense amount.

## 16. Existing payment pages and deferred gateway acceptance

### TC78 — Read-only payment page/navigation coverage

1. Member/Treasurer/Staff opens More → My payments; inspect owned test-checkout history or honest empty state.
2. If authorized existing test payment records are present, open own View checkout & status; compare event, recorded amount/currency and status without pressing payment/refund/reconcile actions.
3. Staff/Treasurer can navigate Test payment desk; Member cannot.
4. A non-owner Member/Treasurer attempts another user's payment detail URL; expect protected ownership. Use a known authorized test record URL privately; do not enumerate real IDs.
5. Confirm Practice registrations appear in My events, not as invented Razorpay checkout records.

**Expected:** Paused payment pages remain accessible only to the permitted actor and clearly labelled Test Mode. No external financial/provider mutations are made by this guide. No-record parts are BLOCKED/NOT APPLICABLE, not fabricated.

### TC79 — Deferred payment acceptance gate

**Status: DEFERRED — do not execute while payment work is paused.** Once the owner resumes that module, write/execute a dedicated sandbox plan for:

1. Checkout success/failure/abandonment, identity/amount/currency tampering, captured-payment verification and ticket issuance exactly once.
2. Ten-minute seat-hold expiry/release, seat competition and waitlist claim with payment.
3. Signed public webhooks, duplicate/out-of-order delivery, timeout/reconciliation and recovery after app restart.
4. Cancellation with ticket revocation followed by a separately confirmed refund, including the previously unresolved provider refund/balance failure.
5. Test ledger exclusion, exact idempotency and ownership of payment history/refund operations.
6. Separate online shop/dues payment design if required; neither is finished by event gateway code.

**Expected gate:** Provider-backed evidence for all sandbox paths before any Live Mode rollout; real billing/settlement review separately. Existing tests/code do not make this task complete.

## 17. Newly identified regression checks

### TC80 — Former Staff denied attendee export after access rejection

**Repaired implementation:** Attendee CSV handler now requires a verified, approved and active Staff account; the old implementation checked only `role === STAFF`, but not `emailVerifiedAt`/`approvalStatus`. New applicants start MEMBER, but a previously approved Staff user can retain STAFF in the database after rejection. Run this direct-session case to confirm the repair in the current environment; the corresponding service regression passed.

1. Use disposable ordinary Staff from TC10; create/register authorized test attendees in an isolated event.
2. Designated Staff changes that user's decision to REJECTED with a valid reason; verify old session revoked.
3. Former Staff signs in again; it should land on approval status, with no operational access.
4. While in that restricted session, navigate directly to `/api/events/TEST_EVENT_ID/attendees`.
5. Compare with approved Staff, who should still export successfully. Do not use actual student records for the exploit reproduction.

**Required result:** Rejected/unverified/pending/disabled identities must never download attendee data. Any attendee disclosure is a FAIL. Account-state checks apply at the Route Handler boundary, independently of page navigation.

### TC81 — Export price/currency labels and payment-mode wording

**Repaired implementation:** CSV now includes Recorded price, Currency and Payment mode columns using stored ticket data. The old implementation labelled all prices `Recorded price (USD)` and all PAID rows `Registered (simulated payment)`, even though test-checkout tickets can use INR. Practice USD paths are unaffected by that particular currency mismatch.

1. Export a Practice/USD test event and confirm header/rows accurately reflect those records.
2. If an existing authorized INR Test Mode event has tickets, export read-only as approved Staff and compare currency/status wording to the ticket/management page. Otherwise mark the INR portion BLOCKED until a later payment test run.
3. Include commas, quotes and formula-leading text in controlled attendee data to verify CSV escaping; inspect as text first and keep codes private.

**Required result:** Exports must label each event/ticket currency and payment mode truthfully; do not imply INR amounts are USD or a captured Test Mode ticket is a Practice sale. Correct this before payment-module review.

## 18. Route-to-case completeness map

| Page / functional surface                    | Cases                                           |
| -------------------------------------------- | ----------------------------------------------- |
| Login/logout/register                        | TC01–TC15, TC17–TC19                            |
| Verify email / approval status / User access | TC04–TC14, TC19, TC80                           |
| Forgot/reset password                        | TC16                                            |
| Overview                                     | TC23, TC33, TC57–TC58, TC67–TC69                |
| Members / membership account view            | TC20–TC26, TC31, TC51                           |
| Events listing/detail/create/edit            | TC27–TC39, TC48–TC49                            |
| My events / owned tickets                    | TC18, TC31–TC46                                 |
| Event management / attendee CSV              | TC33–TC39, TC47–TC48, TC74, TC80–TC81           |
| Door check-in / camera / backup code         | TC40–TC46                                       |
| Merchandise / order collection               | TC50–TC56                                       |
| Volunteers                                   | TC57, TC67, TC69                                |
| Noticeboard / announcement delivery          | TC58–TC59, TC73                                 |
| My account / preferences / own expenses      | TC02, TC16, TC22–TC26, TC59–TC65                |
| My updates / mark read / notification links  | TC36–TC39, TC49, TC58–TC59, TC73                |
| Finance / fundraiser receipts                | TC23–TC24, TC31, TC34, TC52, TC60–TC68          |
| Test payment pages / webhook                 | TC78; actual gateway execution deferred in TC79 |
| Calendar export / protected jobs             | TC29, TC38–TC39, TC74                           |
| Navigation / loading / denied / 404 / errors | TC03, TC17–TC19, TC70–TC77                      |
| Database persistence / restore               | TC01, TC76                                      |

## 19. Recommended run order and time planning

1. **First session, about 45–60 minutes:** startup, three existing logins, navigation and role access (TC01–TC03, TC17–TC19), plus creation of only needed test records.
2. **Email/access session, about 45–90 minutes plus waiting:** TC04–TC16. Hourly OTP and reset expiry cases continue asynchronously; record scheduled times. Run TC80 only with a disposable Staff identity.
3. **Business flow session, about 2–3 hours:** membership/event booking, QR, shop, tasks/notices and expense/ledger checks (TC20–TC24, TC27–TC37, TC40–TC69).
4. **Boundary/device session, about 1–2 hours:** delayed offer/deadline checks, concurrent cases and responsive/keyboard/failure checks (TC38–TC39, TC70–TC78, TC81).
5. **Scheduled/fixture cases:** membership renewal/expiry, seven-day session expiry, >12-hour post-event entry and long offer-expiry promotion cannot all be honestly validated in a short sitting without reviewed isolated fixtures. Keep them BLOCKED/NOT RUN until evidence exists.
6. **Regression:** fix observed issues in small commits; rerun affected cases plus permissions and financial deltas. Run code/service checks where the implementation changed; a docs-only change does not need another application build.

These durations are planning estimates, not a promise every case finishes in one review rehearsal. Do not create 20+ unnecessary live accounts solely for pagination; prepare that dataset separately.

## 20. Cleanup and evidence

1. Record redacted test results in [manual test results](MANUAL_TEST_RESULTS.md); link exact failing case IDs and source commit.
2. Stop only your test worker/server when finished; restore browser device emulation/network settings.
3. Sign out verification sessions and revoke/disable disposable accounts through designated Staff after any required retests. Preserve the initial three accounts.
4. Keep QA records clearly prefixed. For events that permit cancellation, cancel them through the UI if they should no longer be bookable. Already attended events cannot be treated as unstarted cancellations.
5. Products/tasks/notices/ledger do not all have safe deletion/undo controls. Do not pretend a universal cleanup button exists. Prefer discarding an isolated test database; otherwise request a reviewed exact-ID cleanup with private backup. Do not reset shared records.
6. Keep QR files, attendee CSVs, receipts and database exports private; redact them before sharing evidence. Store no passwords/OTP/reset links in the results file.
7. Sign off only executed PASS cases; retain BLOCKED/DEFERRED checks and known failures visibly.

## 21. Next-review walkthrough

Use these already prepared dynamic test/review records, after the relevant acceptance tests pass:

1. Staff signs in, shows the actual Overview counts and event details.
2. Member signs in in a different session, shows account/membership, registers for a Practice event and opens their ticket. State clearly that no real money was charged.
3. Staff selects the correct door, scans or enters code, confirms admission, then retries to show duplicate rejection.
4. On a different full event, show queue order, cancellation releasing a seat, an offer and successful claim.
5. Member orders a merchandise size; Staff shows stock change and marks collection.
6. Staff shows assigned task/status and a published notice; Member shows the matching saved update.
7. Member submits an expense; Treasurer approves it and explains per-currency ledger deltas, pending/rejected exclusion and self-review prevention.
8. If actually verified, show inbox delivery evidence without exposing OTP/reset secrets. Otherwise state that inbox acceptance remains pending.
9. Explain that gateway work, public deployment and production hardening are separate remaining tasks.

Do not spend the review clicking unverified/deferred gateway buttons. Prepare fallback manual ticket-code entry only if camera access is unavailable; explain which method was demonstrated.

## 18. Added operational features: detailed acceptance

### TC82 — Assigned volunteer status and ownership

1. Staff creates two tasks: assign PREFIX Assigned to Member A; leave PREFIX Unassigned without an assignee.
2. Member A opens Volunteers and confirms Assigned exposes the status selector, while Unassigned does not.
3. Change Assigned to In progress, then Done. Reload and compare column counts and Staff's view.
4. A different approved Member or Treasurer opens Volunteers: Assigned has no status controls.
5. Staff updates Unassigned and Assigned; both should succeed.
6. In a controlled service run, attempt another volunteer's task ID, an unknown status and an ineligible account.

**Expected:** Only the assigned linked account or Staff changes status; no create/edit/reassignment privilege is added. Service coverage: verify:operations.

### TC83 — Receive/correct merchandise stock and audit

1. Staff adds PREFIX Stock test, size M, stock 5, price 10.00.
2. More → Club shop → Receive or adjust merchandise stock.
3. Select that exact M variant, enter +8 and reason PREFIX Supplier delivery; Record stock adjustment.
4. Reload: M stock is 13, and Recent adjustments shows +8, 5 → 13, reason, date and Staff name.
5. Enter −3 and PREFIX Damaged units; stock becomes 10 and a second audit row shows 13 → 10.
6. Compare Finance before/after: there is no income/expense from either adjustment.
7. Another size's stock and existing order prices must remain unchanged.

**Expected:** Persisted audited adjustments, no finance posting or modification of earlier order snapshots.

### TC84 — Invalid, unauthorized and concurrent stock adjustments

1. Try 0, 1.5, −11 against stock 10, over 1,000,000, blank reason, two-character reason and >300 reason.
2. Member/Treasurer opens Club shop: no adjustment controls. Run service ownership/role checks for direct submissions.
3. Two Staff sessions open the variant with stock 10. Both attempt −8 with distinct request keys.
4. Refresh: exactly one removal succeeds, stock is 2, and one audit row was added.
5. Retry the same successful submission key without changing payload; it must not decrement again.
6. Attempt changed payload with the same key in the service suite.

**Expected:** No negative/over-limit stock, no unauthorized writes, no lost updates or repeated adjustment. Client loading alone is not evidence of server idempotency.

### TC85 — Finance filters, pagination and CSV

1. Treasurer opens Finance with known USD/INR and posted/pending test records from earlier cases.
2. Select Currency=INR, Category=reimbursement, Status=pending, Entry type=Expenses, and a description fragment; Apply filters.
3. Verify URL selection, visible rows and filtered KPI definitions. No USD entry may appear.
4. Add From/To dates containing the target claim; To date is inclusive in UTC.
5. Export filtered CSV. Open as text first: only matching rows, correct currencies, status/claimant and UTC timestamps.
6. Clear filters. With >25 authorized test rows, Next/Previous preserve selected filters and provide stable pagination.
7. Try reversed dates, malformed/impossible dates, unknown currency/status and duplicate query parameters directly in an isolated test route.
8. Member/Staff/signed-out and pending/unverified Treasurer cannot access /api/finance/export.

**Expected:** Table uses 25 rows/page; CSV and totals include all matching rows up to 10,000. Broader reports request narrower filters. Currencies remain separate and test entries never become posted balance. Boundary fixtures in verify:operations verify 00:00 and 23:59:59.999 UTC inclusion.

### TC86 — Upload a private receipt and review its claim

1. Confirm storage:setup succeeds and skyline-receipts is Private in Supabase Storage.
2. Member My account → Submit a club expense.
3. Choose a harmless PDF/PNG/JPEG ≤2 MB, enter PREFIX Private receipt, INR 12.50, and leave Receipt link empty.
4. Submit for review; record the expense ID privately, not in a public issue.
5. Reload My expense requests; Open receipt downloads the original file.
6. Treasurer opens Finance, finds the claimant and pending request, and downloads its receipt.
7. Compare bytes/file appearance. Review the claim normally; approval must not perform a bank payout.

**Expected:** One pending claim with private receipt metadata, uploaded file persists, owner/Treasurer downloads are correct, and pending amount is excluded from posted balance.

### TC87 — Receipt size, type and conflicting inputs

1. Try an empty file, >2 MB PDF, SVG/HTML, and a renamed text file with .png extension.
2. Enter both a valid HTTPS link and a valid receipt file.
3. Try invalid amount/description with a valid file.
4. Use the service verification for exact signature/MIME mismatch and empty-file cases that a browser selector may filter.
5. Compare claim list and private bucket: rejected operations should create no claim/file. A server-action body-limit error for a very large request is expected failure, not success.

**Expected:** Nonempty PDF/PNG/JPEG content only, maximum 2 MB, no simultaneous file/link and no uploaded object before ordinary input validation. Signature checking is not malware scanning.

### TC88 — Private receipt URL access boundaries

1. Copy the TC86 application receipt URL privately.
2. Owner and approved verified Treasurer download successfully.
3. Open the URL as another Member, Staff and signed-out visitor.
4. In isolated fixtures, test pending/rejected/unverified/disabled Treasurer accounts, including stale sessions.
5. Try the file's Supabase public URL only in the dedicated live storage suite; it must not return the receipt.
6. Inspect download headers: private/no-store, attachment, nosniff and sandbox. No service key or public/signed storage URL should be in rendered page content.

**Expected:** Unauthorized actors get no receipt bytes; signed-out returns 401, ineligible returns 403, unauthorized authenticated non-owner returns 404. Approved Staff has no blanket access to personal claim receipts.

### TC89 — Expense retry and storage/database failure

1. Submit a valid private-file claim; reload alone must not create another claim.
2. Use verify:operations to concurrently retry the identical stable request key and payload.
3. Confirm one claim and one linked object; changed payload under that key is rejected.
4. Use an isolated transport fixture to reject upload, then simulate access revocation before database save.
5. Confirm failed upload creates no claim; confirmed unlinked upload is removed after save failure, and the previous successful receipt remains.
6. Reconcile any ambiguous network/process-crash outcome before manually retrying or deleting objects.

**Expected:** No duplicate claim and no deletion of another/winning claim's receipt. Private orphan cleanup after process crashes remains an operational reconciliation task.

### TC90 — Pending/unverified public event browsing

1. A disposable registered but unverified account opens /events and one public event detail.
2. Repeat with a verified account waiting for role approval.
3. Both can view public event information; neither can register, join waitlist, use Staff creation controls or export attendees.
4. Follow verification/approval guidance and attempt protected routes such as /my-events, /fundraisers and /treasurer.
5. Finish normal OTP/approval only for the disposable account, then verify allowed operations.

**Expected:** Public browsing is consistent with its links. Operational access still requires verification and approval. The requested role does not create privileges.

### TC91 — One explicitly authorized real mailbox acceptance check

1. Obtain explicit permission for the target mailbox. Run email:acceptance -- --send --to that mailbox once.
2. Confirm the targeted application outbox message becomes SENT with exactly one accepted dispatch.
3. The recipient checks Inbox/Spam and confirms arrival.
4. Record provider acceptance and recipient confirmation separately; do not include secrets/message IDs or send other queued messages.

**Recorded evidence, 11 October 2026:** One message titled Skyline — email delivery check was sent to the owner's authorized Gmail mailbox. The application recorded SENT, sent=1, failed=0; the owner confirmed Received in Inbox. No other queued mail was dispatched. This case does not replace real registration OTP, password-reset or event reminder acceptance.
