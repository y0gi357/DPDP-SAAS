import assert from "node:assert/strict";
import { decisionNotice, latestDecisions } from "../src/lib/business-consent";
import { detectGaps, type GapInput } from "../src/lib/gaps";
import { hashToken, newToken } from "../src/lib/tokens";

const oldGrant = { choice: "GRANTED" as const, noticeId: "v1" };
assert.equal(decisionNotice(undefined, "GRANTED", "v2", "v2"), "v2");
assert.equal(decisionNotice(undefined, "DENIED", "v2", "v2"), "v2");
assert.throws(() => decisionNotice(undefined, "GRANTED", "v2", "v1"), /notice has changed/);
assert.equal(decisionNotice(oldGrant, "WITHDRAWN", "v2", "v1"), "v1", "A new notice must not block withdrawal of an older grant");
assert.throws(() => decisionNotice(oldGrant, "WITHDRAWN", "v2", "v2"), /no matching active consent/);
assert.throws(() => decisionNotice(undefined, "WITHDRAWN", "v2", "v2"), /no matching active consent/);
assert.throws(() => decisionNotice({ choice: "DENIED", noticeId: "v2" }, "WITHDRAWN", "v2", "v2"), /no matching active consent/);
assert.throws(() => decisionNotice(oldGrant, "DENIED", "v2", "v2"), /Withdraw your existing consent/, "Declining a new notice must not silently remove a prior grant without withdrawal tasks");
assert.equal(decisionNotice(oldGrant, "GRANTED", "v2", "v2"), "v2");
const current = latestDecisions([
  { purposeId: "marketing", revision: 3, choice: "WITHDRAWN" },
  { purposeId: "analytics", revision: 2, choice: "DENIED" },
  { purposeId: "marketing", revision: 1, choice: "GRANTED" },
]);
assert.equal(current.get("marketing")?.choice, "WITHDRAWN");
assert.equal(current.get("analytics")?.choice, "DENIED");
assert.equal(current.size, 2);
const token = newToken();
assert.match(token.token, /^[A-Za-z0-9_-]{43}$/);
assert.equal(token.hash, hashToken(token.token));
assert.notEqual(newToken().hash, token.hash);
console.log("Consent decision, notice-version, history and token regression checks passed.");

const snapshot: GapInput = {
  now: new Date(), org: { isSDF: false, dpoEmail: "privacy@example.test", grievanceEmail: "help@example.test" },
  committee: [], departments: [], assets: [], vendors: [], ropa: [], controls: [], dpiaRopaIds: new Set(), approvedDpiaCount: 0, breaches: [],
};
assert.equal(detectGaps(snapshot).some((g) => g.key === "CONSENT-WITHDRAWALS"), false);
assert.equal(detectGaps({ ...snapshot, pendingConsentWithdrawals: 2 }).find((g) => g.key === "CONSENT-WITHDRAWALS")?.severity, "High");
console.log("Pending withdrawals surface in the gap engine; acknowledged queues do not.");
