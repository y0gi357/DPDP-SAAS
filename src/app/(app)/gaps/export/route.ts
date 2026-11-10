import { requireSession } from "@/lib/session";
import { loadGaps } from "@/lib/gaps-load";

// Spreadsheet formulas in cells can run code; neutralise cells that start with a formula character.
const cell = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET() {
  const s = await requireSession("view");
  const { gaps, trackingByKey, ownerOptions } = await loadGaps(s);
  const label = new Map(ownerOptions.map((o) => [o.value, o.label]));
  const header = ["Key", "Severity", "Scope", "Gap", "Detail", "Recommendation", "Status", "Owners", "Due date", "Notes"];
  const rows = gaps.map((g) => {
    const t = trackingByKey.get(g.key);
    return [g.key, g.severity, g.scope, g.title, g.detail, g.recommendation, t?.status ?? "OPEN",
      (t?.owners ?? []).map((o) => label.get(o) ?? o).join("; "), t?.dueDate ? t.dueDate.toISOString().slice(0, 10) : "", t?.notes ?? ""];
  });
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="remediation-plan-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
