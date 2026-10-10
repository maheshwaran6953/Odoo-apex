import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { PageHeading, Empty } from "@/components/club/ui";
import { ActionForm } from "@/components/club/action-form";
import { markRead } from "@/server/actions/notifications";
export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <main>
      <PageHeading
        eyebrow="THE THINGS TO KNOW"
        title="My updates"
        description="Seat offers, event changes, and reminders in one place."
        action={
          <ActionForm action={markRead}>
            <button className="button secondary">Mark all as read</button>
          </ActionForm>
        }
      />
      <section className="glass-panel panel">
        {notifications.length ? (
          notifications.map((item) => (
            <article key={item.id} className="row-list flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <span className={`badge ${item.readAt ? "" : "active"}`}>
                  {item.readAt ? "Read" : "New update"}
                </span>
                <h2 className="section-title mt-3">{item.title}</h2>
                <p className="subtext mt-2 whitespace-pre-line">{item.body}</p>
                <p className="subtext mt-2">
                  {item.createdAt.toLocaleString()}
                </p>
              </div>
              <Link href={item.href} className="button small">
                View details
              </Link>
              {!item.readAt && (
                <ActionForm action={markRead}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="button small secondary">Mark read</button>
                </ActionForm>
              )}
            </article>
          ))
        ) : (
          <Empty>
            No updates yet. Your registrations and waitlist offers will appear
            here.
          </Empty>
        )}
      </section>
      <p className="subtext mt-4">
        Latest 100 saved updates. Email reminders depend on your preferences and
        the configured delivery service.
      </p>
    </main>
  );
}
