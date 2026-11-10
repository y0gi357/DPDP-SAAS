import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { withTenant } from "../src/lib/tenant";

// Proves tenant isolation at the DATABASE layer, using the low-privilege app role.
async function main() {
  const a = randomUUID(), b = randomUUID();
  const control = await prisma.control.findFirst();
  if (!control) throw new Error("Seed the controls library first (npm run db:seed).");

  for (const id of [a, b]) {
    await withTenant({ orgId: id }, (tx) => tx.organisation.create({ data: { id, name: `Test ${id.slice(0, 6)}` } }));
  }
  await withTenant({ orgId: a }, (tx) =>
    tx.controlAssessment.create({ data: { orgId: a, controlId: control.id, status: "IMPLEMENTED" } }),
  );

  const asB = await withTenant({ orgId: b }, (tx) => tx.controlAssessment.findMany());
  const noCtx = await withTenant({}, (tx) => tx.controlAssessment.findMany());
  const asA = await withTenant({ orgId: a }, (tx) => tx.controlAssessment.findMany());

  let crossWriteBlocked = false;
  try {
    await withTenant({ orgId: b }, (tx) =>
      tx.controlAssessment.create({ data: { orgId: a, controlId: control.id, status: "PARTIAL" } }),
    );
  } catch { crossWriteBlocked = true; }

  let auditImmutable = false;
  try {
    await withTenant({ orgId: a }, async (tx) => {
      await tx.auditLog.create({ data: { orgId: a, action: "t", entity: "t" } });
      await tx.auditLog.deleteMany({});
    });
  } catch { auditImmutable = true; }

  // Phase 2 tables: every tenant table must be invisible to other orgs.
  await withTenant({ orgId: a }, async (tx) => {
    const dept = await tx.department.create({ data: { orgId: a, name: "Finance" } });
    await tx.dataAsset.create({ data: { orgId: a, name: "ERP", departmentId: dept.id } });
    await tx.vendor.create({ data: { orgId: a, name: "Acme Cloud" } });
    await tx.committeeMember.create({ data: { orgId: a, name: "Test Member" } });
    const v = await tx.vendor.findFirstOrThrow({ where: { orgId: a } });
    await tx.subProcessor.create({ data: { orgId: a, vendorId: v.id, name: "Sub Co" } });
    const asset = await tx.dataAsset.findFirstOrThrow({ where: { orgId: a } });
    const ropa = await tx.ropaRecord.create({ data: { orgId: a, activity: "Payroll", purpose: "Pay staff" } });
    await tx.ropaAsset.create({ data: { ropaId: ropa.id, assetId: asset.id, orgId: a } });
    await tx.gapTracking.create({ data: { orgId: a, gapKey: "VEN-x-DPA" } });
    await tx.invitation.create({ data: { orgId: a, email: "new@a.example", role: "SPOC", tokenHash: "hash-a", expiresAt: new Date(Date.now() + 1e6) } });
    await tx.consentConfig.create({ data: { orgId: a, rightsPortalUrl: "https://a.example/rights" } });
    await tx.breach.create({ data: { orgId: a, title: "Test", detectedAt: new Date(), nature: "Unauthorised access", description: "d" } });
    await tx.dpia.create({ data: { orgId: a, ropaId: ropa.id, activity: "Payroll", riskLevel: "High", riskScore: 7, riskFactors: [], necessity: "n", proportionality: "p" } });
  });
  const leak = await withTenant({ orgId: b }, async (tx) =>
    (await tx.department.count()) + (await tx.dataAsset.count()) + (await tx.vendor.count()) +
    (await tx.committeeMember.count()) + (await tx.ropaRecord.count()) + (await tx.ropaVendor.count()) +
    (await tx.subProcessor.count()) + (await tx.ropaAsset.count()) + (await tx.gapTracking.count()) + (await tx.dpia.count()) + (await tx.consentConfig.count()) + (await tx.breach.count()) + (await tx.invitation.count()),
  );
  const ownCount = await withTenant({ orgId: a }, async (tx) => (await tx.department.count()) + (await tx.vendor.count()));

  // An invite link opens exactly its own invitation, and nothing else.
  const byRightToken = await withTenant({ inviteHash: "hash-a" }, (tx) => tx.invitation.findMany());
  const byWrongToken = await withTenant({ inviteHash: "hash-b" }, (tx) => tx.invitation.findMany());
  const orgNameVisibleToMember = await (async () => {
    const uid = randomUUID();
    const u = await prisma.user.create({ data: { id: uid, email: `${uid}@t.example`, name: "T", passwordHash: "x" } });
    await withTenant({ orgId: a, userId: u.id }, (tx) => tx.membership.create({ data: { orgId: a, userId: u.id, role: "SPOC" } }));
    const mine = await withTenant({ userId: u.id }, (tx) => tx.membership.findMany({ include: { org: true } }));
    await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    return mine.length === 1 && mine[0].org?.id === a;
  })();

  const results = {
    "invite link opens only its own invitation": byRightToken.length === 1 && byWrongToken.length === 0,
    "a member can read their own organisation's name": orgNameVisibleToMember,
    "phase 2: org B sees none of A's discovery data": leak === 0,
    "phase 2: org A sees its own discovery data": ownCount === 2,
    "org A sees its own row": asA.length === 1,
    "org B sees nothing of A": asB.length === 0,
    "no tenant context sees nothing": noCtx.length === 0,
    "org B cannot write into org A": crossWriteBlocked,
    "audit log cannot be deleted by app role": auditImmutable,
  };
  console.table(results);
  if (!Object.values(results).every(Boolean)) { console.error("ISOLATION FAILURE"); process.exit(1); }
  console.log("All isolation checks passed.");
}
main().finally(() => prisma.$disconnect());
