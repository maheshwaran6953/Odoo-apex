# Skyline Razorpay Test Mode implementation plan

## Scope and release boundary

First release: event tickets only, INR, Razorpay Test Mode. No real money is accepted.
Live keys are rejected in code. Membership dues and merchandise keep their existing
practice workflows. Legacy USD events/transactions keep their currency and value;
they are never silently converted to rupees. Test ledger entries are separated from
posted club income. Existing accounts, tickets, waitlists and club records survive
the additive schema upgrade.

## Step 1 — Configuration and backup

1. Keep secrets in skyline/.env: RAZORPAY_KEY_ID (rzp_test_),
   RAZORPAY_KEY_SECRET and a separate RAZORPAY_WEBHOOK_SECRET (32+ characters).
2. Configure automatic capture in the Razorpay Test Mode dashboard. An authorized
   payment alone does not issue a ticket; captured status must be verified.
3. Stop this checkout's app and reminder worker before client regeneration.
4. Save a private, consistent PostgreSQL record snapshot, including the staff account.
5. Add Payment and PaymentWebhook models, currency metadata, and event checkout mode.
6. Apply schema without reset/data-loss flags; enable RLS and revoke public API reads
   on the new tables. Verify original IDs/counts/balance afterward.

## Step 2 — State machine and seat ownership

- Payment states: INIT, CREATING, PENDING, CONFIRMED, FAILED, EXPIRED, REVIEW,
  REFUND_REQUIRED, REFUND_PENDING, REFUNDED.
- INIT/CREATING/PENDING reserve one seat until expiresAt, for at most ten minutes.
  Holds end no later than registration deadline, event start, or the original
  waitlist offer deadline. Browser countdown is informational; server time controls.
- Seat invariant: confirmed tickets + unexpired payment holds + unexpired waitlist
  offers <= event capacity. Lock the event row in a serializable transaction for
  every capacity-affecting operation; retry serialization conflicts.
- A waitlist offer transfers into PAYMENT_PENDING during checkout; never count
  both the offer and its checkout hold. If checkout expires, restore a still-valid
  offer or expire it, then promote the next person in FIFO order.
- Repeated clicks reuse the owner's active attempt. No provider API calls run inside
  database transactions. Do not retry an ambiguous order-creation POST blindly.
- Payment capture after expiry/cancellation goes to REVIEW, without ticket issuance
  or overselling. Staff must reconcile/refund; do not silently take another held seat.

## Step 3 — Provider adapter

Use server-side fetch to the official Razorpay REST API with bounded timeouts.
Only public key ID and provider order ID reach checkout; API/webhook secrets stay
server-side. Amount, currency and account identity come from the database.

Create one order with a unique local receipt. Persist its ID before exposing checkout.
For an ambiguous timeout, reconcile orders by receipt before considering another
attempt. Fetch payment/order state from Razorpay before accepting confirmation.
Validate ID, order, integer amount, INR currency, receipt and captured status.

## Step 4 — Confirmation and recovery

1. Checkout handler returns payment ID, order ID and signature to a server action.
2. Verify SHA-256 HMAC using the stored order ID plus payment ID and a timing-safe
   comparison. Never trust the browser's amount or success label.
3. Fetch authoritative provider entities; only a fully captured matching payment
   can confirm a still-valid hold.
4. Atomically persist provider payment ID, one ticket, one test ledger income entry,
   claimed waitlist status and one notification. Issue QR only after this commit.
5. Callback, webhook and polling share one idempotent finalization function.
6. A signed raw-body webhook supports captured/order-paid/refund updates. Store
   event ID and body digest, not full payloads/card details. Reject invalid signatures
   and conflicting event-ID replays. Return non-success on transient processing
   errors so Razorpay can retry. Unsupported signed events are acknowledged.
7. Provide owner/staff reconciliation for missed callbacks. The local worker also
   reconciles eligible attempts, expires holds and processes ordinary event jobs.
