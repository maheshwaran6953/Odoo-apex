# Skyline event payments — Razorpay Test Mode

## Release scope

Event tickets only, INR and Test Mode. Real payments, membership dues checkout and
merchandise checkout are outside this release. Test capture entries use ledger
status `test` and are excluded from posted club income. Old USD practice records
retain their original amounts and currencies.

## Private configuration

1. In Razorpay Dashboard select **Test Mode**.
2. Open **Account & Settings → Website and app settings → API Keys → Generate Key**.
3. Save the Key ID and Key Secret immediately in `skyline/.env`:

   ```dotenv
   RAZORPAY_KEY_ID=rzp_test_replace_locally
   RAZORPAY_KEY_SECRET=replace_locally
   RAZORPAY_WEBHOOK_SECRET=separate_random_secret_at_least_32_characters
   ```

4. Configure automatic payment capture in the Test Mode dashboard. An authorized
   payment does not count as a captured payment and never issues a ticket.
5. Restart the app and worker after changing environment variables. Secrets are
   server-only; never put them in `NEXT_PUBLIC_` variables, screenshots or Git.

Official instructions: https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/

## Start the application

From `skyline`, using an already configured database:

```powershell
npm run verify
$env:SKYLINE_DIST_DIR = '.next-verify'
npm start -- --port 3001
```

In a second terminal:

```powershell
npm run events:watch
```

The worker reconciles pending/uncertain checkouts and refunds, then handles event
reminders and waitlists every five minutes. Authenticated users can also request
an immediate status recheck, with a fifteen-second cooldown. Worker reconciliation
is bounded to 25 recent attempts per pass and a 24-hour lookback; older unresolved
records require an explicit staff recheck. This is not a permanent settlement audit.

## Attendee workflow

1. Sign in with a verified account. An active club membership selects member pricing;
   a user account alone does not qualify for that discount.
2. Open an upcoming INR event configured with Razorpay Test Mode.
3. Start checkout. The server freezes the price and reserves one seat for at most
   ten minutes, bounded by booking/event/seat-offer deadlines.
4. Open the checkout link, then **Pay with Razorpay · TEST**. Payment details are
   entered only in Razorpay's own overlay. Do not use real card/bank details to test.
5. Server verification checks signature, stored order, receipt, amount, currency and
   captured status. A successful matching capture atomically creates the ticket,
   test ledger entry and notification. The QR appears only afterward.
6. If checkout closes or a response is lost, use **Recheck payment status**. Repeated
   clicks reuse the same active attempt; an uncertain order POST is not blindly retried.
7. A captured payment arriving after a hold expires goes to staff review, with no
   ticket issued. It does not steal another attendee's ticket or waitlist offer.

An offered waitlist seat transfers into the checkout hold without double counting.
Abandoning checkout restores an offer whose original deadline is still valid;
leave the waitlist afterward if you want to release that offer as well.

## Cancellation and refunds

- Cancel from the ticket page before attendance starts. Access and QR are revoked
  immediately; payment becomes **Refund required**. Cancellation is not a refund.
- Staff/Treasurer opens the record from **Test payment desk**, confirms the full
  test refund checkbox and submits it. A pending request remains **Refund pending**.
- A stable refund idempotency key protects retries after uncertain responses.
- Only matching, processed full refunds mark the payment **Refunded** and void its
  test income. Partial/external refund anomalies remain **Review** for investigation.
- An old refund cannot cancel a ticket subsequently rebooked under a different ledger.
- Never interpret a Test Mode refund or capture as a real money movement.

## Public webhook configuration

Localhost cannot receive Razorpay's remote callbacks. After deployment:

1. Set the deployed app's private environment variables and `APP_URL` to its HTTPS URL.
2. In Razorpay **Test Mode → Account & Settings → Webhooks**, add:
   `https://YOUR_APP_HOST/api/payments/razorpay/webhook`.
3. Use exactly the same `RAZORPAY_WEBHOOK_SECRET` as the deployed app.
4. Subscribe to `payment.captured`, `order.paid`, and `refund.processed`.
5. Test delivery from Razorpay and inspect delivery logs. Acknowledge successful
   events with HTTP 200; failed processing returns a retryable status.
6. Verify that duplicate deliveries produce one ticket/ledger entry. Invalid
   signatures are rejected. Conflicting reuse of an event ID is rejected.

An HTTPS hosting subdomain is sufficient; a purchased domain or DNS setup is not
required for this endpoint. No public webhook delivery is claimed until configured
and tested. Local server reconciliation provides recovery while that is pending.

## Verification commands and boundaries

```powershell
npm run verify
# Explicitly permits temporary database fixtures; provider responses are simulated:
npm run verify:payments -- --temporary-fixtures
```

The integrity script inserts isolated verification users/events in the configured
database and removes only their exact IDs in `finally`. It never resets or seeds
existing club records. Prefer a disposable database when repeating it. Interrupted
processes may leave fixtures; review by the printed verification prefix rather than
deleting unrelated records. The script blocks every provider network request and
does not exercise an actual Razorpay checkout, authentication, or public delivery.

See `PAYMENT_VERIFICATION.md` for recorded outcomes and remaining verification.

## Live release gate

Live keys are intentionally rejected. Enabling real payments is a separate release
requiring explicit approval, activated merchant account, verified hosted callbacks,
reconciliation/monitoring, refund policies and an end-to-end sandbox pass. Replacing
the key alone cannot enable live payments in this code.
