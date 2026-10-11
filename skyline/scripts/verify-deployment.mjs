import assert from "node:assert/strict";
const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base))
  throw Error("Provide the verified deployment URL.");
for (const route of [
  "/login",
  "/register",
  "/events",
  "/forgot-password",
  "/reset-password",
]) {
  const result = await fetch(new URL(route, base));
  assert.equal(result.status, 200, route);
  assert.match(result.headers.get("content-type") || "", /text\/html/);
}
for (const route of ["/account", "/treasurer", "/admin/users", "/my-events"]) {
  const result = await fetch(new URL(route, base), { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(result.status), route);
  assert.ok(
    new URL(result.headers.get("location"), base).pathname === "/login",
    route,
  );
}
for (const route of ["/api/jobs/events", "/api/receipts/unknown"]) {
  const result = await fetch(new URL(route, base), { redirect: "manual" });
  assert.equal(result.status, 401, route);
}
const denied = await fetch(new URL("/api/jobs/events", base), {
  method: "POST",
  headers: { authorization: "Bearer invalid-not-a-real-secret" },
});
assert.equal(denied.status, 401);
console.log(
  "Deployment smoke checks passed: public pages, auth redirects, denied private receipt/jobs and wrong scheduler secret. No users, events or mail created.",
);
