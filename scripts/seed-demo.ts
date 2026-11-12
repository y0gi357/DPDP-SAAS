import "dotenv/config";
import { refreshExistingDemo } from "./demo-refresh";
import { polishDemoPresentation } from "./demo-presentation";
import { PrismaClient, type Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { DEFS } from "../src/lib/ropa-checks";
import { assessRopa } from "../src/lib/ropa-assess";
import { mitigationsFor } from "../src/lib/dpia";
import { autoNa } from "../src/lib/controls";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("npm run db:demo -- [--apply] [--refresh-existing]\nPopulates only an existing local TestOrg/Test Org with clearly fictional records. Without --apply, previews only. Set DEMO_ORG_ID if names are ambiguous. Requires current migrations and active controls. No emails, user accounts or live portal tokens are created. --refresh-existing standardises existing fictional data after a private backup; IDs, links and immutable history are kept, earlier customer links revoked.");
  process.exit(0);
}
if (args.some((a) => a !== "--apply" && a !== "--refresh-existing")) throw new Error("Unknown argument; use --help.");
const apply = args.includes("--apply");
const refresh = args.includes("--refresh-existing");
const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL is required. No data was changed.");
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Demo loader is limited to a local database. No data was changed.");
const db = new PrismaClient({ datasourceUrl: url });
const marker = "FICTIONAL DEMO — not real evidence, approval, consent or notification.";
const day = 86_400_000, now = new Date();
const ago = (days: number) => new Date(now.getTime() - days * day);
const ahead = (days: number) => new Date(now.getTime() + days * day);
const email = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, ".") + "@testorg.example";

