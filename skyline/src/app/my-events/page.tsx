import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { PageHeading, Empty, date } from "@/components/club/ui";
import { ActionForm } from "@/components/club/action-form";
import { leaveWaitlist } from "@/server/actions/events";
export default async function MyEventsPage() {
  const user = await requireUser();
  const tickets = await db.ticket.findMany({
    where: { userId: user.id },
    include: { event: true },
    orderBy: { event: { startsAt: "asc" } },
  });
  const waitlist = await db.waitlistEntry.findMany({
    where: {
      userId: user.id,
      status: { in: ["WAITING", "OFFERED", "EXPIRED", "PAYMENT_PENDING"] },
    },
    include: { event: true },
    orderBy: { createdAt: "asc" },
  });
  const positions = await Promise.all(
    waitlist.map((entry) =>
      entry.status === "WAITING"
        ? db.waitlistEntry.count({
            where: {
              eventId: entry.eventId,
              status: "WAITING",
              OR: [
                { createdAt: { lt: entry.createdAt } },
                { createdAt: entry.createdAt, id: { lte: entry.id } },
              ],
            },
          })
        : Promise.resolve(0),
    ),
  );
  return (
    <main>
      <PageHeading
        eyebrow="YOUR CAMPUS CALENDAR"
        title="My events & tickets"
        description="Your registrations, entry passes, and places in line."
        action={
          <Link href="/events" className="button">
            Find another gathering
          </Link>
        }
      />
      <Link className="button secondary mb-5" href="/payments">
        My checkouts & test payments
      </Link>
      {!user.emailVerifiedAt && (
        <div className="form-feedback failure mb-5">
          <p>
            Your email is not verified.{" "}
            <Link className="underline" href="/account">
              Manage verification
            </Link>{" "}
            or ask club staff to confirm your identity before registering.
          </p>
        </div>
      )}
      <section className="glass-panel panel mb-6">
        <h2 className="section-title">Registered gatherings</h2>
        {tickets.length ? (
          <div className="grid gap-4 mt-5 md:grid-cols-2">
            {tickets.map((ticket) => (
              <article key={ticket.id} className="task-card !mt-0">
                <div className="flex justify-between gap-3">
                  <h3>{ticket.event.name}</h3>
                  <span
                    className={`badge ${ticket.status === "CANCELLED" ? "danger" : ticket.status === "CHECKED_IN" ? "active" : "pending"}`}
                  >
                    {ticket.status === "PAID"
                      ? "Registered"
                      : ticket.status === "CHECKED_IN"
                        ? "Attended"
                        : ticket.status === "CANCELLED"
                          ? "Cancelled"
                          : "Reserved"}
                  </span>
                </div>
                <p className="subtext mt-3">
                  {date(ticket.event.startsAt)} · {ticket.event.location}
                </p>
                <div className="flex gap-3 mt-4">
                  <Link className="button small" href={`/tickets/${ticket.id}`}>
                    Open ticket
                  </Link>
                  <Link
                    className="button small secondary"
                    href={`/events/${ticket.eventId}`}
                  >
                    Event details
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty>
            You have no registrations yet. Browse events to find your first one.
          </Empty>
        )}
      </section>
      <section className="glass-panel panel">
        <h2 className="section-title">Waitlists & seat offers</h2>
        {waitlist.length ? (
          waitlist.map((entry, index) => (
            <article className="row-list flex-wrap" key={entry.id}>
              <div className="flex-1 min-w-[180px]">
                <h3 className="font-semibold">{entry.event.name}</h3>
                <p className="subtext mt-2">
                  {entry.status === "PAYMENT_PENDING"
                    ? "Offer transferred to checkout. Open My payments to finish or release the hold."
                    : entry.status === "WAITING"
                      ? `Position ${positions[index]} · offers follow joining order`
                      : entry.status === "OFFERED" &&
                          entry.offerExpiresAt &&
                          entry.offerExpiresAt > new Date()
                        ? `Seat held until ${entry.offerExpiresAt.toLocaleString()}`
                        : "Offer expired. You may rejoin if the event remains full."}
                </p>
              </div>
              <Link className="button small" href={`/events/${entry.eventId}`}>
                {entry.status === "OFFERED"
                  ? "Review & claim seat"
                  : "View event"}
              </Link>
              {["WAITING", "OFFERED"].includes(entry.status) && (
                <ActionForm action={leaveWaitlist}>
                  <input type="hidden" name="eventId" value={entry.eventId} />
                  <button className="button small secondary">
                    Leave waitlist
                  </button>
                </ActionForm>
              )}
            </article>
          ))
        ) : (
          <Empty>
            No waitlist entries. If an event fills up, you can join its queue.
          </Empty>
        )}
      </section>
    </main>
  );
}
