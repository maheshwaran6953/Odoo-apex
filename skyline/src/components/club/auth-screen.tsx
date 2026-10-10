import Link from "next/link";
import { ActionForm } from "@/components/club/action-form";
import {
  login,
  register,
  requestReset,
  resetPassword,
  verifyEmail,
} from "@/server/actions/auth";
export function AuthScreen({
  mode,
  token = "",
}: {
  mode: "login" | "register" | "forgot" | "reset" | "verify";
  token?: string;
}) {
  const titles = {
    login: "Welcome back.",
    register: "Make yourself at home.",
    forgot: "Find your way back.",
    reset: "A fresh password.",
    verify: "Confirm your email.",
  };
  const actions = {
    login,
    register,
    forgot: requestReset,
    reset: resetPassword,
    verify: verifyEmail,
  };
  return (
    <main className="login-wrap">
      <section className="glass-panel login-panel">
        <Link href="/events" className="club-brand !p-0">
          <span className="brand-symbol">s.</span>
          <span>
            skyline<span className="brand-caption">STUDENT ASSOCIATION</span>
          </span>
        </Link>
        <h1>{titles[mode]}</h1>
        <p className="subtext mb-6">
          One account for your club events, tickets, and updates.
        </p>
        <ActionForm action={actions[mode]}>
          <input type="hidden" name="token" value={token} />
          {mode === "register" && (
            <label className="field">
              <span>Your full name</span>
              <input
                name="name"
                className="input"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                required
              />
            </label>
          )}
          {["login", "register", "forgot"].includes(mode) && (
            <label className="field">
              <span>Email address</span>
              <input
                name="email"
                className="input"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
              />
            </label>
          )}
          {["login", "register", "reset"].includes(mode) && (
            <label className="field">
              <span>
                Password {mode !== "login" && "(at least 12 characters)"}
              </span>
              <input
                className="input"
                name="password"
                type="password"
                minLength={mode === "login" ? 1 : 12}
                maxLength={256}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
              />
            </label>
          )}
          {mode === "register" && (
            <>
              <label className="field">
                <span>Confirm password</span>
                <input
                  className="input"
                  name="confirmPassword"
                  type="password"
                  minLength={12}
                  maxLength={256}
                  required
                  autoComplete="new-password"
                />
              </label>
              <label className="field">
                <span>Requested role</span>
                <select
                  className="input"
                  name="requestedRole"
                  defaultValue="MEMBER"
                >
                  <option value="MEMBER">Student / Member</option>
                  <option value="STAFF">Staff</option>
                  <option value="TREASURER">Treasurer</option>
                </select>
              </label>
            </>
          )}
          <button className="button w-full">
            {
              {
                login: "Sign in",
                register: "Create account",
                forgot: "Request reset link",
                reset: "Save new password",
                verify: "Verify email",
              }[mode]
            }
          </button>
        </ActionForm>
        <div className="flex flex-wrap gap-4 mt-6 text-xs">
          <Link href="/login">Sign in</Link>
          <Link href="/register">Create account</Link>
          <Link href="/forgot-password">Forgot password?</Link>
          <Link href="/events">Browse events</Link>
        </div>
        {mode === "register" && (
          <p className="subtext mt-5">
            Requested roles require email verification and approval by the
            designated Staff account. Membership discounts separately require an
            active club membership.
          </p>
        )}
      </section>
    </main>
  );
}
