import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** A random URL-safe token (sent to the user) and its SHA-256 hash (stored). */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const HOUR = 3600 * 1000;
export const TTL = { verify: 48 * HOUR, reset: 1 * HOUR, invite: 7 * 24 * HOUR } as const;
export const isExpired = (expiresAt: Date, now = new Date()) => expiresAt.getTime() <= now.getTime();

/** Only follow same-site paths after login, never an arbitrary URL. */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\r\n]/.test(next)) return fallback;
  return next;
}
