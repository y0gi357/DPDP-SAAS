import { requireSession } from "@/lib/session";
import { loadFlowInput } from "@/lib/dfd-load";
import { buildFlow, layoutFlow, renderSvg } from "@/lib/dfd";
import { categoryLabel } from "@/lib/pii";
import { PageHead } from "@/components/ui";

export default async function Dfd({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  const s = await requireSession("view");
  const { dept } = await searchParams;
  const { input, departments } = await loadFlowInput(s, dept || undefined);
  const flow = buildFlow(input);
  const svg = renderSvg(layoutFlow(flow), "page", categoryLabel);

  return (
    <>
      <PageHead title="Data Flow" sub="How personal data moves from Data Principals through your systems and departments to processors and across borders. Built from the RoPA." />
      <div className="tiles">
        <div className="tile"><div className="t">Systems</div><div className="n">{flow.stats.systems}</div></div>
        <div className="tile"><div className="t">Departments</div><div className="n">{flow.stats.departments}</div></div>
        <div className="tile"><div className="t">Processors</div><div className="n">{flow.stats.processors}</div></div>
        <div className="tile"><div className="t">Flows</div><div className="n">{flow.stats.flows}</div></div>
        <div className="tile"><div className="t">Cross-border flows</div><div className="n" style={{ color: flow.stats.crossBorderFlows ? "var(--bad)" : "var(--ok)" }}>{flow.stats.crossBorderFlows}</div></div>
      </div>
      <form method="get" className="row" style={{ marginBottom: 12 }}>
        <select name="dept" defaultValue={dept ?? ""}><option value="">All departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <button type="submit" className="ghost sm">Apply</button>
        <a className="btn" href={`/dfd/export${dept ? `?dept=${encodeURIComponent(dept)}` : ""}`}>Download SVG</a>
      </form>
      {flow.nodes.length === 0 ? (
        <div className="card empty">No flows yet. Add processing activities in the RoPA and link them to systems, a department and vendors.</div>
      ) : (
        <div className="card dfd" style={{ overflow: "auto" }} dangerouslySetInnerHTML={{ __html: svg }} />
      )}
      <p className="muted" style={{ fontSize: 13 }}>Dashed red lines are cross-border flows. Hover a line or box for the activities and data categories. Vendors flagged "no DPA" or "abroad" and systems hosted outside India are marked on the node.</p>
    </>
  );
}