8. Closing checkout is not proof of failure. Keep a bounded hold while asynchronous
   confirmation is possible. Explicit abandonment releases the hold; late captures
   go to REVIEW. A failed payment attempt may be retried against the same order while
   its hold remains valid; a failure webhook must not cancel a later captured payment.

## Step 5 — Frontend

- Event creation: explicit Practice / Razorpay Test Mode and USD / INR selection.
  Razorpay events require INR and nonzero prices. Lock currency/mode after any
  ticket or payment history exists. Show missing-key setup feedback.
- Event detail: server-selected price, checkout terms, test label and payment entry.
- Checkout /payments/[paymentId]: amount, currency, expiry, reservation status,
  Razorpay overlay, capture verification, retry/recheck, explicit abandon, and
  expired/review/refund outcomes. Do not collect card information in Skyline.
- My payments /payments: owner history; no other attendee's data.
- Staff payment desk /admin/payments: status filters, provider references, amounts,
  hold expiry, issues, ticket links, reconciliation and confirmed full test refunds.
- My events and ticket: payment reference/status link, accurate test labels;
  no QR for pending/expired/review attempts.
- Staff event management: checkout-hold count and contextual payment-desk link.
- Ledger: separate INR test entries and status; legacy USD balance unchanged.

## Step 6 — Cancellation and full test refunds

Cancel entry immediately and release the seat, but do not pretend a refund completed.
Captured test payments become REFUND_REQUIRED; preserve the income entry until the
provider confirms full refund. Staff submits an explicit full-refund request with a
stable idempotency key. REFUND_PENDING is not REFUNDED. Provider processed status
and verified amount/payment association are required before marking REFUNDED and
voiding the linked test income. Partial/external refunds require staff review; no
automatic assumptions. Reconciliation/webhooks recover a lost refund response.

## Step 7 — Verification gates

Use isolated test fixtures and remove only those fixtures after verification.
Verify concurrent final-seat holds, offer transfer, expiration/promotion, disabled
accounts, ownership, wrong amount/currency/order, forged signature, authorization
without capture, duplicate/concurrent callback and webhook, callback loss, late
capture, cancellation races, ambiguous order/refund responses, ledger deduplication,
refund confirmation, webhook replay and rejection of live credentials. Run schema,
TypeScript and production-build checks. Browser-check missing-key state, checkout,
payment history, staff desk and responsive feedback. Real Razorpay sandbox success,
failure and refund verification require the owner's valid test keys. Do not call
mock-provider checks actual Razorpay payments.

## Step 8 — Publish and activate

Commit database/configuration, backend, frontend and verification separately using
the team mapping already provided. Never publish .env, snapshots or generated clients.
No rewrite of already-published history and no empty attribution commits.

For webhook delivery, configure a publicly reachable HTTPS endpoint at
/api/payments/razorpay/webhook. Subscribe in Test Mode to payment.captured,
order.paid and refund.processed; select the same private webhook secret. Localhost
is not reachable from Razorpay. Local authenticated reconciliation works without
a public webhook, but public-webhook delivery remains unverified until deployed.

## Sources

- https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
- https://razorpay.com/docs/api/orders/create/
- https://razorpay.com/docs/webhooks/validate-test/
- https://razorpay.com/docs/api/refunds/create-normal/

## Progress record

- Test credentials authenticated successfully on 10 October 2026.
- Additive schema, checkout, reconciliation, cancellation and refund services/UI implemented; Prisma validation, TypeScript and production build passed.
- Simulated-provider integrity checks passed with scoped temporary fixtures and cleanup. Two additional assertions (wrong provider order and frozen price after editing an event) compile but await a repeat execution.
- Actual INR 1 sandbox checkout captured successfully and issued one QR ticket and one test ledger entry. Cancellation revoked the QR and released the seat.
- Actual full test refund was rejected with HTTP 400; no successful refund or corresponding ledger void is claimed. Public provider webhook delivery is also unverified.
- Payment work paused at the user's request for project review. Live payments remain disabled.
