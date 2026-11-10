"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { sendPortalLink } from "@/lib/business-consent";
import { hit } from "@/lib/ratelimit";

const back = (message: string): never => redirect(`/consent/records?message=${encodeURIComponent(message)}`);
const list = (v: string) => [...new Set(v.split("\n").map((x) => x.trim()).filter(Boolean))];
const noticeSchema = z.object({ purposeId: z.string().max(60), key: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{1,79}$/), title: z.string().trim().min(1).max(160), description: z.string().trim().min(1).max(2000), text: z.string().trim().min(1).max(12000), dataItems: z.string().trim().min(1).max(4000), language: z.string().trim().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).max(35), targets: z.string().max(2000) });

export async function publishNotice(fd: FormData) {
  const s = await requireSession("edit_org");
  const parsed = noticeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return back("Check the purpose, notice, language and data items. Purpose keys use lowercase letters, numbers, underscores or hyphens.");
  const d = parsed.data;
  const items = list(d.dataItems), targets = list(d.targets);
  if (!items.length || items.some((x) => x.length > 200) || items.length > 100 || targets.some((x) => x.length > 200) || targets.length > 30) back("Use up to 100 data items and 30 systems, each at most 200 characters.");
  try {
    await withTenant(s, async (tx) => {
      let purpose;
      if (d.purposeId) {
        await tx.$queryRaw`SELECT id FROM "ConsentPurpose" WHERE id = ${d.purposeId} AND "orgId" = ${s.orgId} FOR UPDATE`;
        purpose = await tx.consentPurpose.findUniqueOrThrow({ where: { id: d.purposeId } });
        await tx.consentPurpose.update({ where: { id: purpose.id }, data: { targets } });
      } else purpose = await tx.consentPurpose.create({ data: { orgId: s.orgId, key: d.key, targets } });
      const latest = await tx.consentNotice.findFirst({ where: { purposeId: purpose.id }, orderBy: { version: "desc" } });
      const row = await tx.consentNotice.create({ data: { orgId: s.orgId, purposeId: purpose.id, version: (latest?.version ?? 0) + 1, title: d.title, description: d.description, text: d.text, dataItems: items, targets, language: d.language, publishedBy: s.userId } });
      await audit(tx, { orgId: s.orgId, userId: s.userId, action: "consent.notice_published", entity: "ConsentNotice", entityId: row.id });
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") back("That purpose key already exists. Select it to publish a new version.");
    throw e;
  }
  revalidatePath("/consent/records");
  back("Notice published. Previous decisions retain their original notice; this does not grant consent to the new version.");
}

export async function togglePurpose(fd: FormData) {
  const s = await requireSession("edit_org");
  await withTenant(s, async (tx) => {
    const id = String(fd.get("id") ?? "");
    const row = await tx.consentPurpose.findUniqueOrThrow({ where: { id } });
    await tx.consentPurpose.update({ where: { id }, data: { active: !row.active } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "consent.purpose_toggled", entity: "ConsentPurpose", entityId: id, meta: { active: !row.active } });
  });
  revalidatePath("/consent/records");
}

export async function addSubject(fd: FormData) {
  const s = await requireSession("edit_data");
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(200), reference: z.string().trim().max(120) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return back("Enter a valid email address and a reference of at most 120 characters.");
  const subject = await withTenant(s, async (tx) => {
    const row = await tx.consentSubject.upsert({ where: { orgId_email: { orgId: s.orgId, email: parsed.data.email } }, create: { orgId: s.orgId, ...parsed.data }, update: { reference: parsed.data.reference || null } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "consent.subject_saved", entity: "ConsentSubject", entityId: row.id });
    return row;
  });
  revalidatePath("/consent/records");
  back(`Customer ${subject.email} saved. Send a private portal link to collect their choices.`);
}

export async function issueLink(fd: FormData) {
  const s = await requireSession("edit_data");
  if (!(await hit(`consent-link:${s.orgId}`, 30, 3600)).ok) back("Too many portal emails. Try again later.");
  const result = await sendPortalLink(s, String(fd.get("id") ?? ""));
  if (!result.delivered && result.link) redirect(`/consent/records?devLink=${encodeURIComponent(result.link)}`);
  back(result.delivered ? "Private portal link sent. It expires in 24 hours." : "Email could not be delivered. Check SMTP settings and send a new link.");
}

export async function revokeLink(fd: FormData) {
  const s = await requireSession("edit_data");
  await withTenant(s, async (tx) => {
    const id = String(fd.get("id") ?? "");
    await tx.consentSubject.update({ where: { id }, data: { tokenHash: null, tokenExpiresAt: null } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "consent.portal_revoked", entity: "ConsentSubject", entityId: id });
  });
  revalidatePath("/consent/records");
}

export async function acknowledgeWithdrawal(fd: FormData) {
  const s = await requireSession("edit_data");
  const note = z.string().trim().min(10).max(2000).safeParse(fd.get("note"));
  if (!note.success) return back("Record the action taken or lawful retention exception (10–2000 characters).");
  await withTenant(s, async (tx) => {
    const id = String(fd.get("id") ?? "");
    const r = await tx.consentWithdrawalTask.updateMany({ where: { id, acknowledgedAt: null }, data: { acknowledgedAt: new Date(), acknowledgedBy: s.userId, note: note.data } });
    if (r.count) await audit(tx, { orgId: s.orgId, userId: s.userId, action: "consent.withdrawal_acknowledged", entity: "ConsentWithdrawalTask", entityId: id, meta: { note: note.data } });
  });
  revalidatePath("/consent/records");
}
