import { clubDateTime } from "@/lib/dates";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { DoorScanner } from "@/components/club/door-scanner";
import { PageHeading, Empty } from "@/components/club/ui";
export default async function CheckInPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  await requireRole(["STAFF"]);
  const events = await db.event.findMany({
    where: {
      cancelledAt: null,
      startsAt: { gte: new Date(Date.now() - 12 * 3600000) },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, name: true },
  });
  const eventId = events.some((e) => e.id === searchParams.eventId)
    ? searchParams.eventId!
    : events[0]?.id;
  const recent = eventId
    ? await db.ticket.findMany({
        where: { eventId, status: "CHECKED_IN" },
        orderBy: { checkedInAt: "desc" },
        take: 20,
      })
    : [];
  return (
    <main>
      <PageHeading
        eyebrow="DOOR DESK"
        title="A warm welcome. A quick check."
        description="Choose the event before scanning. Every entry is checked against its registration list."
      />
      <form className="toolbar">
        <label className="field flex-1">
          <span>Event at this door</span>
          <select className="input" name="eventId" defaultValue={eventId}>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button self-center">Open this event</button>
        {eventId && (
          <Link
            href={`/events/${eventId}/manage`}
            className="button secondary self-center"
          >
            Attendee list
          </Link>
        )}
      </form>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="glass-panel panel">
          <h2 className="section-title mb-5">Verify a ticket</h2>
          {eventId ? (
            <DoorScanner key={eventId} eventId={eventId} />
          ) : (
            <Empty>
              No active events are available. Create an event first.
            </Empty>
          )}
          <p className="subtext mt-5">
            Entry window: 12 hours before to 12 hours after the start. Camera
            scanning requires HTTPS or localhost. Manual codes always remain
            available.
          </p>
        </section>
        <section className="glass-panel panel">
          <h2 className="section-title">Recently welcomed</h2>
          {recent.length ? (
            recent.map((ticket) => (
              <div className="row-list" key={ticket.id}>
                <span className="avatar">✓</span>
                <div>
                  <strong>{ticket.attendeeName || "Guest"}</strong>
                  <p className="subtext">
                    {ticket.checkedInAt ? clubDateTime(ticket.checkedInAt) : ""}
                  </p>
                </div>
                <span className="badge active ml-auto">Checked in</span>
              </div>
            ))
          ) : (
            <Empty>No check-ins recorded for this event yet.</Empty>
          )}
        </section>
      </div>
    </main>
  );
}
