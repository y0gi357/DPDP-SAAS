export type Role = "OWNER" | "ADMIN" | "SPOC" | "AUDITOR";
export type Action =
  | "assess"
  | "edit_data" // apps, vendors, RoPA
  | "manage_members"
  | "view_audit_log"
  | "edit_org" // organisation profile, committee, departments
  | "view";

const matrix: Record<Role, Action[]> = {
  OWNER: ["view", "assess", "edit_data", "manage_members", "view_audit_log", "edit_org"],
  ADMIN: ["view", "assess", "edit_data", "manage_members", "view_audit_log", "edit_org"],
  SPOC: ["view", "assess", "edit_data"],
  AUDITOR: ["view", "view_audit_log"], // read-only
};

export function can(role: string, action: Action): boolean {
  return (matrix[role as Role] ?? []).includes(action);
}
