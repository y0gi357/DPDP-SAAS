import { requireSession } from "@/lib/session";
import { loadFlowInput } from "@/lib/dfd-load";
import { buildFlow, layoutFlow, renderSvg } from "@/lib/dfd";
import { categoryLabel } from "@/lib/pii";

export async function GET(req: Request) {
  const s = await requireSession("view");
  const dept = new URL(req.url).searchParams.get("dept") || undefined;
  const { input } = await loadFlowInput(s, dept);
  const svg = renderSvg(layoutFlow(buildFlow(input)), "file", categoryLabel);
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": 'attachment; filename="data-flow.svg"', "Cache-Control": "no-store" } });
}
