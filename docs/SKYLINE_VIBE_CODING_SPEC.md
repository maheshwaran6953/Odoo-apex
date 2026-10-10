# Skyline Student Organization System

## Vibe-coding implementation specification

This is the build contract for a 24-hour vertical-slice prototype for the Odoo Hackathon. It converts the Skyline Student Organization System brief into a small product that can be built, tested, and demonstrated without inventing requirements during implementation.

The product replaces spreadsheet member sign-ups, cash ticket sales, notebook budgeting, one-by-one WhatsApp announcements, and receipt chasing with one modular monolith. The demo story is: a student joins, buys a discounted gala ticket, checks in, orders club merchandise, completes a fundraiser task, and the treasurer sees the money in one ledger.

## 1. Product boundary

### In scope

- Member records, dues status, membership expiry, and renewal reminders.
- Events with capacity, ticket tiers, member pricing, registration, and check-in.
- Hoodie/T-shirt catalog with size variants and stock decrement.
- Announcements page with an email-preview action.
- Fundraiser task board with assignment and status.
- Income and expense ledger, receipt attachment metadata, reimbursement status, and balance.
- Responsive member view and staff/treasurer view.
- Seed data, local SQLite setup, automated checks, and a deployable demo build.

### Explicitly out of scope

Real payment settlement, WhatsApp delivery, multi-club tenancy, recurring accounting, tax compliance, native mobile apps, complex inventory purchasing, and production-grade email infrastructure. Simulated integrations must be labelled Demo mode in the UI.

## 2. Architecture

- Next.js 14 App Router with TypeScript.
- Server Components for reads and Server Actions for mutations.
- Tailwind CSS, shadcn/ui primitives, Lucide icons, and small hand-authored animations.
- SQLite with Prisma ORM for the 24-hour prototype.
- Zod schemas shared by forms and Server Actions.
- Zustand or React state only for cart state and other client-only interaction.
- One modular monolith. No separate API server, queue, or microservice.
- Money is stored as integer minor units, called amountCents, never floating point.
- Ticket allocation and inventory decrements happen inside database transactions.
- Server-side authorization is authoritative.

Suggested layout:

    src/
      app/
        dashboard/
        members/
        events/
        events/[eventId]/
        events/check-in/
        merchandise/
        fundraisers/
        treasurer/
        announcements/
      components/ui/
      components/skyline/
      server/actions/
      server/queries/
      lib/
      prisma/schema.prisma
      prisma/seed.ts

## 3. Domain model

Core models are Member, Membership, Event, Ticket, InventoryItem, MerchandiseOrder, MerchandiseOrderLine, Task, and Transaction. Add createdAt and updatedAt to mutable models.

Required enum values:

- MembershipStatus: PENDING, ACTIVE, EXPIRED
- TicketType: MEMBER, NON_MEMBER
- TicketStatus: RESERVED, PAID, CHECKED_IN, CANCELLED
- OrderStatus: PENDING, PAID, FULFILLED, CANCELLED
- TaskStatus: TODO, DOING, DONE
- TransactionType: INCOME, EXPENSE
- TransactionCategory: DUES, TICKET, MERCHANDISE, FUNDRAISER, REIMBURSEMENT, OTHER

Important fields:

- Member: name, email, phone.
- Membership: member ID, status, dues in cents, expiry date.
- Event: name, description, start time, location, capacity, member and non-member price in cents.
- Ticket: unique code, event ID, optional member ID, type, status, price, checked-in time.
- InventoryItem: name, category, size, price in cents, stock.
- MerchandiseOrder: optional member, status, total in cents, lines.
- Task: title, description, status, due date, assignee.
- Transaction: type, category, description, amount in cents, optional member, receipt URL, status.

Keep behavior intact if simplifying the schema. Do not replace persisted data with arrays in feature pages.

## 4. Roles

Prototype roles are MEMBER, STAFF, and TREASURER.

