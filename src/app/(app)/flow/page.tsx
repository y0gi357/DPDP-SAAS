import { requireSession } from "@/lib/session";
import { loadGaps } from "@/lib/gaps-load";
import { flowSnapshot } from "@/lib/snapshot";
import { PHASES, buildSteps, progressOf } from "@/lib/flow";
import { PageHead } from "@/components/ui";
import { FlowDiagram } from "@/components/FlowDiagram";

export default async function Flow() {
  const s = await requireSession("view");
  const steps = buildSteps(flowSnapshot(await loadGaps(s)));
  const p = progressOf(steps);
  const next = steps.find((x) => x.status === "progress" || x.status === "todo");

  return (
    <>
      <PageHead title="Implementation flow" sub="How a DPDPA programme moves from organisation setup, through every duty to the Data Principal, to the dashboard. Each stage's colour comes from the records you have entered." />
      <div className="card">
        <h2>{p.pct}% complete</h2>
        <div className="muted">{p.done} of {p.total} applicable stages done{next ? ` · next: ${next.n}. ${next.title}` : ""}</div>
        <div className="bar"><i style={{ width: `${p.pct}%` }} /></div>
      </div>
      <FlowDiagram
        nextN={next?.n ?? null}
        steps={steps.map((x) => ({ n: x.n, id: x.id, title: x.title, phase: `${PHASES[x.phase].tag}: ${PHASES[x.phase].label}`, status: x.status, detail: x.detail, receives: x.receives, produces: x.produces, refs: x.refs, href: x.href }))}
      />
    </>
  );
}
