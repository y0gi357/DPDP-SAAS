import { prisma } from "./db";

export type Limit = { ok: boolean; remaining: number; retryAfterSec: number };

/** Pure decision from a counter row; the database does the atomic increment. */
export function decide(count: number, resetAt: Date, limit: number, now = new Date()): Limit {
  return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfterSec: Math.max(0, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)) };
}

/**
 * Fixed-window counter shared by every app instance. One atomic upsert per call.
 * Counts the attempt first, so a caller over the limit stays blocked until the window ends.
 */
export async function hit(key: string, limit: number, windowSec: number): Promise<Limit> {
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + (${windowSec}::int * interval '1 second'))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  if (Math.random() < 0.01) void prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < now() - interval '1 day'`.catch(() => {});
  return decide(Number(rows[0].count), rows[0].resetAt, limit);
}

/** Best-effort client address. Only trust x-forwarded-for when a proxy you control sets it. */
export function ipFrom(h: Headers): string {
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (fwd || h.get("x-real-ip") || "unknown").slice(0, 64);
}