- Members can view public events, their own tickets/orders, and announcements.
- Staff can create events, check in tickets, manage inventory, and manage fundraiser tasks.
- Treasurers can view and mutate ledger entries and reimbursement status.
- Only staff and treasurers can mutate shared records.

## 5. UI direction

Do not ask an AI agent for “a modern dashboard.” Give it a visual system.

Skyline visual language:

- Warm off-white canvas #F7F4EE, ink navy #172033, electric coral #F45B4A.
- Compact club-pulse header with semester, next-event countdown, and available cash.
- Editorial cards with one oversized number, one sentence of context, and one quiet action.
- Diagonal/arc motif inspired by a campus noticeboard pin or skyline horizon.
- Table-to-card responsive transitions rather than squeezed desktop tables.
- Lucide icons inside tinted 32px squares; no emoji as operational UI.
- 150–220ms motion, subtle card lift, check-in success pulse, stock warning shimmer.
- Respect prefers-reduced-motion.
- Empty states explain the next action.
- Every page needs loading, empty, error, validation, and success states.

### Open-source tools and templates

Use these as source material, not as a visual identity to copy wholesale:

- shadcn/ui: https://ui.shadcn.com/
- Kiranism dashboard starter: https://github.com/Kiranism/next-shadcn-dashboard-starter
- Next.js + Supabase + shadcn boilerplate: https://github.com/Barty-Bart/nextjs-supabase-shadcn-boilerplate
- Magic UI: https://magicui.design/
- Aceternity UI: https://ui.aceternity.com/
- Tremor: https://tremor.so/
- Lucide: https://lucide.dev/
- v0: https://v0.dev/

Use the dashboard starter for patterns only. Select individual animation components from Magic UI or Aceternity. Use Tremor or Recharts for one balance chart and one category breakdown. Record source URL and license in docs/THIRD_PARTY_UI.md whenever code is copied. Do not use code without a clear license.

## 6. Server Action contracts

Every action returns either ok=true with data or ok=false with an error containing code, message, and optional fieldErrors. Validate with Zod and revalidate affected paths.

Required actions:

    createMember(input)
    activateMembership(memberId)
    renewMembership(memberId)
    createEvent(input)
    purchaseTicket(eventId, memberId?)
    checkInTicket(code)
    createMerchandiseOrder(lines, memberId?)
    moveTask(taskId, status)
    createTransaction(input)
    approveReimbursement(transactionId)

purchaseTicket counts paid/reserved tickets inside a transaction. createMerchandiseOrder re-checks stock inside a transaction, decrements stock, and creates the order and income transaction atomically. checkInTicket rejects cancelled, unknown, or already checked-in codes.

## 7. 24-hour execution plan

### Hours 1–3: foundation

Initialize the app, install shadcn, create Prisma schema/migrations/seed, build the shell, and make the dashboard render seeded data. Commit when a fresh clone runs with one command.

### Hours 4–8: members and merchandise

Build member list/detail, activation/expiry, catalog, size variants, cart, and transactional order path. Commit when a member can buy a hoodie and stock changes.

### Hours 9–14: events and check-in

Build event detail, pricing, capacity, ticket generation, and staff check-in. Commit when the same ticket cannot be checked in twice.

### Hours 15–19: tasks and treasurer

Build fundraiser board, transaction list, reimbursement status, balance summary, and one useful chart. Commit when the dashboard reconciles seeded and new records.

### Hours 20–24: polish and demo

Run mobile checks, remove placeholder copy, seed believable data, add empty/error states, run tests/build, deploy, and rehearse. Do not add features in this phase.

## 8. Four-person Git playbook

Ownership:

1. Foundation + members: setup, Prisma schema, auth/demo roles, shell, dashboard, membership actions.
2. Events + check-in: event pages, ticket purchase, capacity transaction, ticket code, check-in view.
3. Merchandise + announcements: catalog, cart, stock transaction, order history, announcement archive/email preview.
4. Tasks + treasurer + integration: Kanban, ledger, reimbursement flow, seed data, cross-feature QA, deployment.

