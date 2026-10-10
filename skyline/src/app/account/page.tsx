import { createExpense } from '@/server/actions/treasurer';
import { requireUser } from "@/server/auth";
import { updateAccount, resendVerification } from "@/server/actions/auth";
import { ActionForm } from "@/components/club/action-form";
import { PageHeading } from "@/components/club/ui";
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
                {user.member?.membership?.status || "No membership linked"}
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
                Delivery requires the email service. Club staff may confirm your
                identity and email ownership in person.
              </p>
            </div>
          )}
          <a href="/forgot-password" className="button secondary mt-5">
            Change password via reset link
          </a>
        </section>
        <section className="glass-panel panel h-fit">
          <h2 className="section-title mb-5">Event reminders</h2>
          <ActionForm action={updateAccount}>
            <label className="flex gap-3 text-sm mb-4">
              <input
                type="checkbox"
                name="emailReminders"
                defaultChecked={user.emailReminders}
              />
              <span>
                Email me event reminders, seat offers, and registration updates
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
      <section className="glass-panel panel mt-5 max-w-[640px]"><h2 className="section-title">Submit a club expense</h2><p className="subtext mt-2 mb-5">Keep your receipt. The treasurer will review the request before it affects the ledger.</p><ActionForm action={createExpense}><label className="field"><span>What was it for?</span><input className="input" name="description" minLength={3} maxLength={200} required/></label><label className="field"><span>Amount ($)</span><input className="input" name="amount" type="number" min="0.01" max="100000" step="0.01" required/></label><button className="button">Submit for review</button></ActionForm></section>
    </main>
  );
}
