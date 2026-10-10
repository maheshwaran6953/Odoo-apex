import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, saved: string) {
  const [salt, hash] = saved.split(":");
  if (!salt || !hash || hash.length !== 128) return false;
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(hash, "hex"),
  );
}
export function newToken() {
  return randomBytes(32).toString("hex");
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
