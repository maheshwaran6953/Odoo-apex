import type { Metadata } from "next";
import "./globals.css";
import { ClubShell } from "@/components/club/shell";
import { ClubFeedbackProvider } from "@/components/club/feedback";
import { currentRole } from "@/server/auth";
import { currentUser } from "@/server/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LiveRefresh } from "@/components/club/live-refresh";
export const metadata: Metadata = {
  title: "Skyline Student Association",
  description: "Members, events and campus life, in one place.",
};
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const path = headers().get("x-skyline-path") || "/";
  const user = await currentUser();
  const publicPath =
    [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/verify-email",
      "/events",
    ].includes(path) ||
    (/^\/events\/[^/]+$/.test(path) && path !== "/events/check-in");
  if (!user && !publicPath) redirect("/login");
  const staffOnly =
    path === "/members" ||
    path.startsWith("/admin") ||
    path === "/events/check-in" ||
    /^\/events\/[^/]+\/manage/.test(path);
  const forbidden =
    user &&
    ((staffOnly &&
      user.role !== "STAFF" &&
      !(path === "/members" && user.role === "TREASURER")) ||
      (path === "/treasurer" && user.role !== "TREASURER"));
  const role = user ? await currentRole() : "GUEST";
  return (
    <html lang="en">
      <body>
        <ClubFeedbackProvider>
          {(path.startsWith("/events") ||
            path.startsWith("/tickets") ||
            ["/my-events", "/notifications"].includes(path)) && <LiveRefresh />}
          <ClubShell role={role}>
            {forbidden ? (
              <main className="glass-panel panel">
                <h1 className="section-title">This desk is restricted</h1>
                <p className="subtext mt-3">
                  Your account does not have access. Contact club staff if your
                  role needs updating.
                </p>
              </main>
            ) : (
              children
            )}
          </ClubShell>
        </ClubFeedbackProvider>
      </body>
    </html>
  );
}
