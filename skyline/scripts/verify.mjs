import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const steps = [
  {
    label: "Validate Prisma schema",
    script: "scripts/database.mjs",
    args: ["validate"],
  },
  {
    label: "Check TypeScript",
    script: "node_modules/typescript/bin/tsc",
    args: ["--noEmit"],
  },
  {
    label: "Build production application",
    script: "node_modules/next/dist/bin/next",
    args: ["build"],
  },
];

for (const step of steps) {
  const executable = path.join(appRoot, step.script);
  if (!existsSync(executable)) {
    console.error("Dependencies are missing. Run npm ci from skyline first.");
    process.exit(1);
  }
  console.log(`\n${step.label}`);
  const env = { ...process.env };
  if (step.args[0] === "build")
    env.SKYLINE_DIST_DIR = env.SKYLINE_DIST_DIR || ".next-verify";
  const result = spawnSync(process.execPath, [executable, ...step.args], {
    cwd: appRoot,
    env,
    stdio: "inherit",
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) {
    console.error(
      `Verification stopped: ${step.label}. No success is claimed for the remaining steps.`,
    );
    process.exit(result.status || 1);
  }
}
console.log(
  "\nSchema validation, TypeScript checking, and production build passed.",
);
console.log(
  "This command does not exercise browser workflows or constitute an automated test suite.",
);
