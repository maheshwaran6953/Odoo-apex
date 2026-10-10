import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";
import {
  saveEvent,
  cancelEvent,
  purchaseTicket,
  cancelRegistration,
  runEventUpdates,
} from "@/server/actions/events";
import { ActionForm } from "@/components/club/action-form";
import { EventFields } from "@/components/club/event-creator";
import { PageHeading, money, Empty } from "@/components/club/ui";
export default async function ManageEventPage({
  params,
  searchParams,
}: {
  params: { eventId: string };
  searchParams: { q?: string; status?: string; page?: string };
}) {
  await requireRole(["STAFF"]);
  const event = await db.event.findUnique({
    where: { id: params.eventId },
    include: {
      tickets: true,
      payments: {
        where: {
          status: { in: ["INIT", "CREATING", "PENDING"] },
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      },
      waitlist: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!event) notFound();
  const q = (searchParams.q || "").slice(0, 100).toLowerCase();
  const registered = event.tickets.filter((t) => t.status !== "CANCELLED");
  const attended = registered.filter((t) => t.status === "CHECKED_IN").length;
  const filtered = event.tickets.filter(
    (t) =>
      (!q ||
        `${t.attendeeName} ${t.attendeeEmail} ${t.code}`
          .toLowerCase()
          .includes(q)) &&
      (!searchParams.status || t.status === searchParams.status),
  );
  const page = Math.max(
    1,
    Math.min(
      Math.ceil(filtered.length / 20) || 1,
      Number.parseInt(searchParams.page || "1", 10) || 1,
    ),
  );
  const tickets = filtered.slice((page - 1) * 20, page * 20);
  const users = await db.user.findMany({
    where: { disabledAt: null, emailVerifiedAt: { not: null } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return (
    <main>
      <Link className="section-link mb-5" href={`/events/${event.id}`}>
        ← Public event page
      </Link>
      <PageHeading
        eyebrow="STAFF EVENT WORKSPACE"
        title={event.name}
        description="Track registrations and attendance, keep the details current, and manage the queue."
        action={
          <Link
            className="button"
            href={`/events/check-in?eventId=${event.id}`}
          >
            Open this door desk
          </Link>
        }
      />
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <p>Registered</p>
          <strong>
            {registered.length}/{event.capacity}
          </strong>
          <span>Includes checked-in attendees</span>
        </div>
        <div className="glass-panel stat-card">
          <p>Checked in</p>
          <strong>{attended}</strong>
          <span>
            {registered.length
              ? Math.round((attended / registered.length) * 100)
              : 0}
            % attendance
          </span>
        </div>
        <div className="glass-panel stat-card">
          <p>Waiting / held offers</p>
          <strong>
            {event.waitlist.filter((e) => e.status === "WAITING").length} /{" "}
            {
              event.waitlist.filter(
                (e) =>
                  e.status === "OFFERED" &&
                  e.offerExpiresAt &&
                  e.offerExpiresAt > new Date(),
              ).length
            }
          </strong>
          <span>Offers reserve seats until expiry</span>
        </div>
        <div className="dark-card stat-card">
          <p>
            {event.paymentMode === "RAZORPAY_TEST"
              ? "Test ticket value"
              : "Simulated ticket value"}
          </p>
          <strong>
            {money(
              registered.reduce((sum, t) => sum + t.priceCents, 0),
              event.currency,
            )}
          </strong>
          <span>No gateway settlement</span>
        </div>
      </div>
      <div className="glass-panel panel mb-5">
        <p className="subtext">
          {event.payments.length} active checkout holds · {event.currency} ·{" "}
          {event.paymentMode === "RAZORPAY_TEST"
            ? "Razorpay Test Mode"
            : "Practice registration"}
        </p>
        <Link
          href={`/admin/payments?eventId=${event.id}`}
          className="button secondary small mt-3"
        >
          Review this event’s test payments
        </Link>
      </div>
      <section className="glass-panel panel mb-6">
        <div className="panel-heading">
          <h2>Attendee register</h2>
          <a
            className="button secondary small"
            href={`/api/events/${event.id}/attendees`}
          >
            Export CSV
          </a>
        </div>
        <form className="toolbar">
          <input
            className="input"
            name="q"
            defaultValue={q}
            aria-label="Search attendee name, email or code"
            placeholder="Name, email, ticket code…"
          />
          <select
            className="input !max-w-[200px]"
            name="status"
            aria-label="Registration status"
            defaultValue={searchParams.status || ""}
          >
            <option value="">All statuses</option>
            <option value="PAID">Registered</option>
            <option value="CHECKED_IN">Checked in</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button className="button small">Apply</button>
        </form>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Attendee</th>
                <th>Email / phone</th>
                <th>Code</th>
                <th>Type / price</th>
                <th>Status</th>
                <th>Entry time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>{ticket.attendeeName || "Legacy guest"}</td>
                  <td>
                    {ticket.attendeeEmail || "Not recorded"}
                    <br />
                    {ticket.attendeePhone}
                  </td>
                  <td className="font-mono break-all">{ticket.code}</td>
                  <td>
                    {ticket.type}
                    <br />
                    {money(ticket.priceCents, ticket.currency)}
                  </td>
                  <td>
                    <span
                      className={`badge ${ticket.status === "CANCELLED" ? "danger" : ticket.status === "CHECKED_IN" ? "active" : "pending"}`}
                    >
                      {ticket.status === "PAID" ? "Registered" : ticket.status}
                    </span>
                  </td>
                  <td>{ticket.checkedInAt?.toLocaleString() || "—"}</td>
                  <td>
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="section-link"
                    >
                      View ticket
                    </Link>
                    {ticket.status === "PAID" &&
                      event.startsAt > new Date() && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer">
                            Cancel registration
                          </summary>
                          <ActionForm action={cancelRegistration}>
                            <input
                              type="hidden"
                              name="ticketId"
                              value={ticket.id}
                            />
                            <button className="button small secondary mt-2">
                              Confirm cancellation
                            </button>
                          </ActionForm>
                        </details>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!tickets.length && (
            <Empty>No registrations match this filter.</Empty>
          )}
        </div>
        <div className="flex justify-between mt-5 text-xs">
          <span>
            {filtered.length} results · page {page} of{" "}
            {Math.ceil(filtered.length / 20) || 1}
          </span>
          <div className="flex gap-3">
            {page > 1 && (
              <Link
                href={`?${new URLSearchParams({ q, status: searchParams.status || "", page: String(page - 1) })}`}
              >
                Previous
              </Link>
            )}
            {page * 20 < filtered.length && (
              <Link
                href={`?${new URLSearchParams({ q, status: searchParams.status || "", page: String(page + 1) })}`}
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </section>
      <section className="glass-panel panel mb-6">
        <div className="panel-heading">
          <h2>Waitlist & seat offers</h2>
          <ActionForm action={runEventUpdates}>
            <button className="button small secondary">
              Refresh offers & reminders
            </button>
          </ActionForm>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Queue position</th>
                <th>Attendee</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Offer expires</th>
              </tr>
            </thead>
            <tbody>
              {event.waitlist.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    {entry.status === "WAITING"
                      ? event.waitlist
                          .filter((e) => e.status === "WAITING")
                          .findIndex((e) => e.id === entry.id) + 1
                      : "—"}
                  </td>
                  <td>
                    {entry.user.name}
                    <br />
                    <span className="subtext">{entry.user.email}</span>
                  </td>
                  <td>{entry.createdAt.toLocaleString()}</td>
                  <td>
                    {entry.status === "OFFERED" &&
                    entry.offerExpiresAt &&
                    entry.offerExpiresAt <= new Date()
                      ? "Expired — awaiting job"
                      : entry.status}
                  </td>
                  <td>{entry.offerExpiresAt?.toLocaleString() || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!event.waitlist.length && (
            <Empty>No waitlist entries for this event.</Empty>
          )}
        </div>
      </section>
      {!event.cancelledAt && event.startsAt > new Date() && (
        <>
          <details className="disclosure">
            <summary>Register a verified attendee at the desk</summary>
            {event.paymentMode === "RAZORPAY_TEST" ? (
              <p className="subtext">
                This event requires each attendee to sign in and complete their
                own verified test checkout. Desk registration cannot bypass
                payment.
              </p>
            ) : (
              <ActionForm action={purchaseTicket}>
                <input type="hidden" name="eventId" value={event.id} />
                <label className="field">
                  <span>Verified account</span>
                  <select className="input" name="userId" required>
                    {users.map((user) => (
                      <option value={user.id} key={user.id}>
                        {user.name} · {user.email}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Contact phone (optional)</span>
                  <input
                    className="input"
                    name="phone"
                    type="tel"
                    maxLength={30}
                  />
                </label>
                <button className="button">Confirm registration</button>
              </ActionForm>
            )}
          </details>
          <details className="disclosure">
            <summary>Edit event details</summary>
            <ActionForm action={saveEvent}>
              <input type="hidden" name="eventId" value={event.id} />
              <EventFields event={event} />
              <button className="button">Save event & notify attendees</button>
            </ActionForm>
          </details>
          <details className="disclosure">
            <summary>Cancel this event</summary>
            <ActionForm action={cancelEvent}>
              <input type="hidden" name="eventId" value={event.id} />
              <label className="flex gap-3 text-sm mb-5">
                <input type="checkbox" name="confirm" required />
                Cancel the event, revoke tickets, close the waitlist, and notify
                attendees. No real refund will be processed.
              </label>
              <button className="button secondary">
                Confirm event cancellation
              </button>
            </ActionForm>
          </details>
        </>
      )}
    </main>
  );
}
