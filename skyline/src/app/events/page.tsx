import Link from "next/link";
import { MapPin, ArrowRight, Ticket } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser } from "@/server/auth";
import { EventCreator } from "@/components/club/event-creator";
import { PageHeading, Empty, money, date } from "@/components/club/ui";
export default async function EventsPage({
  searchParams,
}: {
  searchParams: { q?: string; view?: string };
}) {
  const user = await currentUser();
  const q = (searchParams.q || "").slice(0, 100).trim();
  const view = ["upcoming", "past", "cancelled", "all"].includes(
    searchParams.view || "",
  )
    ? searchParams.view
    : "upcoming";
  const events = await db.event.findMany({
    where: {
      ...(q
        ? { OR: [{ name: { contains: q } }, { location: { contains: q } }] }
        : {}),
      ...(view === "upcoming"
        ? { startsAt: { gt: new Date() }, cancelledAt: null }
        : view === "past"
          ? { startsAt: { lte: new Date() }, cancelledAt: null }
          : view === "cancelled"
            ? { cancelledAt: { not: null } }
            : {}),
    },
    include: {
      tickets: { select: { status: true } },
      waitlist: {
        where: { status: "OFFERED", offerExpiresAt: { gt: new Date() } },
        select: { id: true },
      },
    },
    orderBy: { startsAt: view === "past" ? "desc" : "asc" },
  });
  return (
    <main>
      <PageHeading
        eyebrow="MAKE TIME FOR YOUR PEOPLE"
        title="Events & gatherings"
        description="Know what’s happening, book a place, and keep your ticket close."
        action={
          user?.role === "STAFF" ? (
            <Link href="/events/check-in" className="button">
              <Ticket size={16} />
              Open door desk
            </Link>
          ) : (
            <Link href={user ? "/my-events" : "/login"} className="button">
              {user ? "My events & tickets" : "Sign in to register"}
            </Link>
          )
        }
      />
      {user?.role === "STAFF" && <EventCreator />}
      <form className="toolbar" action="/events">
        <label className="field !mb-0 flex-1">
          <span>Find an event or venue</span>
          <input
            className="input"
            name="q"
            defaultValue={q}
            placeholder="Social, workshop, Student Union…"
          />
        </label>
        <label className="field !mb-0">
          <span>Show</span>
          <select className="input" name="view" defaultValue={view}>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All events</option>
          </select>
        </label>
        <button className="button self-end">Apply filters</button>
        <Link href="/events" className="button secondary self-end">
          Reset
        </Link>
      </form>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => {
          const sold = event.tickets.filter(
            (t) => t.status !== "CANCELLED",
          ).length;
          const seats = Math.max(
            0,
            event.capacity - sold - event.waitlist.length,
          );
          const closed =
            event.startsAt <= new Date() ||
            !!event.cancelledAt ||
            (!!event.registrationClosesAt &&
              event.registrationClosesAt <= new Date());
          return (
            <article key={event.id} className="glass-panel overflow-hidden">
              <div className="event-art">
                <span className="poster-title">{event.name}</span>
                <div className="date-tile">
                  <strong>{event.startsAt.getDate()}</strong>
                  <span>
                    {event.startsAt.toLocaleString("en-GB", { month: "short" })}
                  </span>
                </div>
              </div>
              <div className="panel">
                <div className="flex justify-between items-center">
                  <span
                    className={`badge ${event.cancelledAt ? "danger" : seats ? "active" : "pending"}`}
                  >
                    {event.cancelledAt
                      ? "Cancelled"
                      : closed
                        ? "Registration closed"
                        : !seats
                          ? "Waitlist open"
                          : "Registration open"}
                  </span>
                  <span className="subtext">{date(event.startsAt)}</span>
                </div>
                <p className="subtext mt-4 flex gap-1 items-center">
                  <MapPin size={13} />
                  {event.location}
                </p>
                <p className="text-sm leading-6 mt-3">{event.description}</p>
                <div className="mt-5">
                  <div className="flex justify-between subtext mb-2">
                    <span>{sold} registered</span>
                    <span>
                      {seats} available · {event.waitlist.length} held
                    </span>
                  </div>
                  <div className="progress-track">
                    <span
                      style={{
                        width: `${Math.min(100, (sold / event.capacity) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                {event.registrationClosesAt && (
                  <p className="subtext mt-3">
                    Register by {date(event.registrationClosesAt)}
                  </p>
                )}
                <div className="flex justify-between items-center mt-5">
                  <span className="subtext">
                    Members <strong>{money(event.memberPriceCents)}</strong>
                  </span>
                  <Link href={`/events/${event.id}`} className="button small">
                    View details <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!events.length && (
        <div className="glass-panel">
          <Empty>
            No events match this view. Try All events or clear your search.
          </Empty>
        </div>
      )}
    </main>
  );
}
