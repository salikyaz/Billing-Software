import crypto from "crypto";

/** SHA-256 hex digest — used to store reset/2FA tokens (never the raw value). */
export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Constant-time string comparison (avoids timing side-channels). */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Cryptographically-random numeric code, e.g. "428193". */
export function randomNumericCode(digits = 6): string {
  const max = 10 ** digits;
  const n = crypto.randomInt(0, max);
  return n.toString().padStart(digits, "0");
}

/** Cryptographically-random URL-safe token (hex). */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}
