import { PII_FIELDS, categoryLabel } from "./pii";
import { legalBasisLabel } from "./enums";

// Items and purposes the notice should list, derived from what the RoPA says you actually process.
export function deriveNoticeItems(ropa: { piiFields: string[]; dataCategories: string[]; purposeCategory: string | null; purpose: string }[]) {
  const byKey = new Map(PII_FIELDS.map((f) => [f.key, f.label]));
  const items = new Set<string>();
  for (const r of ropa) {
    if (r.piiFields.length) r.piiFields.forEach((k) => items.add(byKey.get(k) ?? k));
    else r.dataCategories.forEach((c) => items.add(categoryLabel(c)));
  }
  const purposes = new Set<string>();
  for (const r of ropa) purposes.add(r.purposeCategory ?? r.purpose);
  return { dataItems: [...items].sort(), purposes: [...purposes].filter(Boolean).sort() };
}

export type NoticeInput = {
  orgName: string; dpoName?: string | null; dpoEmail?: string | null; grievanceEmail?: string | null;
  rightsPortalUrl?: string | null; dataItems: string[]; purposes: string[]; legalBases: string[];
  handlesChildren: boolean; crossBorder: boolean; crossBorderText?: string | null; date: Date;
};

/** Plain-text privacy notice covering the content Sec 5 and Rule 3 expect. A draft for legal review. */
export function generateNotice(i: NoticeInput): string {
  const bullets = (xs: string[], empty: string) => (xs.length ? xs.map((x) => `  - ${x}`).join("\n") : `  - ${empty}`);
  const consent = i.legalBases.includes("CONSENT");
  const uses = i.legalBases.filter((b) => b !== "CONSENT");
  const contact = i.dpoEmail ?? "[contact email]";
  const lines = [
    "PRIVACY NOTICE",
    `Issued by: ${i.orgName}`,
    `Date: ${i.date.toISOString().slice(0, 10)}`,
    "Issued under Section 5 of the Digital Personal Data Protection Act, 2023 and Rule 3 of the DPDP Rules.",
    "",
    "1. THE PERSONAL DATA WE PROCESS",
    bullets(i.dataItems, "[add the personal data items you collect]"),
    "",
    "2. WHY WE PROCESS IT",
    bullets(i.purposes, "[add the specific purposes]"),
    "",
    "3. ON WHAT BASIS",
    consent ? "  - Your consent, given by a clear action, for the purposes described above (Section 6)." : "",
    ...uses.map((b) => `  - ${legalBasisLabel(b)}.`),
    !i.legalBases.length ? "  - [record the lawful basis for each activity in the RoPA]" : "",
    "",
    "4. YOUR RIGHTS",
    "You may ask us for a summary of your personal data and who it is shared with (Section 11); ask us to correct, complete, update or erase it (Section 12); raise a grievance with us (Section 13); and nominate another person to exercise your rights if you die or cannot act (Section 14).",
    "",
    "5. WITHDRAWING CONSENT",
    "Where we rely on your consent, you can withdraw it at any time, as easily as you gave it. Withdrawal does not affect processing already done lawfully.",
    i.rightsPortalUrl ? `  - Use: ${i.rightsPortalUrl}` : "  - Use: [rights portal link]",
    `  - Or write to: ${contact}`,
    "",
    "6. HOW TO REACH US AND COMPLAIN",
    i.dpoName ? `  - Contact person: ${i.dpoName}` : "",
    `  - Email: ${contact}`,
    i.grievanceEmail ? `  - Grievances: ${i.grievanceEmail}` : "",
    "If you are not satisfied with our response, you may complain to the Data Protection Board of India.",
    "",
    "7. CHILDREN",
    i.handlesChildren
      ? "We process a child's personal data only with the verifiable consent of a parent or lawful guardian (Section 9). We do not track or monitor a child's behaviour or direct targeted advertising at children."
      : "We do not knowingly process the personal data of children.",
    "",
    "8. TRANSFERS OUTSIDE INDIA",
    i.crossBorderText?.trim() || (i.crossBorder
      ? "We transfer some personal data outside India. We do this only as permitted under Section 16 of the Act and any restrictions the Central Government notifies."
      : "We do not currently transfer personal data outside India."),
    "",
    "9. LANGUAGE",
    "This notice is available in English and in any language listed in the Eighth Schedule to the Constitution on request.",
  ];
  return lines.filter((l, idx, a) => !(l === "" && a[idx - 1] === "")).join("\n");
}

export const CMP_ITEMS = [
  { id: "layered", label: "Layered notice: short just-in-time notice plus the full policy", refs: "Sec 5, Rule 3", codes: ["DPDP-5-001", "DPDP-5-005"] },
  { id: "granular", label: "Granular consent: a separate choice for each purpose", refs: "Sec 6(1)", codes: ["DPDP-6-001", "DPDP-6-002"] },
  { id: "log", label: "Tamper-evident consent log: every consent, refusal and withdrawal recorded", refs: "Sec 6(10)", codes: ["DPDP-6-010"] },
  { id: "withdraw", label: "Withdrawal as easy as giving consent", refs: "Sec 6(4)", codes: ["DPDP-6-007", "DPDP-6-009"] },
  { id: "lang", label: "Notice and consent available in English and Eighth Schedule languages", refs: "Sec 5(3), 6(3)", codes: ["DPDP-5-008", "DPDP-6-004"] },
  { id: "cm", label: "Consent Manager integration, if you use one", refs: "Sec 6(7)-(9), Rule 4", codes: ["DPDP-R4-006"] },
  { id: "cm_receive", label: "Fiduciary readiness: receive and action consent and withdrawal instructions through a Consent Manager", refs: "Sec 6(7)", codes: ["DPDP-R4-006"] },
  { id: "cm_registered", label: "Fiduciary readiness: check the Consent Manager is registered with the Board before relying on relayed consent", refs: "Sec 6(9), Rule 4", codes: ["DPDP-R4-006"] },
  { id: "processor_withdrawals", label: "Fiduciary readiness: pass withdrawals to relevant processors and track cessation / acknowledgements", refs: "Sec 6(6), Sec 8(2)", codes: ["DPDP-6-009"] },
  { id: "parental", label: "Verifiable parental or guardian consent for children", refs: "Sec 9, Rule 10", codes: ["DPDP-9-001", "DPDP-9-003"] },
  { id: "reconsent", label: "Notice flow for users who consented before the Act commenced", refs: "Sec 5(2)", codes: ["DPDP-5-009"] },
] as const;
export const CMP_STATES = ["YES", "PARTIAL", "NO", "NA"] as const;
export const CMP_LABELS: Record<string, string> = { YES: "In place", PARTIAL: "Partly", NO: "Not yet", NA: "Not applicable" };
