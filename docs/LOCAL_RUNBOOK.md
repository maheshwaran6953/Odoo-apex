# Run Skyline locally after the reliability repairs

## Your app folder

E:\Odoo-apex-main\Odoo-apex-main\skyline

The Git repository is its parent. The outer E:\Odoo-apex-main folder is not the app. The local repository now uses the existing GitHub history and branch codex/skyline-reliability.

## First start / restoring dependencies

Open PowerShell:

```powershell
cd E:\Odoo-apex-main\Odoo-apex-main\skyline
node --version
npm --version
npm ci
npm run db:generate
npm run db:validate
npm run dev -- --port 3001
```

Open http://localhost:3001/login. The initial accounts already exist; do NOT run reset, bootstrap or demo seed during normal startup. Stop a running server with Ctrl+C before starting another on the same port.

The private .env has been restored locally. It must include DATABASE_PROVIDER=postgresql, DATABASE_URL, DIRECT_URL and APP_URL=http://localhost:3001. The database is Supabase PostgreSQL, not a new local SQLite database. Internet access is required to reach it.

Only when intentionally applying reviewed schema updates:

```powershell
npm run db:push
```

This project currently uses Prisma schema push with a PostgreSQL-generation wrapper. A versioned production migration workflow remains future hardening; do not use destructive schema flags to fix errors.

## Accounts and expected pages

| Email | Granted role | Landing page |
| --- | --- | --- |
| maheshwaranpalanisamy1@gmail.com | Member | My events |
| balajivasun@gmail.com | Staff/designated role approver | Overview |
| smohamedanas02@gmail.com | Treasurer | Treasurer desk |

Use the passwords you supplied privately. They are not in this runbook or Git. Only Balaji's initial Staff identity can approve/reject requested roles. Subsequent Staff users do not automatically receive this capability.

Different normal browser tabs share cookies. Use separate browsers or an incognito session for simultaneous role demonstrations. Sign out between sequential tests.

## Starting with an empty workspace

No demo events, inventory, tickets or ledger entries are present. Staff creates real events in Events & tickets, enters real inventory in Club shop > Add inventory item, creates volunteer tasks, and adds/manages member records. Select practice registration while payment work remains paused. Prices/capacity are explicit inputs; zero prices are allowed for practice events.

The Member registers through an event page, opens their own ticket and presents the QR/backup code to Staff. Staff uses the event door desk and confirms Verify & record entry. A scan only fills the code; entry is recorded after confirmation. Duplicate/cancelled/wrong-event tickets are rejected. Entry window is plus/minus 12 hours from event start. Camera requires HTTPS or localhost.

Users submit owned expense requests in My account. Treasurer approves or rejects another user's pending claim. The claimant, reviewer, date and reason are recorded. Approval updates the ledger, not a bank payout. The sole initial Treasurer cannot approve their own claim; another approved Treasurer is needed. USD and INR are reported separately.

## Background event/reminder processing

In another PowerShell terminal:

```powershell
cd E:\Odoo-apex-main\Odoo-apex-main\skyline
npm run events:watch
```

Keep it running only while required; Ctrl+C stops it. Running the app alone does not imply unattended reminder processing. Gmail SMTP authentication is verified locally. In-app notifications work independently; actual recipient inbox delivery remains unverified. Membership renewal reminders and notice mailing now also use this worker.

## OTP email activation

OTP logic is implemented and tested with isolated fixtures; real inbox delivery is NOT verified. Local SMTP authentication has passed and EMAIL_VERIFICATION_ENABLED=true is now configured. New registrations remain unverified and cannot access protected club operations until email delivery is enabled and verification completes. Initial accounts were administratively bootstrapped, not OTP-verified.

See EMAIL_VERIFICATION.md for Gmail SMTP without a custom domain. Run npm run email:check after adding the App Password locally. Alternatively configure a verified-domain Resend provider; keep the private OTP_SECRET (at least32 characters); verify sender/provider delivery; set EMAIL_VERIFICATION_ENABLED=true; restart server and worker; test registration, inbox delivery, OTP verification, pending role approval and approved login. Do not print OTPs or bypass verification to simulate success.

## Code checks

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run build
```

Format edits with npm run format. The explicit integration checks create isolated temporary fixtures in the configured DB and clean by exact IDs:

```powershell
npm run verify:otp
npm run verify:events
npm run verify:finance
npm run verify:basics
```

Prefer a separate test database for future repeated checks. They are not a substitute for full browser acceptance or actual email delivery.

Production-style local startup after a successful build:

```powershell
npm run start -- --port 3001
```

Do not build into .next while a production server using it is running. Do not run dev and start on the same port.

## Backups and reset safety

The private pre-repair snapshot covers all19 previous application tables (52 records). Local ignored backups contain personal data/password hashes and must stay private. Reset completion marker prevents accidental replay of the one-time reset. There is no automatic seed/reset at installation or startup. For a later reset create a fresh, reviewed backup/restore procedure first.

## Known release blockers / honest verification

- SMTP authentication passed; real OTP/reminder/notice inbox delivery remains unverified.
- Razorpay work remains paused; actual refund and public webhook delivery are unresolved. Do not activate Live Mode.
- npm audit reports critical/high issues in this older Next.js14/Prisma dependency stack. A deliberate supported-version migration and repeat compatibility/security checks are required before public production release. No blind npm audit fix --force was performed.
- Account approval stores the current decision metadata; an append-only administrative audit trail remains additional hardening.
- Registration/OTP account rate budgets are implemented; production proxy-trust and distributed/IP-abuse protection still need deployment-specific verification.
- The reset backup was parsed/count-checked; a full isolated restore rehearsal was not performed.
- Physical QR-camera/device compatibility and reliable external email require real-device/provider verification.

## Troubleshooting

Prisma not initialized: run npm run db:generate from the app folder.
Database unreachable: verify local provider/connection strings and Supabase availability; never paste secrets into chat.
Port in use: stop the previous Skyline process; do not kill unrelated Node processes.
Wrong account across tabs: sign out and use isolated browser sessions.
Access denied: inspect approval, verified identity and effective role; requested role alone does not grant access.
OTP unavailable: expected while EMAIL_VERIFICATION_ENABLED=false. Do not manually approve unverified new users.
Dates shifted: use browser-local datetime input; the form now submits ISO timestamps with timezone information.
Negative/invalid amount: expected validation rejection; money supports at most two decimal places, expenses must be positive, capacity/quantity must be positive integers.
