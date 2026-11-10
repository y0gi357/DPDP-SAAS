import assert from "node:assert/strict";
import { CM_FIELDS, cmControlEvidence, cmEvidenceRows, readCmEvidence, validateCmEvidence } from "../src/lib/cm-readiness";
import { CMP_ITEMS } from "../src/lib/notice";
import { buildReport } from "../src/lib/report";
import type { Loaded } from "../src/lib/snapshot";

const today = "2026-11-09";
const states = { cm_receive: "YES", cm_registered: "YES", processor_withdrawals: "YES" };
const evidence = {
  managerName: "Example CM", registrationRef: "Board-reference-for-test", registryUrl: "https://example.gov.in/registry/example",
  checkedOn: today, checkedBy: "Privacy lead", registrationEvidence: "Official listing and registration document reviewed; test fixture only.",
  integrationOwner: "Engineering", consentChannel: "Authenticated consent endpoint", withdrawalChannel: "Authenticated withdrawal endpoint",
  integrationTestedOn: today, integrationEvidence: "Test consent and withdrawal receipts mapped to customer and purpose; invalid senders rejected.",
  routingOwner: "Privacy operations", processorRouting: "CRM: documented email route, acknowledgement and escalation case references.",
  routingTimescale: "Internal target and exception procedure documented in SOP-12.", routingTestedOn: today,
  routingEvidence: "Test processor notification, acknowledgement and cessation evidence: CASE-123.",
};
assert.equal(validateCmEvidence(evidence, states, today).ok, true);
for (const f of CM_FIELDS.filter((f) => !f.key.endsWith("Reason"))) {
  assert.equal(validateCmEvidence({ ...evidence, [f.key]: "" }, states, today).ok, false, `${f.key} must be supplied before claiming readiness`);
}
assert.equal(validateCmEvidence({}, { cm_receive: "PARTIAL" }, today).ok, true, "Partial readiness can be recorded while evidence is still being gathered");
for (const id of Object.keys(states)) assert.equal(validateCmEvidence({}, { [id]: "NA" }, today).ok, false, "N/A needs an explanation for each new item");
assert.equal(validateCmEvidence({ receiveNaReason: "External CM connection not currently used." }, { cm_receive: "NA" }, today).ok, true);
for (const url of ["javascript:alert(1)", "https://user:secret@example.test/list", "not-a-url"]) assert.equal(validateCmEvidence({ ...evidence, registryUrl: url }, states, today).ok, false);
for (const date of ["2026-02-30", "2026-11-10", "09/11/2026"]) assert.equal(validateCmEvidence({ ...evidence, checkedOn: date }, states, today).ok, false);
assert.equal(validateCmEvidence({ ...evidence, registrationEvidence: "x".repeat(2001) }, states, today).ok, false);
const legacy = readCmEvidence({ cm: "YES", layered: "YES" });
assert.equal(legacy.managerName, "", "A legacy generic integration answer must not fabricate detailed evidence");
assert.equal(CMP_ITEMS.some((i) => i.id === "cm"), true, "Existing overall assessment remains available");
for (const id of Object.keys(states)) assert.equal(CMP_ITEMS.some((i) => i.id === id), true);
const stored = { ...states, _cmReadiness: evidence };
assert.equal(readCmEvidence(stored).registrationRef, evidence.registrationRef);
assert.ok(cmEvidenceRows(stored).some(([label, value]) => label.includes("Registration check evidence") && value === evidence.registrationEvidence));
const controls = cmControlEvidence(stored);
assert.ok(controls["DPDP-R4-006"].some((line) => line.includes(evidence.registrationRef)));
assert.ok(controls["DPDP-6-009"].some((line) => line.includes(evidence.routingEvidence)));
assert.equal(controls["DPDP-R4-006"].some((line) => line.includes(evidence.routingEvidence)), false, "Processor evidence belongs to the fiduciary withdrawal control");
const data = {
  org: { name: "Test business", isSDF: false, handlesChildrenData: false, actsAsFiduciary: true, actsAsProcessor: false, dpoEmail: "privacy@example.test", grievanceEmail: "help@example.test" },
  gaps: [], trackingByKey: new Map(), ownerOptions: [], libLabel: "test",
  raw: { committee: [], departments: [], assets: [], vendors: [], assessed: [], dpias: [], breaches: [], controlRows: [], reportGenerated: false,
    consent: { cmp: stored }, consentEvidence: { activePurposes: 0, customers: 0, decisions: 0, pendingWithdrawals: 0 } },
} as unknown as Loaded;
const report = buildReport(data, new Date(today));
const section = report.sections.find((s) => s.title === "Consent Management Evidence")!;
const content = JSON.stringify(section);
assert.ok(content.includes(evidence.registrationRef));
assert.ok(content.includes(evidence.routingEvidence));
assert.ok(content.includes("platform has not checked the Board register"));
assert.equal(section.blocks.find((b) => b.kind === "table")?.rows.length, 3);
console.log("CM readiness validation, legacy compatibility, control mapping and report evidence checks passed.");
