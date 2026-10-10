# Skyline: project walkthrough for the team

Updated 10 October 2026: account sign-in and the expanded event workflow are now
implemented. Read `EVENTS_AND_SUPABASE.md` for setup and current verification.
The active database is still SQLite; Supabase connection and email delivery await
private environment configuration. Payments remain simulated.

## 1. Understand the problem before the code

Skyline is a student association that sells memberships, organizes events, sells
hoodies and T-shirts, coordinates volunteers, and manages a small club budget.
The original problem is that these jobs live in separate spreadsheets, cash
transactions, notebooks, and WhatsApp conversations.

For example, Aisha signs up in a spreadsheet and pays dues to one committee
member. Another committee member sells her a gala ticket without knowing whether
she qualifies for a discount. A volunteer buys bake-sale ingredients and later
has to chase the treasurer for reimbursement. Nobody has a reliable shared record.

The system should connect these jobs: one membership record determines ticket
pricing, one ticket determines admission, one merchandise order changes stock,
and all recorded income and expenses appear in the same club ledger.

The PDF describes business needs. It does not prescribe Next.js, glassmorphism,
SQLite, or the three-role practice switcher; those are implementation decisions.

## 2. Who uses it?

- Member: views events, buys practice tickets and merchandise, reads notices,
  views the volunteer board, and submits expenses.
- Staff: registers members, records dues, creates events, checks tickets,
  creates and assigns volunteer tasks, and updates task status.
- Treasurer: records dues, reviews the ledger, approves expenses, and publishes
  notices. Staff can also publish notices.

Users now sign in at `/login` with email/password accounts. New accounts start as
Member; Staff assigns roles. Sessions are stored as opaque token hashes and revoked
when signing out or changing access. Verified identity links a matching membership.
The directory is restricted to Staff/Treasurer and the full ledger to Treasurer.
Personal tickets and updates are checked against the signed-in user's ID. Staff
can view attendees; the public cannot view private registration details.

## 3. Membership: who belongs to the club?

Open `/members`. Staff or Treasurer expands Add a member and enters a name,
email, and annual dues. The new member starts as Pending dues. Recording dues
activates membership, records DUES income, and makes member ticket pricing available.
An already-active membership cannot be charged again through this action.

Example: Aisha pays $12. Her membership becomes active and the ledger gains $12.
The directory can be searched by name/email and filtered by membership status.

Remaining: self-service registration, member profiles/editing, automatic renewal
reminders, and a clear membership-year policy. The brief describes end-of-year
expiry; the current activation action grants one year from the payment date.
That difference must be resolved before claiming full brief compliance.

## 4. Events: who can attend and what do they pay?

Open `/events`. Staff can create an event with a future date, location, description,
capacity, member price, and guest price. An event detail page shows availability
and lets a Member or Staff book a practice ticket.

Example: an Autumn Social has 80 seats, $12 member tickets, and $18 guest tickets.
Aisha's active, unexpired membership gives her the $12 price. A guest pays $18.
The server checks capacity, creates a unique ticket code, and records ticket income.
Past events remain visible but cannot accept new bookings.

At `/events/check-in`, Staff enters a code. Unknown, invalid, and already-used codes
are rejected. Successful entry records CHECKED_IN and a check-in time. Recent
check-ins appear in the door desk. A keyboard scanner can type into the field;
camera QR decoding is now available with a manual-code fallback.

The updated event module adds attendee lists, attendance counts, simulated ticket
value, personal history, named attendees and optional phone, cancellation, QR
tickets, camera decoding, selected-event check-in, calendar downloads, event changes,
FIFO waitlists and expiring seat offers. Registration requires verified identity.
In-app reminders work through the job worker; email delivery requires a provider.
Actual payments and refunds are still deferred. Physical-camera behavior and hosted
Supabase operation remain unverified. Existing legacy registrations are retained.

## 5. Merchandise: what is available in each size?

Open `/merchandise`. The catalog groups sizes under each product. Selecting a
size changes the available stock; changing quantity changes the displayed total.
Submitting an order creates its order lines, reduces the selected size's stock,
and records MERCHANDISE income together in a database transaction.

Example: there are eight medium hoodies at $32 each. Aisha orders two. Medium
stock becomes six and the ledger gains $64. Large stock is unaffected. Requests
above the available quantity are rejected server-side.

Remaining: product creation/editing, stock replenishment, order history, pickup
or fulfillment status, cancellation/restocking, a multi-product cart, and reliable
buyer identity. The current shop form does not link the order to a signed-in member.
The shop currently gives everyone the same merchandise price.

## 6. Volunteers: who is doing each job?

Open `/fundraisers`. Staff adds a title, optional notes, assignee, and due date.
Tasks move between To do, In progress, and Done using a status selector and save
button. Each card shows its assignee and due date; overdue unfinished work is marked.

