import type { Prisma } from "@prisma/client";

export const sampleNames = [
  "Sneha Pillai", "Karthik Subramani", "Aditi Rao", "Manish Goyal", "Pooja Nair", "Suresh Krishnan",
  "Rohit Anand", "Meera Saxena", "Nisha Kapoor", "Ananya Desai", "Rahul Verma", "Ishita Bose",
  "Arjun Sen", "Priya Menon", "Neha Sharma", "Tara Iyer", "Vivek Joshi", "Kavya Reddy",
  "Dev Menon", "Ritika Shah", "Aman Gupta", "Sana Ali", "Rohan Mehta", "Vikram Sethi",
  "Anjali Kulkarni", "Nikhil Bhat", "Divya Raman", "Varun Malhotra", "Sonal Jain", "Aditya Sinha",
];
export function cleanPresentationText(value: string | null | undefined): string {
  return (value || "")
    .replace(/FICTIONAL DEMO\s*[—–-]\s*not real evidence, approval, consent or notification\.\s*/gi, "")
    .replace(/\[(?:SIMULATED DEMO|DEMO)\]\s*/gi, "")
    .replace(/\s*\(fictional\)/gi, "")
    .replace(/\b(?:fictional|demo|synthetic|simulated|illustrative)\s*[:—–-]?\s*/gi, "")
    .replace(/\s{2,}/g, " ").trim();
}
export const nameEmail = (name: string) => `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@testorg.example`;
const departmentHead = (name: string, i: number) => {
  if (/engineering|product/i.test(name)) return "Rohan Mehta";
  if (/information technology|^it$/i.test(name)) return "Meera Shah";
  if (/security/i.test(name)) return "Kabir Nair";
  if (/human|\bhr\b/i.test(name)) return "Nisha Kapoor";
  if (/sales|marketing/i.test(name)) return "Arjun Sen";
  if (/customer|support/i.test(name)) return "Tara Iyer";
  if (/finance|account/i.test(name)) return "Dev Menon";
  if (/legal|privacy/i.test(name)) return "Aditi Rao";
  return sampleNames[i % sampleNames.length];
};

function uniqueNames<T extends { id: string; name: string }>(rows: T[]) {
  const used = new Set<string>();
  return rows.map((r) => {
    const base = cleanPresentationText(r.name) || "Operations";
    let name = base, n = 2;
    while (used.has(name)) name = `${base} — Team ${n++}`;
    used.add(name);
    return { id: r.id, name };
  });
}

