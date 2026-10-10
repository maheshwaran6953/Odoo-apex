import Link from "next/link";
export default function AccessDenied() {
  return (
    <main className="glass-panel panel">
      <h1 className="section-title">This desk is restricted</h1>
      <p className="subtext mt-3">
        Your account does not have permission for this operation.
      </p>
      <Link href="/account" className="button secondary mt-5">
        My account
      </Link>
    </main>
  );
}
