import type { AuthTokenType } from "@prisma/client";
import { prisma } from "./db";
import { hit } from "./ratelimit";
import { appUrl, sendEmail } from "./email";
import { isExpired, newToken, hashToken, TTL } from "./tokens";
import { verifyEmailMail } from "./mail-templates";

/** Creates a one-time link token for a person, replacing any unused one of the same kind. Returns the raw token. */
export async function issueToken(userId: string, type: AuthTokenType, ttlMs: number): Promise<string> {
  const { token, hash } = newToken();
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } }),
    prisma.authToken.create({ data: { userId, type, tokenHash: hash, expiresAt: new Date(Date.now() + ttlMs) } }),
  ]);
  return token;
}

/** Checks a token without using it. */
export async function peekToken(type: AuthTokenType, token: string): Promise<{ userId: string } | null> {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  return row && row.type === type && !row.usedAt && !isExpired(row.expiresAt) ? { userId: row.userId } : null;
}

/** Uses a token exactly once, even if two requests arrive together. */
export async function consumeToken(type: AuthTokenType, token: string): Promise<string | null> {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.type !== type || row.usedAt || isExpired(row.expiresAt)) return null;
  const r = await prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return r.count === 1 ? row.userId : null;
}

/** Sends the confirm-your-email message. Never throws: a mail outage must not block sign-up. */
export async function sendVerification(user: { id: string; name: string; email: string }): Promise<boolean> {
  try {
    if (!(await hit(`verify:${user.id}`, 3, 3600)).ok) return false;
    const token = await issueToken(user.id, "VERIFY_EMAIL", TTL.verify);
    const mail = verifyEmailMail(user.name, `${appUrl()}/verify-email/${token}`);
    return (await sendEmail({ to: user.email, ...mail })).delivered;
  } catch (e) {
    console.error("verification email failed", e);
    return false;
  }
}
