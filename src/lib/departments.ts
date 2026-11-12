import { z } from "zod";

export const departmentRoles = ["DATA_FIDUCIARY", "JOINT_DATA_FIDUCIARY", "DATA_PROCESSOR", "OPERATIONAL_OWNER", "NOT_APPLICABLE"] as const;
export const departmentRoleLabels: Record<typeof departmentRoles[number], string> = {
  DATA_FIDUCIARY: "Data Fiduciary", JOINT_DATA_FIDUCIARY: "Joint Data Fiduciary",
  DATA_PROCESSOR: "Data Processor", OPERATIONAL_OWNER: "Shared Service / Operational Owner", NOT_APPLICABLE: "Not Applicable",
};
const optionalText = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const roles = z.array(z.enum(departmentRoles)).max(departmentRoles.length)
  .refine((v) => new Set(v).size === v.length, "Duplicate roles")
  .refine((v) => !v.includes("NOT_APPLICABLE") || v.length === 1, "Not Applicable cannot be combined with other roles");
export const departmentContactSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  subFunction: z.string().trim().min(1, "Sub-function is required").max(120),
  name: z.string().trim().max(120),
  email: z.string().trim().max(200).refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email address").transform((v) => v || null),
  designation: optionalText(120), phone: optionalText(40), responsibilities: optionalText(2000),
  roles, isPrimary: z.boolean(),
}).refine((v) => !v.email || !!v.name, "Add the SPOC name when providing an email address")
  .refine((v) => !v.isPrimary || !!v.name, "A primary SPOC needs a name");
export const departmentSchema = z.object({
  name: z.string().trim().min(1, "Department name is required").max(120),
  headName: optionalText(120), roles,
  contacts: z.array(departmentContactSchema).max(100, "Use at most 100 sub-functions per department"),
}).superRefine((v, ctx) => {
  if (v.contacts.filter((c) => c.isPrimary).length > 1) ctx.addIssue({ code: "custom", path: ["contacts"], message: "Choose one primary SPOC" });
  if (v.contacts.some((c) => c.name) && !v.contacts.some((c) => c.isPrimary)) ctx.addIssue({ code: "custom", path: ["contacts"], message: "Choose a primary SPOC" });
  const ids = v.contacts.flatMap((c) => c.id ? [c.id] : []);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["contacts"], message: "Duplicate contact IDs" });
});
export type DepartmentInput = z.input<typeof departmentSchema>;
export const rolesLabel = (values: string[]) => values.map((v) => departmentRoleLabels[v as typeof departmentRoles[number]] ?? v).join(", ") || "Unspecified";
