# Email verification - local Gmail SMTP setup

Status: SMTP code and queue-integrity tests implemented. SMTP connection/TLS/authentication passed on 11 October 2026 and local verification is enabled. Real inbox delivery and the complete new-user approval journey remain unverified; no email-verification bypass exists.

## Why a Gmail SMTP option is needed

The existing Resend sender is a Gmail address. Resend requires a verified sending domain for general recipient delivery; its resend.dev testing domain is restricted. Gmail SMTP can use the user's Gmail mailbox without purchasing a custom domain. Use an App Password, not the normal Gmail password.

Sources: https://support.google.com/accounts/answer/185833 ; https://nodemailer.com/usage/using-gmail/ ; https://resend.com/docs/knowledge-base/403-error-resend-dev-domain

## Owner steps

1. Sign in to the Google account used for the sending mailbox.
2. Enable 2-Step Verification in Google Account > Security. Complete this yourself; do not share authentication codes.
3. Open https://myaccount.google.com/apppasswords and generate an App Password named Skyline. If unavailable, check Google's account eligibility/policy; do not disable protections to make it appear.
4. Edit only E:\Odoo-apex-main\Odoo-apex-main\skyline\.env. Keep this file private:

```dotenv
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=maheshwaranpalanisamy1@gmail.com
SMTP_PASSWORD=your_private_google_app_password
EMAIL_FROM=maheshwaranpalanisamy1@gmail.com
EMAIL_VERIFICATION_ENABLED=false
```

Keep the already-generated OTP_SECRET unchanged. Never paste the App Password, OTP_SECRET or database keys into chat or Git. Enter the App Password without grouping spaces; never use the normal account password.

5. Check SMTP connection/authentication, without sending an email:

```powershell
cd E:\Odoo-apex-main\Odoo-apex-main\skyline
npm run email:check
```

6. Reply SMTP configured after saving. The assistant will verify settings and connection, then enable verification and restart the local app. A successful handshake proves authentication, not inbox delivery.
7. Complete a real registration with an email you control that is not already registered. The three initial users are already administratively verified, so they do not need an OTP retroactively. Do not change their verification state just for a test.
8. Check inbox/spam and enter the latest six-digit code. Do not paste it into chat. Correct OTP verifies email only; your requested role still awaits the designated Staff approver.
9. Balaji signs in > User access > reviews verified applicant > records approval. Re-login as the approved user to check the granted role and correct landing page.

## Implemented behavior

- Cryptographic six-digit OTP, leading zeros retained; ten-minute expiry.
- Five incorrect attempts, sixty-second resend cooldown, five requests/hour/account.
- Requested role grants no privilege before email verification and Staff approval.
- Registration and resend immediately dispatch only their own OTP queue entry; unrelated emails are not sent by that request.
- Delivery feedback distinguishes provider acceptance, incomplete delivery and verified email. Provider acceptance is not proof the message appeared in an inbox.
- Sign-out is available on verification and approval-pending screens.
- SMTP transport uses encrypted port465 or mandatory STARTTLS on587 with certificate validation. No TLS bypass.
- OTP text is removed from sent/expired/superseded local outbox records. Active queued codes remain private server-only data until delivery/expiration.
- SMTP has no provider idempotency guarantee. Stale in-flight/ambiguous delivery goes to REVIEW; do not blindly retry it. Definitive rejection can be retried within bounded queue attempts. Resend retains its stable idempotency key.
- Existing event workers can deliver reminders/reset emails via the selected provider. Gmail is suitable for local verification; production volume/reputation and quotas need a deliberate provider plan.

## Checks

```powershell
npm run verify:otp
npm run verify:email
npm run format:check
npm run lint
npm run typecheck
npm run build
```

The two fixture suites create scoped temporary rows, clean by exact ID, and send no provider email. Email tests cover one concurrent dispatch, expired OTP cancellation, code cleanup, definitive rejection retry and uncertain/stale SMTP review. They do not prove actual Gmail delivery.

## Troubleshooting

- EAUTH: check App Password and SMTP_USER; never use the Skyline login password as SMTP_PASSWORD.
- ETIMEDOUT/connection: check internet/firewall; port465 may be blocked. If needed use port587 with SMTP_SECURE=false (STARTTLS remains required).
- EMAIL_FROM mismatch: Gmail sender must match SMTP_USER.
- No code: check verification feature flag and message delivery status, inbox/spam, latest challenge/cooldown. Do not expose code in the UI as a fallback.
- SMTP accepted but no inbox email: inbox/spam/provider-side checks needed. Do not mark end-to-end verification passed yet.
- Unverified/pending: expected restricted access, separate from membership dues/discount status.