The foundation owner creates shared UI primitives and schema conventions. No one silently edits another owner’s domain files. Shared contract changes go in docs/CONTRACT_CHANGES.md before editing.

Beginner workflow:

    git clone https://github.com/maheshwaran6953/Odoo-apex.git
    cd Odoo-apex
    git switch -c feat/foundation
    npm install
    npm run dev

Use unique branches: feat/foundation, feat/events, feat/merchandise, feat/treasurer.

Push after the first runnable scaffold, after each manually verified vertical slice, before a shared schema/component change, at the end of a work block, and before integration.

    git status
    git add src prisma docs
    git commit -m "feat(events): add transactional ticket purchase"
    git push -u origin feat/events

Never work directly on main. Never use git add . blindly. Never commit .env, database files, secrets, or generated build folders.

Open a pull request from the feature branch to main after pushing. The author explains what changed, how to run it, how to test it, and what remains. One teammate reviews and runs the smoke test. Merge only after lint, typecheck, test, and build pass, or an unavailable command is documented.

After merge:

    git switch main
    git pull --ff-only origin main
    git switch feat/your-next-task
    git rebase main

If a rebase conflict appears, stop and ask the owner of the conflicting domain. Never force-push main.

## 9. AI coding prompt

Paste this into the coding agent at the start of every task:

    You are implementing one milestone of the Skyline Student Organization System.
    Read docs/SKYLINE_VIBE_CODING_SPEC.md before editing.
    This is a 24-hour vertical slice: favor a complete, testable workflow over breadth.
    Use Next.js 14 App Router, Server Components, Server Actions, TypeScript, Tailwind,
    shadcn/ui, Prisma, and SQLite. Preserve modular boundaries and the Skyline visual
    language. Do not invent features or replace real persistence with fixture arrays.

    Before coding: inspect the current tree, identify the smallest vertical slice,
    list files you will change, and state any contract you need from another teammate.
    While coding: validate Server Action inputs with Zod, enforce role checks on the
    server, use transactions for seats/stock/money, and provide loading, empty, error,
    and success states. Keep copied UI dependencies licensed and documented.
    After coding: run lint, typecheck, tests, and build; fix failures; update the task
    checklist; provide manual verification steps and a concise commit message.
    Do not claim completion when a page still uses placeholder data.

For UI work, add:

    Do not produce a generic SaaS dashboard. Use warm paper canvas, ink navy, coral
    action color, editorial cards, campus noticeboard/skyline motif, Lucide icons,
    quiet micro-animations, meaningful empty states, and mobile-first table-to-card
    layouts. Generate one page at a time and verify it against the shell.

## 10. Acceptance checklist

- A fresh clone runs locally with SQLite and seed data.
- Dashboard totals are calculated from database records.
- A member can activate, expire, and renew membership.
- Member and non-member ticket prices differ server-side.
- Ticket capacity cannot be exceeded in concurrent purchases.
- Ticket check-in is fast, searchable, and rejects repeats.
- Merchandise stock is tracked by size and cannot become negative.
- A fundraiser task has an assignee, status, and due date.
- Income minus expenses equals the displayed balance.
- Every mutation has validation and a visible failure state.
- Mobile layouts work for member and check-in flows.
- No secrets or unlicensed copied code are committed.
- The final demo can be completed in under three minutes.

## 11. Demo script

1. Open dashboard: show active members, next event, stock warning, and cash balance.
2. Open Members: activate Aisha Rahman and show the expiry date.
3. Open Spring Gala: buy the member ticket and show remaining capacity.
4. Open Door Check-in: enter the ticket code; show success; repeat it to demonstrate duplicate protection.
5. Open Merchandise: order a medium hoodie; show medium stock decrement.
6. Open Fundraiser: move Run bake-sale table from Doing to Done.
7. Open Treasurer: show ticket, dues, merchandise, reimbursement lines, and resulting balance.

The judging message: one system turns club activity into traceable work and money, while the interface feels like a focused campus tool rather than an anonymous admin template.

