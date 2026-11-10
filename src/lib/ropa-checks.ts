// Per-activity compliance checklist for the RoPA. Pure functions, no imports:
// the client form and the server action evaluate the same rules.
// Item wording is a working draft: have counsel review it against the Act and the current Rules.

export type Status = "Met" | "Partial" | "Not met" | "N/A";
export const MANUAL_STATUSES = ["Met", "Partial", "Not met"] as const;

export type Ctx = {
  isProcessor: boolean; // we process on behalf of another fiduciary
  isConsent: boolean;   // lawful basis is consent (Sec 6) rather than a Sec 7 legitimate use
  hasVendors: boolean;
  hasChild: boolean;
  crossBorder: boolean;
};

export type EvalInput = {
  ctx: Ctx;
  lawfulBasis: string | null;
  retention: string | null;
  saved: Record<string, string>;
};

type Def = {
  id: string;
  group: string;
  name: string;
  ref: string;
  recommended?: boolean;
  na?: (c: Ctx) => string | null;
  auto?: (i: EvalInput) => Status | null;
  derive?: (i: EvalInput) => Status | null;
  lib?: string[]; // control codes in the controls library that this item is evidence for
};

const processorNa = (c: Ctx) => (c.isProcessor ? "Owned by the Data Fiduciary that engages you (Sec 8(2))" : null);
const consentNa = (c: Ctx) =>
  c.isProcessor ? "Owned by the Data Fiduciary that engages you (Sec 8(2))"
  : !c.isConsent ? "Not required: this activity relies on a Sec 7 legitimate use"
  : null;
const vendorNa = (c: Ctx) => (!c.hasVendors ? "No vendors linked to this activity" : null);

export const GROUPS = [
  { id: "basis", label: "Lawful basis & notice" },
  { id: "consent", label: "Consent" },
  { id: "purpose", label: "Purpose, minimisation & accuracy" },
  { id: "retention", label: "Retention & erasure" },
  { id: "rights", label: "Data Principal rights" },
  { id: "security", label: "Security safeguards (Rule 6)" },
  { id: "breach", label: "Breach readiness" },
  { id: "xborder", label: "Cross-border transfer" },
  { id: "extra", label: "Recommended practices" },
] as const;

