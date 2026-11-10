import type { ConsentChoice, ConsentEvent, Prisma } from "@prisma/client";
import { withTenant } from "./tenant";
import { hashToken, newToken } from "./tokens";
import { audit } from "./audit";
import { appUrl, sendEmail } from "./email";

export const PORTAL_TTL = 24 * 60 * 60 * 1000;
export const choices = ["GRANTED", "DENIED", "WITHDRAWN"] as const;
export const choiceLabel: Record<string, string> = { GRANTED: "Granted", DENIED: "Declined", WITHDRAWN: "Withdrawn" };

export function latestDecisions<T extends { purposeId: string; revision: number }>(events: T[]): Map<string, T> {
  const out = new Map<string, T>();
  for (const event of events) if (!out.has(event.purposeId) || out.get(event.purposeId)!.revision < event.revision) out.set(event.purposeId, event);
  return out;
}

// Withdrawal refers to the notice originally accepted, even if a new notice has been published.
export function decisionNotice(current: Pick<ConsentEvent, "choice" | "noticeId"> | undefined, choice: ConsentChoice, latestNoticeId: string, submittedNoticeId: string): string {
  if (current?.choice === "GRANTED" && choice === "DENIED") throw new Error("Withdraw your existing consent before declining a new notice.");
  if (choice === "WITHDRAWN") {
    if (current?.choice !== "GRANTED" || submittedNoticeId !== current.noticeId) throw new Error("There is no matching active consent to withdraw. Refresh the page.");
    return current.noticeId;
  }
  if (submittedNoticeId !== latestNoticeId) throw new Error("The notice has changed. Refresh and read the latest version before choosing.");
  return latestNoticeId;
}

export async function portalSubject(tx: Prisma.TransactionClient, orgId: string, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return tx.consentSubject.findFirst({ where: { orgId, tokenHash: hashToken(token), tokenExpiresAt: { gt: new Date() } } });
}

export async function sendPortalLink(ctx: { orgId: string; userId?: string }, subjectId: string) {
  const { token, hash } = newToken();
  const subject = await withTenant(ctx, async (tx) => {
    const row = await tx.consentSubject.update({ where: { id: subjectId }, data: { tokenHash: hash, tokenExpiresAt: new Date(Date.now() + PORTAL_TTL) } });
    await audit(tx, { orgId: ctx.orgId, userId: ctx.userId, action: "consent.portal_link_issued", entity: "ConsentSubject", entityId: row.id });
    return row;
  });
  const link = `${appUrl()}/privacy/${ctx.orgId}/${token}`;
  let delivered = false;
  try {
    delivered = (await sendEmail({ to: subject.email, subject: "Manage your privacy choices", text: `Open your private consent portal:\n${link}\n\nThis link expires in 24 hours and replaces previous links. Anyone with it can manage your choices. If you did not request this, ignore this message.` })).delivered;
  } catch { console.error("Could not send consent portal email"); }
  return { delivered, link: process.env.NODE_ENV !== "production" ? link : null };
}

export async function recordDecision(orgId: string, token: string, purposeId: string, noticeId: string, choice: ConsentChoice) {
  return withTenant({ orgId }, async (tx) => {
    const subject = await portalSubject(tx, orgId, token);
    if (!subject) throw new Error("This private link has expired. Request a new link.");
    // Serialize decisions for this person, then re-check the credential after acquiring the lock.
    await tx.$queryRaw`SELECT id FROM "ConsentSubject" WHERE id = ${subject.id} AND "orgId" = ${orgId} FOR UPDATE`;
    if (!(await portalSubject(tx, orgId, token))) throw new Error("This private link has expired. Request a new link.");
    await tx.$queryRaw`SELECT id FROM "ConsentPurpose" WHERE id = ${purposeId} AND "orgId" = ${orgId} FOR SHARE`;
    const purpose = await tx.consentPurpose.findUnique({ where: { id: purposeId }, include: { notices: { orderBy: { version: "desc" }, take: 1 } } });
    if (!purpose?.notices[0]) throw new Error("Purpose not found.");
    const current = await tx.consentEvent.findFirst({ where: { subjectId: subject.id, purposeId }, orderBy: { revision: "desc" } });
    if (!purpose.active && choice !== "WITHDRAWN") throw new Error("This purpose no longer accepts new choices.");
    if (current?.choice === "WITHDRAWN" && choice === "WITHDRAWN" && current.noticeId === noticeId) return;
    const acceptedNoticeId = decisionNotice(current ?? undefined, choice, purpose.notices[0].id, noticeId);
    if (current?.choice === choice && current.noticeId === acceptedNoticeId) return; // safe duplicate submission
    const next = await tx.consentSubject.update({ where: { id: subject.id }, data: { revision: { increment: 1 } } });
    const event = await tx.consentEvent.create({ data: { orgId, subjectId: subject.id, purposeId, noticeId: acceptedNoticeId, choice, revision: next.revision } });
    if (choice === "WITHDRAWN") {
      // Include systems from previous grants, even if an admin later removes a target.
      const grants = await tx.consentEvent.findMany({ where: { subjectId: subject.id, purposeId, choice: "GRANTED" }, select: { notice: { select: { targets: true } } } });
      const knownTargets = [...new Set([...purpose.targets, ...grants.flatMap((g) => g.notice.targets)])];
      const targets = knownTargets.length ? knownTargets : ["Internal processing and relevant processors"];
      await tx.consentWithdrawalTask.createMany({ data: targets.map((target) => ({ orgId, eventId: event.id, target })) });
    }
    await audit(tx, { orgId, action: `consent.${choice.toLowerCase()}`, entity: "ConsentEvent", entityId: event.id, meta: { subjectId: subject.id, purposeId, noticeId: acceptedNoticeId } });
  });
}
