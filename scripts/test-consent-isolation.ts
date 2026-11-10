import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { portalSubject } from "../src/lib/business-consent";
import { newToken } from "../src/lib/tokens";

// Runs against the configured restricted app role. Every test row rolls back.
const rollback = new Error("CONSENT_TEST_ROLLBACK");
async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const a = randomUUID(), b = randomUUID(), token = newToken();
      await tx.$queryRaw`SELECT set_config('app.current_org', ${a}, true)`;
      const purpose = await tx.consentPurpose.create({ data: { orgId: a, key: `test-${a}`, targets: ["CRM"] } });
      const notice = await tx.consentNotice.create({ data: { orgId: a, purposeId: purpose.id, version: 1, title: "Test", description: "Test purpose", dataItems: ["Email"], text: "Test notice", publishedBy: "test" } });
      const subject = await tx.consentSubject.create({ data: { orgId: a, email: `${a}@example.test`, tokenHash: token.hash, tokenExpiresAt: new Date(Date.now() + 60_000) } });
      const event = await tx.consentEvent.create({ data: { orgId: a, subjectId: subject.id, purposeId: purpose.id, noticeId: notice.id, revision: 1, choice: "GRANTED" } });
      await tx.consentWithdrawalTask.create({ data: { orgId: a, eventId: event.id, target: "CRM" } });
      assert.equal((await portalSubject(tx, a, token.token))?.id, subject.id);
      assert.equal(await portalSubject(tx, a, newToken().token), null);
      await tx.consentSubject.update({ where: { id: subject.id }, data: { tokenExpiresAt: new Date(0) } });
      assert.equal(await portalSubject(tx, a, token.token), null, "Expired links must fail");
      await tx.consentSubject.update({ where: { id: subject.id }, data: { tokenHash: null } });
      assert.equal(await portalSubject(tx, a, token.token), null, "Revoked links must fail");
      const tables = ["ConsentPurpose", "ConsentNotice", "ConsentSubject", "ConsentEvent", "ConsentWithdrawalTask"];
      for (const context of [b, ""]) {
        await tx.$queryRaw`SELECT set_config('app.current_org', ${context}, true)`;
        for (const table of tables) {
          const rows = await tx.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${table}"`);
          assert.equal(Number(rows[0].n), 0, `${table} leaked outside its tenant`);
        }
      }
      await tx.$queryRaw`SELECT set_config('app.current_org', ${a}, true)`;
      async function blocked(sql: string, expected: string) {
        await tx.$executeRawUnsafe("SAVEPOINT consent_negative");
        let failed = false;
        try { await tx.$executeRawUnsafe(sql); } catch { failed = true; }
        await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT consent_negative");
        assert.ok(failed, expected);
      }
      for (const table of ["ConsentNotice", "ConsentEvent"]) {
        await blocked(`DELETE FROM "${table}"`, `${table} must be undeletable by app role`);
        await blocked(`UPDATE "${table}" SET "orgId" = "orgId"`, `${table} must be immutable`);
      }
      await blocked(`INSERT INTO "ConsentPurpose" (id, "orgId", key, targets, "createdAt") VALUES ('${randomUUID()}', '${b}', 'cross-write', ARRAY[]::text[], now())`, "Cross-tenant insert must be blocked");
      await tx.$queryRaw`SELECT set_config('app.current_org', ${b}, true)`;
      const p2 = await tx.consentPurpose.create({ data: { orgId: b, key: "cross-reference", targets: [] } });
      await blocked(`INSERT INTO "ConsentEvent" (id, "orgId", "subjectId", "purposeId", "noticeId", revision, choice, source, "createdAt") VALUES ('${randomUUID()}', '${b}', '${subject.id}', '${p2.id}', '${notice.id}', 1, 'GRANTED', 'TEST', now())`, "Foreign keys must reject cross-tenant relationships");
      console.log("Consent tenant isolation, expired/revoked links, immutable history and cross-tenant FK checks passed (all fixtures rolled back).");
      throw rollback;
    }, { timeout: 30_000 });
  } catch (e) { if (e !== rollback) throw e; }
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
