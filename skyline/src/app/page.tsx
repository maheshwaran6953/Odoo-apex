import Link from "next/link";
import { CalendarDays, ArrowRight, Users, MapPin, Check } from "lucide-react";
import { db } from "@/lib/db";
import {
  PageHeading,
  Stat,
  SectionLink,
  Empty,
  money,
  date,
} from "@/components/club/ui";
export default async function HomePage() {
  const now = new Date();
  const [active, members, events, tasks, updates, transactions] =
    await Promise.all([
      db.membership.count({
        where: { status: "ACTIVE", expiresAt: { gte: now } },
      }),
      db.member.count(),
      db.event.findMany({
        orderBy: { startsAt: "asc" },
        include: { tickets: true },
      }),
      db.task.findMany({ include: { assignee: true } }),
      db.announcement.findMany({ orderBy: { publishedAt: "desc" }, take: 3 }),
      db.transaction.findMany(),
    ]);
  const upcoming = events.filter(
    (event) => event.startsAt >= now && !event.cancelledAt,
  );
  const featured = upcoming[0] ?? events[events.length - 1];
  const openTasks = tasks.filter((task) => task.status !== "DONE");
  const balance = transactions
    .filter((t) => t.status === "posted")
    .reduce(
      (sum, t) => sum + (t.type === "INCOME" ? t.amountCents : -t.amountCents),
      0,
    );
  return (
    <main>
      <PageHeading
        eyebrow="THE CLUB, AT A GLANCE"
        title="Good things happen together."
        description={`Here's what's happening around Skyline. ${new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(now)}`}
        action={
          <Link href="/events" className="button">
            <CalendarDays size={16} />
            Browse events
          </Link>
        }
      />
      <div className="stats-grid">
        <Stat
          label="Active members"
          value={active}
          note={`${members} people in our directory`}
          dark
        />
        <Stat
          label="Upcoming events"
          value={upcoming.length}
          note="Gatherings on the calendar"
        />
        <Stat
          label="Volunteer tasks"
          value={openTasks.length}
          note={`${tasks.filter((t) => t.status === "DONE").length} completed by the team`}
        />
        <Stat
          label="Club balance"
          value={money(balance)}
          note="Posted income less posted expenses"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-5">
          <section className="hero-panel">
            <div>
              <span className="badge mb-4">Your campus. Your people.</span>
              <h2>A shared space for everything we do.</h2>
              <p>
                Find your next event, lend a hand, or pick up a club hoodie. The
                small details are all here.
              </p>
              <Link className="button secondary" href="/fundraisers">
                Find a way to help <ArrowRight size={15} />
              </Link>
            </div>
            <div className="club-stamp" aria-hidden="true">
              skyline
              <br />
              <span className="text-xs tracking-widest">COME AS YOU ARE</span>
            </div>
          </section>
          <section className="glass-panel panel">
            <div className="panel-heading">
              <h2>
                {featured && featured.startsAt < now
                  ? "From our event calendar"
                  : "Next on the calendar"}
              </h2>
              <SectionLink href="/events">All events</SectionLink>
            </div>
            {featured ? (
              <>
                <div className="flex items-start gap-4">
                  <div className="date-tile">
                    <strong>{featured.startsAt.getDate()}</strong>
                    <span>
                      {featured.startsAt.toLocaleString("en-GB", {
                        month: "short",
                      })}
                    </span>
                  </div>
                  <div className="flex-1">
                    <Link
                      href={`/events/${featured.id}`}
                      className="text-xl font-semibold tracking-tight"
                    >
                      {featured.name}
                    </Link>
                    <p className="subtext mt-2 flex items-center gap-1">
                      <MapPin size={12} />
                      {featured.location} · {date(featured.startsAt)}
                    </p>
                    <p className="subtext mt-2">{featured.description}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-4">
                  <span className="subtext">
                    {
                      featured.tickets.filter((t) => t.status !== "CANCELLED")
                        .length
                    }{" "}
                    / {featured.capacity} seats booked · Members{" "}
                    {money(featured.memberPriceCents)}
                  </span>
                  <Link
                    href={`/events/${featured.id}`}
                    className="button small"
                  >
                    View event <ArrowRight size={13} />
                  </Link>
                </div>
              </>
            ) : (
              <Empty>
                No events yet. Your next gathering will appear here.
              </Empty>
            )}
          </section>
        </div>
        <section className="glass-panel panel">
          <div className="panel-heading">
            <h2>Noticeboard</h2>
            <SectionLink href="/announcements">Read all</SectionLink>
          </div>
          {updates.length ? (
            updates.map((update) => (
              <article
                key={update.id}
                className="py-5 border-b border-black/5 last:border-0"
              >
                <p className="eyebrow">{date(update.publishedAt)}</p>
                <h3 className="font-semibold text-sm">{update.title}</h3>
                <p className="subtext mt-2 whitespace-pre-line">
                  {update.body}
                </p>
              </article>
            ))
          ) : (
            <Empty>No club announcements yet.</Empty>
          )}
          <div className="mt-5 p-4 rounded-xl bg-[#e1e7d8] text-xs leading-6">
            <Users size={17} className="mb-2" />
            Keep the whole club in the loop. Event details and volunteer updates
            live here.
          </div>
        </section>
      </div>
      <section className="glass-panel panel mt-5">
        <div className="panel-heading">
          <h2>A few things to lend a hand with</h2>
          <SectionLink href="/fundraisers">Volunteer board</SectionLink>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {openTasks.slice(0, 3).map((task) => (
            <Link
              key={task.id}
              href="/fundraisers"
              className="rounded-xl border border-white bg-white/40 p-4 transition hover:bg-white/80"
            >
              <span className={`badge ${task.status.toLowerCase()}`}>
                {task.status === "DOING" ? "In progress" : "To do"}
              </span>
              <h3 className="text-sm font-semibold mt-3">{task.title}</h3>
              <p className="subtext mt-3">
                {task.assignee?.name ?? "Unassigned"}
                {task.dueAt ? ` · ${date(task.dueAt)}` : ""}
              </p>
            </Link>
          ))}
          {!openTasks.length && (
            <p className="subtext flex items-center gap-2">
              <Check size={16} />
              Everything on the board is done.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