/** Presentation copy for a sample-data tenant; never changes accounts or sends messages. */
export async function polishDemoPresentation(tx: Prisma.TransactionClient, orgId: string) {
  const org = await tx.organisation.findUniqueOrThrow({ where: { id: orgId } });
  if (!/^test\s*org$/i.test(org.name.trim())) throw new Error("Presentation cleanup is restricted to TestOrg.");
  await tx.organisation.update({ where: { id: orgId }, data: { legalName: "TestOrg Digital Services", registrationNo: null, address: "Business Park, Whitefield, Bengaluru, Karnataka", dpoName: "Aditi Rao", dpoEmail: "aditi.rao@testorg.example" } });
  const departments = await tx.department.findMany({ where: { orgId }, include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }, { id: "asc" }] } }, orderBy: { name: "asc" } });
  // Temporary unique names allow prefix removal even if both IT and [DEMO] IT exist.
  const deptNames = uniqueNames(departments);
  for (const d of departments) await tx.department.update({ where: { id: d.id }, data: { name: `presentation-${d.id}` } });
  for (const [i, d] of departments.entries()) {
    for (const [j, c] of d.contacts.entries()) {
      const name = sampleNames[(i * 3 + j) % sampleNames.length];
      await tx.departmentContact.update({ where: { id: c.id }, data: { name, email: nameEmail(name), designation: j === 0 ? "Function Lead" : "Privacy Coordinator", responsibilities: `Maintain the ${cleanPresentationText(c.subFunction)} inventory, coordinate privacy requests, review access and retention, and track remediation evidence.`, subFunction: cleanPresentationText(c.subFunction) } });
    }
    const primary = await tx.departmentContact.findFirst({ where: { orgId, departmentId: d.id, isPrimary: true } });
    await tx.department.update({ where: { id: d.id }, data: { name: deptNames[i].name, headName: departmentHead(deptNames[i].name, i), spocName: primary?.name || null, spocEmail: primary?.email || null } });
  }
  const members = await tx.committeeMember.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } });
  for (const [i, m] of members.entries()) {
    const name = /\(DPO\)/.test(m.designation || "") ? "Aditi Rao" : /\(CEO\)/.test(m.designation || "") ? "Vikram Sethi" : /\(CISO\)/.test(m.designation || "") ? "Kabir Nair" : /\(CHRO\)/.test(m.designation || "") ? "Nisha Kapoor" : /Legal/.test(m.designation || "") ? "Sana Ali" : /\(CFO\)/.test(m.designation || "") ? "Dev Menon" : /\(CTO\)/.test(m.designation || "") ? "Rohan Mehta" : sampleNames[i % sampleNames.length];
    await tx.committeeMember.update({ where: { id: m.id }, data: { name, email: nameEmail(name), function: cleanPresentationText(m.function) || "Governance and operational oversight" } });
  }
  const vendors = await tx.vendor.findMany({ where: { orgId }, orderBy: { name: "asc" } });
  const vendorNames = uniqueNames(vendors);
  for (const v of vendors) await tx.vendor.update({ where: { id: v.id }, data: { name: `presentation-${v.id}` } });
  for (const [i, v] of vendors.entries()) {
    const name = sampleNames[(i + 8) % sampleNames.length];
    await tx.vendor.update({ where: { id: v.id }, data: { name: vendorNames[i].name, contactName: name, contactEmail: nameEmail(name), service: cleanPresentationText(v.service), dsrSla: "Acknowledge within 2 working days", dsrContact: "privacy@processors.example" } });
  }
  for (const s of await tx.subProcessor.findMany({ where: { orgId } })) await tx.subProcessor.update({ where: { id: s.id }, data: { name: cleanPresentationText(s.name).replace(/^Processor (\d+) /, "Regional "), purpose: "Encrypted backups and restricted infrastructure support" } });
  const assets = await tx.dataAsset.findMany({ where: { orgId }, orderBy: { name: "asc" } });
  const assetNames = uniqueNames(assets);
  for (const a of assets) await tx.dataAsset.update({ where: { id: a.id }, data: { name: `presentation-${a.id}` } });
  for (const [i, a] of assets.entries()) await tx.dataAsset.update({ where: { id: a.id }, data: { name: assetNames[i].name, description: `${assetNames[i].name} supports the assigned business workflow with role-based access and documented retention.`, ownerName: sampleNames[(i + 4) % sampleNames.length], hostingLocation: "Bengaluru primary region; Mumbai recovery region" } });
  for (const r of await tx.ropaRecord.findMany({ where: { orgId } })) await tx.ropaRecord.update({ where: { id: r.id }, data: {
    activity: cleanPresentationText(r.activity), purpose: cleanPresentationText(r.purpose), source: "Customer forms and authenticated workforce workflows", storage: cleanPresentationText(r.storage),
    retention: cleanPresentationText(r.retention).replace(/This is a scenario assumption, not a statutory period\./g, "Subject to the approved retention schedule and legal holds."),
    notes: "Purpose, lawful basis and retention are recorded for review by the privacy owner. Changes require reassessment.",
    techDetails: { tech_encryption: "AES-256 at rest; TLS in transit", tech_access: "Role-based access; quarterly reviews", tech_logging: "Restricted event logs and investigation procedures", tech_backup: "Encrypted daily backups; quarterly restoration checks" },
  } });
  for (const d of await tx.dpia.findMany({ where: { orgId }, include: { ropa: { include: { department: true } } } })) await tx.dpia.update({ where: { id: d.id }, data: {
    activity: d.ropa?.activity || cleanPresentationText(d.activity), department: d.ropa?.department?.name || cleanPresentationText(d.department),
    necessity: cleanPresentationText(d.necessity), proportionality: cleanPresentationText(d.proportionality), residualNote: cleanPresentationText(d.residualNote),
    reviewNotes: "Review collection necessity, access controls and processor terms. Track outstanding mitigations before the next review.", mitigations: d.mitigations.map(cleanPresentationText),
  } });
  for (const a of await tx.controlAssessment.findMany({ where: { orgId }, include: { control: true } })) await tx.controlAssessment.update({ where: { id: a.id }, data: {
    evidence: a.status === "NOT_APPLICABLE" ? cleanPresentationText(a.evidence) : `${a.control.code}: ${a.control.title}. References: privacy procedure, access-review register and safeguard test record. ${a.status === "IMPLEMENTED" ? "Recorded as implemented; supporting evidence is available for reviewer assessment." : "Owner is completing documentation and safeguard validation; follow-up is tracked in remediation."}`,
  } });
  for (const g of await tx.gapTracking.findMany({ where: { orgId } })) await tx.gapTracking.update({ where: { id: g.id }, data: { notes: `Review ${g.gapKey}, implement the agreed safeguard, validate a sample and attach closure evidence for the privacy lead.` } });
  await tx.consentConfig.updateMany({ where: { orgId }, data: { crossBorderText: "Personal data is stored in India. Review processor locations before approving any international transfer.", cmpNotes: "Separate purpose choices and versioned notices are in place. Multilingual notices and processor follow-up remain improvement priorities.", cmp: { layered: "YES", granular: "YES", log: "PARTIAL", withdraw: "PARTIAL", lang: "PARTIAL", cm: "NO", cm_receive: "NO", cm_registered: "NO", processor_withdrawals: "PARTIAL", parental: "NA", reconsent: "PARTIAL", _cmReadiness: { routingOwner: "Aditi Rao", processorRouting: "Privacy Operations reviews withdrawals, sends instructions to the relevant processor and records acknowledgements. Unanswered requests are escalated to the privacy lead.", routingTimescale: "Internal target: 2 working days. Document and review any lawful retention exception.", routingEvidence: "Processor acknowledgement register and withdrawal follow-up queue." } } } });
  const subjects = await tx.consentSubject.findMany({ where: { orgId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  for (const s of subjects) await tx.consentSubject.update({ where: { id: s.id }, data: { email: `pending.${s.id}@testorg.example` } });
  for (const [i, s] of subjects.entries()) await tx.consentSubject.update({ where: { id: s.id }, data: { email: nameEmail(sampleNames[i % sampleNames.length]).replace("@", `${i >= sampleNames.length ? `.${Math.floor(i / sampleNames.length) + 1}` : ""}@`), reference: `CUST-${String(1001 + i)}`, tokenHash: null, tokenExpiresAt: null } });
  for (const p of await tx.consentPurpose.findMany({ where: { orgId }, include: { notices: { orderBy: { version: "desc" }, take: 1 } } })) {
    const targets = p.targets.map(cleanPresentationText);
    await tx.consentPurpose.update({ where: { id: p.id }, data: { targets } });
    const latest = p.notices[0];
    if (latest?.publishedBy === "PRESENTATION_V1") continue;
    const title = cleanPresentationText(latest?.title || p.key);
    await tx.consentNotice.create({ data: { orgId, purposeId: p.id, version: (latest?.version || 0) + 1, title, description: `Choose whether we may use your information for ${title.toLowerCase()}.`, dataItems: ["Email", "Account reference"], language: "en", publishedBy: "PRESENTATION_V1", targets,
      text: `Purpose: ${title}. We use your email and account reference for this optional purpose. Your choice is separate from the core service. You may decline or withdraw through your privacy portal. Contact privacy@testorg.example for assistance. We retain information according to the applicable retention schedule and stop optional processing after withdrawal, subject to documented legal exceptions.`,
    } });
  }
  for (const t of await tx.consentWithdrawalTask.findMany({ where: { orgId } })) await tx.consentWithdrawalTask.update({ where: { id: t.id }, data: { target: cleanPresentationText(t.target), note: t.acknowledgedAt ? "Acknowledgement recorded; review the processor response and supporting closure evidence." : "Awaiting processor follow-up and acknowledgement." } });
  for (const [i, b] of (await tx.breach.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } })).entries()) await tx.breach.update({ where: { id: b.id }, data: {
    title: ["Misdirected support export", "Lost encrypted laptop", "Excessive analytics access"][i % 3],
    description: ["A support export was shared with an unintended internal recipient. The team is checking scope and confirming removal.", "A workforce laptop was reported missing. Device encryption and remote access revocation are being reviewed.", "An analytics account had access beyond its assigned role. Access was restricted and the activity log is under review."][i % 3],
    dataAffected: "Email addresses and account references", rootCause: "Export scope, device handling or access-role configuration requires review.", measures: "Restrict access, preserve investigation records, assess impact, review notification obligations and validate corrective safeguards.",
  } });
}
