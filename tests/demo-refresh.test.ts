import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { demoLabel, demoEmail, refreshExistingDemo } from "../scripts/demo-refresh";
assert.equal(demoLabel("[DEMO] Payroll", "Example"), "[DEMO] Payroll");
assert.equal(demoLabel(demoLabel("Payroll", "Example"), "Example"), "[DEMO] Payroll");
assert.equal(demoLabel("", "Example"), "[DEMO] Example");
assert.equal(demoEmail("customer", "existing-id"), demoEmail("customer", "existing-id"));
assert.notEqual(demoEmail("customer", "one"), demoEmail("customer", "two"));
assert.match(demoEmail("customer", "person@real-domain.invalid"), /^customer\.[a-f0-9]{12}@testorg\.example$/);
let writes = 0;
const denied = {
  organisation: { findUniqueOrThrow: async () => ({ name: "Production" }), update: async () => { writes++; } },
} as unknown as Prisma.TransactionClient;
async function run() {
  await assert.rejects(refreshExistingDemo(denied, "org", new Date()), /restricted to TestOrg/);
  assert.equal(writes, 0, "Reject other organisations before mutations");
  console.log("Demo refresh label, pseudonym stability and non-test organisation rejection checks passed.");
}
run().catch((e) => { console.error(e); process.exitCode = 1; });
