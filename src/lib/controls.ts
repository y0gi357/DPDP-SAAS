// Controls assessment: statuses, scoring and automatic applicability. Pure functions (client-safe).
export const STATUSES = ["IMPLEMENTED", "PARTIAL", "PLANNED", "NOT_IMPLEMENTED", "NOT_APPLICABLE"] as const;
export type SetStatus = (typeof STATUSES)[number];
export type AnyStatus = SetStatus | "NOT_ASSESSED";

export const STATUS_LABELS: Record<AnyStatus, string> = {
  IMPLEMENTED: "Implemented",
  PARTIAL: "Partially implemented",
  PLANNED: "Planned",
  NOT_IMPLEMENTED: "Not implemented",
  NOT_APPLICABLE: "Not applicable",
  NOT_ASSESSED: "Not set",
};

// Partial earns half, Planned a quarter. Unset counts as not implemented.
const WEIGHT: Record<AnyStatus, number> = { IMPLEMENTED: 1, PARTIAL: 0.5, PLANNED: 0.25, NOT_IMPLEMENTED: 0, NOT_APPLICABLE: 0, NOT_ASSESSED: 0 };

export type OrgProfile = { actsAsFiduciary: boolean; actsAsProcessor: boolean; isSDF: boolean; handlesChildrenData: boolean };

/** Why a control does not apply to this organisation, or null if it does. */
export function autoNa(audience: string[], org: OrgProfile): string | null {
  if (audience.includes("CM")) return "Applies only to registered Consent Managers";
  if (audience.includes("SDF") && !org.isSDF) return "Applies only to notified Significant Data Fiduciaries";
  if (audience.includes("CHILDREN") && !org.handlesChildrenData) return "Your profile says you do not process children's data";
  const fid = org.actsAsFiduciary && audience.includes("FIDUCIARY");
  const proc = org.actsAsProcessor && audience.includes("PROCESSOR");
  if (!fid && !proc) return "A Data Fiduciary duty; your profile says you act only as a Data Processor";
  return null;
}

/** An explicit status always wins; otherwise an unset control that cannot apply is N/A automatically. */
export function effective(saved: string | null | undefined, audience: string[], org: OrgProfile): { status: AnyStatus; auto: boolean; reason: string | null } {
  const reason = autoNa(audience, org);
  const explicit = saved && saved !== "NOT_ASSESSED" ? (saved as AnyStatus) : null;
  if (explicit) return { status: explicit, auto: false, reason };
  if (reason) return { status: "NOT_APPLICABLE", auto: true, reason };
  return { status: "NOT_ASSESSED", auto: false, reason: null };
}

export type Tally = { score: number; applicable: number; total: number; counts: Record<AnyStatus, number> };

export function tally(statuses: AnyStatus[]): Tally {
  const counts: Record<AnyStatus, number> = { IMPLEMENTED: 0, PARTIAL: 0, PLANNED: 0, NOT_IMPLEMENTED: 0, NOT_APPLICABLE: 0, NOT_ASSESSED: 0 };
  let pts = 0;
  for (const s of statuses) { counts[s]++; pts += WEIGHT[s]; }
  const applicable = statuses.length - counts.NOT_APPLICABLE;
  return { score: applicable ? Math.round((pts / applicable) * 100) : 0, applicable, total: statuses.length, counts };
}
