import { clubDate } from "@/lib/dates";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
export const date = clubDate;
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Stat({
  label,
  value,
  note,
  dark = false,
}: {
  label: string;
  value: string | number;
  note: string;
  dark?: boolean;
}) {
  return (
    <div className={`stat-card ${dark ? "dark-card" : "glass-panel"}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </div>
  );
}
export function SectionLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="section-link">
      {children}
      <ArrowUpRight size={16} />
    </Link>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
