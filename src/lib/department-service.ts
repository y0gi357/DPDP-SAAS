import type { Prisma } from "@prisma/client";
import { departmentSchema } from "./departments";
import { audit } from "./audit";

export class DepartmentContactError extends Error {}

/** Caller must use withTenant and require edit_org. The parent lock serializes roster replacement. */
export async function saveDepartment(tx: Prisma.TransactionClient, ctx: { orgId: string; userId: string }, id: string | null, input: unknown) {
  const data = departmentSchema.parse(input);
  let departmentId: string;
  if (id) {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Department" WHERE id = ${id} AND "orgId" = ${ctx.orgId} FOR UPDATE`;
    if (!locked.length) throw new DepartmentContactError("Department not found.");
    departmentId = id;
  } else {
    if (data.contacts.some((c) => c.id)) throw new DepartmentContactError("New departments cannot reference existing contacts.");
    departmentId = (await tx.department.create({ data: { orgId: ctx.orgId, name: data.name, headName: data.headName, roles: data.roles } })).id;
  }
  const existing = await tx.departmentContact.findMany({ where: { departmentId, orgId: ctx.orgId }, select: { id: true } });
  const owned = new Set(existing.map((c) => c.id));
  if (data.contacts.some((c) => c.id && !owned.has(c.id))) throw new DepartmentContactError("A contact does not belong to this department. Reload and try again.");
  const retained = data.contacts.flatMap((c) => c.id ? [c.id] : []);
  // Demote first so switching the primary cannot violate the partial unique index.
  await tx.departmentContact.updateMany({ where: { departmentId, orgId: ctx.orgId, isPrimary: true }, data: { isPrimary: false } });
  await tx.departmentContact.deleteMany({ where: { departmentId, orgId: ctx.orgId, id: { notIn: retained } } });
  for (const contact of data.contacts) {
    const { id: contactId, ...fields } = contact;
    if (contactId) await tx.departmentContact.update({ where: { id: contactId, departmentId, orgId: ctx.orgId }, data: fields });
    else await tx.departmentContact.create({ data: { ...fields, orgId: ctx.orgId, departmentId } });
  }
  const primary = data.contacts.find((c) => c.isPrimary);
  await tx.department.update({ where: { id: departmentId, orgId: ctx.orgId }, data: {
    name: data.name, headName: data.headName, roles: data.roles,
    spocName: primary?.name || null, spocEmail: primary?.email || null,
  } });
  await audit(tx, { orgId: ctx.orgId, userId: ctx.userId, action: id ? "department.updated" : "department.created", entity: "Department", entityId: departmentId, meta: { subFunctions: data.contacts.length, assignedSpocs: data.contacts.filter((c) => c.name).length } });
  return departmentId;
}
