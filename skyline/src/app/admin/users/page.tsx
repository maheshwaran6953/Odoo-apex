import { db } from "@/lib/db";
import { requireApprover } from "@/server/auth";
import { manageUser } from "@/server/actions/auth";
import { ActionForm } from "@/components/club/action-form";
import { PageHeading } from "@/components/club/ui";
export default async function UsersPage() {
  const actor = await requireApprover();
  const users = await db.user.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <main>
      <PageHeading
        eyebrow="CLUB ADMINISTRATION"
        title="People & access"
        description="Review verified applicants and record role decisions."
      />
      <div className="glass-panel panel">
        <h2 className="section-title">Registered accounts</h2>
        <div className="grid gap-4 mt-5 lg:grid-cols-2">
          {users.map((user) => (
            <section key={user.id} className="task-card !mt-0">
              <h3>{user.name}</h3>
              <p className="subtext">{user.email}</p>
              <p className="mt-3">
                Requested: {user.requestedRole} · Granted: {user.role}
              </p>
              <span className="badge mt-3">
                {user.disabledAt ? "Disabled" : user.approvalStatus} ·{" "}
                {user.emailVerifiedAt ? "Verified" : "Email unverified"}
              </span>
              {user.id !== actor.id && !user.isRoleApprover && (
                <ActionForm action={manageUser} className="mt-4">
                  <input type="hidden" name="userId" value={user.id} />
                  <label className="field">
                    <span>Decision</span>
                    <select name="decision" className="input">
                      <option value="APPROVED">Approve requested role</option>
                      <option value="REJECTED">Reject request</option>
                      <option value="DISABLED">Disable access</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Reason (required for rejection)</span>
                    <input className="input" name="reason" maxLength={500} />
                  </label>
                  <button className="button small">Record decision</button>
                </ActionForm>
              )}
              {user.approvalReason && (
                <p className="subtext mt-3">{user.approvalReason}</p>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
