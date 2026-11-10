// Implementation roadmap: 22 stages in 7 phases whose status is worked out from the organisation's own records.
import type { AnyStatus } from "./controls";
import { COVERAGE } from "./enums";
import { CMP_ITEMS } from "./notice";

export type StepStatus = "done" | "progress" | "todo" | "na";
export type FlowSnapshot = {
  org: { dpoEmail: string | null; grievanceEmail: string | null; handlesChildrenData: boolean; isSDF: boolean };
  committee: (string | null)[];
  departments: { spocName: string | null; spocEmail: string | null }[];
  assets: { storesPersonalData: boolean; piiFieldCount: number; ropaCount: number }[];
  vendors: { hasContract: boolean; securityControlCount: number }[];
  ropaCount: number;
  anyCrossBorder: boolean;
  dpia: { needed: number; withDpia: number; approved: number };
  controlStatus: Record<string, AnyStatus>; // by control code, effective status
  consent: { portal: boolean; cmp: Record<string, string>; notice: boolean };
  breaches: { total: number; overdue: number };
  gaps: { criticalHigh: number };
  reportGenerated: boolean;
};

export const PHASES = [
  { label: "Foundation", tag: "Start" },
  { label: "Mobilization", tag: "Phase 1" },
  { label: "Discovery", tag: "Phase 2" },
  { label: "Analysis", tag: "Phase 3" },
  { label: "Operationalize", tag: "Phase 4" },
  { label: "Remediation", tag: "Phase 5" },
  { label: "Reporting", tag: "Close" },
] as const;

export type Step = {
  n: number; id: string; phase: number;
  title: string; href: string; receives: string; produces: string; refs: string[];
  status: StepStatus; detail: string;
};

const done = (c: boolean, started: boolean): StepStatus => (c ? "done" : started ? "progress" : "todo");

function byControls(s: FlowSnapshot, codes: string[]): { status: StepStatus; detail: string } {
  const st = codes.map((c) => s.controlStatus[c] ?? "NOT_ASSESSED");
  const applicable = st.filter((x) => x !== "NOT_APPLICABLE");
  if (applicable.length === 0) return { status: "na", detail: "No applicable controls for your profile" };
  const impl = applicable.filter((x) => x === "IMPLEMENTED").length;
  const started = applicable.some((x) => x !== "NOT_ASSESSED");
  return { status: done(impl === applicable.length, started), detail: `${impl} of ${applicable.length} controls implemented` };
}

