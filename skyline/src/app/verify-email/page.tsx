import { emailDeliveryConfigured } from "@/server/email-transport";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/club/action-form";
import { currentUser } from "@/server/auth";
import {
  verifyEmail,
  resendVerification,
  signOut,
} from "@/server/actions/auth";

export default async function VerifyEmailPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const configured =
    process.env.EMAIL_VERIFICATION_ENABLED === "true" &&
    emailDeliveryConfigured() &&
    (process.env.OTP_SECRET?.length ?? 0) >= 32;
  return (
    <main className="login-wrap">
      <section className="glass-panel login-panel">
        <Link href="/events" className="club-brand !p-0">
          <span className="brand-symbol">s.</span>
          <span>
            skyline<span className="brand-caption">STUDENT ASSOCIATION</span>
          </span>
        </Link>
        <h1>Confirm your email.</h1>
        <p className="subtext mb-6">
          Verification is for {user.email}. Role approval is a separate step
          handled by the designated Staff account.
        </p>
        {user.emailVerifiedAt ? (
          <p role="status">
            Your email is verified.{" "}
            <Link href="/account">View your account and approval status</Link>.
          </p>
        ) : (
          <>
            {!configured && (
              <p className="form-feedback failure mb-4" role="status">
                Email delivery has not been configured. Verification cannot be
                completed yet. Contact the designated Staff account; no code is
                displayed in the application.
              </p>
            )}
            <ActionForm action={verifyEmail}>
              <label className="field">
                <span>Six-digit verification code</span>
                <input
                  className="input"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  autoComplete="one-time-code"
                  required
                  aria-describedby="otp-help"
                />
              </label>
              <p id="otp-help" className="subtext mb-4">
                Use the latest code. Codes expire after 10 minutes and allow
                five incorrect attempts.
              </p>
              <button className="button w-full" disabled={!configured}>
                Verify email
              </button>
            </ActionForm>
            <ActionForm action={resendVerification} className="mt-4">
              <button
                className="button secondary w-full"
                disabled={!configured}
              >
                Send a new code
              </button>
            </ActionForm>
            <p className="subtext mt-4">
              Wait 60 seconds between requests. You can request up to five codes
              per hour.
            </p>
          </>
        )}
        <div className="flex flex-wrap gap-4 mt-6 text-xs">
          <Link href="/account">My account</Link>
          <Link href="/events">Browse events</Link>
          <form action={signOut}>
            <button className="section-link">Sign out</button>
          </form>
        </div>
      </section>
    </main>
  );
}
