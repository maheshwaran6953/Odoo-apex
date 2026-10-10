# Skyline project review guide

Prepared 10 October 2026 from the running app and current source. Razorpay is outside
this review. This is a student association system, not LoomFlow or an Odoo-framework
implementation.

## What problem are we solving?

A student association uses separate spreadsheets, ticket lists, stock notebooks,
WhatsApp messages and expense records. That creates duplicate work and uncertainty:
who paid dues, who gets member ticket pricing, whether seats/hoodie sizes remain,
who should enter an event, which volunteer task is unfinished and whether an expense
was approved. Skyline connects those records in one role-controlled workspace.

## Sign-in and roles

Open http://localhost:3001/login. Separate review accounts now exist for MEMBER,
STAFF and TREASURER. Their credentials are in the private, Git-ignored
`skyline/backups/review-credentials-20261010.json`, not in this document. Original
accounts and passwords were not changed. All review identities are preverified;
their example email addresses are sign-in identifiers, not receiving mailboxes.

MEMBER is an access role. It does not mean club dues were paid. The separate linked
Membership record must be ACTIVE and unexpired for member ticket pricing. The review
Member is linked to a pending-dues directory record to demonstrate that distinction.

| Operation | Member | Staff | Treasurer |
|---|---|---|---|
| Overview, event browsing, own registrations, QR tickets, cancellation, waitlists | Yes | Yes | Yes |
| Own saved updates, preferences and expense submission | Yes | Yes | Yes |
| Read volunteer board and noticeboard | Yes | Yes | Yes |
| Place practice merchandise orders | Yes | Yes | No |
| Add directory members; record dues/renew inactive memberships | No | Yes | Yes |
| Create/edit/cancel events; attendee CSV and check-in | No | Yes | No |
| Create/assign tasks and change task progress | No | Yes | No |
| Publish announcements | No | Yes | Yes |
| Full ledger and reimbursement approval | No | No | Yes |
| Verify identities, assign roles and disable users | No | Yes | No |

Guest is the anonymous public experience, not a stored account role. Guests can
browse events/details and authentication pages but cannot book a ticket. Staff is
the administrative role; there is no separate ADMIN role. Staff is not automatically
Treasurer: the full finance desk and expense approval are reserved for TREASURER.

## Implemented modules

1. **Overview `/`**: database-backed membership, upcoming-event, task and posted
   balance summaries, event previews, notices and volunteer links.
2. **Membership `/members`**: Staff/Treasurer search/filter directory, add members,
   record dues, activate one year of membership and create matching dues income.
   Repeat activation of an already-active membership does not add duplicate dues.
3. **Events `/events`**: public search/filter, details, dates, venue, schedule,
   registration deadline, capacity and member/guest pricing. Staff creates events.
4. **Personal registrations `/my-events`**: tickets, cancellation, waitlist positions
   and offered seats belonging to the signed-in account.
5. **Tickets `/tickets/[ticketId]`**: private QR, backup code, copy/download/print,
   calendar link and cancellation before attendance starts. Practice registration
   creates a recorded income entry; it does not charge a card.
6. **Event management `/events/[eventId]/manage`**: Staff edits/cancels upcoming
   events, reviews attendees/attendance, exports CSV and triggers reminder/offer jobs.
7. **Door desk `/events/check-in`**: Staff selects the event, scans QR or enters a
   code. Wrong-event, cancelled, unknown and already-used tickets are rejected.
   Check-in is restricted to 12 hours before/after the event start. Manual-code
   verification is the reliable review path; physical camera QA is not complete.
8. **Waitlists**: full events offer FIFO queueing. Cancelled bookings release seats;
   next eligible attendee receives an offer expiring in at most two hours, bounded
   by event/deadline. Unclaimed offers expire; account ownership/capacity enforced.
9. **Updates `/notifications`**: saved registration/event-change/seat-offer/reminder
   messages, individual/all read marking and contextual links. Event pages refresh
   every 20 seconds while visible; this is polling, not websocket streaming.
10. **Shop `/merchandise`**: size variants, stock, quantity and total; transactionally
    creates order/lines, reduces that size's stock and records practice income.
    No shipping, multi-item cart, product administration or payment settlement.
11. **Volunteer board `/fundraisers`**: Staff creates tasks with notes, member assignee
    and deadline; changes To do → In progress → Done. Others read the board. This
    uses a selector/save action, not drag-and-drop or volunteer self-management.
12. **Treasurer `/treasurer`**: posted income/expenses, balance, pending reimbursements,
    saved ledger and approval. Pending expenses do not reduce balance; approval
    posts them once. Approval records a decision, not a bank transfer.
13. **Noticeboard `/announcements`**: saved notices, timestamps and Staff/Treasurer
    publishing. Website announcements do not automatically broadcast email/WhatsApp.
