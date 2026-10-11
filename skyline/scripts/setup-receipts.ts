import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { setupReceiptStorage } = await import("../src/server/receipt-storage");
  await setupReceiptStorage();
  console.log(
    "Private receipt bucket configured for PDF, PNG and JPEG, maximum 2 MB. No public URLs generated.",
  );
}
main().catch(() => {
  console.error(
    "Receipt setup failed. Check local SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and bucket configuration. No secret values printed.",
  );
  process.exitCode = 1;
});
