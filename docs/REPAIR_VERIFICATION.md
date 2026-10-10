# Repair verification - 10 October 2026

Local source: E:\Odoo-apex-main\Odoo-apex-main\skyline. Existing remote history preserved.

- Full pre-reset private backup:19 tables,52 records; JSON/count checked. Restore rehearsal deferred.
- User-approved reset:3 approved users,1 linked student member identity; no demo business records.
- Schema validation/generation and Supabase server-only RLS applied.
- TypeScript, ESLint, Prettier check and production build passed.
- OTP isolated fixture checks passed: disabled configuration, cooldown/hourly limit, attempts/expiry, leading zeros, stale challenge invalidation and concurrent consumption. No real email sent.
- Events scoped fixtures passed: concurrent last seat, duplicate registration, account state denial, exact cancellation/QR/ledger changes, membership eligibility and input/date boundaries.
- Finance scoped fixtures passed: actor/ownership denial, self-review, concurrent decisions, repeat decisions, audit fields, decimal bounds and currency isolation.
- Fixture suites clean exact IDs and preserve preexisting records.

Real email deferred; framework dependency advisories remain release blockers. Payment refund/public webhook incomplete and paused. Physical scanner unverified. See LOCAL_RUNBOOK.md.

Browser checks: initial Member login -> My events with no registrations; Member finance route denied; designated Staff login -> Overview with honest empty totals and access to role review screen. Treasurer browser verification follows.

Treasurer initial login -> Treasurer desk with zero ledger entries; Treasurer User access route denied. All three initial browser logins verified.

Email implementation update: encrypted SMTP adapter, immediate account-specific OTP dispatch, safe SMTP uncertainty handling and outbox-code cleanup implemented. OTP and simulated-delivery suites pass with scoped cleanup. Actual SMTP authentication/inbox verification pending App Password.
