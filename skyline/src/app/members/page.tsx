import { db } from "@/lib/db";
import { currentRole, requireRole } from "@/server/auth";
import { PageHeading, Stat } from "@/components/club/ui";
import { MemberDirectory } from "@/components/club/member-directory";
import { ActionForm } from "@/components/club/action-form";
import { addMember } from "@/server/actions/members";
export default async function MembersPage() {
  await requireRole(["STAFF", "TREASURER"]);
  const members = await db.member.findMany({
    include: { membership: true },
    orderBy: { name: "asc" },
  });
  const role = await currentRole();
  const canManage = role !== "MEMBER";
  const active = members.filter(
    (m) =>
      m.membership?.status === "ACTIVE" && m.membership.expiresAt >= new Date(),
  ).length;
  return (
    <main>
      <PageHeading
        eyebrow="THE PEOPLE BEHIND THE CLUB"
        title="Member directory"
        description="Everyone in one place, with a clear view of dues and renewals."
      />
      <div className="stats-grid !grid-cols-1 sm:!grid-cols-3">
        <Stat
          label="In the directory"
          value={members.length}
          note="Students and club members"
        />
        <Stat
          label="Active memberships"
          value={active}
          note="Dues recorded and membership valid"
          dark
        />
        <Stat
          label="Needs attention"
          value={members.length - active}
          note="Pending dues or expired membership"
        />
      </div>
      {canManage && (
        <details className="disclosure">
          <summary>+ Add a member</summary>
          <ActionForm action={addMember}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="field">
                <span>Full name</span>
                <input
                  className="input"
                  name="name"
                  required
                  minLength={2}
                  placeholder="Jordan Lee"
                />
              </label>
              <label className="field">
                <span>Email address</span>
                <input
                  className="input"
                  name="email"
                  type="email"
                  required
                  placeholder="jordan@university.edu"
                />
              </label>
              <label className="field">
                <span>Annual dues ($)</span>
                <input
                  className="input"
                  name="dues"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max="100000"
                  required
                />
              </label>
            </div>
            <button className="button">Add to directory</button>
          </ActionForm>
        </details>
      )}
      <MemberDirectory
        canManage={canManage}
        members={members.map((m) => ({
          ...m,
          membership: m.membership
            ? {
                ...m.membership,
                expiresAt: m.membership.expiresAt.toISOString(),
              }
            : null,
        }))}
      />
    </main>
  );
}
