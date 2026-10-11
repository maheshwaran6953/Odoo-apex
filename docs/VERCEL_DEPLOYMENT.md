# Skyline Vercel deployment

## Current preparation

- Hosting account: MAHESHWARAN P's projects; project: odoo-apex-skyline.
- Git repository: maheshwaran6953/Odoo-apex; application root: skyline.
- Next.js 15.5.27 / React 18.3.1 / Prisma 6.19.3; Node.js 22 recommended on hosting.
- Production dependency audit: zero findings after pinned Next.js/PostCSS/Deepmerge patches. Development-only advisories remain; a clean audit is not proof against all vulnerabilities.
- Installation: npm ci. Build: npm run build. Prisma generation runs at postinstall.
- No database schema push, reset, seed or bootstrap runs during deployment. Existing Supabase records remain unchanged.
- The UI styling remains unchanged. Next.js request APIs now await cookies, headers and route/query parameters.

## Private production environment

Save these only in Vercel Production environment settings. Never add credentials to Git, a public URL, client-side NEXT_PUBLIC variables, or chat. Only give production database access to trusted production deployments; do not share it with untrusted preview branches.

Required names:

- DATABASE_PROVIDER=postgresql
- DATABASE_URL and DIRECT_URL: the existing Supabase PostgreSQL connection strings; hosting must reach the pooler.
- DATABASE_CONNECTION_LIMIT=3
- SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_RECEIPTS_BUCKET=skyline-receipts (existing private bucket)
- EMAIL_PROVIDER=smtp, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD and EMAIL_FROM
- EMAIL_VERIFICATION_ENABLED=true, OTP_SECRET (at least 32 characters)
- APP_URL: the verified canonical HTTPS production URL, not localhost
- NEXT_PUBLIC_CLUB_TIME_ZONE=Asia/Kolkata
- CRON_SECRET: a new random server-only secret shared with the scheduler
- PAYMENT_JOBS_ENABLED=false

Do not upload BOOTSTRAP_PASSWORD, BOOTSTRAP_EMAIL, RAZORPAY keys, unused RESEND_API_KEY or local SKYLINE_DIST_DIR. Payment integration remains paused. Before a public production release, rotate credentials previously pasted into chat and update the ignored local environment privately. Rotation of authentication credentials is performed by the account owner.

## Hosted reminders and mail

A local npm run events:watch terminal is not part of a Vercel deployment. The application exposes POST /api/jobs/events, authenticated using Authorization: Bearer followed by CRON_SECRET. Missing/wrong credentials return 401; no jobs run. Hosted batches deliver at most ten queued emails per invocation. The endpoint has a 300-second budget and runs in the Node.js runtime. Payment reconciliation is opt-in and remains disabled.

The prepared GitHub Actions workflow is .github/workflows/skyline-jobs.yml. It has no repository-content permissions, does not check out source, and serializes its own runs. Configure in GitHub repository Settings → Secrets and variables → Actions:

- Repository variable SKYLINE_APP_URL: canonical HTTPS app URL.
- Repository secret SKYLINE_CRON_SECRET: exactly the Vercel CRON_SECRET.
- Repository variable SKYLINE_SCHEDULER_ENABLED=true only after hosting is verified.

Scheduled workflows execute from the default branch. Five-minute schedules are best-effort: GitHub may delay runs, and public repositories can have scheduled workflows disabled after inactivity. This is suitable for a prototype, not a strict five-minute delivery SLA. Do not also run a local watcher against production during acceptance checks. For dependable production timing use a dedicated authenticated scheduler; Vercel Hobby cron scheduling cannot replace a five-minute worker.

## Verification before calling deployment complete

1. Confirm local typecheck, lint, production build and applicable regressions.
2. Push reviewed separate frontend/backend/deployment/testing commits.
3. Confirm Vercel root directory skyline, Production environment and correct branch.
4. Deploy and inspect logs without exposing private values.
5. Confirm HTTPS login/register/events load and unauthenticated private routes redirect.
6. Confirm unauthenticated job and receipt endpoints return 401.
7. Sign in with existing approved accounts; verify secure HttpOnly session cookie and role boundaries.
8. Verify database-backed public events render. Do not create/delete real records as a smoke test.
9. Owner verifies OTP/mail delivery and private receipts in an intentional acceptance workflow; SMTP acceptance alone is not inbox proof.
10. Set the canonical APP_URL and scheduler variables/secret, manually dispatch one authorized job, then check job result and outbox status. Job execution may send opted-in queued mail.
11. Record real deployment URL, deployment ID, commit and date here. Until these are recorded with live checks, hosting is prepared rather than verified complete.

## Local checkout after migration

Stop only Skyline development and watcher terminals with Ctrl+C before updating dependencies. In Windows CMD, from the intended local checkout:

    cd /d E:\Odoo-apex-main\Odoo-apex-main\skyline
    npm ci
    npm run db:generate
    npm run dev -- --port 3001

In a separate terminal use npm run events:watch for local-only jobs, not in addition to the production scheduler. Do not reset or seed the database.

## Local verification evidence — 11 October 2026

- TypeScript: passed.
- ESLint: passed with no warnings/errors.
- Production build: passed with NODE_OPTIONS=--max-old-space-size=512 after an initial Windows memory failure.
- Production npm audit --omit=dev: zero vulnerabilities. Full development audit: nine findings (two moderate, seven high), tracked separately.
- Mail queue regression: passed with mocked provider; no emails sent.
- Production HTTP smoke checks on port 3002: passed (public pages, protected redirects, denied receipt/jobs).
- Production configuration and deployment completed after authorization. See live verification below.

## Live deployment verification — 11 October 2026

- Canonical URL: https://odoo-apex-skyline.vercel.app
- Vercel project: maheshwaran-ps-projects/odoo-apex-skyline; root directory skyline.
- Verified application commit: 4c572a9 on main.
- Deployment ID: JBP1wqC6qnbCt6kEJvkGEAA9oQRg. Vercel displayed Ready, Production / Current, created at 13:09:32 Asia/Kolkata; build duration 1 minute 6 seconds.
- Production-only server credentials saved as secret variables. Public club time zone is Asia/Kolkata. APP_URL uses the canonical HTTPS URL. Preview deployments do not share these credentials.
- Live verify:deployment passed: public login/register/events/forgot-password/reset-password pages returned 200; protected pages redirected to login; unauthenticated receipt/job endpoints and a wrong scheduler bearer returned 401.
- Browser verification: live HTTPS login rendered successfully.
- GitHub scheduler configured with SKYLINE_APP_URL, SKYLINE_SCHEDULER_ENABLED and private SKYLINE_CRON_SECRET. Manual acceptance run #1 completed successfully in 4 seconds: https://github.com/maheshwaran6953/Odoo-apex/actions/runs/38122314124
- The successful workflow proves its authenticated curl request returned a successful HTTP response. GitHub's browser log pane failed to display step output, so no sent/failed email counts or hosted inbox delivery are claimed from that run.
- Schedule is every five minutes, best effort: GitHub Actions may delay scheduled runs. Maximum hosted mail batch is 10. Stop local events:watch when using this hosted scheduler against the same database.
- PAYMENT_JOBS_ENABLED=false; Razorpay credentials were not copied to Vercel. No payment acceptance is claimed.
- Existing Supabase records and accounts were preserved. No reset, seed or bootstrap was performed.
- Broader manual acceptance (OTP/reset inbox delivery on the live origin, role matrix, real camera scanning and complete business journeys) remains separate from deployment smoke checks.
