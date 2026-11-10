// HEURISTIC inherent-risk score for a RoPA activity. A screening aid to prioritise DPIAs, not a legal
// determination. The DPDPA has no "sensitive data" class; these factors are what typically raises impact.
// Review the weights with your DPO / counsel.
export type RopaRiskInput = {
  dataCategories: string[];
  piiFields: string[];
  principalCategory: string;
  purposeCategory: string | null;
  departmentName: string | null;
  crossBorder: boolean;
  crossBorderCountry: string | null;
  vendorCount: number;
  otherPartyCount: number;
  hasLawfulBasis: boolean;
  hasSecurityEvidence: boolean;
  orgHandlesChildren: boolean;
};

export type RiskFactor = { key: string; label: string; weight: number; ref: string };
export type RopaRisk = { score: number; level: "Low" | "Medium" | "High"; factors: RiskFactor[] };

const SENSITIVE_FIELDS = new Set(["AADHAAR", "MEDICAL_RECORDS", "PRESCRIPTIONS", "DISABILITY", "SEXUAL_ORIENTATION", "CRIMINAL"]);
const FINANCIAL_FIELDS = new Set(["BANK_ACCOUNT", "SALARY", "PAN", "UPI", "CARD"]);

export function scoreRopaRisk(r: RopaRiskInput): RopaRisk {
  const factors: RiskFactor[] = [];
  const add = (key: string, label: string, weight: number, ref: string) => factors.push({ key, label, weight, ref });
  const cats = new Set(r.dataCategories);

  if (cats.has("HEALTH_SENSITIVE") || cats.has("BIOMETRIC") || r.piiFields.some((f) => SENSITIVE_FIELDS.has(f)))
    add("sensitive", "High-impact data (health, biometric, Aadhaar or similar)", 3, "Sec 8(5), Sec 10(1)(b)");
  if (cats.has("FINANCIAL") || r.piiFields.some((f) => FINANCIAL_FIELDS.has(f)))
    add("financial", "Financial identifiers", 2, "Sec 8(5)");
  if (r.orgHandlesChildren || cats.has("CHILDREN") || r.principalCategory.toLowerCase().startsWith("child"))
    add("children", "Children's data", 3, "Sec 9");
  if (r.crossBorder)
    add("crossborder", `Cross-border transfer${r.crossBorderCountry ? ` (${r.crossBorderCountry})` : ""}`, 2, "Sec 16, Rule 15");
  if (cats.has("BEHAVIOURAL") || cats.has("LOCATION") || /analytics|fraud/i.test(r.purposeCategory ?? "") || /\bai\b|data science/i.test(r.departmentName ?? ""))
    add("profiling", "Profiling, analytics or location tracking", 2, "Sec 10(2)(c)");
  if (r.vendorCount > 0 || r.otherPartyCount > 0)
    add("vendors", "Shared with vendors or other parties", 1, "Sec 8(2)");
  if (r.principalCategory === "Customer")
    add("customer", "External customer data", 1, "Sec 8(1)");
  if (!r.hasLawfulBasis)
    add("nobasis", "No lawful basis recorded", 2, "Sec 4");
  if (!r.hasSecurityEvidence)
    add("nosecurity", "No security safeguards evidenced", 2, "Sec 8(5), Rule 6");

  const score = factors.reduce((a, f) => a + f.weight, 0);
  return { score, level: score >= 6 ? "High" : score >= 3 ? "Medium" : "Low", factors };
}
