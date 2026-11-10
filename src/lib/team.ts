// Rules for who may change whose role. Pure, so the same checks guard the page and the server action.
export const ROLES = ["OWNER", "ADMIN", "SPOC", "AUDITOR"] as const;
export type RoleName = (typeof ROLES)[number];
export const INVITABLE: RoleName[] = ["ADMIN", "SPOC", "AUDITOR"];
export const ROLE_LABELS: Record<RoleName, string> = { OWNER: "Owner", ADMIN: "Admin", SPOC: "SPOC (contributor)", AUDITOR: "Auditor (read-only)" };

export type Verdict = { ok: true } | { ok: false; reason: string };
const no = (reason: string): Verdict => ({ ok: false, reason });

export function canChangeRole(a: { actorRole: string; actorMembershipId: string; targetMembershipId: string; targetRole: string; newRole: string; ownerCount: number }): Verdict {
  if (!ROLES.includes(a.newRole as RoleName)) return no("Unknown role.");
  if (a.actorMembershipId === a.targetMembershipId) return no("You cannot change your own role.");
  if (a.actorRole !== "OWNER" && a.actorRole !== "ADMIN") return no("Only owners and admins can change roles.");
  if (a.actorRole === "ADMIN" && (a.targetRole === "OWNER" || a.newRole === "OWNER")) return no("Only an owner can grant or change the owner role.");
  if (a.targetRole === "OWNER" && a.newRole !== "OWNER" && a.ownerCount <= 1) return no("An organisation needs at least one owner.");
  return { ok: true };
}

export function canRemove(a: { actorRole: string; actorMembershipId: string; targetMembershipId: string; targetRole: string; ownerCount: number }): Verdict {
  if (a.actorRole !== "OWNER" && a.actorRole !== "ADMIN") return no("Only owners and admins can remove members.");
  if (a.actorMembershipId === a.targetMembershipId) return no("You cannot remove yourself. Ask another owner or admin.");
  if (a.actorRole === "ADMIN" && a.targetRole === "OWNER") return no("Only an owner can remove an owner.");
  if (a.targetRole === "OWNER" && a.ownerCount <= 1) return no("An organisation needs at least one owner.");
  return { ok: true };
}

export function canInvite(actorRole: string, role: string): Verdict {
  if (actorRole !== "OWNER" && actorRole !== "ADMIN") return no("Only owners and admins can invite people.");
  if (!INVITABLE.includes(role as RoleName)) return no("Invite as admin, SPOC or auditor. Promote to owner afterwards.");
  return { ok: true };
}