async function run() {
  await db.$transaction(async (tx) => {
    if (process.env.DEMO_ORG_ID) await tx.$queryRaw`SELECT set_config('app.current_org', ${process.env.DEMO_ORG_ID}, true)`;
    const matches = await tx.organisation.findMany({ where: { ...(process.env.DEMO_ORG_ID ? { id: process.env.DEMO_ORG_ID } : {}), name: { in: ["TestOrg", "Test Org"], mode: "insensitive" } } });
    if (matches.length !== 1) throw new Error("Expected exactly one existing TestOrg/Test Org. If RLS hides it or names are ambiguous, set DEMO_ORG_ID to its ID. Nothing was changed.");
    const org = matches[0], orgId = org.id;
    await tx.$queryRaw`SELECT set_config('app.current_org', ${orgId}, true)`;
    await tx.$queryRaw`SELECT id FROM "Organisation" WHERE id = ${orgId} FOR UPDATE`;
    const library = await tx.controlLibraryVersion.findFirst({ where: { isActive: true }, include: { controls: { orderBy: { code: "asc" } } } });
    if (!library?.controls.length) throw new Error("No active control library. Run npm run db:seed first. Nothing was changed.");
    // Detect missing department migration before creating a backup or writing anything.
    await tx.departmentContact.count({ where: { orgId } });
    console.log(`Target: ${org.name} (${orgId}). ${library.controls.length} active controls.`);
    console.log("Plan: 8 departments / 24 sub-functions, 7 committee members, 6 vendors + subprocessors, 10 applications, 10 linked RoPA/DPIAs, consent notices + 8 fictional customers, 3 simulated incidents and control/remediation examples.");
    if (refresh) console.log("Refresh mode: rewrite existing TestOrg demo profile and mutable records, keep links/history, and revoke earlier fictional customer portal links.");
    if (!apply) { console.log("Preview only. Add --apply to populate this organisation."); return; }
    const id = (key: string) => "demo-" + createHash("sha256").update(`${orgId}:${key}`).digest("hex").slice(0, 28);
    const backup = { createdAt: now, organisation: org, tables: await Promise.all([
      tx.department.findMany({ where: { orgId }, include: { contacts: true } }), tx.committeeMember.findMany({ where: { orgId } }),
      tx.vendor.findMany({ where: { orgId }, include: { subProcessors: true } }), tx.dataAsset.findMany({ where: { orgId } }),
      tx.ropaRecord.findMany({ where: { orgId }, include: { assets: true, vendors: true } }), tx.dpia.findMany({ where: { orgId } }),
      tx.controlAssessment.findMany({ where: { orgId } }), tx.gapTracking.findMany({ where: { orgId } }), tx.consentConfig.findMany({ where: { orgId } }),
      tx.breach.findMany({ where: { orgId } }), tx.consentPurpose.findMany({ where: { orgId }, include: { notices: true } }),
      tx.consentSubject.findMany({ where: { orgId } }), tx.consentEvent.findMany({ where: { orgId } }), tx.consentWithdrawalTask.findMany({ where: { orgId } }),
    ]) };
    mkdirSync("backups", { recursive: true });
    const backupFile = `backups/demo-before-${now.toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(backupFile, JSON.stringify(backup, null, 2), { mode: 0o600, flag: "wx" });
    console.log(`Pre-change tenant snapshot: ${backupFile} (private; do not upload). This is not a substitute for a full database backup.`);
    await tx.organisation.update({ where: { id: orgId }, data: {
      legalName: org.legalName || "TestOrg Digital Services — FICTIONAL DEMO", industry: org.industry || "Business software and customer support",
      registrationNo: org.registrationNo || "DEMO-NOT-A-REAL-REGISTRATION", address: org.address || "Fictional Demo Campus, Bengaluru, India",
      website: org.website || "https://testorg.example", employeeCount: org.employeeCount ?? 240,
      dpoName: org.dpoName || "Aditi Rao (fictional)", dpoEmail: org.dpoEmail || "privacy@testorg.example", grievanceEmail: org.grievanceEmail || "grievance@testorg.example",
    } });
    const departments = [
      ["Engineering / Product", "Rohan Mehta", "Product Management", "Backend Engineering", "QA & Release"],
      ["Information Technology", "Meera Shah", "Helpdesk", "Identity & Access", "Cloud Operations"],
      ["Information Security", "Kabir Nair", "Security Operations", "GRC", "Incident Response"],
      ["Human Resources", "Nisha Kapoor", "Recruitment", "Payroll", "Employee Relations"],
      ["Sales & Marketing", "Arjun Sen", "Lead Generation", "Campaign Operations", "Sales Operations"],
      ["Customer Success", "Tara Iyer", "Support Desk", "Customer Onboarding", "Escalations"],
      ["Finance", "Dev Menon", "Billing", "Accounts Payable", "Financial Reporting"],
      ["Legal & Privacy", "Aditi Rao", "Privacy Operations", "Contract Review", "Grievance Handling"],
    ];
    const depIds: string[] = [], ownerIds: string[] = [];
    for (const [i, [name, head, ...functions]] of departments.entries()) {
      const d = await tx.department.upsert({ where: { id: id(`dept-${i}`) }, update: {}, create: { id: id(`dept-${i}`), orgId, name: `[DEMO] ${name}`, headName: `${head} (fictional)`, roles: ["OPERATIONAL_OWNER"] } });
      depIds.push(d.id); ownerIds.push(`dept:${d.id}`);
      const existingPrimary = await tx.departmentContact.findFirst({ where: { orgId, departmentId: d.id, isPrimary: true } });
      for (const [j, subFunction] of functions.entries()) await tx.departmentContact.upsert({ where: { id: id(`contact-${i}-${j}`) }, update: {}, create: {
        id: id(`contact-${i}-${j}`), orgId, departmentId: d.id, subFunction, name: `${head} — ${["Lead", "Deputy", "Coordinator"][j]} (fictional)`,
        email: `${i}.${j}@testorg.example`, designation: ["Function Lead", "Operations Specialist", "Privacy Coordinator"][j],
        responsibilities: `${marker} Maintain ${subFunction.toLowerCase()} inventory; review purpose/retention; coordinate requests, evidence collection and incident escalation.`,
        roles: ["OPERATIONAL_OWNER"], isPrimary: j === 0 && !existingPrimary,
      } });
      const primary = await tx.departmentContact.findFirst({ where: { orgId, departmentId: d.id, isPrimary: true } });
      if (primary && !d.spocName) await tx.department.update({ where: { id: d.id }, data: { spocName: primary.name, spocEmail: primary.email } });
    }
    const committee = [
      ["Vikram Sethi", "Chief Executive Officer (CEO)", "Executive sponsorship"], ["Aditi Rao", "Data Protection Officer (DPO)", "Privacy governance"],
      ["Kabir Nair", "Chief Information Security Officer (CISO)", "Security assurance"], ["Nisha Kapoor", "Chief Human Resources Officer (CHRO)", "Employee privacy"],
      ["Sana Ali", "Head - Legal / General Counsel", "Contracts and applicability review"], ["Dev Menon", "Chief Financial Officer (CFO)", "Budget and financial processing"],
      ["Rohan Mehta", "Chief Technology Officer (CTO)", "Product safeguards"],
    ];
    for (const [i, [name, designation, fn]] of committee.entries()) await tx.committeeMember.upsert({ where: { id: id(`committee-${i}`) }, update: {}, create: { id: id(`committee-${i}`), orgId, name: `${name} (fictional)`, email: email(name), designation, function: `[DEMO] ${fn}` } });
    const vendorNames = ["Nimbus Hosting", "PeopleSpring Payroll", "ReachLeaf Campaigns", "HelpHarbor Support", "LedgerBridge Billing", "VerifyTrail Screening"];
    const vendorIds: string[] = [];
    for (const [i, name] of vendorNames.entries()) {
      const v = await tx.vendor.upsert({ where: { id: id(`vendor-${i}`) }, update: {}, create: {
        id: id(`vendor-${i}`), orgId, name: `[DEMO] ${name}`, type: ["Cloud Hosting", "HR / Payroll", "Marketing", "SaaS Platform", "Payment Processor", "Other"][i],
        service: `${marker} ${["Managed hosting and encrypted backups", "Payroll calculation and employee payslips", "Optional email campaigns", "Support ticket routing", "Invoice generation and reconciliation", "Candidate verification"][i]}`,
        role: "PROCESSOR", country: "India", riskTier: i === 5 ? "HIGH" : i % 2 ? "MEDIUM" : "LOW", lastReview: ago(20 + i),
        dataCategories: i === 1 || i === 4 ? ["IDENTITY", "FINANCIAL", "CONTACT"] : ["IDENTITY", "CONTACT"],
        contactName: `Demo Vendor Contact ${i + 1} (fictional)`, contactEmail: `contact${i}@processors.example`, hasContract: i !== 5,
        contractExpiry: ahead(180), breachClause: i !== 5, certifications: [], securityControls: i === 5 ? [] : ["Encryption at rest", "MFA", "Access reviews", "Backup testing"],
        dsrContact: `privacy${i}@processors.example`, dsrChannel: "Email", dsrSla: "Internal demo target: acknowledge within 2 working days",
      } });
      vendorIds.push(v.id);
      await tx.subProcessor.upsert({ where: { id: id(`subprocessor-${i}`) }, update: {}, create: { id: id(`subprocessor-${i}`), orgId, vendorId: v.id, name: `[DEMO] Processor ${i + 1} Backup Services`, purpose: `${marker} Encrypted backup storage`, country: "India", dpaSigned: i !== 5 } });
    }
    const activities = [
      { app: "Customer Portal", type: "ONPREM_APP" as const, dep: 0, vendor: 0, activity: "Customer account onboarding", purpose: "Create customer accounts and deliver the subscribed business service", fields: ["FULL_NAME", "EMAIL", "PHONE", "USER_ID"], cats: ["IDENTITY", "CONTACT"], basis: "VOLUNTARY" as const, principal: "Customer", retention: "Account lifetime; review inactive accounts quarterly and retain only justified records" },
      { app: "Support Desk", type: "SAAS" as const, dep: 5, vendor: 3, activity: "Customer support resolution", purpose: "Receive, triage and resolve customer service tickets", fields: ["FULL_NAME", "EMAIL", "PHONE"], cats: ["IDENTITY", "CONTACT"], basis: "VOLUNTARY" as const, principal: "Customer", retention: "12 months after ticket closure, subject to documented legal hold" },
      { app: "Payroll Workspace", type: "SAAS" as const, dep: 3, vendor: 1, activity: "Employee payroll administration", purpose: "Calculate salaries and fulfil reviewed employment/payroll obligations", fields: ["FULL_NAME", "EMPLOYEE_ID", "SALARY", "BANK_ACCOUNT", "PAN"], cats: ["IDENTITY", "EMPLOYMENT", "FINANCIAL"], basis: "EMPLOYMENT" as const, principal: "Employee", retention: "Retention schedule HR-RET-01 (fictional); statutory periods require legal review" },
      { app: "Recruitment Tracker", type: "SAAS" as const, dep: 3, vendor: 5, activity: "Recruitment and candidate screening", purpose: "Evaluate applications and coordinate candidate-provided verification", fields: ["FULL_NAME", "EMAIL", "RESUME", "BGV"], cats: ["IDENTITY", "CONTACT", "EMPLOYMENT"], basis: "CONSENT" as const, principal: "Applicant", retention: "180 days after recruitment closure unless separately opted into talent pool" },
      { app: "Campaign Console", type: "SAAS" as const, dep: 4, vendor: 2, activity: "Optional product updates", purpose: "Send optional product announcements to customers who opt in", fields: ["FULL_NAME", "EMAIL", "PREFERENCES"], cats: ["IDENTITY", "CONTACT", "BEHAVIOURAL"], basis: "CONSENT" as const, principal: "Customer", retention: "Until withdrawal or 12 months inactivity; suppress withdrawn addresses" },
      { app: "Invoice Ledger", type: "SAAS" as const, dep: 6, vendor: 4, activity: "Customer billing and reconciliation", purpose: "Issue invoices and reconcile service payments", fields: ["FULL_NAME", "EMAIL", "ADDRESS", "TRANSACTIONS", "TAX_RECORDS"], cats: ["IDENTITY", "CONTACT", "FINANCIAL"], basis: "VOLUNTARY" as const, principal: "Customer", retention: "Finance schedule FIN-RET-02 (fictional); tax retention reviewed separately" },
      { app: "Access Directory", type: "ONPREM_APP" as const, dep: 1, vendor: 0, activity: "Workforce access management", purpose: "Provision least-privilege employee access and revoke access at exit", fields: ["FULL_NAME", "EMAIL", "EMPLOYEE_ID", "DESIGNATION", "USAGE_LOGS"], cats: ["IDENTITY", "CONTACT", "EMPLOYMENT", "DEVICE_NETWORK"], basis: "EMPLOYMENT" as const, principal: "Employee", retention: "Accounts disabled on exit; access evidence retained under reviewed security schedule" },
      { app: "Security Event Store", type: "INTERNAL_DB" as const, dep: 2, vendor: 0, activity: "Security monitoring and investigation", purpose: "Investigate suspicious workforce access to company systems", fields: ["EMAIL", "USER_ID", "USAGE_LOGS"], cats: ["CONTACT", "DEVICE_NETWORK"], basis: "EMPLOYMENT" as const, principal: "Employee", retention: "Security log schedule SEC-RET-03 (fictional); access restricted to investigators" },
      { app: "Privacy Case Register", type: "ONPREM_APP" as const, dep: 7, vendor: 0, activity: "Privacy request coordination", purpose: "Coordinate voluntarily submitted privacy enquiries and responses", fields: ["FULL_NAME", "EMAIL", "USER_ID"], cats: ["IDENTITY", "CONTACT"], basis: "VOLUNTARY" as const, principal: "Customer", retention: "24 months after closure unless a reviewed legal hold applies" },
      { app: "Service Analytics Store", type: "DATA_WAREHOUSE" as const, dep: 0, vendor: 0, activity: "Optional service usage analytics", purpose: "Understand opted-in usage patterns to prioritise service improvements", fields: ["USER_ID", "USAGE_LOGS", "PREFERENCES"], cats: ["IDENTITY", "BEHAVIOURAL", "DEVICE_NETWORK"], basis: "CONSENT" as const, principal: "Customer", retention: "Raw events 90 days; retain aggregated non-identifying reports only after review" },
    ];
    const orgProfile = await tx.organisation.findUniqueOrThrow({ where: { id: orgId } });
    for (const [i, a] of activities.entries()) {
      const asset = await tx.dataAsset.upsert({ where: { id: id(`asset-${i}`) }, update: {}, create: {
        id: id(`asset-${i}`), orgId, name: `[DEMO] ${a.app}`, type: a.type, description: `${marker} ${a.purpose}.`, departmentId: depIds[a.dep], ownerName: `${departments[a.dep][1]} (fictional)`,
        hostingLocation: "India — fictional Bengaluru primary / Mumbai recovery", hostedInIndia: true, storesPersonalData: true,
        sourcing: a.type === "SAAS" ? "OUTSOURCED" : "IN_HOUSE", vendorId: vendorIds[a.vendor], vendorAccess: "LIMITED_ACCESS", dataCategories: a.cats, piiFields: a.fields,
      } });
      const evaluation = Object.fromEntries(DEFS.map((d, n) => [d.id, i === 3 && n % 3 === 0 ? "Not met" : (i + n) % 7 === 0 ? "Partial" : "Met"]));
      const ropa = await tx.ropaRecord.upsert({ where: { id: id(`ropa-${i}`) }, update: {}, create: {
        id: id(`ropa-${i}`), orgId, activity: `[DEMO] ${a.activity}`, purpose: `${marker} ${a.purpose}.`, purposeCategory: i === 9 ? "Analytics" : a.activity,
        departmentId: depIds[a.dep], principalCategory: a.principal, role: "DATA_FIDUCIARY", piiFields: a.fields, dataCategories: a.cats,
        source: "Fictional first-party form or authenticated employee workflow", storage: `[DEMO] ${a.app}; encrypted India-hosted storage`, retention: a.retention,
        legalBasis: a.basis, otherParties: [], crossBorder: false, controlEval: evaluation,
        techDetails: { tech_encryption: "DEMO: AES-256 at rest; TLS in transit", tech_access: "DEMO: role-based access, quarterly reviews", tech_logging: "DEMO: restricted access logs; incident review", tech_backup: "DEMO: encrypted daily backups; quarterly recovery exercise" },
        notes: `${marker} Proposed basis and retention are scenario assumptions for review, not legal advice. Reference DEMO-ROPA-${i + 1}.`,
      } });
      await tx.ropaAsset.upsert({ where: { ropaId_assetId: { ropaId: ropa.id, assetId: asset.id } }, update: {}, create: { orgId, ropaId: ropa.id, assetId: asset.id } });
      await tx.ropaVendor.upsert({ where: { ropaId_vendorId: { ropaId: ropa.id, vendorId: vendorIds[a.vendor] } }, update: {}, create: { orgId, ropaId: ropa.id, vendorId: vendorIds[a.vendor] } });
      const loaded = await tx.ropaRecord.findUniqueOrThrow({ where: { id: ropa.id }, include: { department: true, vendors: { include: { vendor: true } } } });
      const assessed = assessRopa(loaded, orgProfile), status = i % 3 === 0 ? "DRAFT" : i % 3 === 1 ? "UNDER_REVIEW" : "APPROVED";
      await tx.dpia.upsert({ where: { id: id(`dpia-${i}`) }, update: {}, create: {
        id: id(`dpia-${i}`), orgId, ropaId: ropa.id, activity: ropa.activity, department: departments[a.dep][0], riskLevel: assessed.risk.level,
        riskScore: assessed.risk.score, riskFactors: assessed.risk.factors as unknown as Prisma.InputJsonValue, necessity: `${marker} ${a.purpose}; collect only the stated fields. Alternatives considered: anonymous enquiry, aggregation and shorter retention.`,
        proportionality: `${marker} ${a.fields.length} fields are mapped to this specific purpose; optional analytics and marketing remain separate. Review identifiers and access before rollout.`,
        mitigations: mitigationsFor(assessed.risk.factors.map((f) => f.key)), residualLevel: i === 3 ? "HIGH" : "MEDIUM",
        residualNote: `${marker} Monitor access, review vendor agreements and verify deletion; open actions remain.`, reviewNotes: `${marker} Demonstration review record DEMO-DPIA-${i + 1}; no real approval occurred.`,
        status, auto: false, approverRef: status === "APPROVED" ? `member:${id("committee-1")}` : null, approvedAt: status === "APPROVED" ? ago(2) : null,
      } });
    }
    for (const [i, control] of library.controls.entries()) {
      const na = autoNa(control.audience, orgProfile);
      const status = na ? "NOT_APPLICABLE" : (["IMPLEMENTED", "IMPLEMENTED", "PARTIAL", "PLANNED", "NOT_IMPLEMENTED"] as const)[i % 5];
      await tx.controlAssessment.upsert({ where: { orgId_controlId: { orgId, controlId: control.id } }, update: {}, create: {
        id: id(`assessment-${control.id}`), orgId, controlId: control.id, status,
        evidence: `${marker} ${na || `Illustrative assessment of ${control.title}. Evidence reference DEMO-${control.code}: draft procedure, sample access review and fictional test record. Status is synthetic for the walkthrough.`}`,
        owners: [ownerIds[i % ownerIds.length]], targetDate: status === "PARTIAL" || status === "PLANNED" || status === "NOT_IMPLEMENTED" ? ahead(7 + i % 21) : null,
      } });
      if (status !== "NOT_APPLICABLE" && status !== "IMPLEMENTED") await tx.gapTracking.upsert({ where: { orgId_gapKey: { orgId, gapKey: `CTL-${control.code}` } }, update: {}, create: {
        id: id(`gap-${control.id}`), orgId, gapKey: `CTL-${control.code}`, status: i % 2 ? "IN_PROGRESS" : "OPEN", owners: [ownerIds[i % ownerIds.length]], dueDate: ahead(7 + i % 21), notes: `${marker} Owner to close DEMO-${control.code}: update procedure, perform a sample test and attach reviewed evidence.`,
      } });
    }
    await tx.consentConfig.upsert({ where: { orgId }, update: {}, create: {
      id: id("consent-config"), orgId, dataItems: ["Name", "Email", "Account reference"], purposes: ["Optional product updates", "Optional usage analytics"],
      rightsPortalUrl: `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/privacy/${orgId}`,
      crossBorderText: "FICTIONAL DEMO: no international transfers in this scenario; verify actual processors before deployment.",
      cmp: { layered: "YES", granular: "YES", log: "PARTIAL", withdraw: "PARTIAL", lang: "PARTIAL", cm: "NO", cm_receive: "NO", cm_registered: "NO", processor_withdrawals: "PARTIAL", parental: orgProfile.handlesChildrenData ? "NO" : "NA", reconsent: "PARTIAL", _cmReadiness: { routingOwner: "Aditi Rao (fictional)", processorRouting: "DEMO: Campaign Console -> manual processor task -> recorded acknowledgement; escalate missing response to privacy lead.", routingTimescale: "DEMO internal target: 2 working days, subject to reviewed exceptions", routingEvidence: "FICTIONAL tabletop DEMO-WD-01; no actual processor was contacted." } },
      cmpNotes: `${marker} Partial states deliberately illustrate planned improvements. No registered Consent Manager or guardian verification is represented.`,
    } });
    const purposes = ["Optional product updates", "Optional usage analytics", "Recruitment talent pool"];
    const purposeIds: string[] = [];
    for (const [i, title] of purposes.entries()) {
      const purpose = await tx.consentPurpose.upsert({ where: { orgId_key: { orgId, key: `demo-purpose-${i}` } }, update: {}, create: { id: id(`purpose-${i}`), orgId, key: `demo-purpose-${i}`, targets: [`[DEMO] ${i === 0 ? "Campaign Console" : i === 1 ? "Service Analytics Store" : "Recruitment Tracker"}`] } });
      purposeIds.push(purpose.id);
      for (const version of [1, 2]) await tx.consentNotice.upsert({ where: { orgId_purposeId_version: { orgId, purposeId: purpose.id, version } }, update: {}, create: {
        id: id(`notice-${i}-${version}`), orgId, purposeId: purpose.id, version, title: `[DEMO] ${title}`, description: `${marker} Separate optional purpose: ${title.toLowerCase()}.`, dataItems: ["Email", "Account reference"],
        text: `${marker}\nWe request an optional choice for ${title.toLowerCase()}. This is separate from the core service. We use your email and account reference for this purpose only. You may decline or withdraw in the private consent portal. Contact privacy@testorg.example for this fictional scenario. Version ${version}${version === 2 ? " clarifies the withdrawal process." : "."}`,
        publishedBy: "DEMO_SEED", publishedAt: ago(version === 1 ? 20 : 5), language: "en", targets: purpose.targets,
      } });
    }
    for (let i = 0; i < 8; i++) {
      const subject = await tx.consentSubject.upsert({ where: { orgId_email: { orgId, email: `demo.customer.${i + 1}@testorg.example` } }, update: {}, create: { id: id(`customer-${i}`), orgId, email: `demo.customer.${i + 1}@testorg.example`, reference: `FICTIONAL-DEMO-CUSTOMER-${i + 1}`, revision: 0 } });
      // Existing customers/decisions are never overwritten or given live portal tokens.
      if (await tx.consentEvent.count({ where: { orgId, subjectId: subject.id } })) continue;
      let revision = subject.revision;
      for (let p = 0; p < purposes.length; p++) {
        const grant = (i + p) % 3 !== 0;
        const event = await tx.consentEvent.create({ data: { id: id(`event-${i}-${p}`), orgId, subjectId: subject.id, purposeId: purposeIds[p], noticeId: id(`notice-${p}-1`), revision: ++revision, choice: grant ? "GRANTED" : "DENIED", source: "DEMO_SEED", createdAt: ago(12 - i) } });
        if (grant && (i + p) % 4 === 0) {
          const withdrawal = await tx.consentEvent.create({ data: { id: id(`withdrawal-${i}-${p}`), orgId, subjectId: subject.id, purposeId: purposeIds[p], noticeId: event.noticeId, revision: ++revision, choice: "WITHDRAWN", source: "DEMO_SEED", createdAt: ago(1) } });
          await tx.consentWithdrawalTask.create({ data: { id: id(`withdrawal-task-${i}-${p}`), orgId, eventId: withdrawal.id, target: `[DEMO] ${purposes[p]}`, ...(i % 2 ? { acknowledgedAt: ago(0.5), acknowledgedBy: "DEMO_SEED", note: `${marker} Simulated acknowledgement only; no external system changed.` } : {}) } });
        }
      }
      await tx.consentSubject.update({ where: { id: subject.id }, data: { revision } });
    }
    for (let i = 0; i < 3; i++) await tx.breach.upsert({ where: { id: id(`incident-${i}`) }, update: {}, create: {
      id: id(`incident-${i}`), orgId, title: `[SIMULATED DEMO] ${["Misdirected support export", "Lost encrypted laptop", "Excessive analytics access"][i]}`,
      detectedAt: ago(i === 0 ? 0.1 : 10 + i), nature: ["Accidental disclosure", "Device loss", "Unauthorised access"][i],
      description: `${marker} Tabletop exercise involving synthetic records. No real incident, personal data loss or regulatory communication occurred.`, dataAffected: "Fictional email addresses and demo account references only", principalsAffected: [12, 1, 24][i],
      status: i === 0 ? "OPEN" : i === 1 ? "CONTAINED" : "CLOSED", rootCause: `${marker} Example process exception: incorrect export scope, asset handling or broad access role.`,
      measures: `${marker} Contain access, preserve synthetic evidence, validate scope, review the notification decision with the privacy lead, and retest safeguards.`,
    } });
    const previousAudit = await tx.auditLog.findFirst({ where: { orgId, action: "demo.dataset_loaded", entityId: id("dataset") } });
    if (!previousAudit) await tx.auditLog.create({ data: { orgId, action: "demo.dataset_loaded", entity: "DemoDataset", entityId: id("dataset"), meta: { fictional: true, source: "SAMVAAD demo loader", externalActions: false } } });
    if (refresh) {
      await refreshExistingDemo(tx, orgId, now);
      await polishDemoPresentation(tx, orgId);
    }
    console.log("Demo dataset loaded. Record IDs, passwords, memberships and immutable history were preserved. No emails sent; no external systems contacted. Refresh the app and select TestOrg. Generate PDF/DOCX reports from the Reports page.");
  }, { maxWait: 10_000, timeout: 120_000 });
}
run().catch((e) => { console.error(e instanceof Error ? e.message : "Demo load failed; database transaction rolled back."); process.exitCode = 1; }).finally(() => db.$disconnect());
