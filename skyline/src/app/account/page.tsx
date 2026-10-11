import { ExpenseAccountSection } from "@/components/club/expense-section";
import { requireUser } from "@/server/auth";
import { updateAccount, resendVerification } from "@/server/actions/auth";
import { ActionForm } from "@/components/club/action-form";
import { PageHeading, date } from "@/components/club/ui";
export default async function AccountPage() {
  const user = await requireUser();
  return (
    <main>
      <PageHeading
        eyebrow="YOUR CLUB IDENTITY"
        title="My account"
        description="Your sign-in identity and event reminder preferences."
      />
      <div className="grid gap-5 md:grid-cols-2">
        <section className="glass-panel panel">
          <h2 className="section-title">Account details</h2>
          <dl className="space-y-4 mt-5">
            <div>
              <dt className="subtext">Name</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt className="subtext">Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt className="subtext">Club role</dt>
              <dd>{user.role}</dd>
            </div>
            <div>
              <dt className="subtext">Verification</dt>
              <dd>{user.emailVerifiedAt ? "Verified" : "Not verified"}</dd>
            </div>
            <div>
              <dt className="subtext">Linked membership</dt>
              <dd>
                {user.member?.membership
                  ? `${user.member.membership.status === "ACTIVE" && user.member.membership.expiresAt <= new Date() ? "EXPIRED" : user.member.membership.status} · valid until ${date(user.member.membership.expiresAt)}`
                  : "Dues not configured"}
              </dd>
            </div>
          </dl>
          {!user.emailVerifiedAt && (
            <div className="mt-5">
              <ActionForm action={resendVerification}>
                <button className="button secondary">
                  Request verification email
                </button>
              </ActionForm>
              <p className="subtext mt-3">
                Delivery requires the configured email service. New accounts
                must verify ownership using an OTP.
              </p>
            </div>
          )}
          <a href="/forgot-password" className="button secondary mt-5">
            Change password via reset link
          </a>
        </section>
        <section className="glass-panel panel h-fit">
          <h2 className="section-title mb-5">Email updates</h2>
          <ActionForm action={updateAccount}>
            <label className="flex gap-3 text-sm mb-4">
              <input
                type="checkbox"
                name="emailReminders"
                defaultChecked={user.emailReminders}
              />
              <span>
                Email me event reminders, seat offers, membership renewals and
                club notices
              </span>
            </label>
            <p className="subtext mb-5">
              In-app updates are always saved. Account verification and password
              reset emails are sent regardless of this preference.
            </p>
            <button className="button">Save preferences</button>
          </ActionForm>
        </section>
      </div>
      <ExpenseAccountSection userId={user.id} />
    </main>
  );
}
