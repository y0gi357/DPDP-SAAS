import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { assessRopa } from "@/lib/ropa-assess";
import { effective, tally } from "@/lib/controls";
import { loadGaps } from "@/lib/gaps-load";
import { isClosed, type GapStatusKey } from "@/lib/gaps";

export default async function Dashboard() {
  const s = await requireSession("view");
  const lib = await prisma.controlLibraryVersion.findFirst({
    where: { isActive: true },
    include: { sections: { orderBy: { order: "asc" }, include: { controls: true } } },
  });
  if (!lib) return <p>No controls library loaded. Run <code>npm run db:seed</code>.</p>;

  const [gapData, dpiaRows] = await Promise.all([loadGaps(s), withTenant(s, (tx) => tx.dpia.findMany({ select: { status: true } }))]);
  const openGaps = gapData.gaps.filter((g) => !isClosed((gapData.trackingByKey.get(g.key)?.status ?? "OPEN") as GapStatusKey));
  const [assessments, deptCount, assetCount, vendorsNoContract, vendorCount, ropa, org] = await withTenant(s, (tx) =>
    Promise.all([
      tx.controlAssessment.findMany(),
      tx.department.count(),
      tx.dataAsset.count(),
      tx.vendor.count({ where: { hasContract: false } }),
      tx.vendor.count(),
      tx.ropaRecord.findMany({ include: { department: true, vendors: { include: { vendor: true } } } }),
      tx.organisation.findUniqueOrThrow({ where: { id: s.orgId } }),
    ]),
  );
  const saved = new Map(assessments.map((a) => [a.controlId, a.status]));
  const statusOf = (c: { id: string; audience: string[] }) => effective(saved.get(c.id), c.audience, org).status;

  const overall = tally(lib.sections.flatMap((sec) => sec.controls).map(statusOf));
  const ropaScored = ropa.map((r) => assessRopa(r, org));
  const highRisk = ropaScored.filter((x) => x.risk.level === "High").length;
  const ropaAvg = ropaScored.length ? Math.round(ropaScored.reduce((a, x) => a + x.ev.pct, 0) / ropaScored.length) : 0;

  return (
    <>
      <h1>Dashboard</h1>
      <p className="muted">Controls library: {lib.label}</p>
      <div className="card">
        <h2>Overall compliance: {overall.score}%</h2>
        <div className="muted">
          {overall.counts.IMPLEMENTED} implemented · {overall.counts.PARTIAL} partial · {overall.counts.PLANNED} planned · {overall.applicable} applicable of {overall.total}
        </div>
        <div className="bar"><i style={{ width: `${overall.score}%` }} /></div>
      </div>
      <div className="grid" style={{ marginBottom: 14 }}>
        <div className="card"><h2>{deptCount}</h2><div className="muted">Departments</div></div>
        <div className="card"><h2>{assetCount}</h2><div className="muted">Apps &amp; data sources</div></div>
        <div className="card"><h2>{vendorCount}</h2><div className="muted">Vendors ({vendorsNoContract} without contract)</div></div>
        <div className="card"><h2>{openGaps.length}</h2><div className="muted">Open gaps ({openGaps.filter((g) => g.severity === "Critical").length} critical, {openGaps.filter((g) => g.severity === "High").length} high)</div></div>
        <div className="card"><h2>{dpiaRows.filter((d) => d.status === "APPROVED").length}/{dpiaRows.length}</h2><div className="muted">DPIAs approved</div></div>
        <div className="card"><h2>{gapData.raw.consentEvidence.decisions}</h2><div className="muted"><a href="/consent/records">Consent decisions</a> · {gapData.raw.consentEvidence.pendingWithdrawals} withdrawal tasks pending</div></div>
        <div className="card"><h2>{ropa.length}</h2><div className="muted">RoPA activities ({highRisk} high risk, avg checklist {ropaAvg}%)</div></div>
      </div>
      <div className="grid">
        {lib.sections.map((sec) => {
          const st = tally(sec.controls.map(statusOf));
          return (
            <div className="card" key={sec.id}>
              <h2>{sec.title}</h2>
              <div className="muted">{st.counts.IMPLEMENTED}/{st.applicable} implemented · {st.score}%</div>
              <div className="bar"><i style={{ width: `${st.score}%` }} /></div>
            </div>
          );
        })}
      </div>
    </>
  );
}