Example: Aisha buys ingredients, Jordan prepares the poster, and Sam staffs the
table. The committee can see unfinished jobs without searching a group chat.

Remaining: volunteers updating their own work, editing/reassigning existing tasks,
and grouping tasks under separate fundraiser records. This is a club task board,
not a complete fundraiser accounting module. Finishing tasks does not record revenue.

## 7. Notices: what does everyone need to know?

Open `/announcements`. Staff or Treasurer publishes a title and message. The
noticeboard and dashboard show saved notices with timestamps, newest first.

Example: publish "Bake sale moved to the Student Union" once and retain a visible
record of the change. Members can read it on the website.

Remaining: mailing-list subscription/unsubscription, actual email delivery,
delivery history, editing, and archiving. Publishing a website notice does not
currently send an email or WhatsApp message.

## 8. Money: where did the club funds go?

Open `/treasurer`. Membership dues, tickets, and merchandise automatically create
income records. An expense submission records a pending reimbursement. Treasurer
approval changes it to Posted and includes it in the balance.

Example starting from $0: $12 dues + $12 ticket + $32 hoodie = $56 income. A $24.50
expense leaves the posted balance at $56 while pending. Approving it changes the
balance to $31.50. This is an illustrative scenario, not a claim about current data.

The current formula is posted income minus posted expenses. Pending expenses are
shown separately. The ledger includes all saved transactions, not just the latest 20.

Remaining: receipts, named claimants, expense rejection, payout tracking, fundraiser
income entry, date/category filters, exports, and semester/per-event reporting.
Approval does not transfer money to a volunteer. Ticket/order Paid states also do
not represent verified payment settlement: the practice app records local income.

## 9. Dashboard: the connected view

At `/`, the application reads active memberships, future events, unfinished tasks,
announcements, and posted financial records from SQLite. These are database-backed
figures rather than hard-coded live counters.

Forms show validation errors, pending feedback, and persistent success confirmations.
New ticket codes remain in a confirmation panel while page data refreshes. Event views also poll every 20 seconds while visible. There is no cross-device streaming connection.

## 10. How the code works

Browser screen -> Next.js Server Action -> validation and role check -> Prisma ->
SQLite -> saved result -> browser confirmation and refreshed data.

- `skyline/src/app`: routes and server-rendered pages.
- `skyline/src/components/club`: navigation, glass UI, search, shop controls, forms,
  and persistent feedback.
- `skyline/src/server/actions`: membership, events, shop, tasks, notices, and finance.
- `skyline/src/server/auth.ts`: practice role cookie and role checks.
- `skyline/src/lib`: database connection and validation helpers.
- `skyline/prisma/schema.prisma`: related database tables.
- `skyline/prisma/seed.ts`: initial example records; deletes existing records first.

The frontend and backend belong to one Next.js application. There is no separate
Express service. SQLite stores the records locally; Prisma is the tool the server
uses to read and write them. Money is stored as integer cents: $12 is 1200 cents.

## 11. What is done and what still matters most?

Implemented local prototype: the original ten page types (overview, role selection, members,
events, event detail, door desk, shop, volunteer board, ledger, and noticeboard),
plus ten new account/event page types, loading/error/not-found states. Core mutations save real database records.
The recent UI revision added the glass visual system, mobile navigation, interactive
filters, variant/quantity controls, role-aware actions, and visible feedback.

Next priorities:

1. Repository installation and the local production build are now resolved;
   teammates should follow `DATABASE_AND_DEPLOYMENT.md` to reproduce setup.
2. Agree on expiry rules and payment simulation boundaries.
3. Event attendance/value reporting is implemented. Membership renewal reminders
   and receipt/claimant records remain separate work.
4. Complete stock administration and order/pickup tracking.
5. Add mailing-list communication if required for the final scope.
6. Account identity and ticket ownership checks are implemented. Complete deployment
   hardening and service configuration before using real member data or money.
7. Choose persistent database hosting, handle backups, and verify deployment.

The presence of enum values such as Cancelled or Fulfilled in the schema does not
mean the corresponding workflow has been built. No live deployment is confirmed.
A precise completion percentage would hide these differences.

## 12. Four teammates can understand and own four parts

- Frontend: navigation, page content, forms, responsive behavior, feedback.
- Backend: validation, permissions, capacity/stock rules, and connected ledger updates.
- Verification: reproduce checks, document failures, and distinguish tested from untested.
- Database/setup/deployment: schema, generation, local setup, storage, and release steps.

Every teammate should first walk through one membership, one future event, one
shop order, one task, and one expense in a disposable local database. Then explain
which records change. That understanding is more useful than memorizing the code.
