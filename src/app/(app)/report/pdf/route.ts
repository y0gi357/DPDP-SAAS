import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { loadGaps } from "@/lib/gaps-load";
import { buildReport } from "@/lib/report";
import { renderPdf } from "@/lib/report-pdf";

export const runtime = "nodejs";

export async function GET() {
  const s = await requireSession("view");
  const data = await loadGaps(s);
  const model = buildReport(data);
  const bytes = renderPdf(model);
  await withTenant(s, (tx) => audit(tx, { orgId: s.orgId, userId: s.userId, action: "report.generated", entity: "Report", meta: { format: "pdf" } }));
  const slug = model.orgName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "organisation";
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="DPDPA-assessment-${slug}-${model.generatedOn}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
