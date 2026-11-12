// Gap detection: turns a snapshot of the organisation's data into a prioritised list of gaps.
// Pure and deterministic, so the Gaps page, the CSV export and the dashboard always agree.
import type { AnyStatus } from "./controls";
import type { ItemResult } from "./ropa-checks";
import type { RopaRisk } from "./risk";
import { COVERAGE } from "./enums";

export type Severity = "Critical" | "High" | "Medium" | "Low";
export const SEV_WEIGHT: Record<Severity, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

export type Gap = {
  key: string;
  scope: string;
  severity: Severity;
  title: string;
  detail: string;
  recommendation: string;
  href: string;
  controlId?: string;
  controlStatus?: AnyStatus;
};

export type GapInput = {
  now: Date;
  org: { isSDF: boolean; dpoEmail: string | null; grievanceEmail: string | null };
  committee: { designation: string | null }[];
  departments: { id: string; name: string; spocName: string | null; spocEmail: string | null; contacts?: { id: string; subFunction: string; name: string; email: string | null }[] }[];
  assets: { id: string; name: string; sourcing: string; vendorId: string | null; storesPersonalData: boolean; piiFieldCount: number; ropaCount: number }[];
  vendors: {
    id: string; name: string; hasContract: boolean; securityControls: string[]; breachClause: boolean;
    dsrContact: string | null; riskTier: string; lastReview: Date | null;
    subProcessors: { id: string; name: string; dpaSigned: boolean }[];
  }[];
  ropa: { id: string; activity: string; crossBorder: boolean; crossBorderCountry: string | null; items: ItemResult[]; risk: RopaRisk; hasSecurity: boolean }[];
  controls: { id: string; code: string; title: string; sectionKey: string; sectionTitle: string; actRefs: string[]; ruleRefs: string[]; status: AnyStatus }[];
  dpiaRopaIds: Set<string>;
  approvedDpiaCount: number;
  pendingConsentWithdrawals?: number;
  breaches: { id: string; title: string; detectedAt: Date; boardIntimatedAt: Date | null; principalsIntimatedAt: Date | null; detailedReportAt: Date | null }[];
};

const CRITICAL_SECTIONS = new Set(["SEC-5", "SEC-6", "SEC-8", "SEC-9", "SEC-10"]);

export function controlSeverity(sectionKey: string, status: AnyStatus): Severity {
  const crit = CRITICAL_SECTIONS.has(sectionKey);
  if (status === "NOT_IMPLEMENTED" || status === "NOT_ASSESSED") return crit ? "Critical" : "High";
  if (status === "PARTIAL") return crit ? "High" : "Medium";
  return "Low"; // planned
}

const SECTION_ADVICE: Record<string, string> = {
  "SEC-3": "Confirm in the RoPA which activities fall under the Act, including non-digital records that get digitised.",
  "SEC-4": "Give every processing activity a lawful ground: consent (Sec 6) or a specific Sec 7 use. Stop any activity that has none.",
  "SEC-5": "Put a layered privacy notice in place that lists the data and purpose and links to rights and the Board complaint route.",
  "SEC-6": "Set up consent capture with a clear affirmative action, purpose-level granularity, logging, and withdrawal as easy as giving consent.",
  "RULE-4": "If you use or operate a Consent Manager, check Board registration and the Rules' conditions.",
  "SEC-7": "Document each Sec 7 use with the facts that justify it, and keep processing inside that scope.",
  "SEC-8": "Assign an owner, document how the safeguard works, and record the evidence. Prioritise security, breach and erasure duties.",
  "SEC-9": "Add age checks and verifiable parental consent, and block tracking and targeted advertising for children.",
  "SEC-10": "Appoint the India-based DPO and independent auditor, and schedule the annual DPIA and audit.",
  "SEC-11-14": "Publish a simple way to request access, correction, erasure and nomination, and track response times.",
  "SEC-15": "Add procedures to verify identity and to handle false or frivolous requests.",
  "SEC-16": "Map every transfer abroad and check each destination against the Government's current restrictions.",
  "SEC-17": "Record which exemption you rely on, the legal basis for it, and its limits.",
  "SEC-18-28": "Name a contact for Board matters and keep records ready for an inquiry.",
  "SEC-29-33": "Keep a penalty exposure register and decide in advance how you would appeal or offer an undertaking.",
};

const HIGH_GROUPS = new Set(["security", "consent", "breach", "basis"]);
const YEAR = 365 * 24 * 3600 * 1000;

