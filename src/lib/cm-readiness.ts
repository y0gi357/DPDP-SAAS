import { z } from "zod";

// Evidence is saved inside ConsentConfig.cmp, so existing tenants need no schema migration.
// These are staff assessments; no registry lookup or external integration is performed.
export const CM_FIELDS = [
  { key: "managerName", label: "Consent Manager legal name", group: "registration", max: 200 },
  { key: "registrationRef", label: "Board registration number / reference", group: "registration", max: 200 },
  { key: "registryUrl", label: "Official Board listing / registration source URL", group: "registration", max: 500, type: "url" },
  { key: "checkedOn", label: "Registration checked on", group: "registration", max: 10, type: "date" },
  { key: "checkedBy", label: "Registration checked by", group: "registration", max: 200 },
  { key: "registrationEvidence", label: "Registration check evidence / document reference", group: "registration", max: 2000, type: "textarea" },
  { key: "integrationOwner", label: "Integration owner", group: "integration", max: 200 },
  { key: "consentChannel", label: "Channel / procedure for receiving consent", group: "integration", max: 500 },
  { key: "withdrawalChannel", label: "Channel / procedure for receiving withdrawals", group: "integration", max: 500 },
  { key: "integrationTestedOn", label: "Consent and withdrawal flow last tested on", group: "integration", max: 10, type: "date" },
  { key: "integrationEvidence", label: "Test evidence: sender validation, customer and purpose matching, consent receipt and withdrawal handling", group: "integration", max: 3000, type: "textarea" },
  { key: "routingOwner", label: "Processor withdrawal routing owner", group: "processors", max: 200 },
  { key: "processorRouting", label: "Relevant processors, notification channels and acknowledgement / escalation procedure", group: "processors", max: 3000, type: "textarea" },
  { key: "routingTimescale", label: "Internal routing timescale and lawful-processing exception procedure", group: "processors", max: 1000, type: "textarea" },
  { key: "routingTestedOn", label: "Processor routing last tested on", group: "processors", max: 10, type: "date" },
  { key: "routingEvidence", label: "Evidence of sending withdrawals and verifying processor cessation / acknowledgements", group: "processors", max: 3000, type: "textarea" },
  { key: "receiveNaReason", label: "Reason receiving CM instructions is not applicable", group: "integration", max: 1000, type: "textarea" },
  { key: "registrationNaReason", label: "Reason checking CM registration is not applicable", group: "registration", max: 1000, type: "textarea" },
  { key: "processorsNaReason", label: "Reason processor withdrawal routing is not applicable", group: "processors", max: 1000, type: "textarea" },
] as const;
export type CmFieldKey = (typeof CM_FIELDS)[number]["key"];
export type CmEvidence = Record<CmFieldKey, string>;
export const CM_GROUPS = [
  { key: "integration", title: "Receive Consent Manager instructions", help: "Document how your systems receive and authenticate consent and withdrawal instructions, identify the customer and purpose, retain receipts, and action withdrawals. Include test results for both flows." },
  { key: "registration", title: "Consent Manager registration check", help: "Record the official source you checked and the result, including any suspension or cancellation information. Saving this form does not verify registration or contact the Board." },
  { key: "processors", title: "Pass withdrawals to processors", help: "Document which processors must receive a withdrawal, who sends it, how cessation is confirmed, and how failures and lawful-processing exceptions are handled. The existing follow-up queue remains manual." },
] as const;
const REQUIREMENTS: Record<string, { fields: CmFieldKey[]; na: CmFieldKey }> = {
  cm_receive: { fields: ["integrationOwner", "consentChannel", "withdrawalChannel", "integrationTestedOn", "integrationEvidence"], na: "receiveNaReason" },
  cm_registered: { fields: ["managerName", "registrationRef", "registryUrl", "checkedOn", "checkedBy", "registrationEvidence"], na: "registrationNaReason" },
  processor_withdrawals: { fields: ["routingOwner", "processorRouting", "routingTimescale", "routingTestedOn", "routingEvidence"], na: "processorsNaReason" },
};
const object = (v: unknown): Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {};
export function readCmEvidence(cmp: unknown): CmEvidence {
  const raw = object(object(cmp)._cmReadiness);
  return Object.fromEntries(CM_FIELDS.map((f) => [f.key, typeof raw[f.key] === "string" ? raw[f.key] : ""])) as CmEvidence;
}
export function validateCmEvidence(raw: Record<string, unknown>, cmp: Record<string, string>, today = new Date().toISOString().slice(0, 10)): { ok: true; evidence: CmEvidence } | { ok: false; error: string } {
  const evidence = {} as CmEvidence;
  for (const f of CM_FIELDS) {
    const result = z.string().trim().max(f.max).safeParse(raw[f.key] ?? "");
    if (!result.success) return { ok: false, error: `${f.label}: use at most ${f.max} characters.` };
    const v = result.data;
    if ("type" in f && f.type === "date" && v && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v || v > today)) return { ok: false, error: `${f.label}: use a valid date that is not in the future.` };
    if ("type" in f && f.type === "url" && v) {
      try { const u = new URL(v); if (!["https:", "http:"].includes(u.protocol) || u.username || u.password) throw new Error(); }
      catch { return { ok: false, error: `${f.label}: use a full http:// or https:// URL without credentials.` }; }
    }
    evidence[f.key] = v;
  }
  for (const [id, rule] of Object.entries(REQUIREMENTS)) {
    if (cmp[id] === "YES") {
      const missing = rule.fields.find((key) => !evidence[key]);
      if (missing) return { ok: false, error: `Before marking this readiness item In place, add: ${CM_FIELDS.find((f) => f.key === missing)!.label}.` };
    }
    if (cmp[id] === "NA" && !evidence[rule.na]) return { ok: false, error: CM_FIELDS.find((f) => f.key === rule.na)!.label + "." };
  }
  return { ok: true, evidence };
}

/** Plain text evidence for controls and format-neutral reports; never claims automatic verification. */
export function cmEvidenceRows(cmp: unknown): [string, string][] {
  const evidence = readCmEvidence(cmp);
  return CM_FIELDS.filter((f) => evidence[f.key]).map((f) => [f.label, evidence[f.key]]);
}

export function cmControlEvidence(cmp: unknown): Record<string, string[]> {
  const evidence = readCmEvidence(cmp);
  const result: Record<string, string[]> = {};
  for (const f of CM_FIELDS) if (evidence[f.key]) {
    const code = f.group === "processors" ? "DPDP-6-009" : "DPDP-R4-006";
    (result[code] ??= []).push(`Recorded readiness evidence — ${f.label}: ${evidence[f.key]}`);
  }
  return result;
}
