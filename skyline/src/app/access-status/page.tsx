import { signOut } from "@/server/actions/auth";
import Link from "next/link";
import { requireSessionUser, roleHome } from "@/server/auth";
import { redirect } from "next/navigation";
export default async function AccessStatus() {
  const user = await requireSessionUser();
  if (!user.emailVerifiedAt) redirect("/verify-email");
  if (user.approvalStatus === "APPROVED") redirect(roleHome(user.role));
  return (
    <main className="glass-panel panel">
      <h1 className="section-title">Account approval</h1>
      <p className="subtext mt-3">{user.email}</p>
      <p className="mt-4">Requested role: {user.requestedRole}</p>
      <p>Status: {user.approvalStatus}</p>
      <p className="subtext mt-3">
        {user.approvalReason ||
          "The designated Staff account must review your role request before club access is enabled."}
      </p>
      <form action={signOut}>
        <button className="button secondary mt-5">Sign out</button>
      </form>
      <Link className="button secondary mt-5" href="/events">
        Browse public events
      </Link>
    </main>
  );
}
