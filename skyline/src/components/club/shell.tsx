"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { signOut } from "@/server/actions/auth";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ShoppingBag,
  Columns3,
  Wallet,
  Megaphone,
  Bell,
  MoreHorizontal,
  UserRound,
  LogOut,
  ScanLine,
  ChevronRight,
} from "lucide-react";

const navigation = [
  { href: "/", name: "Overview", icon: LayoutDashboard, group: "Club" },
  { href: "/members", name: "Members", icon: Users, group: "Club" },
  { href: "/events", name: "Events", icon: CalendarDays, group: "Club" },
  { href: "/my-events", name: "My events", icon: CalendarDays, group: "Club" },
  { href: "/merchandise", name: "Club shop", icon: ShoppingBag, group: "Club" },
  { href: "/fundraisers", name: "Volunteers", icon: Columns3, group: "Club" },
  {
    href: "/announcements",
    name: "Noticeboard",
    icon: Megaphone,
    group: "Club",
  },
  { href: "/treasurer", name: "Finance", icon: Wallet, group: "Club" },
  { href: "/notifications", name: "My updates", icon: Bell, group: "Personal" },
  { href: "/account", name: "My account", icon: UserRound, group: "Personal" },
  {
    href: "/events/check-in",
    name: "Door check-in",
    icon: ScanLine,
    group: "Administration",
  },
  {
    href: "/admin/users",
    name: "User access",
    icon: Users,
    group: "Administration",
  },
  {
    href: "/payments",
    name: "My payments",
    icon: Wallet,
    group: "Payment testing",
  },
  {
    href: "/admin/payments",
    name: "Test payment desk",
    icon: Wallet,
    group: "Payment testing",
  },
];
const primaryPaths: Record<string, string[]> = {
  MEMBER: ["/my-events", "/events", "/merchandise", "/fundraisers"],
  STAFF: ["/", "/events", "/members", "/fundraisers"],
  TREASURER: ["/treasurer", "/members", "/events", "/"],
  GUEST: ["/events"],
};
function matches(path: string, href: string) {
  return href === "/"
    ? path === "/"
    : path === href || path.startsWith(href + "/");
}
export function ClubShell({
  children,
  role,
  isApprover = false,
  identity,
}: {
  children: React.ReactNode;
  role: string;
  isApprover?: boolean;
  identity?: string;
}) {
  const path = usePathname();
  const moreRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (moreRef.current) moreRef.current.open = false;
  }, [path]);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (
        moreRef.current?.open &&
        event.target instanceof Node &&
        !moreRef.current.contains(event.target)
      )
        moreRef.current.open = false;
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !moreRef.current?.open) return;
      const returnFocus = moreRef.current.contains(document.activeElement);
      moreRef.current.open = false;
      if (returnFocus) moreRef.current.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, []);
  if (
    [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/verify-email",
    ].includes(path)
  )
    return <>{children}</>;
  const guest = role === "GUEST";
  const allowed = navigation.filter((item) => {
    if (guest) return item.href === "/events";
    if (item.href === "/admin/users") return role === "STAFF" && isApprover;
    if (["/members", "/admin/payments"].includes(item.href))
      return ["STAFF", "TREASURER"].includes(role);
    if (item.href === "/events/check-in") return role === "STAFF";
    if (item.href === "/treasurer") return role === "TREASURER";
    return true;
  });
  const primary = (primaryPaths[role] || primaryPaths.MEMBER).flatMap((href) =>
    allowed.filter((item) => item.href === href),
  );
  const secondary = allowed.filter(
    (item) => !primary.some((link) => link.href === item.href),
  );
  const route = path.startsWith("/tickets/") ? "/my-events" : path;
  const current = allowed
    .filter((item) => matches(route, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const secondaryActive = secondary.some((item) => item.href === current?.href);
  const home = primary[0]?.href || "/events";
  const roleLabel = guest
    ? identity
      ? "Awaiting approval"
      : "Campus events"
    : role === "MEMBER"
      ? "Member space"
      : role === "STAFF"
        ? "Staff space"
        : "Treasurer space";
  const closeMore = () => {
    if (moreRef.current) moreRef.current.open = false;
  };
  return (
    <div
      className={`club-app easy-navigation ${guest ? "guest-navigation" : ""}`}
    >
      <a className="skip-navigation" href="#workspace-content">
        Skip to content
      </a>
      <header className="workspace-header">
        <div className="workspace-header-row">
          <Link
            href={home}
            className="club-brand workspace-brand"
            aria-label="Skyline home"
          >
            <span className="brand-symbol">s.</span>
            <span>
              skyline<span className="brand-caption">STUDENT ASSOCIATION</span>
            </span>
          </Link>
          <span className="workspace-role">{roleLabel}</span>
          <div className="workspace-account-actions">
            {!guest && (
              <Link
                href="/notifications"
                className="workspace-icon"
                aria-label="My updates"
                title="My updates"
              >
                <Bell size={19} />
              </Link>
            )}
            {!guest && (
              <Link
                href="/account"
                className="workspace-account"
                aria-label="My account"
                title={identity || "My account"}
              >
                <UserRound size={18} />
                <span>{identity?.split("@")[0] || "My account"}</span>
              </Link>
            )}
            {identity ? (
              <form action={signOut}>
                <button
                  className="workspace-icon"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut size={18} />
                  <span className="sr-only">Sign out</span>
                </button>
              </form>
            ) : (
              <Link href="/login" className="button small">
                Sign in
              </Link>
            )}
          </div>
        </div>
        <div className="workspace-navigation-row">
          <nav className="workspace-navigation" aria-label="Main navigation">
            {primary.map(({ href, name, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={current?.href === href ? "page" : undefined}
                className={`workspace-nav-link ${current?.href === href ? "active" : ""}`}
                onClick={closeMore}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{name}</span>
              </Link>
            ))}
            {!!secondary.length && (
              <details className="workspace-more" ref={moreRef}>
                <summary
                  className={`workspace-nav-link ${secondaryActive ? "active" : ""}`}
                  aria-label="More pages"
                >
                  <MoreHorizontal size={21} />
                  <span>More</span>
                </summary>
                <div className="workspace-more-panel">
                  <div className="workspace-more-heading">
                    <strong>More in Skyline</strong>
                    <span>{roleLabel}</span>
                  </div>
                  {[
                    "Club",
                    "Personal",
                    "Administration",
                    "Payment testing",
                  ].map((group) => {
                    const links = secondary.filter(
                      (item) => item.group === group,
                    );
                    return links.length ? (
                      <section key={group} aria-label={group}>
                        <h2>{group}</h2>
                        {links.map(({ href, name, icon: Icon }) => (
                          <Link
                            key={href}
                            href={href}
                            className={`workspace-more-link ${current?.href === href ? "active" : ""}`}
                            aria-current={
                              current?.href === href ? "page" : undefined
                            }
                            onClick={closeMore}
                          >
                            <Icon size={17} />
                            <span>{name}</span>
                            <ChevronRight size={14} />
                          </Link>
                        ))}
                      </section>
                    ) : null;
                  })}
                </div>
              </details>
            )}
          </nav>
          <div className="workspace-location" aria-label="Current section">
            <span>{roleLabel}</span>
            <ChevronRight size={13} />
            <strong>{current?.name || "Account access"}</strong>
          </div>
        </div>
      </header>
      <div className="workspace-body">
        <div className="page-container" id="workspace-content" tabIndex={-1}>
          {children}
        </div>
        <footer className="club-footer">
          Skyline Student Association
          <span>Club workspace · Payments are simulated, not charged.</span>
        </footer>
      </div>
    </div>
  );
}
