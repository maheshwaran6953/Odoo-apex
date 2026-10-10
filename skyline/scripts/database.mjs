import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
export const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
loadEnvConfig(appRoot);
export function selectedSchema() {
  if ((process.env.DATABASE_PROVIDER || "sqlite") === "sqlite")
    return path.join(appRoot, "prisma/schema.prisma");
  if (process.env.DATABASE_PROVIDER !== "postgresql")
    throw new Error("DATABASE_PROVIDER must be sqlite or postgresql.");
  if (
    !process.env.DATABASE_URL?.startsWith("postgres") ||
    !process.env.DIRECT_URL?.startsWith("postgres")
  )
    throw new Error(
      "Set PostgreSQL DATABASE_URL and DIRECT_URL locally before switching providers.",
    );
  const base = readFileSync(path.join(appRoot, "prisma/schema.prisma"), "utf8");
  const schema = base
    .replace('provider = "sqlite"', 'provider = "postgresql"')
    .replace(
      'url      = env("DATABASE_URL")',
      'url      = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")',
    );
  const target = path.join(
    appRoot,
    "prisma/schema.postgresql.generated.prisma",
  );
  writeFileSync(target, schema);
  return target;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const command = process.argv[2];
  if (!["generate", "push", "validate"].includes(command))
    throw new Error("Use generate, push, or validate.");
  const args =
    command === "push" ? ["db", "push", "--skip-generate"] : [command];
  if (
    command === "push" &&
    (process.env.DATABASE_PROVIDER || "sqlite") === "sqlite" &&
    process.env.DATABASE_URL?.startsWith("file:")
  ) {
    const value = process.env.DATABASE_URL.slice(5).split("?")[0];
    const file = path.resolve(appRoot, "prisma", value);
    // Creating the empty file explicitly also supports fresh Windows checkouts.
    if (!existsSync(file)) {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, "", { flag: "wx" });
    }
  }
  const schema = selectedSchema();
  const run = (args) =>
    spawnSync(
      process.execPath,
      [require.resolve("prisma/build/index.js"), ...args, "--schema", schema],
      { cwd: appRoot, env: process.env, stdio: "inherit" },
    );
  const result = run(args);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  if (command === "push") {
    if (process.env.DATABASE_PROVIDER === "postgresql") {
      // Tables remain server-only; public Supabase API roles cannot read credentials
      // or attendee records. Prisma connects as the database owner/service DB role.
      const models = [
        ...readFileSync(schema, "utf8").matchAll(/^model\s+(\w+)\s*\{/gm),
      ].map((match) => match[1]);
      const sql = models
        .map(
          (model) =>
            `ALTER TABLE public."${model}" ENABLE ROW LEVEL SECURITY;\nDO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE public."${model}" FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE public."${model}" FROM authenticated; END IF; END $$;`,
        )
        .join("\n");
      const sqlFile = path.join(appRoot, "prisma/server-only.generated.sql");
      writeFileSync(sqlFile, sql);
      const secure = run(["db", "execute", "--file", sqlFile]);
      if (secure.status !== 0) process.exit(secure.status || 1);
    }
    const generated = run(["generate"]);
    if (generated.error) throw generated.error;
    process.exit(generated.status || 0);
  }
  process.exit(0);
}