14. **Account `/account`**: role/verification/linked-membership display, reminder
    preferences, expense submission and password-reset entry.
15. **Access `/admin/users`**: Staff confirms identity/email ownership, links matching
    membership, assigns roles or disables users. Changed access revokes their sessions;
    Staff cannot change their own role using that screen.
16. **Authentication**: registration, sign-in, sign-out, one-time verification/reset
    tokens and basic login attempt throttling. New registrations start as MEMBER.

## Reminders and current limits

The job logic creates in-app event reminders for unreminded valid tickets within
24 hours of the start, processes offer expiry and promotes the queue. For this
review, use Staff's manual event-update action. A continuous worker or hosted
scheduler is needed for unattended operation. In-app updates work; email delivery
is not ready for a dependable live demonstration (the current queue includes failed
messages). Staff identity confirmation provides an alternative to emailed verification.

Membership-year policy is currently one year from recorded activation, rather than
a fixed academic-year boundary. Automatic membership renewal reminders, full member
editing, merchandise fulfilment/restocking, expense receipts/rejection/payout tracking,
claimed-expense ownership, multi-club tenancy, email broadcasts and hosted public
deployment are not complete. Expense requests currently lack a linked named claimant;
describe them as a shared reimbursement queue, not a complete personal expenses system.

## Technology and architecture

| Layer | Actual implementation |
|---|---|
| Application framework | Next.js 14 App Router; installed release 14.2.35 |
| UI | React 18, TypeScript, Tailwind CSS 3, custom glass-panel CSS/components, Lucide icons |
| Server | Node.js, Next.js Server Actions for mutations, route handlers for HTTP exports/jobs |
| Data | Supabase-hosted PostgreSQL; Prisma ORM/client 6.19.3 |
| Authentication | Custom password authentication using scrypt hashes, opaque random session tokens stored as hashes, HttpOnly cookies and server role checks |
| Validation | Zod for selected payloads plus typed server-side validation |
| QR | qrcode.react generation; @zxing/browser camera decoding; manual-code fallback |
| Email | Resend adapter and database outbox; dependable delivery not verified |
| Client state | React hooks for forms, feedback, navigation and shop selection |

This is a modular monolith: UI/server/database access in one Next.js application,
with separated domain action/service files. It does not use Express, JWT, Supabase
Auth, microservices or an AI model. Supabase supplies PostgreSQL hosting; Prisma
reads/writes it server-side. SQLite remains an optional fresh local-checkout mode.

Mutation flow: form → server action → session/role/ownership validation → domain
rules → database transaction → success/error feedback → refreshed server page.
Seat mutations serialize on the event row; stock decrements require sufficient stock.
Passwords are hashed, sessions can be revoked, and private tickets are checked by
owner. These protections are implemented, not a claim of a completed security audit.

## Concrete review sequence

Use **Campus Connect — review practice event**: two seats, $10 member / $15 guest,
starts three hours after review setup on 10 October, within the door check-in window.

1. Staff logs in; show overview and Members. Review Member starts with pending dues.
2. Record Review Member's $10 dues. Show ACTIVE membership and matching ledger income
   later under Treasurer. This is a recorded practice payment, not a gateway charge.
3. Sign out and log in as Member; open the event and book at $10. Show private QR,
   backup code, calendar download and My events.
4. For waitlist demo: Staff books the second seat at guest price; Treasurer then
   joins the full-event waitlist. Cancel Staff's ticket before checking it in.
   Treasurer opens the offered seat in My events and claims it before expiry.
5. Staff selects the practice event at Door desk; enter Member's backup code. Entry
   becomes checked-in. Repeat it to demonstrate duplicate-entry rejection.
6. Member orders one medium hoodie. Stock should decrease by one and $32 practice
   income appears in the ledger. Quantity above stock is rejected.
7. Staff moves a volunteer task to Done, then publishes a review announcement.
8. Member submits a $5 printing reimbursement at My account.
9. Treasurer shows that $5 is pending without reducing balance, then approves it.
   Posted expenses increase by $5 and balance falls by $5.
10. Staff shows User access; explain permissions without disabling/changing review
    accounts mid-demonstration. Show Member cannot access administrative desks.

Do not use Spring Gala for booking: its April 2026 date is in the past. Do not use
the separate sandbox-payment event for this review. Do not reseed the database.

Suggested opening: “Skyline connects membership, event admission, merchandise stock,
volunteer tasks and club finances. An action updates related records together, so
the committee does not have to reconcile separate spreadsheets.”

Suggested limitation statement: “Core workflows are database-backed. Shop/dues
payments are practice records; bank settlement, dependable outgoing email and public
deployment are separate completion tasks. The review uses the core practice workflow.”
