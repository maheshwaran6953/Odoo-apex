/** Prisma v6 pool bounds for the shared 15-client Supabase session pool.
 * Never log the returned URL: it contains database credentials.
 */
export function boundedDatabaseUrl(
  value = process.env.DATABASE_URL,
  requestedLimit = process.env.DATABASE_CONNECTION_LIMIT,
) {
  if (!value || !/^postgres(?:ql)?:\/\//.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw Error("Invalid PostgreSQL connection configuration.");
  }
  const selected =
    requestedLimit ?? url.searchParams.get("connection_limit") ?? "3";
  if (!/^[1-5]$/.test(selected))
    throw Error(
      "DATABASE_CONNECTION_LIMIT must be a whole number from 1 to 5.",
    );
  url.searchParams.set("connection_limit", selected);
  if (!url.searchParams.has("pool_timeout"))
    url.searchParams.set("pool_timeout", "10");
  return url.toString();
}
