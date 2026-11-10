import { withTenant } from "@/lib/tenant";
import { portalSubject } from "@/lib/business-consent";
import { audit } from "@/lib/audit";
import { hit, ipFrom } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string; token: string }> }) {
  const { orgId, token } = await params;
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
  if (!(await hit(`privacy-export:${ipFrom(req.headers)}`, 30, 3600)).ok) return new Response("Please try again later.", { status: 429, headers });
  const records = await withTenant({ orgId }, async (tx) => {
    const subject = await portalSubject(tx, orgId, token);
    if (!subject) return null;
    const events = await tx.consentEvent.findMany({ where: { subjectId: subject.id }, include: { notice: true, tasks: true }, orderBy: { revision: "asc" } });
    await audit(tx, { orgId, action: "consent.records_exported", entity: "ConsentSubject", entityId: subject.id });
    return {
      exportedAt: new Date().toISOString(), organisationId: orgId,
      customer: { email: subject.email, reference: subject.reference },
      decisions: events.map((e) => ({ receiptId: e.id, purposeId: e.purposeId, choice: e.choice, sequence: e.revision, source: e.source, recordedAt: e.createdAt,
        notice: { id: e.notice.id, version: e.notice.version, title: e.notice.title, purpose: e.notice.description, dataItems: e.notice.dataItems, text: e.notice.text, language: e.notice.language, publishedAt: e.notice.publishedAt },
        withdrawalFollowUp: e.tasks.map((t) => ({ target: t.target, createdAt: t.createdAt, acknowledgedAt: t.acknowledgedAt })),
      })),
    };
  });
  if (!records) return new Response("Private link expired or unavailable.", { status: 404, headers });
  return Response.json(records, { headers: { ...headers, "Content-Disposition": 'attachment; filename="my-consent-records.json"' } });
}
