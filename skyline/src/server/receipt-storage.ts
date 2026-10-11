import { createClient } from "@supabase/supabase-js";

export const receiptMaxBytes = 2 * 1024 * 1024;
export const receiptMimeTypes = ["application/pdf", "image/jpeg", "image/png"];
export type ReceiptStorage = {
  upload: (path: string, bytes: Uint8Array, mime: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
  download: (path: string) => Promise<Blob>;
};
function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_RECEIPTS_BUCKET || "skyline-receipts";
  if (
    !url ||
    !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) ||
    !key ||
    !/^[a-z0-9-]{3,63}$/.test(bucket)
  )
    throw Error(
      "Private receipt storage is not configured. Contact Staff; do not expose keys in the browser.",
    );
  if (!key.startsWith("sb_secret_")) {
    try {
      const claims = JSON.parse(
        Buffer.from(key.split(".")[1] || "", "base64url").toString("utf8"),
      );
      if (
        claims.role !== "service_role" ||
        claims.ref !== new URL(url).hostname.split(".")[0]
      )
        throw Error("Incorrect key");
    } catch {
      throw Error(
        "Receipt storage requires this project's service_role or server secret key, not an anon/publishable key.",
      );
    }
  }
  return {
    supabase: createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }),
    bucket,
  };
}
async function privateBucket() {
  const { supabase, bucket } = client();
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (error || !data)
    throw Error(
      "Private receipt bucket is unavailable. Staff must run the storage setup.",
    );
  if (data.public)
    throw Error(
      "Receipt storage must be private. Upload and download were blocked.",
    );
  return { supabase, bucket };
}
export async function setupReceiptStorage() {
  const { supabase, bucket } = client();
  const found = await supabase.storage.getBucket(bucket);
  if (!found.data) {
    const created = await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: receiptMaxBytes,
      allowedMimeTypes: receiptMimeTypes,
    });
    if (created.error)
      throw Error(
        "Could not create private receipt bucket. Check the server key and Storage permissions.",
      );
  } else {
    if (found.data.public)
      throw Error(
        "Existing receipt bucket is public. Make it private before continuing.",
      );
    const updated = await supabase.storage.updateBucket(bucket, {
      public: false,
      fileSizeLimit: receiptMaxBytes,
      allowedMimeTypes: receiptMimeTypes,
    });
    if (updated.error)
      throw Error("Could not configure receipt bucket restrictions.");
  }
  await privateBucket();
}
export const receiptStorage: ReceiptStorage = {
  async upload(path, bytes, mime) {
    const { supabase, bucket } = await privateBucket();
    const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType: mime,
      upsert: false,
      cacheControl: "0",
    });
    if (error)
      throw Error(
        "Receipt upload failed. Check storage configuration and retry; no expense was recorded.",
      );
  },
  async remove(path) {
    const { supabase, bucket } = await privateBucket();
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw Error("Receipt cleanup requires administrator review.");
  },
  async download(path) {
    const { supabase, bucket } = await privateBucket();
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) throw Error("Receipt is unavailable. Contact Staff.");
    return data;
  },
};
