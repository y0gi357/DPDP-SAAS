import { rolesLabel } from "./departments";
// Builds one format-neutral document model; report-docx.ts and report-pdf.ts both render it.
import type { Loaded } from "./snapshot";
import { flowSnapshot } from "./snapshot";
import { buildSteps, progressOf } from "./flow";
import { tally, STATUS_LABELS } from "./controls";
import { SEV_WEIGHT, isClosed, type GapStatusKey } from "./gaps";
import { legalBasisLabel, VENDOR_ROLE_LABELS, ROPA_ROLE_LABELS, ASSET_TYPE_LABELS } from "./enums";
import { categoryLabel } from "./pii";
import { CMP_ITEMS, CMP_LABELS } from "./notice";
import { cmEvidenceRows } from "./cm-readiness";
import { DPIA_LABELS } from "./dpia";

export type Block =
  | { kind: "p"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][]; widths?: number[] }
  | { kind: "kv"; rows: [string, string][] };
export type Section = { title: string; blocks: Block[] };
export type ReportModel = { orgName: string; generatedOn: string; libLabel: string; score: number; sections: Section[]; disclaimer: string };

const d10 = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : "-");
const yn = (b: boolean) => (b ? "Yes" : "No");
const dash = (x: string | null | undefined) => (x && x.trim() ? x : "-");