export function buildSteps(s: FlowSnapshot): Step[] {
  const mk = (n: number, id: string, phase: number, title: string, href: string, receives: string, produces: string, refs: string[], r: { status: StepStatus; detail: string }): Step =>
    ({ n, id, phase, title, href, receives, produces, refs, ...r });

  const orgDone = !!s.org.dpoEmail && !!s.org.grievanceEmail;
  const covered = COVERAGE.filter((c) => s.committee.some((d) => d && c.match.test(d))).length;
  const spocsOk = s.departments.length > 0 && s.departments.every((d) => d.spocName && d.spocEmail);
  const pdAssets = s.assets.filter((a) => a.storesPersonalData);
  const vendorsOk = s.vendors.length > 0 && s.vendors.every((v) => v.hasContract && v.securityControlCount > 0);
  const cmpValues = CMP_ITEMS.map((i) => s.consent.cmp[i.id]).filter(Boolean);
  const cmpDone = cmpValues.length === CMP_ITEMS.length && cmpValues.every((v) => v === "YES" || v === "NA");
  const controlsAssessed = Object.values(s.controlStatus).filter((x) => x !== "NOT_APPLICABLE");
  const unassessed = controlsAssessed.filter((x) => x === "NOT_ASSESSED").length;

  const ropaOk = s.ropaCount > 0;
  const assessedAny = controlsAssessed.length > unassessed;

  return [
    mk(1, "org", 0, "Organisation Setup", "/org", "Business context", "Profile and scope", ["Sec 3", "Sec 8(9)"],
      { status: done(orgDone, !!s.org.dpoEmail || !!s.org.grievanceEmail), detail: orgDone ? "DPO and grievance contacts recorded" : "Add the DPO and grievance contacts" }),
    mk(2, "committee", 1, "DPDPA Committee", "/committee", "Organisation profile", "Roster and DPO", ["Sec 8(1)", "Sec 10(2)(a)"],
      { status: done(covered === COVERAGE.length, s.committee.length > 0), detail: `${s.committee.length} member(s), ${covered} of ${COVERAGE.length} key functions covered` }),
    mk(3, "departments", 1, "Departments & SPOCs", "/departments", "Committee owners", "Department register", ["Sec 8(1)"],
      { status: done(spocsOk, s.departments.length > 0), detail: `${s.departments.length} department(s)${spocsOk ? ", all with a SPOC" : ", some without a SPOC"}` }),
    mk(4, "apps", 2, "Apps & Data Sources", "/apps", "Departments", "App inventory", ["Sec 8(5)"],
      { status: done(pdAssets.length > 0 && pdAssets.every((a) => a.piiFieldCount > 0), s.assets.length > 0), detail: `${s.assets.length} system(s), ${pdAssets.filter((a) => a.piiFieldCount === 0).length} without PII fields listed` }),
    mk(5, "vendors", 2, "Vendors & TPRM", "/vendors", "Applications", "Processor register", ["Sec 8(2)", "Rule 6(1)(f)"],
      { status: done(vendorsOk, s.vendors.length > 0), detail: `${s.vendors.length} vendor(s), ${s.vendors.filter((v) => !v.hasContract).length} without a DPA` }),
    mk(6, "ropa", 2, "RoPA / Data Mapping", "/ropa", "Systems and processors", "RoPA with control checklist", ["Sec 4", "Sec 6", "Sec 7"],
      { status: done(ropaOk && pdAssets.every((a) => a.ropaCount > 0), ropaOk), detail: `${s.ropaCount} activit${s.ropaCount === 1 ? "y" : "ies"}, ${pdAssets.filter((a) => a.ropaCount === 0).length} personal-data system(s) not yet covered` }),
    mk(7, "dfd", 3, "Data Flow", "/dfd", "RoPA", "Flow maps", ["Sec 8(5)", "Sec 16"],
      { status: ropaOk ? "done" : "todo", detail: ropaOk ? "Generated from your RoPA" : "Needs RoPA activities" }),
    mk(8, "dpia", 3, "DPIA", "/dpia", "RoPA risk scores", "DPIA records", ["Sec 10(2)(c)", "Rule 13"],
      s.dpia.needed === 0 ? { status: ropaOk ? "done" : "todo", detail: ropaOk ? "No activity needs a DPIA" : "Needs RoPA activities" }
        : { status: done(s.dpia.withDpia >= s.dpia.needed && s.dpia.approved >= s.dpia.needed, s.dpia.withDpia > 0), detail: `${s.dpia.approved} approved of ${s.dpia.needed} needed` }),
    mk(9, "controls", 3, "Controls Assessment", "/controls", "RoPA checklist and DPIA risks", "Control scores", ["Sec 8"],
      { status: done(controlsAssessed.length > 0 && unassessed === 0, assessedAny), detail: `${controlsAssessed.length - unassessed} of ${controlsAssessed.length} applicable controls assessed` }),
    mk(10, "notice", 4, "Notice", "/consent", "RoPA data and purposes", "Itemised notice", ["Sec 5", "Rule 3"],
      { status: done(s.consent.notice && s.consent.portal, s.consent.notice || s.consent.portal), detail: s.consent.portal ? "Rights link recorded" : "Add the rights portal link and review the notice" }),
    mk(11, "consent", 4, "Consent & Withdrawal", "/consent/records", "Notice", "Consent records", ["Sec 6", "Rule 4"],
      { status: done(cmpDone, cmpValues.length > 0), detail: `${cmpValues.length} of ${CMP_ITEMS.length} checklist items answered` }),
    mk(12, "children", 4, "Children & PwD", "/controls", "Consent design", "Verified consent", ["Sec 9", "Rule 10", "Rule 11"],
      byControls(s, s.org.handlesChildrenData ? ["DPDP-9-001", "DPDP-9-002", "DPDP-9-003", "DPDP-9-004", "DPDP-9-005"] : ["DPDP-9-002"])),
    mk(13, "security", 4, "Security Safeguards", "/controls", "Technical safeguards", "Rule 6 measures", ["Sec 8(5)", "Rule 6"],
      byControls(s, ["DPDP-8-006", "DPDP-8-007", "DPDP-8-008", "DPDP-8-009", "DPDP-8-010", "DPDP-8-011", "DPDP-8-012", "DPDP-8-013"])),
    mk(14, "retention", 4, "Retention & Erasure", "/controls", "RoPA retention periods", "Erasure schedule", ["Sec 8(7)", "Rule 8"],
      byControls(s, ["DPDP-8-017", "DPDP-8-018", "DPDP-8-019"])),
    mk(15, "rights", 4, "Data Principal Rights", "/controls", "Notice and contacts", "Request workflow", ["Sec 11-14", "Rule 14"],
      byControls(s, ["DPDP-11-001", "DPDP-11-002", "DPDP-12-001", "DPDP-12-002", "DPDP-14-001"])),
    mk(16, "grievance", 4, "Grievance & Contact", "/controls", "Rights requests", "Redressal process", ["Sec 8(9)", "Sec 8(10)", "Sec 13"],
      byControls(s, ["DPDP-8-020", "DPDP-8-021", "DPDP-8-022", "DPDP-13-001"])),
    mk(17, "breach", 4, "Breach Response", "/breaches", "Logs and monitoring", "72-hour reporting", ["Sec 8(6)", "Rule 7"],
      (() => { const c = byControls(s, ["DPDP-8-014", "DPDP-8-015", "DPDP-8-016"]); return s.breaches.overdue > 0 ? { status: "progress" as const, detail: `${s.breaches.overdue} breach(es) past the 72-hour report deadline` } : c; })()),
    mk(18, "xborder", 4, "Cross-border Transfer", "/ropa", "RoPA and processor countries", "Transfer register", ["Sec 16", "Rule 15"],
      s.anyCrossBorder ? byControls(s, ["DPDP-16-001", "DPDP-16-002"]) : { status: ropaOk ? "na" : "todo", detail: ropaOk ? "No transfers abroad recorded" : "Needs RoPA activities" }),
    mk(19, "sdf", 4, "SDF Obligations", "/controls", "DPIA and control scores", "DPO, audit, DPIA", ["Sec 10", "Rule 13"],
      s.org.isSDF ? byControls(s, ["DPDP-10-002", "DPDP-10-003", "DPDP-10-004", "DPDP-10-005", "DPDP-10-006", "DPDP-10-007"]) : { status: "na", detail: "Not notified as an SDF" }),
    mk(20, "gaps", 5, "Gap Analysis", "/gaps", "Control scores and RoPA checklists", "Remediation plan", ["Sec 8(1)"],
      { status: s.gaps.criticalHigh === 0 && assessedAny ? "done" : assessedAny ? "progress" : "todo", detail: `${s.gaps.criticalHigh} open critical or high gap(s)` }),
    mk(21, "report", 6, "Generate Report", "/report", "Everything recorded", "Board report", ["Sec 8(1)", "Sec 10(2)(b)"],
      { status: s.reportGenerated ? "done" : "todo", detail: s.reportGenerated ? "A report has been generated" : "Generate when the stages above are ready" }),
    mk(22, "dashboard", 6, "Dashboard", "/dashboard", "Assessment record", "Live posture", ["Sec 8(1)"],
      { status: ropaOk && assessedAny ? "done" : ropaOk || assessedAny ? "progress" : "todo", detail: ropaOk && assessedAny ? "Live posture available" : "Fills in as you record data and assess controls" }),
  ];
}

export function progressOf(steps: Step[]) {
  const live = steps.filter((x) => x.status !== "na");
  const pts = live.reduce((a, x) => a + (x.status === "done" ? 1 : x.status === "progress" ? 0.5 : 0), 0);
  return { pct: live.length ? Math.round((pts / live.length) * 100) : 0, done: live.filter((x) => x.status === "done").length, total: live.length };
}
