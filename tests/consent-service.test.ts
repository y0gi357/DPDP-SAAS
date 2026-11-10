import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { recordDecision } from "../src/lib/business-consent";
import { newToken } from "../src/lib/tokens";

// Exercise the actual service against an in-memory transaction double. Database permissions
// and isolation are covered separately by test-consent-isolation.ts against PostgreSQL.
const tenant = require("../src/lib/tenant") as typeof import("../src/lib/tenant");
const original = tenant.withTenant;
const credential = newToken();
const subject = { id: "subject", orgId: "org-a", email: "customer@example.test", tokenHash: credential.hash as string | null, tokenExpiresAt: new Date(Date.now() + 60_000), revision: 0 };
const v1 = { id: "v1", targets: ["Original CRM"] };
const v2 = { id: "v2", targets: ["New CRM"] };
const purpose = { id: "purpose", active: true, targets: ["Original CRM"], notices: [v1] };
type Event = { id: string; orgId: string; subjectId: string; purposeId: string; noticeId: string; choice: string; revision: number };
const events: Event[] = [], tasks: { orgId: string; eventId: string; target: string }[] = [];
const tx = {
  $queryRaw: async () => [],
  consentSubject: {
    findFirst: async ({ where }: { where: { orgId: string; tokenHash: string; tokenExpiresAt: { gt: Date } } }) => subject.orgId === where.orgId && subject.tokenHash === where.tokenHash && subject.tokenExpiresAt > where.tokenExpiresAt.gt ? { ...subject } : null,
    update: async () => { subject.revision++; return { ...subject }; },
  },
  consentPurpose: { findUnique: async () => purpose },
  consentEvent: {
    findFirst: async () => events.at(-1) ?? null,
    create: async ({ data }: { data: Omit<Event, "id"> }) => { const row = { ...data, id: `event-${events.length + 1}` }; events.push(row); return row; },
    findMany: async () => events.filter((e) => e.choice === "GRANTED").map((e) => ({ notice: e.noticeId === "v1" ? v1 : v2 })),
  },
  consentWithdrawalTask: { createMany: async ({ data }: { data: typeof tasks }) => { tasks.push(...data); return { count: data.length }; } },
  auditLog: { create: async () => ({}) },
};
tenant.withTenant = (async (ctx: { orgId: string }, fn: (client: Prisma.TransactionClient) => unknown) => {
  assert.equal(ctx.orgId, "org-a");
  return fn(tx as unknown as Prisma.TransactionClient);
}) as typeof tenant.withTenant;

async function run() {
  try {
    await recordDecision("org-a", credential.token, "purpose", "v1", "GRANTED");
    await recordDecision("org-a", credential.token, "purpose", "v1", "GRANTED");
    assert.equal(events.length, 1, "A repeated grant must not duplicate history");
    await assert.rejects(recordDecision("org-a", credential.token, "purpose", "v1", "DENIED"), /Withdraw your existing consent/);
    purpose.notices = [v2]; purpose.targets = ["New CRM"];
    await assert.rejects(recordDecision("org-a", credential.token, "purpose", "v1", "GRANTED"), /notice has changed/);
    await recordDecision("org-a", credential.token, "purpose", "v1", "WITHDRAWN");
    assert.equal(events[1].noticeId, "v1", "Withdrawal must preserve the original accepted notice");
    assert.deepEqual(new Set(tasks.map((t) => t.target)), new Set(["Original CRM", "New CRM"]), "Withdrawal must reach old and current systems");
    await recordDecision("org-a", credential.token, "purpose", "v1", "WITHDRAWN");
    assert.equal(events.length, 2); assert.equal(tasks.length, 2, "Retries must not duplicate follow-up tasks");
    await recordDecision("org-a", credential.token, "purpose", "v2", "GRANTED");
    assert.equal(tasks.length, 2, "Re-consent must not cancel a pending withdrawal");
    purpose.active = false;
    await assert.rejects(recordDecision("org-a", credential.token, "purpose", "v2", "GRANTED"), /no longer accepts/);
    await recordDecision("org-a", credential.token, "purpose", "v2", "WITHDRAWN");
    assert.equal(events.at(-1)?.choice, "WITHDRAWN", "Pausing a purpose must never block withdrawal");
    const count = events.length;
    subject.tokenExpiresAt = new Date(0);
    await assert.rejects(recordDecision("org-a", credential.token, "purpose", "v2", "WITHDRAWN"), /expired/);
    subject.tokenExpiresAt = new Date(Date.now() + 60_000); subject.tokenHash = null;
    await assert.rejects(recordDecision("org-a", credential.token, "purpose", "v2", "WITHDRAWN"), /expired/);
    assert.equal(events.length, count, "Invalid credentials must not record decisions");
    assert.deepEqual(events.map((e) => e.revision), [1, 2, 3, 4]);
    console.log("Consent service checks passed: duplicate requests, stale notices, withdrawal routing, paused purposes and expired/revoked access.");
  } finally { tenant.withTenant = original; }
}
run().catch((e) => { console.error(e); process.exitCode = 1; });