export const DEFS: Def[] = [
  { id: "basis", lib: ["DPDP-4-003"], group: "basis", name: "Lawful basis recorded for this activity", ref: "Sec 4", auto: (i) => (i.lawfulBasis ? "Met" : null) },
  { id: "notice", lib: ["DPDP-5-001", "DPDP-6-003"], group: "basis", name: "Notice given with or before the consent request, in plain language", ref: "Sec 5(1), Rule 3", na: consentNa },

  { id: "c_prove", lib: ["DPDP-6-001", "DPDP-6-010"], group: "consent", name: "Consent is free, specific, informed and recorded so it can be proved", ref: "Sec 6(1), 6(10)", na: consentNa },
  { id: "c_withdraw", lib: ["DPDP-6-007"], group: "consent", name: "Withdrawing consent is as easy as giving it", ref: "Sec 6(4)", na: consentNa },
  { id: "c_child", lib: ["DPDP-9-001", "DPDP-9-003"], group: "consent", name: "Verifiable parent / guardian consent before processing a child's data", ref: "Sec 9(1), Rule 10", na: (c) => processorNa(c) ?? (!c.hasChild ? "No children's data in this activity" : null) },

  { id: "p_limit", lib: ["DPDP-4-001"], group: "purpose", name: "Data is used only for the stated purpose", ref: "Sec 4, 6(1)" },
  { id: "p_min", lib: ["DPDP-6-002"], group: "purpose", name: "Only data necessary for the purpose is collected", ref: "Sec 6(1)" },
  { id: "p_acc", lib: ["DPDP-8-004"], group: "purpose", name: "Data is kept accurate and complete where it drives decisions or is shared", ref: "Sec 8(3)", na: processorNa },

  { id: "r_sched", lib: ["DPDP-8-017"], group: "retention", name: "Retention period defined and documented", ref: "Sec 8(7)", derive: (i) => (i.retention?.trim() ? "Partial" : null) },
  { id: "r_erase", lib: ["DPDP-8-017"], group: "retention", name: "Data erased when the purpose is served or consent is withdrawn; processors told to erase", ref: "Sec 8(7), Rule 8" },
  { id: "r_flow", lib: ["DPDP-8-017"], group: "retention", name: "Retention and erasure duties flow down to vendors", ref: "Sec 8(2), 8(7)", na: vendorNa },

  { id: "d_access", lib: ["DPDP-11-001"], group: "rights", name: "Data Principals can obtain a summary of their data and who it is shared with", ref: "Sec 11", na: processorNa },
  { id: "d_correct", lib: ["DPDP-12-001", "DPDP-12-002"], group: "rights", name: "Correction, completion, updating and erasure requests are handled", ref: "Sec 12", na: processorNa },
  { id: "d_griev", lib: ["DPDP-8-021", "DPDP-13-001"], group: "rights", name: "Grievance redressal in place, with responses inside the prescribed period", ref: "Sec 8(10), 13, Rule 14", na: processorNa },
  { id: "d_nominate", lib: ["DPDP-14-001"], group: "rights", name: "Nomination of another person to exercise rights is supported", ref: "Sec 14", na: processorNa },
  { id: "d_contact", lib: ["DPDP-8-020"], group: "rights", name: "Business contact of the DPO / designated person is published", ref: "Sec 8(9), Rule 9", na: processorNa },

  { id: "t_enc", lib: ["DPDP-8-007"], group: "security", name: "Personal data encrypted, masked or tokenised at rest", ref: "Rule 6(1)(a)" },
  { id: "t_transit", lib: ["DPDP-8-006"], group: "security", name: "Personal data encrypted in transit", ref: "Rule 6(1)(a)" },
  { id: "t_access", lib: ["DPDP-8-008"], group: "security", name: "Access restricted on a least-privilege basis", ref: "Rule 6(1)(b)" },
  { id: "t_mfa", lib: ["DPDP-8-008"], group: "security", name: "Multi-factor authentication for privileged and remote access", ref: "Rule 6(1)(b)" },
  { id: "t_logs", lib: ["DPDP-8-009"], group: "security", name: "Access logs and monitoring to detect unauthorised access", ref: "Rule 6(1)(c)" },
  { id: "t_backup", lib: ["DPDP-8-010"], group: "security", name: "Backups and continuity so data survives a compromise", ref: "Rule 6(1)(d)" },
  { id: "t_logret", lib: ["DPDP-8-011"], group: "security", name: "Logs and relevant data retained for at least one year for investigation", ref: "Rule 6(1)(e)" },
  { id: "t_contract", lib: ["DPDP-8-002", "DPDP-8-012"], group: "security", name: "Written contract with every processor covering these safeguards", ref: "Rule 6(1)(f), Sec 8(2)", na: vendorNa },
  { id: "t_toms", lib: ["DPDP-8-005", "DPDP-8-013"], group: "security", name: "Technical and organisational measures documented and reviewed", ref: "Rule 6(1)(g)" },

  { id: "b_plan", lib: ["DPDP-8-014"], group: "breach", name: "Breach response plan exists and has been exercised", ref: "Sec 8(6)" },
  { id: "b_notify", lib: ["DPDP-8-015", "DPDP-8-016"], group: "breach", name: "Can notify the Board and affected Data Principals, with a detailed report in 72 hours", ref: "Rule 7" },
  { id: "b_vendor", lib: ["DPDP-8-014"], group: "breach", name: "Vendors are obliged to report breaches to you promptly", ref: "Sec 8(2), 8(6)", na: vendorNa },

  { id: "x_check", lib: ["DPDP-16-001"], group: "xborder", name: "Transfer checked against any restriction notified by the Central Government", ref: "Sec 16, Rule 15", na: (c) => (!c.crossBorder ? "Data stays in India" : null) },

  { id: "e_vuln", group: "extra", name: "Vulnerability management programme", ref: "Good practice", recommended: true },
  { id: "e_vapt", group: "extra", name: "Periodic VAPT of systems holding this data", ref: "Good practice", recommended: true },
  { id: "e_edr", group: "extra", name: "Endpoint protection / EDR on devices that access this data", ref: "Good practice", recommended: true },
  { id: "e_dlp", group: "extra", name: "Data loss prevention controls", ref: "Good practice", recommended: true },
  { id: "e_sdlc", group: "extra", name: "Secure development lifecycle / privacy by design", ref: "Good practice", recommended: true },
];

