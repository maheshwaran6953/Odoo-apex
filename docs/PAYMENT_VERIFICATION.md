# Payment verification — 10 October 2026

## Verified implementation

- Prisma PostgreSQL validation, TypeScript and Next.js production build pass.
- Actual Test Mode credentials accepted by Razorpay: read-only request HTTP 200.
- Actual ₹1 Test Mode order creation/fetch succeed, matching receipt, amount and INR.
- Owner's signed-in browser: Staff creates an explicit sandbox event, guest price ₹1,
  capacity 2; registration creates a single bounded checkout hold.
- Official Razorpay overlay loads and visibly shows Test Mode and ₹1.
- Actual sandbox payment reports `captured=true`, `status=captured`, INR 100 paise.
  Skyline confirms it and creates one QR ticket and one `test` income entry.
- Browser ticket cancellation revokes the QR and releases the seat. Posted income
  remains unchanged at USD $24. Cancellation is separate from refund completion.
- Before browser verification, all 14 original database records were compared field
  by field against the private pre-payment snapshot: no original value changed.
- Payment and PaymentWebhook tables have row security enabled; schema setup revokes
  Supabase public-role access to all 19 application tables.
- Integrity fixtures cleaned by exact IDs. Existing accounts/data not seeded/reset.

## Simulated-provider checks

`npm run verify:payments -- --temporary-fixtures` uses the configured database and
intercepts provider requests within that process. Unexpected hosts are blocked.
These checks are not actual Razorpay payments or browser authentication tests.

1. Concurrent final-seat reservation: one winner, active attempt reused.
2. Concurrent order creation: one provider POST.
3. Practice registration cannot bypass Razorpay checkout.
4. Forged HMAC, wrong amount/currency/order and uncaptured authorization cannot
   issue a ticket. Checkout price remains frozen across an event price edit.
5. Concurrent callback/webhook: one ticket, linked test ledger and notification;
   identical replay accepted, conflicting event-ID body rejected.
6. Rejected refund remains required; no successful refund recorded.
7. Lost refund response recovered without a second refund; ledger void waits for
   matching processed full-refund evidence.
8. Ambiguous order creation recovered by receipt, no replacement POST.
9. Expiry/FIFO waitlist promotion, offer transfer without double counting,
   abandonment restoring only a still-valid original offer.
10. Late capture enters review without taking another attendee's seat.
11. Unauthorized user cannot abandon another user's hold.
12. Lost browser callback recovered through reconciliation.
13. Full external refund before callback: evidence recorded/voided, no QR issued.
14. Disabled/unverified accounts denied; live keys rejected.
15. Raw-body webhook HMAC accepts matching signature and rejects tampering.

Local webhook HTTP checks: invalid signature 401, valid signed unsupported event
200, identical replay 200, conflicting same-ID signed payload 503. Only that test
webhook row was removed. This does not prove provider delivery to a public endpoint.

## Actual refund blocker — not verified successful

Razorpay rejected the captured ₹1 payment's full test refund: HTTP 400,
`BAD_REQUEST_ERROR`, description `invalid request sent`. Its refund list was empty.
Ticket cancellation/QR revocation stand; no refund completion or ledger void is claimed.

An identical retry, documented UUID-format key and documentation's minimal payload
were rejected. Alternate diagnostic keys were tried only after definitive HTTP 400
responses and a zero-refund check. Application code retains one stable key/payload
and never changes keys following uncertain replies.

Owner asked to inspect the Test Mode dashboard reason, including available test
refund balance. Insufficient balance is a possibility, not an established diagnosis.
No real top-up, live activation, reduced refund or non-idempotent fallback occurred.

## Remaining gates

- Resolve provider rejection; verify full sandbox refund to local `REFUNDED`,
  provider `processed`, void test ledger and revoked QR.
- Actual sandbox failure/retry browser flow, simultaneous server-action
  cancellation/check-in races and cross-account access-denial browser checks.
- Public HTTPS deployment, webhook configuration and provider delivery/retry logs.
- Hosted scheduler verification. Email delivery needs a verified sender domain;
  payment implementation does not remove that DNS requirement.
- Physical camera/phone QA remains separate.

No claim of complete production/live-money readiness.
