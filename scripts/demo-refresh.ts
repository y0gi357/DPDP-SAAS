import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { assessRopa } from "../src/lib/ropa-assess";
import { mitigationsFor } from "../src/lib/dpia";
import { autoNa } from "../src/lib/controls";
import { SENIOR_DESIGNATIONS } from "../src/lib/enums";
import { DEFS } from "../src/lib/ropa-checks";

export const DEMO_MARKER = "FICTIONAL DEMO — not real evidence, approval, consent or notification.";
export function demoLabel(value: string, fallback: string) {
  const clean = value.replace(/^\[(?:DEMO|SIMULATED DEMO)\]\s*/i, "").trim();
  return `[DEMO] ${clean || fallback}`;
}
export function demoEmail(kind: string, id: string) {
  return `${kind}.${createHash("sha256").update(id).digest("hex").slice(0, 12)}@testorg.example`;
}

/** Only invoked explicitly for the existing local test tenant, after its private backup. */
export async function refreshExistingDemo(tx: Prisma.TransactionClient, orgId: string, now: Date) {
  const org = await tx.organisation.findUniqueOrThrow({ where: { id: orgId } });
  if (!/^test\s*org$/i.test(org.name.trim())) throw new Error("Refresh is restricted to TestOrg/Test Org.");
  const due = new Date(now.getTime() + 14 * 86_400_000);
  const profile = await tx.organisation.update({ where: { id: orgId }, data: {
    legalName: "TestOrg Digital Services — FICTIONAL DEMO", industry: "Business software and customer support",
    registrationNo: "DEMO-NOT-A-REAL-REGISTRATION", address: "Fictional Demo Campus, Bengaluru, India", website: "https://testorg.example", employeeCount: 240,
    dpoName: "Aditi Rao (fictional)", dpoEmail: "privacy@testorg.example", dpoPhone: null, grievanceEmail: "grievance@testorg.example",
    actsAsFiduciary: true, actsAsProcessor: true, isSDF: false, handlesChildrenData: false, transfersAbroad: false,
  } });
  // Preserve IDs and names so inventories and owner references remain recognisable.
  const departments = await tx.department.findMany({ where: { orgId }, include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }, { id: "asc" }] } }, orderBy: { name: "asc" } });
  const owners: string[] = [];
  for (const [i, d] of departments.entries()) {
    owners.push(`dept:${d.id}`);
    const head = d.id.startsWith("demo-") ? d.headName || `Department Lead ${i + 1} (fictional)` : `Demo Department Lead ${i + 1} (fictional)`;
    const contacts = d.contacts;
    const primaryId = contacts.find((c) => c.isPrimary)?.id || contacts[0]?.id;
    await tx.departmentContact.updateMany({ where: { orgId, departmentId: d.id }, data: { isPrimary: false } });
    for (const [j, c] of contacts.entries()) await tx.departmentContact.update({ where: { id: c.id }, data: {
      name: c.id.startsWith("demo-") ? c.name || `Demo Privacy Contact ${i + 1}.${j + 1}` : `Demo Privacy Contact ${i + 1}.${j + 1} (fictional)`, email: demoEmail("spoc", c.id), phone: null,
      subFunction: c.subFunction.trim() || "Privacy Coordination", designation: c.designation || (j === 0 ? "Privacy Coordination Lead" : "Operations Specialist"), roles: c.roles.length ? c.roles : ["OPERATIONAL_OWNER"],
      responsibilities: `${DEMO_MARKER} Own the ${c.subFunction || "department"} processing inventory, review access and retention, coordinate rights enquiries and supply remediation evidence.`, isPrimary: c.id === primaryId,
    } });
    if (!contacts.length) contacts.push(await tx.departmentContact.create({ data: {
      orgId, departmentId: d.id, subFunction: "Privacy Coordination", name: head, email: demoEmail("department", d.id), isPrimary: true,
      designation: "Privacy Coordinator", roles: ["OPERATIONAL_OWNER"], responsibilities: `${DEMO_MARKER} Coordinate departmental inventory, risk reviews, requests and evidence.`,
    } }));
    const primary = await tx.departmentContact.findFirstOrThrow({ where: { orgId, departmentId: d.id, isPrimary: true } });
    await tx.department.update({ where: { id: d.id }, data: { headName: head, spocName: primary.name, spocEmail: primary.email, roles: d.roles.length ? d.roles : ["OPERATIONAL_OWNER"] } });
  }
  const members = await tx.committeeMember.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } });
  for (const [i, m] of members.entries()) await tx.committeeMember.update({ where: { id: m.id }, data: {
    name: m.id.startsWith("demo-") ? m.name : `Demo Committee Member ${i + 1} (fictional)`, email: demoEmail("committee", m.id),
    designation: SENIOR_DESIGNATIONS.includes(m.designation as typeof SENIOR_DESIGNATIONS[number]) ? m.designation : "Other - Senior Function Head",
    function: m.function ? demoLabel(m.function, "Governance") : "[DEMO] Governance and remediation oversight",
  } });
  const vendors = await tx.vendor.findMany({ where: { orgId }, orderBy: { name: "asc" } });
  for (const [i, v] of vendors.entries()) {
    await tx.vendor.update({ where: { id: v.id }, data: {
      service: `${DEMO_MARKER} ${v.service?.replace(/^FICTIONAL DEMO[^.]*\.\s*/, "") || "Contracted processing and operational support for the linked application"}`,
      country: "India", riskTier: i % 4 === 0 ? "HIGH" : "MEDIUM", lastReview: new Date(now.getTime() - 20 * 86_400_000),
      dataCategories: v.dataCategories.length ? v.dataCategories : ["IDENTITY", "CONTACT"], contactName: `Vendor Privacy Contact ${i + 1} (fictional)`, contactEmail: demoEmail("vendor", v.id),
      hasContract: i % 4 !== 0, breachClause: i % 4 !== 0, contractExpiry: new Date(now.getTime() + 180 * 86_400_000), certifications: [],
      securityControls: i % 4 === 0 ? ["Access reviews pending"] : ["Encryption at rest", "Restricted access", "Audit logging", "Recovery testing"],
      dsrContact: demoEmail("processor-requests", v.id), dsrChannel: "Email", dsrSla: "Demo internal target: acknowledge within 2 working days",
    } });
  }
  const subs = await tx.subProcessor.findMany({ where: { orgId } });
  for (const sub of subs) await tx.subProcessor.update({ where: { id: sub.id }, data: { country: "India", purpose: `${DEMO_MARKER} Restricted processing or encrypted backup support for the parent processor.` } });
  const assets = await tx.dataAsset.findMany({ where: { orgId }, orderBy: { name: "asc" } });
  for (const [i, a] of assets.entries()) await tx.dataAsset.update({ where: { id: a.id }, data: {
    description: `${DEMO_MARKER} ${a.name}: business-service processing with purpose-limited access, reviewed retention and accountable departmental ownership.`,
    departmentId: a.departmentId || departments[i % departments.length]?.id || null, ownerName: `Demo Application Owner ${i + 1} (fictional)`,
    hostingLocation: "India — fictional Bengaluru primary / Mumbai recovery", hostedInIndia: true,
    ...(a.storesPersonalData ? { dataCategories: a.dataCategories.length ? a.dataCategories : ["IDENTITY", "CONTACT"], piiFields: a.piiFields.length ? a.piiFields : ["FULL_NAME", "EMAIL"] } : {}),
    ...(a.sourcing === "OUTSOURCED" && !a.vendorId ? { vendorId: vendors[i % vendors.length]?.id, vendorAccess: "LIMITED_ACCESS" as const } : {}),
  } });
  const ropas = await tx.ropaRecord.findMany({ where: { orgId }, include: { assets: true, vendors: true }, orderBy: { createdAt: "asc" } });
  for (const [i, r] of ropas.entries()) {
    const evaluation = Object.fromEntries(DEFS.map((d, n) => [d.id, (i + n) % 9 === 0 ? "Not met" : (i + n) % 5 === 0 ? "Partial" : "Met"]));
    await tx.ropaRecord.update({ where: { id: r.id }, data: {
      purpose: `${DEMO_MARKER} ${r.activity}: deliver the described business workflow using only the necessary personal data.`,
      departmentId: r.departmentId || departments[i % departments.length]?.id || null, principalCategory: r.principalCategory || "Customer",
      piiFields: r.piiFields.length ? r.piiFields : ["FULL_NAME", "EMAIL"], dataCategories: r.dataCategories.length ? r.dataCategories : ["IDENTITY", "CONTACT"],
      source: "Fictional first-party form or authenticated workforce workflow", storage: "Fictional India-hosted service and encrypted recovery store",
      retention: "DEMO schedule: review at purpose completion; remove unnecessary records after 180 days unless a documented exception applies. This is a scenario assumption, not a statutory period.",
      otherParties: [], crossBorder: false, crossBorderCountry: null, controlEval: evaluation,
      techDetails: { tech_encryption: "DEMO: AES-256 at rest and TLS in transit", tech_access: "DEMO: role-based access and quarterly review", tech_logging: "DEMO: restricted event logs and investigation procedure", tech_backup: "DEMO: encrypted backups and restore exercise" },
      notes: `${DEMO_MARKER} Existing record refreshed for the SAMVAAD scenario. Basis and retention need review in a real deployment.`,
    } });
    if (!r.assets.length && assets.length) await tx.ropaAsset.create({ data: { orgId, ropaId: r.id, assetId: assets[i % assets.length].id } });
  }
  const dpias = await tx.dpia.findMany({ where: { orgId } });
  for (const d of dpias) {
    const r = d.ropaId ? await tx.ropaRecord.findUnique({ where: { id: d.ropaId }, include: { department: true, vendors: { include: { vendor: true } } } }) : null;
    const risk = r ? assessRopa(r, profile).risk : null;
    await tx.dpia.update({ where: { id: d.id }, data: {
      ...(r ? { activity: r.activity, department: r.department?.name } : {}),
      ...(risk ? { riskLevel: risk.level, riskScore: risk.score, riskFactors: risk.factors as unknown as Prisma.InputJsonValue, mitigations: mitigationsFor(risk.factors.map((f) => f.key)) } : {}),
      necessity: `${DEMO_MARKER} ${r?.activity || d.activity} supports a defined service. Anonymous handling, fewer identifiers and shorter retention were considered.`,
      proportionality: `${DEMO_MARKER} Limit collection to the stated purpose, separate optional uses, restrict staff access and document deletion exceptions.`,
      residualNote: `${DEMO_MARKER} Residual risks require recurring access review, processor follow-up and retention verification.`,
      reviewNotes: `${DEMO_MARKER} Illustrative review; status is a synthetic demonstration and no real approval occurred.`, sdfMandated: false, outdated: false,
      ...(d.status === "APPROVED" ? { approverRef: members.find((m) => m.designation === "Data Protection Officer (DPO)") ? `member:${members.find((m) => m.designation === "Data Protection Officer (DPO)")!.id}` : null } : { approverRef: null, approvedAt: null }),
    } });
  }
  const assessments = await tx.controlAssessment.findMany({ where: { orgId }, include: { control: true } });
  for (const [i, a] of assessments.entries()) {
    const na = autoNa(a.control.audience, profile);
    const status = na ? "NOT_APPLICABLE" : (["IMPLEMENTED", "IMPLEMENTED", "PARTIAL", "PLANNED", "NOT_IMPLEMENTED"] as const)[i % 5];
    await tx.controlAssessment.update({ where: { id: a.id }, data: { status, evidence: `${DEMO_MARKER} ${na || `Illustrative ${a.control.code} evidence: draft procedure, synthetic sample review and test record DEMO-${a.control.code}.`}`, owners: owners.length ? [owners[i % owners.length]] : [], targetDate: status === "IMPLEMENTED" || status === "NOT_APPLICABLE" ? null : due } });
    if (status !== "IMPLEMENTED" && status !== "NOT_APPLICABLE") await tx.gapTracking.upsert({ where: { orgId_gapKey: { orgId, gapKey: `CTL-${a.control.code}` } }, update: { status: "IN_PROGRESS", owners: owners.length ? [owners[i % owners.length]] : [], dueDate: due, notes: `${DEMO_MARKER} Review the procedure, complete the safeguard test and attach evidence for ${a.control.code}.` }, create: { orgId, gapKey: `CTL-${a.control.code}`, status: "IN_PROGRESS", owners: owners.length ? [owners[i % owners.length]] : [], dueDate: due, notes: `${DEMO_MARKER} Complete the assigned safeguard test and record evidence.` } });
  }
  const gaps = await tx.gapTracking.findMany({ where: { orgId } });
  for (const [i, g] of gaps.entries()) await tx.gapTracking.update({ where: { id: g.id }, data: { notes: `${DEMO_MARKER} Owner to review ${g.gapKey}, implement the proposed safeguard, test a sample and record closure evidence.`, owners: owners.length ? [owners[i % owners.length]] : [], dueDate: due } });
  await tx.consentConfig.updateMany({ where: { orgId }, data: {
    rightsPortalUrl: `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/privacy/${orgId}`, dataItems: ["Name", "Email", "Account reference"], purposes: ["Optional product updates", "Optional usage analytics"],
    crossBorderText: "FICTIONAL DEMO: scenario storage and processor locations are India-only.",
    cmp: { layered: "YES", granular: "YES", log: "PARTIAL", withdraw: "PARTIAL", lang: "PARTIAL", cm: "NO", cm_receive: "NO", cm_registered: "NO", processor_withdrawals: "PARTIAL", parental: "NA", reconsent: "PARTIAL", _cmReadiness: { routingOwner: "Aditi Rao (fictional)", processorRouting: "DEMO: review the withdrawal queue, notify the relevant fictional processor manually, record acknowledgement and escalate missing responses.", routingTimescale: "DEMO internal target: 2 working days; retention exceptions require reviewed justification.", routingEvidence: "FICTIONAL tabletop DEMO-WD-01. No actual processor was contacted." } },
    cmpNotes: `${DEMO_MARKER} Partial items are planned improvements. No registered CM integration or automatic processor execution is claimed.`,
  } });
  const subjects = await tx.consentSubject.findMany({ where: { orgId } });
  for (const subject of subjects) if (!subject.id.startsWith("demo-")) await tx.consentSubject.update({ where: { id: subject.id }, data: { email: demoEmail("customer", subject.id), reference: `FICTIONAL-DEMO-${subject.id}`, tokenHash: null, tokenExpiresAt: null } });
  const purposes = await tx.consentPurpose.findMany({ where: { orgId }, include: { notices: { orderBy: { version: "desc" }, take: 1 } } });
  for (const purpose of purposes) if (!purpose.id.startsWith("demo-")) {
    const latest = purpose.notices[0];
    // Publish a new fictional version; never rewrite what earlier decisions referred to.
    if (latest?.publishedBy === "DEMO_REFRESH" || latest?.publishedBy === "PRESENTATION_V1") continue;
    await tx.consentNotice.create({ data: { orgId, purposeId: purpose.id, version: (latest?.version || 0) + 1, title: demoLabel(latest?.title || purpose.key, "Optional processing"),
      description: `${DEMO_MARKER} A separate choice for this processing purpose.`, dataItems: ["Email", "Account reference"], language: "en", publishedBy: "DEMO_REFRESH", targets: purpose.targets,
      text: `${DEMO_MARKER}\nPurpose: ${latest?.title || purpose.key}. We use email and account reference only for this optional workflow. Decline or withdraw through the private portal. Contact privacy@testorg.example. Historical decisions remain linked to the notice originally displayed.`,
    } });
  }
  const tasks = await tx.consentWithdrawalTask.findMany({ where: { orgId } });
  for (const task of tasks) await tx.consentWithdrawalTask.update({ where: { id: task.id }, data: { note: `${DEMO_MARKER} ${task.acknowledgedAt ? "Simulated processor acknowledgement; no external action occurred." : "Pending manual follow-up in this fictional scenario."}` } });
  const incidents = await tx.breach.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } });
  for (const [i, b] of incidents.entries()) await tx.breach.update({ where: { id: b.id }, data: {
    title: `[SIMULATED DEMO] Incident ${i + 1}: ${["Misdirected support export", "Lost encrypted device", "Excessive service access"][i % 3]}`,
    description: `${DEMO_MARKER} A tabletop exercise using synthetic account data; no real incident or regulatory communication occurred.`, dataAffected: "Fictional email and account references", principalsAffected: [12, 1, 24][i % 3],
    nature: ["Accidental disclosure", "Device loss", "Unauthorised access"][i % 3], rootCause: `${DEMO_MARKER} Example export-scope, device-handling or access-role exception.`,
    measures: `${DEMO_MARKER} Restrict access, preserve exercise evidence, investigate scope, review notifications and retest safeguards.`,
  } });
  await tx.auditLog.create({ data: { orgId, action: "demo.existing_records_refreshed", entity: "DemoDataset", meta: { fictional: true, departments: departments.length, assets: assets.length, ropas: ropas.length, dpias: dpias.length, noExternalActions: true, immutableHistoryPreserved: true } } });
  console.log(`Refreshed existing demo: ${departments.length} departments, ${members.length} committee members, ${vendors.length} vendors, ${assets.length} apps, ${ropas.length} RoPA records and ${dpias.length} DPIAs. Login accounts unchanged; old portal links for earlier fictional customers revoked.`);
}
