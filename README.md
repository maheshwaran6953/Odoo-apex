# Skyline Student Association — Student Organization System

A unified platform to manage student memberships, events, ticket sales, merchandise, announcements, volunteer tasks, and finances in one place.

## 📌 Overview

The Skyline Student Association is a campus club that organizes events, sells memberships and merchandise, and manages a budget funded by membership dues, ticket sales, and fundraisers.

Currently, most operations are handled manually using spreadsheets, notebooks, cash payments, and WhatsApp messages. This leads to missed announcements, financial discrepancies, and difficulty tracking memberships, payments, and expenses.

The **Student Organization System** aims to digitize and centralize these operations, making club management simpler, faster, and more transparent.

## 🎯 Problem Statement

The association faces several operational challenges:

- **Membership Management:** Member details and dues are tracked in spreadsheets.
- **Event Management:** Tickets are sold manually, making attendance and revenue difficult to track.
- **Communication:** Announcements are sent individually across multiple WhatsApp groups.
- **Merchandise Sales:** Orders, sizes, payments, and inventory are tracked manually.
- **Volunteer Coordination:** Tasks and responsibilities are scattered across group chats.
- **Financial Management:** Income, expenses, and reimbursements are recorded in notebooks, with receipts managed separately.

The system will provide a single platform to address these problems.

## ✨ Core Features

### 1. Membership Management

- Register and manage student members.
- Track membership status and dues payments.
- Define membership benefits, including discounts on tickets and merchandise.
- Manage annual membership validity and renewals.
- Send renewal reminders before memberships expire.
- Verify membership status during events.

### 2. Event and Ticket Management

- Create and publish events online.
- Sell tickets with different pricing for members and non-members.
- Set ticket limits and track remaining availability.
- Generate digital tickets for attendees.
- Verify tickets quickly at the event entrance.
- Track attendance and ticket check-ins.
- Generate event revenue and attendance reports.

### 3. Announcements and Communication

- Publish announcements through a centralized website.
- Maintain a mailing list for members.
- Send updates about meetings, deadlines, and schedule changes.
- Keep a history of published announcements with timestamps.
- Reduce the need to send messages manually across multiple groups.

### 4. Merchandise Management

- List and sell club merchandise, including hoodies and T-shirts.
- Collect orders and payments online.
- Record product sizes and quantities.
- Track available stock for each product and size.
- Update inventory as orders are placed.
- Monitor merchandise sales and revenue.

### 5. Volunteer and Task Management

- Create tasks for events and fundraisers.
- Assign tasks to volunteers.
- Set deadlines and track task status.
- View task ownership and progress at a glance.
- Coordinate activities without relying entirely on group chats.
- Track fundraiser preparation and completion.

### 6. Financial Management

- Record income from membership dues, ticket sales, merchandise, and fundraisers.
- Record expenses incurred by the association.
- Submit and track volunteer reimbursement requests.
- Attach receipts to expense records.
- Track reimbursement status.
- View total income, total expenses, and available balance.
- Generate financial summaries for the semester.
- Maintain transparent financial records for the leadership team.

## 👥 Target Users

- **Members:** Register, renew memberships, purchase tickets, order merchandise, and receive announcements.
- **Volunteers:** View assigned tasks, manage responsibilities, and submit expense claims.
- **Event Organizers:** Create events, manage tickets, and track attendance.
- **Treasurers:** Monitor income, expenses, reimbursements, and the club's balance.
- **Administrators / Club Leaders:** Manage members, events, announcements, merchandise, volunteers, and overall club operations.

## 🔄 Typical User Workflows

### New Member Registration
1. A student registers for membership.
2. The system records their details and payment status.
3. Membership benefits become available once eligibility requirements are met.
4. The system tracks the membership expiry date and sends renewal reminders.

### Event Ticket Purchase
1. An organizer publishes an event and configures ticket prices and capacity.
2. A student selects the appropriate ticket type.
3. The system processes the purchase and generates a digital ticket.
4. An organizer verifies the ticket at the entrance.
5. Attendance and event revenue are recorded.

### Merchandise Order
1. An administrator lists products, sizes, prices, and stock.
2. A member selects merchandise and places an order.
3. The system records payment and updates inventory.
4. The order is tracked until fulfilment.

### Fundraiser Coordination
1. An organizer creates a fundraiser and its associated tasks.
2. Tasks are assigned to volunteers with deadlines.
3. Volunteers update their task progress.
4. The organizer monitors completion and fundraiser progress.
5. Income and expenses are recorded in the financial system.

### Semester-End Financial Reporting
1. The treasurer reviews all recorded income.
2. Expenses and reimbursement requests are reconciled with receipts.
3. The system calculates total income, total expenses, and the remaining balance.
4. A financial summary is generated for review by the leadership team.

## 💡 Expected Benefits

- Centralized management of club operations.
- Reduced manual work and administrative overhead.
- Better tracking of memberships, payments, and renewals.
- Faster ticket verification and more reliable attendance records.
- Improved merchandise inventory management.
- Clearer volunteer responsibilities and task progress.
- Accurate financial records and easier expense reconciliation.
- Greater transparency and accountability across the association.

## 🎯 Project Goal

Build a simple, reliable, and centralized system that enables the Skyline Student Association to manage its entire semester—from onboarding new members to organizing events and closing the books—without depending on scattered spreadsheets, notebooks, and group chats.

## Implemented practice application

The current implementation is in [`skyline/`](skyline/README.md). Read
[`docs/PROJECT_WALKTHROUGH.md`](docs/PROJECT_WALKTHROUGH.md) for a beginner-friendly
explanation of the club workflows, implemented features, and remaining work.
[`docs/VERIFICATION.md`](docs/VERIFICATION.md) separates completed checks from
unverified scenarios and the current production build blocker.

The features listed above describe the product's intended scope. The current
application uses practice role switching and simulated payment records, with local
SQLite persistence. It does not yet provide production authentication, actual
payment collection, email delivery, receipt uploads, or a verified live deployment.