export type ItemResult = {
  def: Def;
  status: Status;
  source: "na" | "auto" | "manual" | "derived";
  reason?: string;
};

export function evaluate(i: EvalInput) {
  const items: ItemResult[] = DEFS.map((def) => {
    const reason = def.na?.(i.ctx) ?? null;
    if (reason) return { def, status: "N/A", source: "na", reason };
    const auto = def.auto?.(i);
    if (auto) return { def, status: auto, source: "auto" };
    const sv = i.saved[def.id];
    if ((MANUAL_STATUSES as readonly string[]).includes(sv)) return { def, status: sv as Status, source: "manual" };
    const d = def.derive?.(i);
    if (d) return { def, status: d, source: "derived" };
    return { def, status: "Not met", source: "manual" };
  });

  const scored = items.filter((x) => !x.def.recommended && x.status !== "N/A");
  const count = (s: Status) => scored.filter((x) => x.status === s).length;
  const met = count("Met"), partial = count("Partial"), notMet = count("Not met");
  const pct = scored.length ? Math.round(((met + 0.5 * partial) / scored.length) * 100) : 100;
  const rec = items.filter((x) => x.def.recommended);
  const recMet = rec.filter((x) => x.status === "Met").length;

  return { items, met, partial, notMet, applicable: scored.length, pct, recMet, recTotal: rec.length };
}

const CHILD_FIELDS = new Set(["CHILD_NAME", "CHILD_DOB", "SCHOOL", "GUARDIAN", "PARENT_CONSENT"]);

export function buildCtx(
  r: { role: string; lawfulBasis: string; dataCategories: string[]; piiFields: string[]; principalCategory: string; crossBorder: boolean },
  vendorCountries: (string | null | undefined)[],
): Ctx {
  const abroad = vendorCountries.some((c) => c && c.trim() && c.trim().toLowerCase() !== "india");
  return {
    isProcessor: r.role === "DATA_PROCESSOR",
    isConsent: r.lawfulBasis === "CONSENT",
    hasVendors: vendorCountries.length > 0,
    hasChild:
      r.dataCategories.includes("CHILDREN") ||
      r.principalCategory.toLowerCase().startsWith("child") ||
      r.piiFields.some((f) => CHILD_FIELDS.has(f)),
    crossBorder: r.crossBorder || abroad,
  };
}

/** True when at least one Rule 6 safeguard is evidenced (Met or Partial). */
export function hasSecurityEvidence(items: ItemResult[]): boolean {
  return items.some((x) => x.def.id.startsWith("t_") && (x.status === "Met" || x.status === "Partial"));
}

/**
 * Aggregate checklist results from all RoPA activities into per-control evidence.
 * An activity counts as "met" for a control only if every checklist item mapped to it is Met.
 */
export type ControlEvidence = { met: number; applicable: number };
export function ropaLibEvidence(results: { items: ItemResult[] }[]): Record<string, ControlEvidence> {
  const out: Record<string, ControlEvidence & { seen: Set<number>; ok: Set<number> }> = {};
  results.forEach((res, idx) => {
    for (const it of res.items) {
      if (!it.def.lib || it.status === "N/A") continue;
      for (const code of it.def.lib) {
        const m = (out[code] ??= { met: 0, applicable: 0, seen: new Set(), ok: new Set() });
        if (m.seen.has(idx)) {
          if (it.status !== "Met" && m.ok.has(idx)) { m.ok.delete(idx); m.met--; }
          continue;
        }
        m.seen.add(idx); m.applicable++;
        if (it.status === "Met") { m.ok.add(idx); m.met++; }
      }
    }
  });
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { met: v.met, applicable: v.applicable }]));
}
