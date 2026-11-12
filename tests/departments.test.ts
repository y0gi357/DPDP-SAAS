import assert from "node:assert/strict";
import { departmentSchema } from "../src/lib/departments";
import { detectGaps, type GapInput } from "../src/lib/gaps";

const contact = { subFunction: "Helpdesk", name: "Demo Person", email: "person@example.test", designation: "Lead", phone: "", responsibilities: "Handle privacy requests", roles: ["OPERATIONAL_OWNER"], isPrimary: true };
const department = { name: "IT", headName: "Demo Head", roles: ["DATA_PROCESSOR"], contacts: [contact, { ...contact, subFunction: "Cloud Operations", name: "Second Person", email: "second@example.test", isPrimary: false }] };
assert.equal(departmentSchema.parse(department).contacts.length, 2);
assert.ok(!departmentSchema.safeParse({ ...department, contacts: [contact, contact] }).success, "Multiple primaries must fail");
assert.ok(!departmentSchema.safeParse({ ...department, contacts: [{ ...contact, isPrimary: false }] }).success, "Named contacts need a primary");
assert.ok(!departmentSchema.safeParse({ ...department, contacts: [{ ...contact, email: "invalid" }] }).success);
assert.ok(!departmentSchema.safeParse({ ...department, roles: ["NOT_APPLICABLE", "DATA_PROCESSOR"] }).success);
assert.ok(!departmentSchema.safeParse({ ...department, contacts: [{ ...contact, roles: ["ADMIN"] }] }).success);
assert.ok(!departmentSchema.safeParse({ ...department, contacts: [{ ...contact, name: "" }] }).success);
assert.ok(!departmentSchema.safeParse({ ...department, contacts: [{ ...contact, id: "one" }, { ...contact, id: "one", isPrimary: false }] }).success);
assert.ok(departmentSchema.safeParse({ ...department, contacts: [{ ...contact, name: "", email: "", isPrimary: false }] }).success, "Unassigned sub-functions can be recorded");
const input: GapInput = { now: new Date(), org: { isSDF: false, dpoEmail: "dpo@example.test", grievanceEmail: "privacy@example.test" }, committee: [], departments: [{ id: "dept", name: "IT", spocName: "Demo Person", spocEmail: "person@example.test", contacts: [{ id: "sub", subFunction: "Helpdesk", name: "", email: null }] }], assets: [], vendors: [], ropa: [], controls: [], dpiaRopaIds: new Set(), approvedDpiaCount: 0, breaches: [] };
assert.ok(detectGaps(input).some((g) => g.key === "DEPT-dept-CONTACT-sub"), "Primary contact must not hide unassigned sub-functions");
input.departments[0].contacts![0] = { id: "sub", subFunction: "Helpdesk", name: "Demo Person", email: "person@example.test" };
assert.ok(!detectGaps(input).some((g) => g.key === "DEPT-dept-CONTACT-sub"));
console.log("Department roster validation and sub-function gap checks passed.");

// Exercise the real service without replacing module exports. SQL/RLS checks run separately.
import type { Prisma } from "@prisma/client";
import { saveDepartment } from "../src/lib/department-service";
async function serviceChecks() {
  const state = { contacts: [ { id: "existing", isPrimary: true } ] as Record<string, unknown>[], department: {} as Record<string, unknown>, audits: 0 };
  const fake = {
    $queryRaw: async () => [{ id: "dept" }],
    department: { update: async ({ data }: { data: Record<string, unknown> }) => { state.department = data; } },
    departmentContact: {
      findMany: async () => state.contacts,
      updateMany: async () => { state.contacts.forEach((c) => { c.isPrimary = false; }); },
      deleteMany: async ({ where }: { where: { id: { notIn: string[] } } }) => { state.contacts = state.contacts.filter((c) => where.id.notIn.includes(String(c.id))); },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { Object.assign(state.contacts.find((c) => c.id === where.id)!, data); },
      create: async ({ data }: { data: Record<string, unknown> }) => { state.contacts.push({ id: `new-${state.contacts.length}`, ...data }); },
    },
    auditLog: { create: async () => { state.audits++; } },
  } as unknown as Prisma.TransactionClient;
  const ctx = { orgId: "org-a", userId: "tester" };
  await assert.rejects(saveDepartment(fake, ctx, "dept", { ...department, contacts: [{ ...contact, id: "foreign" }] }), /does not belong/);
  assert.equal(state.contacts[0].isPrimary, true, "Reject foreign IDs before changing the roster");
  await saveDepartment(fake, ctx, "dept", { ...department, contacts: [{ ...contact, id: "existing", isPrimary: false }, { ...contact, subFunction: "Cloud", name: "New Primary", email: "new@example.test" }] });
  assert.equal(state.contacts.length, 2);
  assert.equal(state.contacts.filter((c) => c.isPrimary).length, 1);
  assert.equal(state.department.spocName, "New Primary");
  assert.equal(state.department.spocEmail, "new@example.test");
  assert.equal(state.audits, 1);
  await saveDepartment(fake, ctx, "dept", { ...department, contacts: [] });
  assert.equal(state.contacts.length, 0);
  assert.equal(state.department.spocName, null, "Clearing roster must clear old compatibility fields");
  console.log("Department service checks passed: foreign IDs, primary switching, roster replacement and audit.");
}
serviceChecks().catch((error) => { console.error(error); process.exitCode = 1; });
