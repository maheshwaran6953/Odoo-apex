import Link from "next/link";
export default function NotFound() {
  return (
    <main className="glass-panel panel max-w-xl mx-auto my-10">
      <p className="eyebrow">404 · NOT FOUND</p>
      <h1 className="text-2xl font-semibold">
        This page isn’t on the club map.
      </h1>
      <p className="subtext mt-3">
        The link may be out of date, or the record may no longer exist.
      </p>
      <Link href="/" className="button mt-5">
        Back to the overview
      </Link>
    </main>
  );
}
