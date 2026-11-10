import { can } from "./rbac";
import { legalBasisLabel } from "./enums";

export const DPIA_STATUSES = ["DRAFT", "UNDER_REVIEW", "APPROVED", "REJECTED"] as const;
export type DpiaStatusKey = (typeof DPIA_STATUSES)[number];
export const DPIA_LABELS: Record<DpiaStatusKey, string> = {
  DRAFT: "Draft", UNDER_REVIEW: "Under review", APPROVED: "Approved", REJECTED: "Rejected",
};

/** A DPIA is warranted for medium/high risk activities, and (as a cautious default) for every activity of a notified SDF. */
export const dpiaNeeded = (level: string, isSDF: boolean) => isSDF || level !== "Low";

const MITIGATIONS: Record<string, string> = {
  sensitive: "Encrypt this data, restrict access by role, and cut the high-impact fields down to the minimum needed (Sec 8(5), Rule 6).",
  financial: "Tokenise or mask financial identifiers and limit access to those who need them (Rule 6(1)(a), (b)).",
  children: "Verify the parent or guardian before collecting, and switch off tracking, behavioural monitoring and targeted advertising for children (Sec 9, Rule 10).",
  crossborder: "Keep a register of transfers abroad and check the destination against the Government's restrictions before any change (Sec 16, Rule 15).",
  profiling: "Document an algorithmic risk review showing that the analytics or tracking does not put Data Principals' rights at risk (Sec 10(2)).",
  vendors: "Confirm a signed contract with every vendor covering safeguards, breach reporting and erasure (Sec 8(2), Rule 6(1)(f)).",
  customer: "Set a retention schedule for customer data with time-bound erasure and an easy way to withdraw consent (Sec 8(7), Rule 8).",
  nobasis: "Record a lawful basis, consent under Sec 6 or a specific Sec 7 use, before processing continues (Sec 4).",
  nosecurity: "Record and put in place the Rule 6 safeguards for this activity: encryption, access control, logging and backups (Rule 6).",
};
const BASELINE = "Maintain the baseline notice, consent, minimisation and security safeguards for this activity.";

export function mitigationsFor(factorKeys: string[]): string[] {
  const out = factorKeys.map((k) => MITIGATIONS[k]).filter(Boolean);
  return out.length ? out : [BASELINE];
}

export function necessityText(r: { purpose: string; purposeCategory: string | null; legalBasis: string }) {
  return `Processing supports: ${r.purpose || r.purposeCategory || "a stated business purpose"}. Lawful basis: ${legalBasisLabel(r.legalBasis)}. Explain why this processing is needed and why a less intrusive approach would not meet the purpose.`;
}

export function proportionalityText(fields: number, categories: number) {
  return `${fields} personal-data field(s) across ${categories} categor${categories === 1 ? "y" : "ies"}. Confirm each field is necessary for the purpose (Sec 6(1)) and that no more is collected or kept than needed.`;
}

export function residualFor(level: string): { level: "LOW" | "MEDIUM" | "HIGH"; note: string } {
  if (level === "High") return { level: "HIGH", note: "High: needs sign-off from the DPO or committee before and during processing." };
  if (level === "Medium") return { level: "MEDIUM", note: "Medium: monitor and reassess periodically." };
  return { level: "LOW", note: "Low: acceptable with the baseline controls." };
}

/** Anyone who can edit data may move a DPIA through draft and review; approving or rejecting needs an admin. */
export function canSetDpiaStatus(role: string, status: string): boolean {
  if (status === "APPROVED" || status === "REJECTED") return can(role, "edit_org");
  return can(role, "edit_data");
}
