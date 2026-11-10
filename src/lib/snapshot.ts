import type { loadGaps } from "./gaps-load";
import type { FlowSnapshot } from "./flow";
import { dpiaNeeded } from "./dpia";
import { isClosed, type GapStatusKey } from "./gaps";

export type Loaded = Awaited<ReturnType<typeof loadGaps>>;
const HOUR = 3600 * 1000;

export function flowSnapshot(d: Loaded, now = new Date()): FlowSnapshot {
  const { raw, org } = d;
  const dpiaByRopa = new Set(raw.dpias.map((x) => x.ropaId).filter(Boolean));
  const needed = raw.assessed.filter(({ a }) => dpiaNeeded(a.risk.level, org.isSDF));
  const openCH = d.gaps.filter((g) => (g.severity === "Critical" || g.severity === "High") && !isClosed((d.trackingByKey.get(g.key)?.status ?? "OPEN") as GapStatusKey));
  return {
    org,
    committee: raw.committee.map((m) => m.designation),
    departments: raw.departments,
    assets: raw.assets.map((a) => ({ storesPersonalData: a.storesPersonalData, piiFieldCount: a.piiFields.length, ropaCount: a._count.ropaLinks })),
    vendors: raw.vendors.map((v) => ({ hasContract: v.hasContract, securityControlCount: v.securityControls.length })),
    ropaCount: raw.assessed.length,
    anyCrossBorder: raw.assessed.some(({ a }) => a.ctx.crossBorder),
    dpia: {
      needed: needed.length,
      withDpia: needed.filter(({ r }) => dpiaByRopa.has(r.id)).length,
      approved: needed.filter(({ r }) => raw.dpias.some((x) => x.ropaId === r.id && x.status === "APPROVED")).length,
    },
    controlStatus: Object.fromEntries(raw.controlRows.map((c) => [c.code, c.status])),
    consent: { portal: !!raw.consent?.rightsPortalUrl, notice: !!raw.consent, cmp: (raw.consent?.cmp ?? {}) as Record<string, string> },
    breaches: { total: raw.breaches.length, overdue: raw.breaches.filter((b) => !b.detailedReportAt && now.getTime() - b.detectedAt.getTime() > 72 * HOUR).length },
    gaps: { criticalHigh: openCH.length },
    reportGenerated: raw.reportGenerated,
  };
}