export function buildReport(d: Loaded, now = new Date()): ReportModel {
  const { raw, org, gaps, trackingByKey, ownerOptions } = d;
  const ownerLabel = new Map(ownerOptions.map((o) => [o.value, o.label]));
  const stateOf = (k: string) => (trackingByKey.get(k)?.status ?? "OPEN") as GapStatusKey;
  const openGaps = gaps.filter((g) => !isClosed(stateOf(g.key)));
  const sev = (s: string) => openGaps.filter((g) => g.severity === s).length;

  const overall = tally(raw.controlRows.map((c) => c.status));
  const steps = buildSteps(flowSnapshot(d, now));
  const prog = progressOf(steps);
  const ropaScored = raw.assessed;
  const highRisk = ropaScored.filter((x) => x.a.risk.level === "High").length;
  const avgChecklist = ropaScored.length ? Math.round(ropaScored.reduce((a, x) => a + x.a.ev.pct, 0) / ropaScored.length) : 0;

  const S: Section[] = [];

  // 1 Executive summary
  const top = [...openGaps].sort((a, b) => SEV_WEIGHT[b.severity] - SEV_WEIGHT[a.severity]).slice(0, 5);
  S.push({
    title: "Executive Summary",
    blocks: [
      { kind: "p", text: `This report presents a self-assessment of ${org.name}'s readiness under the Digital Personal Data Protection Act, 2023 and the DPDP Rules, generated on ${d10(now)} from the records kept in the platform.` },
      { kind: "kv", rows: [
        ["Overall control score", `${overall.score}% (${overall.counts.IMPLEMENTED} implemented, ${overall.counts.PARTIAL} partial, ${overall.counts.PLANNED} planned, ${overall.counts.NOT_IMPLEMENTED + overall.counts.NOT_ASSESSED} not implemented or not yet assessed, ${overall.counts.NOT_APPLICABLE} not applicable)`],
        ["Implementation roadmap", `${prog.done} of ${prog.total} applicable steps complete (${prog.pct}%)`],
        ["Open gaps", `${openGaps.length}: ${sev("Critical")} critical, ${sev("High")} high, ${sev("Medium")} medium, ${sev("Low")} low`],
        ["Processing activities", `${ropaScored.length} recorded, ${highRisk} high risk, average checklist ${avgChecklist}%`],
        ["DPIAs", `${raw.dpias.filter((x) => x.status === "APPROVED").length} approved of ${raw.dpias.length}`],
        ["Breaches recorded", String(raw.breaches.length)],
      ] },
      top.length ? { kind: "p", text: "Priority actions:" } : { kind: "p", text: "No open gaps were detected." },
      ...(top.length ? [{ kind: "bullets" as const, items: top.map((g) => `${g.severity}: ${g.title}`) }] : []),
    ],
  });

  // 2 Roadmap
  S.push({
    title: "Implementation Status",
    blocks: [{ kind: "table", head: ["#", "Step", "Status", "Detail"], widths: [0.06, 0.28, 0.14, 0.52],
      rows: steps.map((x) => [String(x.n), x.title, x.status === "done" ? "Done" : x.status === "progress" ? "In progress" : x.status === "na" ? "Not applicable" : "Not started", x.detail]) }],
  });

  // 3 Organisation + governance
  S.push({
    title: "Organisation Profile",
    blocks: [{ kind: "kv", rows: [
      ["Organisation", org.name], ["Legal name", dash(org.legalName)], ["Registration no.", dash(org.registrationNo)], ["Industry", dash(org.industry)],
      ["Role under the Act", [org.actsAsFiduciary && "Data Fiduciary", org.actsAsProcessor && "Data Processor"].filter(Boolean).join(" and ") || "-"],
      ["Significant Data Fiduciary", yn(org.isSDF)], ["Processes children's data", yn(org.handlesChildrenData)], ["Transfers data abroad", yn(org.transfersAbroad)],
      ["DPO / contact", `${dash(org.dpoName)} (${dash(org.dpoEmail)})`], ["Grievance contact", dash(org.grievanceEmail)],
    ] }],
  });
  S.push({
    title: "Steering Committee",
    blocks: raw.committee.length ? [{ kind: "table", head: ["Name", "Designation", "Function", "Email"], rows: raw.committee.map((m) => [m.name, dash(m.designation), dash(m.function), dash(m.email)]) }] : [{ kind: "p", text: "No committee members recorded." }],
  });
  S.push({
    title: "Departments and SPOCs",
    blocks: raw.departments.length ? [{ kind: "table", head: ["Department / Head", "Sub-function / Roles", "SPOC / Designation", "Email / Phone", "Responsibilities"], rows: raw.departments.flatMap((d) => d.contacts.length ? d.contacts.map((c) => [`${d.name} / ${dash(d.headName)}\n${rolesLabel(d.roles)}`, `${c.subFunction}\n${rolesLabel(c.roles)}`, `${c.name || "Not assigned"}${c.isPrimary ? " (Primary)" : ""}\n${dash(c.designation)}`, `${dash(c.email)}\n${dash(c.phone)}`, dash(c.responsibilities)]) : [[`${d.name} / ${dash(d.headName)}\n${rolesLabel(d.roles)}`, "No sub-functions", dash(d.spocName), dash(d.spocEmail), "-"]]) }] : [{ kind: "p", text: "No departments recorded." }],
  });

  // Inventory
  S.push({
    title: "Applications and Data Sources",
    blocks: raw.assets.length ? [{ kind: "table", head: ["Application", "Type", "Department", "Sourcing", "Hosting", "Data categories"], widths: [0.18, 0.14, 0.16, 0.18, 0.14, 0.2],
      rows: raw.assets.map((a) => [a.name, ASSET_TYPE_LABELS[a.type] ?? a.type, dash(a.department?.name), a.sourcing === "IN_HOUSE" ? "In-house" : `Vendor: ${dash(a.vendor?.name)}`, `${dash(a.hostingLocation)}${a.hostedInIndia ? "" : " (outside India)"}`, a.dataCategories.map(categoryLabel).join(", ") || "-"]) }] : [{ kind: "p", text: "No applications recorded." }],
  });

  // RoPA
  S.push({
    title: "Record of Processing Activities",
    blocks: ropaScored.length ? [{ kind: "table", head: ["Activity", "Department", "Role", "Basis", "Vendors", "Checklist", "Risk"], widths: [0.2, 0.13, 0.11, 0.16, 0.14, 0.12, 0.14],
      rows: ropaScored.map(({ r, a }) => [r.activity, dash(r.department?.name), ROPA_ROLE_LABELS[r.role], legalBasisLabel(r.legalBasis), r.vendors.map((v) => v.vendor.name).join(", ") || "-", `${a.ev.pct}%`, `${a.risk.level} (${a.risk.score})`]) }] : [{ kind: "p", text: "No processing activities recorded." }],
  });
  const byBasis = new Map<string, number>();
  for (const { r } of ropaScored) byBasis.set(r.legalBasis, (byBasis.get(r.legalBasis) ?? 0) + 1);
  S.push({
    title: "Lawful Basis Distribution",
    blocks: byBasis.size ? [{ kind: "table", head: ["Lawful basis", "Activities"], rows: [...byBasis.entries()].map(([k, v]) => [legalBasisLabel(k), String(v)]) }] : [{ kind: "p", text: "No processing activities recorded." }],
  });

  // Vendors
  S.push({
    title: "Vendors and Processors",
    blocks: raw.vendors.length ? [{ kind: "table", head: ["Vendor", "Role", "Country", "DPA", "Sub-processors", "Risk", "Last review"], widths: [0.18, 0.16, 0.11, 0.13, 0.17, 0.11, 0.14],
      rows: raw.vendors.map((v) => [v.name, VENDOR_ROLE_LABELS[v.role] ?? v.role, dash(v.country), v.hasContract ? "Signed" : "Missing", `${v.subProcessors.length}${v.subProcessors.some((p) => !p.dpaSigned) ? " (DPA gap)" : ""}`, v.riskTier, d10(v.lastReview)]) }] : [{ kind: "p", text: "No vendors recorded." }],
  });

  // DPIA
  S.push({
    title: "DPIA Register",
    blocks: raw.dpias.length ? [{ kind: "table", head: ["Activity", "Risk", "Status", "Residual", "Approved by", "Date"], widths: [0.26, 0.12, 0.14, 0.12, 0.22, 0.14],
      rows: raw.dpias.map((x) => [x.activity, `${x.riskLevel} (${x.riskScore})`, DPIA_LABELS[x.status], x.residualLevel, x.approverRef ? (d.ownerOptions.find((o) => o.value === x.approverRef)?.label ?? "Committee member") : "-", d10(x.approvedAt)]) }] : [{ kind: "p", text: "No DPIAs recorded." }],
  });

  // Controls by section
  const sections = [...new Map(raw.controlRows.map((c) => [c.sectionKey, c.sectionTitle])).entries()];
  S.push({
    title: "Controls Coverage",
    blocks: [{ kind: "table", head: ["Section", "Impl.", "Partial", "Planned", "Not impl.", "N/A", "Score"], widths: [0.37, 0.09, 0.1, 0.1, 0.12, 0.08, 0.14],
      rows: sections.map(([k, title]) => {
        const t = tally(raw.controlRows.filter((c) => c.sectionKey === k).map((c) => c.status));
        return [title, String(t.counts.IMPLEMENTED), String(t.counts.PARTIAL), String(t.counts.PLANNED), String(t.counts.NOT_IMPLEMENTED + t.counts.NOT_ASSESSED), String(t.counts.NOT_APPLICABLE), `${t.score}%`];
      }) }],
  });

  // Gaps
  const prio = openGaps.filter((g) => g.severity === "Critical" || g.severity === "High").slice(0, 30);
  S.push({
    title: "Priority Gaps and Recommendations",
    blocks: prio.length ? [
      { kind: "p", text: `Open critical and high gaps${openGaps.filter((g) => g.severity === "Critical" || g.severity === "High").length > prio.length ? ` (top ${prio.length} shown)` : ""}.` },
      { kind: "table", head: ["Severity", "Gap", "Recommendation", "Status", "Owner", "Due"], widths: [0.1, 0.3, 0.28, 0.1, 0.12, 0.1],
        rows: prio.map((g) => { const t = trackingByKey.get(g.key); return [g.severity, g.title, g.recommendation, stateOf(g.key).replace("_", " ").toLowerCase(), (t?.owners ?? []).map((o) => ownerLabel.get(o) ?? o).join("; ") || "-", d10(t?.dueDate)]; }) },
    ] : [{ kind: "p", text: "No open critical or high gaps." }],
  });
  const tracked = gaps.filter((g) => { const t = trackingByKey.get(g.key); return t && (t.status !== "OPEN" || t.owners.length || t.dueDate); }).slice(0, 60);
  S.push({
    title: "Remediation Plan",
    blocks: tracked.length ? [{ kind: "table", head: ["Gap", "Status", "Owner", "Due", "Notes"], widths: [0.32, 0.12, 0.18, 0.1, 0.28],
      rows: tracked.map((g) => { const t = trackingByKey.get(g.key)!; return [g.title, t.status.replace("_", " ").toLowerCase(), t.owners.map((o) => ownerLabel.get(o) ?? o).join("; ") || "-", d10(t.dueDate), dash(t.notes)]; }) }] : [{ kind: "p", text: "No remediation work has been assigned yet." }],
  });

  // Breaches
  S.push({
    title: "Personal Data Breach Register",
    blocks: raw.breaches.length ? [{ kind: "table", head: ["Detected", "Breach", "Affected", "Board told", "Principals told", "72h report", "Status"], widths: [0.12, 0.26, 0.1, 0.13, 0.13, 0.13, 0.13],
      rows: raw.breaches.map((b) => [d10(b.detectedAt), b.title, b.principalsAffected == null ? "-" : String(b.principalsAffected), d10(b.boardIntimatedAt), d10(b.principalsIntimatedAt), d10(b.detailedReportAt), b.status.toLowerCase()]) }] : [{ kind: "p", text: "No breaches recorded." }],
  });

  S.push({
    title: "Consent Management Evidence",
    blocks: [
      { kind: "kv", rows: [
        ["Active consent purposes", String(raw.consentEvidence.activePurposes)],
        ["Enrolled customers", String(raw.consentEvidence.customers)],
        ["Decisions recorded (all history)", String(raw.consentEvidence.decisions)],
        ["Withdrawal tasks awaiting acknowledgement", String(raw.consentEvidence.pendingWithdrawals)],
      ] },
      { kind: "table", head: ["Fiduciary readiness", "Staff assessment"], rows: CMP_ITEMS.filter((i) => ["cm_receive", "cm_registered", "processor_withdrawals"].includes(i.id)).map((i) => {
        const value = (raw.consent?.cmp as Record<string, unknown> | null)?.[i.id];
        return [i.label, typeof value === "string" ? (CMP_LABELS[value] ?? "Not answered") : "Not answered"];
      }) },
      ...(() => { const rows = cmEvidenceRows(raw.consent?.cmp); return rows.length ? [{ kind: "kv" as const, rows }] : [{ kind: "p" as const, text: "No Consent Manager or processor routing readiness evidence recorded." }]; })(),
      { kind: "p", text: "Registration references and integration tests above were entered by staff. The platform has not checked the Board register or tested an external Consent Manager connection." },
      { kind: "p", text: "Counts are operational evidence, not proof that every processing activity has valid consent. Published notices and customer decisions retain their original versions. Withdrawal follow-up is manual; tasks do not stop processing in external systems automatically. This is business consent management, not evidence of Board registration as a Consent Manager." },
    ],
  });

  // Owner worklist
  const owners = new Map<string, { controls: number; open: number; gaps: number; due: Date | null }>();
  const bump = (o: string) => owners.get(o) ?? owners.set(o, { controls: 0, open: 0, gaps: 0, due: null }).get(o)!;
  for (const c of raw.controlRows) for (const o of c.owners) { const e = bump(o); e.controls++; if (c.status !== "IMPLEMENTED" && c.status !== "NOT_APPLICABLE") e.open++; }
  for (const g of openGaps) { const t = trackingByKey.get(g.key); for (const o of t?.owners ?? []) { const e = bump(o); e.gaps++; if (t?.dueDate && (!e.due || t.dueDate < e.due)) e.due = t.dueDate; } }
  S.push({
    title: "Owner Worklist",
    blocks: owners.size ? [{ kind: "table", head: ["Owner", "Controls owned", "Not yet implemented", "Open gaps assigned", "Earliest due"], widths: [0.36, 0.14, 0.18, 0.18, 0.14],
      rows: [...owners.entries()].map(([o, e]) => [ownerLabel.get(o) ?? "Former owner", String(e.controls), String(e.open), String(e.gaps), d10(e.due)]) }] : [{ kind: "p", text: "No owners have been assigned to controls or gaps yet." }],
  });

  // Annexure
  const acts = new Set(raw.controlRows.flatMap((c) => c.actRefs.map((r) => r.replace(/\(.*$/, "").trim())));
  S.push({
    title: "Annexure: Method and Limitations",
    blocks: [
      { kind: "bullets", items: [
        `Control scoring: Implemented counts 1, Partial 0.5, Planned 0.25; unset controls count against you; not applicable controls are excluded. Library: ${d.libLabel ?? "none"}, covering ${acts.size} Act sections or rules.`,
        "Applicability: controls are marked not applicable automatically from the organisation profile (role, SDF status, children's data); an explicit status overrides this.",
        "RoPA risk bands and gap severities are screening heuristics to prioritise work. They are not legal determinations.",
        "The 24-hour and 72-hour breach thresholds used to flag the register are working defaults; the 72-hour detailed report follows Rule 7.",
      ] },
    ],
  });

  return {
    orgName: org.name, generatedOn: d10(now), libLabel: d.libLabel ?? "-", score: overall.score, sections: S,
    disclaimer: "This report is a self-assessment generated from information entered in the platform. It is not legal advice. The control library wording is a working draft and should be reviewed by qualified counsel before the report is relied on or shared outside the organisation.",
  };
}