export function detectGaps(i: GapInput): Gap[] {
  const out: Gap[] = [];
  const push = (g: Gap) => out.push(g);

  // 1. Control gaps
  for (const c of i.controls) {
    if (c.status === "IMPLEMENTED" || c.status === "NOT_APPLICABLE") continue;
    const label = c.status === "NOT_ASSESSED" ? "Not yet assessed" : c.status === "NOT_IMPLEMENTED" ? "Not implemented" : c.status === "PARTIAL" ? "Partially implemented" : "Planned";
    push({
      key: `CTL-${c.code}`, scope: "Control", severity: controlSeverity(c.sectionKey, c.status),
      title: `${c.code}: ${c.title}`,
      detail: `${label}. ${c.actRefs.join(", ")}${c.ruleRefs.length ? ` · ${c.ruleRefs.join(", ")}` : ""} · ${c.sectionTitle}`,
      recommendation: SECTION_ADVICE[c.sectionKey] ?? "Assign an owner and record how this control is met.",
      href: "/controls", controlId: c.id, controlStatus: c.status,
    });
  }

  // 2. RoPA checklist gaps, one per checklist item across all activities
  const agg = new Map<string, { item: ItemResult; of: number; notMet: string[]; partial: string[] }>();
  for (const r of i.ropa) for (const it of r.items) {
    if (it.def.recommended || it.source === "auto" || it.status === "N/A") continue;
    const a = agg.get(it.def.id) ?? { item: it, of: 0, notMet: [], partial: [] };
    a.of++;
    if (it.status === "Not met") a.notMet.push(r.activity);
    if (it.status === "Partial") a.partial.push(r.activity);
    agg.set(it.def.id, a);
  }
  for (const a of agg.values()) {
    if (!a.notMet.length && !a.partial.length) continue;
    push({
      key: `ROPA-CHK-${a.item.def.id}`, scope: "RoPA",
      severity: a.notMet.length ? (HIGH_GROUPS.has(a.item.def.group) ? "High" : "Medium") : "Low",
      title: `${a.item.def.name} (${a.item.def.ref}): not met in ${a.notMet.length} and partial in ${a.partial.length} of ${a.of} activities`,
      detail: [a.notMet.length && `Not met: ${a.notMet.join(", ")}.`, a.partial.length && `Partial: ${a.partial.join(", ")}.`].filter(Boolean).join(" "),
      recommendation: "Open each listed RoPA activity and complete this checklist item, recording how it is met.",
      href: "/ropa",
    });
  }

  // 3. RoPA activity gaps
  for (const r of i.ropa) {
    if (r.crossBorder && !r.crossBorderCountry)
      push({ key: `ROPA-${r.id}-XB`, scope: "RoPA", severity: "High", title: `Cross-border transfer declared but no destination country for "${r.activity}"`, detail: "Sec 16 checks cannot be done without the destination.", recommendation: "Edit the activity and enter the destination country.", href: "/ropa" });
    if (!r.hasSecurity)
      push({ key: `ROPA-${r.id}-SC`, scope: "RoPA", severity: "High", title: `No security safeguards evidenced for "${r.activity}"`, detail: "None of the Rule 6 checklist items is Met or Partial.", recommendation: "Complete the security items in the activity's checklist.", href: "/ropa" });
    if (!i.dpiaRopaIds.has(r.id) && (i.org.isSDF || r.risk.level === "High"))
      push({ key: `ROPA-${r.id}-DPIA`, scope: "RoPA", severity: i.org.isSDF ? "High" : "Medium", title: `${r.risk.level}-risk activity "${r.activity}" has no DPIA`, detail: r.risk.factors.map((f) => f.label).join("; "), recommendation: "Generate or add a DPIA for this activity, then review and approve it.", href: "/dpia" });
  }

  // 4. Vendors and sub-processors
  for (const v of i.vendors) {
    if (!v.hasContract) push({ key: `VEN-${v.id}-DPA`, scope: "Vendor", severity: "Critical", title: `Vendor "${v.name}" has no DPA / Sec 8(2) contract`, detail: "A Data Processor may only be engaged under a valid contract.", recommendation: "Execute a DPA before sharing more personal data, then tick DPA on the vendor.", href: "/vendors" });
    if (v.securityControls.length === 0) push({ key: `VEN-${v.id}-SEC`, scope: "Vendor", severity: "High", title: `Vendor "${v.name}" has no documented security controls`, detail: "Rule 6 safeguards must also bind processors.", recommendation: "Collect the vendor's attestation and tick the controls it confirms.", href: "/vendors" });
    else if (!v.securityControls.some((c) => c.startsWith("Encryption at rest"))) push({ key: `VEN-${v.id}-ENC`, scope: "Vendor", severity: "High", title: `Vendor "${v.name}" does not confirm encryption at rest`, detail: "Rule 6(1)(a).", recommendation: "Ask the vendor to enable encryption at rest and verify by attestation or audit.", href: "/vendors" });
    if (!v.breachClause) push({ key: `VEN-${v.id}-BC`, scope: "Vendor", severity: "Medium", title: `Vendor "${v.name}" has no breach-notification clause`, detail: "You must report breaches without delay, so the vendor must tell you quickly.", recommendation: "Add a breach-notification clause, typically within 24 hours.", href: "/vendors" });
    if (!v.dsrContact) push({ key: `VEN-${v.id}-DSR`, scope: "Vendor", severity: "Medium", title: `Vendor "${v.name}" has no DSR contact`, detail: "Rights requests may need to reach the vendor.", recommendation: "Record a DSR contact, channel and SLA.", href: "/vendors" });
    if (!v.lastReview || i.now.getTime() - v.lastReview.getTime() > YEAR)
      push({ key: `VEN-${v.id}-REV`, scope: "Vendor", severity: v.riskTier === "HIGH" ? "Medium" : "Low", title: `Vendor "${v.name}" review is overdue`, detail: v.lastReview ? "Last reviewed more than 12 months ago." : "Never reviewed.", recommendation: "Review the vendor and record the date.", href: "/vendors" });
    for (const s of v.subProcessors) if (!s.dpaSigned)
      push({ key: `SUB-${s.id}-DPA`, scope: "Sub-Processor", severity: "High", title: `Sub-processor "${s.name}" (via ${v.name}) has no flow-down DPA`, detail: "Safeguards must flow down the whole chain (Sec 8(2)).", recommendation: "Have the vendor sign a downstream DPA, then mark it on the sub-processor.", href: "/vendors" });
  }

  // 5. Applications
  for (const a of i.assets) {
    if (a.sourcing === "OUTSOURCED" && !a.vendorId) push({ key: `APP-${a.id}-VEN`, scope: "Application", severity: "Medium", title: `Outsourced application "${a.name}" has no vendor`, detail: "Outsourced systems need a linked vendor.", recommendation: "Edit the application and add the vendor.", href: "/apps" });
    if (a.storesPersonalData && a.ropaCount === 0) push({ key: `APP-${a.id}-ROPA`, scope: "Application", severity: "Medium", title: `"${a.name}" holds personal data but has no RoPA activity`, detail: "It is missing from your record of processing.", recommendation: "Use Build RoPA from apps, or add an activity and link the application.", href: "/ropa" });
    if (a.storesPersonalData && a.piiFieldCount === 0) push({ key: `APP-${a.id}-PII`, scope: "Application", severity: "Low", title: `"${a.name}" is marked as holding personal data but lists no PII fields`, detail: "The data inventory is incomplete.", recommendation: "Select the PII fields it collects.", href: "/apps" });
  }

  // 6. Departments
  for (const d of i.departments) {
    if (!d.spocName) push({ key: `DEPT-${d.id}-SPOC`, scope: "Department", severity: "High", title: `Department "${d.name}" has no SPOC`, detail: "Each department needs one privacy contact.", recommendation: "Assign a SPOC with an email address.", href: "/departments" });
    else if (!d.spocEmail) push({ key: `DEPT-${d.id}-SPOCMAIL`, scope: "Department", severity: "Medium", title: `SPOC for "${d.name}" has no email address`, detail: "They cannot be reached for requests or incidents.", recommendation: "Add the SPOC's email.", href: "/departments" });
    for (const c of d.contacts ?? []) {
      if (!c.name || !c.email) push({ key: `DEPT-${d.id}-CONTACT-${c.id}`, scope: "Department", severity: !c.name ? "High" : "Medium", title: `Sub-function "${c.subFunction}" in "${d.name}" has an incomplete SPOC`, detail: "Each recorded sub-function needs a named contact and email.", recommendation: "Edit the department and complete the sub-function's SPOC details.", href: "/departments" });
    }
  }

  // 7. Breach register (Sec 8(6), Rule 7). The 24h and 72h thresholds are working defaults for review.
  const HOUR = 3600 * 1000;
  for (const b of i.breaches) {
    const age = i.now.getTime() - b.detectedAt.getTime();
    if (!b.detailedReportAt && age > 72 * HOUR)
      push({ key: `BRE-${b.id}-72H`, scope: "Breach", severity: "Critical", title: `Detailed report to the Board overdue for breach "${b.title}"`, detail: "The detailed report is due within 72 hours of becoming aware of the breach (Rule 7).", recommendation: "File the detailed report with the Board now and record the date in the Breach Register.", href: "/breaches" });
    if (!b.boardIntimatedAt && age > 24 * HOUR)
      push({ key: `BRE-${b.id}-BOARD`, scope: "Breach", severity: "High", title: `Board not yet told about breach "${b.title}"`, detail: "The Board must be told without delay (Sec 8(6), Rule 7).", recommendation: "Intimate the Board and record the date.", href: "/breaches" });
    if (!b.principalsIntimatedAt && age > 72 * HOUR)
      push({ key: `BRE-${b.id}-DP`, scope: "Breach", severity: "High", title: `Affected Data Principals not yet told about breach "${b.title}"`, detail: "Each affected Data Principal must be told without delay (Sec 8(6), Rule 7).", recommendation: "Notify the affected individuals and record the date.", href: "/breaches" });
  }

  if (i.pendingConsentWithdrawals) push({
    key: "CONSENT-WITHDRAWALS", scope: "Consent", severity: "High",
    title: `${i.pendingConsentWithdrawals} consent withdrawal follow-up task(s) await acknowledgement`,
    detail: "Customer choices have been recorded, but stopping consent-based processing in the relevant systems has not yet been acknowledged.",
    recommendation: "Review each pending system or processor task and record the action taken or applicable lawful retention exception.",
    href: "/consent/records",
  });

  // 8. Organisation and governance
  if (!i.org.dpoEmail) push({ key: "ORG-DPO", scope: "Organisation", severity: "High", title: "No DPO / contact person recorded", detail: "Business contact details must be published (Sec 8(9)).", recommendation: "Add the contact in Organisation Setup.", href: "/org" });
  if (!i.org.grievanceEmail) push({ key: "ORG-GRIEV", scope: "Organisation", severity: "Medium", title: "No grievance contact recorded", detail: "A grievance redressal route is required (Sec 8(10)).", recommendation: "Add a grievance email in Organisation Setup.", href: "/org" });
  if (i.committee.length === 0) push({ key: "ORG-COMM", scope: "Organisation", severity: "High", title: "No DPDPA steering committee constituted", detail: "Nobody is accountable for decisions yet.", recommendation: "Add senior members on the Committee page.", href: "/committee" });
  else {
    const missing = COVERAGE.filter((c) => !i.committee.some((m) => m.designation && c.match.test(m.designation))).map((c) => c.name);
    if (missing.length) push({ key: "ORG-COV", scope: "Organisation", severity: "Low", title: `Committee does not yet cover: ${missing.join(", ")}`, detail: "Guidance for a well-rounded committee, not a legal requirement.", recommendation: "Add members for the missing functions.", href: "/committee" });
  }
  if (i.org.isSDF) {
    if (!i.committee.some((m) => m.designation && /\((DPO|CPO)\)/.test(m.designation)))
      push({ key: "SDF-DPO", scope: "Organisation (SDF)", severity: "Critical", title: "Significant Data Fiduciary has no DPO on the committee", detail: "A DPO based in India is required (Sec 10(2)(a)).", recommendation: "Add the DPO to the Committee.", href: "/committee" });
    if (i.approvedDpiaCount === 0)
      push({ key: "SDF-DPIA", scope: "Organisation (SDF)", severity: "High", title: "No approved DPIA yet", detail: "SDFs must carry out periodic DPIAs (Sec 10(2)(c)).", recommendation: "Generate DPIAs from the RoPA, then review and approve them.", href: "/dpia" });
  }

  return out.sort((a, b) => SEV_WEIGHT[b.severity] - SEV_WEIGHT[a.severity] || a.scope.localeCompare(b.scope) || a.title.localeCompare(b.title));
}

export type GapStatusKey = "OPEN" | "IN_PROGRESS" | "ADDRESSED" | "ACCEPTED";
export const isClosed = (s: GapStatusKey | undefined) => s === "ADDRESSED" || s === "ACCEPTED";
