import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { verifyEmailConnection, emailConfigurationError } =
    await import("../src/server/email-transport");
  const problem = emailConfigurationError();
  if (problem) throw Error(problem);
  await verifyEmailConnection();
  console.log(
    "SMTP connection, TLS and authentication verified. No email sent; inbox delivery remains unverified.",
  );
}
main().catch((error) => {
  const code = error?.code;
  if (code === "EAUTH")
    console.error(
      "SMTP authentication failed. Use a Gmail App Password, not the account password.",
    );
  else
    console.error(
      "Email connection check failed:",
      code || "CONFIGURATION",
      "Check local SMTP settings and network; no secret values were printed.",
    );
  process.exitCode = 1;
});
