import { prisma } from "./db";
import { withTenant } from "./tenant";
import { effective } from "./controls";
import { assessRopa } from "./ropa-assess";
import { detectGaps } from "./gaps";

/** Loads everything for one organisation, runs the gap engine, and returns the raw records for other modules. */
export async function loadGaps(s: { orgId: string; userId: string }) {
  const lib = await prisma.controlLibraryVersion.findFirst({
    where: { isActive: true },
    include: { sections: { orderBy: { order: "asc" }, include: { controls: { orderBy: { code: "asc" } } } } },
  });
  const [org, committee, departments, assets, vendors, ropa, assessments, dpias, tracking, breaches, consent, reportLog, consentEvidence] = await withTenant(s, (tx) =>
    Promise.all([
      tx.organisation.findUniqueOrThrow({ where: { id: s.orgId } }),
      tx.committeeMember.findMany({ orderBy: { name: "asc" } }),
      tx.department.findMany({ orderBy: { name: "asc" } }),
      tx.dataAsset.findMany({ include: { _count: { select: { ropaLinks: true } }, department: true, vendor: true }, orderBy: { name: "asc" } }),
      tx.vendor.findMany({ include: { subProcessors: true, _count: { select: { assets: true, ropaLinks: true } } }, orderBy: { name: "asc" } }),
      tx.ropaRecord.findMany({ include: { department: true, assets: { include: { asset: true } }, vendors: { include: { vendor: true } } }, orderBy: { activity: "asc" } }),
      tx.controlAssessment.findMany(),
      tx.dpia.findMany({ orderBy: [{ riskScore: "desc" }, { activity: "asc" }] }),
      tx.gapTracking.findMany(),
      tx.breach.findMany({ orderBy: { detectedAt: "desc" } }),
      tx.consentConfig.findUnique({ where: { orgId: s.orgId } }),
      tx.auditLog.findFirst({ where: { action: "report.generated" }, select: { id: true } }),
      Promise.all([tx.consentPurpose.count({ where: { active: true } }), tx.consentSubject.count(), tx.consentEvent.count(), tx.consentWithdrawalTask.count({ where: { acknowledgedAt: null } })]),
    ]),
  );
  const savedBy = new Map(assessments.map((a) => [a.controlId, a]));
  const assessed = ropa.map((r) => ({ r, a: assessRopa(r, org) }));

  const controlRows = (lib?.sections ?? []).flatMap((sec) =>
    sec.controls.map((c) => {
      const a = savedBy.get(c.id);
      return {
        id: c.id, code: c.code, title: c.title, sectionKey: sec.key, sectionTitle: sec.title, actRefs: c.actRefs, ruleRefs: c.ruleRefs,
        audience: c.audience, status: effective(a?.status, c.audience, org).status, owners: a?.owners ?? [], target: a?.targetDate ?? null,
      };
    }),
  );

  const gaps = detectGaps({
    now: new Date(), org, committee, departments,
    assets: assets.map((a) => ({ id: a.id, name: a.name, sourcing: a.sourcing, vendorId: a.vendorId, storesPersonalData: a.storesPersonalData, piiFieldCount: a.piiFields.length, ropaCount: a._count.ropaLinks })),
    vendors,
    ropa: assessed.map(({ r, a }) => ({
      id: r.id, activity: r.activity, crossBorder: r.crossBorder, crossBorderCountry: r.crossBorderCountry,
      items: a.ev.items, risk: a.risk, hasSecurity: a.risk.factors.every((f) => f.key !== "nosecurity"),
    })),
    controls: controlRows,
    dpiaRopaIds: new Set(dpias.map((d) => d.ropaId).filter((x): x is string => !!x)),
    approvedDpiaCount: dpias.filter((d) => d.status === "APPROVED").length,
    pendingConsentWithdrawals: consentEvidence[3],
    breaches,
  });

  const trackingByKey = new Map(tracking.map((t) => [t.gapKey, t]));
  const ownerOptions = [
    ...departments.filter((d) => d.spocName).map((d) => ({ value: `dept:${d.id}`, label: `${d.spocName} - ${d.name}` })),
    ...committee.map((m) => ({ value: `member:${m.id}`, label: `${m.name} - Committee (${m.designation ?? "Member"})` })),
  ];
  return {
    gaps, trackingByKey, ownerOptions, org, libLabel: lib?.label ?? null,
    raw: { committee, departments, assets, vendors, assessed, dpias, breaches, consent, consentEvidence: { activePurposes: consentEvidence[0], customers: consentEvidence[1], decisions: consentEvidence[2], pendingWithdrawals: consentEvidence[3] }, controlRows, reportGenerated: !!reportLog },
  };
}
