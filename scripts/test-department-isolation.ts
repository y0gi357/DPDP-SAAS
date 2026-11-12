import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { saveDepartment } from "../src/lib/department-service";

// Use only a disposable migrated test database with DATABASE_URL set to app_user.
// This test rolls back every fixture and requires actual RLS enforcement.
const rollback = new Error("DEPARTMENT_TEST_ROLLBACK");
async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const a = randomUUID(), b = randomUUID();
      const role = await tx.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
      assert.ok(!role[0].rolsuper && !role[0].rolbypassrls, "Use a restricted role");
      await tx.$queryRaw`SELECT set_config('app.current_org', ${a}, true)`;
      const data = { name: `Dept ${a}`, headName: "", roles: [], contacts: [
        { subFunction: "Helpdesk", name: "Person One", email: "one@example.test", designation: "", phone: "", responsibilities: "", roles: [], isPrimary: true },
        { subFunction: "Cloud", name: "Person Two", email: "two@example.test", designation: "", phone: "", responsibilities: "", roles: [], isPrimary: false },
      ] };
      const id = await saveDepartment(tx, { orgId: a, userId: "test" }, null, data);
      const contacts = await tx.departmentContact.findMany({ where: { departmentId: id }, orderBy: { subFunction: "asc" } });
      assert.equal(contacts.length, 2);
      await tx.$queryRaw`SELECT set_config('app.current_org', ${b}, true)`;
      assert.equal(await tx.departmentContact.count(), 0, "Cross-tenant reads must be blocked");
      const other = await tx.department.create({ data: { orgId: b, name: "Other department" } });
      async function blocked(sql: string) {
        await tx.$executeRawUnsafe("SAVEPOINT department_negative");
        let failed = false;
        try { await tx.$executeRawUnsafe(sql); } catch { failed = true; }
        await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT department_negative");
        assert.ok(failed, "Expected RLS/foreign-key/primary constraint to reject operation");
      }
      await blocked(`INSERT INTO "DepartmentContact" (id,"orgId","departmentId","subFunction",name) VALUES ('${randomUUID()}','${a}','${id}','Other','Other')`);
      await blocked(`INSERT INTO "DepartmentContact" (id,"orgId","departmentId","subFunction",name) VALUES ('${randomUUID()}','${b}','${id}','Other','Other')`);
      await assert.rejects(saveDepartment(tx, { orgId: b, userId: "test" }, other.id, { ...data, contacts: [{ ...data.contacts[0], id: contacts[0].id }] }), /does not belong/);
      await tx.$queryRaw`SELECT set_config('app.current_org', ${a}, true)`;
      await blocked(`UPDATE "DepartmentContact" SET "isPrimary"=true WHERE "departmentId"='${id}'`);
      await saveDepartment(tx, { orgId: a, userId: "test" }, id, { ...data, contacts: contacts.map((c) => ({ ...c, email: c.email ?? "", designation: c.designation ?? "", phone: c.phone ?? "", responsibilities: c.responsibilities ?? "", isPrimary: c.id === contacts[0].id })) });
      assert.equal((await tx.department.findUniqueOrThrow({ where: { id } })).spocName, contacts[0].name);
      await tx.department.delete({ where: { id } });
      assert.equal(await tx.departmentContact.count(), 0, "Delete must cascade");
      throw rollback;
    }, { timeout: 30_000 });
  } catch (e) { if (e !== rollback) throw e; }
  console.log("Department multi-contact service, RLS, cross-tenant FK, primary uniqueness and cascade checks passed (fixtures rolled back).");
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
