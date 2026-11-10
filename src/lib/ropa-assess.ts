import { buildCtx, evaluate, hasSecurityEvidence } from "./ropa-checks";
import { scoreRopaRisk } from "./risk";

type RopaLike = {
  role: string; legalBasis: string; dataCategories: string[]; piiFields: string[]; principalCategory: string;
  purposeCategory: string | null; crossBorder: boolean; crossBorderCountry: string | null; retention: string | null;
  otherParties: string[]; controlEval: unknown;
  department: { name: string } | null;
  vendors: { vendor: { country: string | null } }[];
};

/** Checklist result + risk for one RoPA record. Used by the RoPA page and the dashboard. */
export function assessRopa(r: RopaLike, org: { handlesChildrenData: boolean }) {
  const ctx = buildCtx({ ...r, lawfulBasis: r.legalBasis }, r.vendors.map((v) => v.vendor.country));
  const ev = evaluate({
    ctx, lawfulBasis: r.legalBasis, retention: r.retention,
    saved: (r.controlEval ?? {}) as Record<string, string>,
  });
  const risk = scoreRopaRisk({
    dataCategories: r.dataCategories, piiFields: r.piiFields, principalCategory: r.principalCategory,
    purposeCategory: r.purposeCategory, departmentName: r.department?.name ?? null,
    crossBorder: ctx.crossBorder, crossBorderCountry: r.crossBorderCountry,
    vendorCount: r.vendors.length, otherPartyCount: r.otherParties.length,
    hasLawfulBasis: !!r.legalBasis, hasSecurityEvidence: hasSecurityEvidence(ev.items),
    orgHandlesChildren: org.handlesChildrenData,
  });
  return { ctx, ev, risk };
}
