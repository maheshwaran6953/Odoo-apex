import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/server/auth";
import { manageUser, confirmIdentity } from "@/server/actions/auth";
import { runEventUpdates } from "@/server/actions/events";
import { sendQueuedEmail } from "@/server/actions/notifications";
import { PageHeading, Empty } from "@/components/club/ui";
import { ActionForm } from "@/components/club/action-form";
export default async function UsersPage() {
  await requireRole(["STAFF"]);
  const actor = await requireUser();
  const users = await db.user.findMany({ orderBy: { createdAt: "desc" } });
  const messages = await db.emailMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      to: true,
      subject: true,
      status: true,
      lastError: true,
      sentAt: true,
    },
  });
  const configured = !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
  return (
    <main>
      <PageHeading
        eyebrow="CLUB ADMINISTRATION"
        title="People & access"
        description="Assign desks, confirm identity, and check event reminder delivery."
      />
      <div className="glass-panel panel mb-6">
        <h2 className="section-title">Registered accounts</h2>
        <div className="grid gap-4 mt-5 lg:grid-cols-2">
          {users.map((user) => (
            <section key={user.id} className="task-card !mt-0">
              <h3>{user.name}</h3>
              <p className="subtext">{user.email}</p>
              <span
                className={`badge mt-3 ${user.disabledAt ? "danger" : user.emailVerifiedAt ? "active" : "pending"}`}
              >
                {user.disabledAt
                  ? "Disabled"
                  : user.emailVerifiedAt
                    ? "Verified identity"
                    : "Awaiting verification"}
              </span>
              {user.id !== actor.id ? (
                <ActionForm action={manageUser} className="mt-4">
                  <input type="hidden" name="userId" value={user.id} />
                  <label className="field">
                    <span>Workspace role</span>
                    <select
                      className="input"
                      name="role"
                      defaultValue={user.role}
                    >
                      <option value="MEMBER">Member</option>
                      <option value="STAFF">Staff</option>
                      <option value="TREASURER">Treasurer</option>
                    </select>
                  </label>
                  <label className="flex gap-2 text-xs mb-4">
                    <input
                      type="checkbox"
                      name="disabled"
                      defaultChecked={!!user.disabledAt}
                    />
                    Disable account and revoke sessions
                  </label>
                  <button className="button small">Save access</button>
                </ActionForm>
              ) : (
                <p className="subtext mt-3">
                  Your own access is protected from accidental changes.
                </p>
              )}
              {!user.emailVerifiedAt && !user.disabledAt && (
                <details className="mt-4">
                  <summary className="text-xs cursor-pointer">
                    Confirm identity in person
                  </summary>
                  <ActionForm action={confirmIdentity} className="mt-3">
                    <input type="hidden" name="userId" value={user.id} />
                    <label className="flex gap-2 text-xs mb-4">
                      <input type="checkbox" name="confirm" required />I checked
                      this person’s identity and ownership of the listed email.
                    </label>
                    <button className="button small secondary">
                      Verify & link membership
                    </button>
                  </ActionForm>
                </details>
              )}
            </section>
          ))}
        </div>
      </div>
      <section className="glass-panel panel">
        <div className="panel-heading">
          <h2>Event jobs & email delivery</h2>
          <span className={`badge ${configured ? "active" : "pending"}`}>
            {configured ? "Email configured" : "Email not connected"}
          </span>
        </div>
        <div className="flex flex-wrap gap-3 mb-5">
          <ActionForm action={runEventUpdates}>
            <button className="button">Process reminders & seat offers</button>
          </ActionForm>
          <ActionForm action={sendQueuedEmail}>
            <button className="button secondary">Deliver queued emails</button>
          </ActionForm>
        </div>
        <p className="subtext mb-5">
          In-app reminders are saved even without email. Schedule the protected
          job endpoint every five minutes after deployment. A queued message is
          not proof of delivery.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Delivery result</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr key={message.id}>
                  <td>{message.to}</td>
                  <td>{message.subject}</td>
                  <td>
                    {message.status === "SENT"
                      ? "Accepted by provider"
                      : message.status}
                  </td>
                  <td>
                    {message.lastError ||
                      message.sentAt?.toLocaleString() ||
                      "Awaiting delivery"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!messages.length && (
            <Empty>No email messages have been queued.</Empty>
          )}
        </div>
      </section>
    </main>
  );
}
