// Steering committee is limited to CXO / function-head level; operational owners join working groups.
export const SENIOR_DESIGNATIONS = [
  "Chief Executive Officer (CEO)",
  "Chief Operating Officer (COO)",
  "Chief Financial Officer (CFO)",
  "Chief Risk Officer (CRO)",
  "Chief Compliance Officer (CCO)",
  "Chief Information Officer (CIO)",
  "Chief Information Security Officer (CISO)",
  "Chief Technology Officer (CTO)",
  "Chief Privacy Officer (CPO)",
  "Data Protection Officer (DPO)",
  "Chief Human Resources Officer (CHRO)",
  "Chief Marketing Officer (CMO)",
  "Chief Product Officer",
  "Chief Data Officer (CDO)",
  "Head - Legal / General Counsel",
  "Head - Internal Audit",
  "Head - IT Infrastructure",
  "Head - Cyber Security",
  "Head - Engineering",
  "Head - Finance",
  "Head - Sales",
  "Head - Customer Success",
  "Head - Operations",
  "Head - Procurement / Vendor Management",
  "Head - Corporate Communications",
  "External Counsel / Privacy Advisor",
  "Board Sponsor / Independent Director",
  "Other - Senior Function Head",
] as const;

// Functions a DPDPA steering committee should ordinarily cover (guidance, not a legal requirement).
export const COVERAGE: { name: string; match: RegExp }[] = [
  { name: "Privacy / DPO lead", match: /\((CPO|DPO)\)|Privacy Advisor/ },
  { name: "Legal", match: /Legal|Counsel|\(CCO\)/ },
  { name: "Information security", match: /\((CISO|CIO|CTO)\)|Cyber Security|IT Infrastructure/ },
  { name: "HR (employee data)", match: /\(CHRO\)/ },
  { name: "Executive sponsor", match: /\((CEO|COO)\)|Board Sponsor/ },
];
export const ASSET_TYPE_OPTIONS = [
  "SAAS", "INTERNAL_DB", "MOBILE_APP", "SPREADSHEET", "ONPREM_APP", "CLOUD_STORAGE", "DATA_WAREHOUSE", "OTHER",
] as const;
export const ASSET_TYPE_LABELS: Record<string, string> = {
  SAAS: "SaaS", INTERNAL_DB: "Internal DB", MOBILE_APP: "Mobile App", SPREADSHEET: "Spreadsheet/CSV",
  ONPREM_APP: "On-prem Application", CLOUD_STORAGE: "Cloud Storage", DATA_WAREHOUSE: "Data Warehouse", OTHER: "Other",
  APPLICATION: "Application (legacy)", DATABASE: "Database (legacy)", FILE_STORE: "File store (legacy)",
};
export const SOURCING = ["IN_HOUSE", "OUTSOURCED"] as const;
export const SOURCING_LABELS = { IN_HOUSE: "In-house", OUTSOURCED: "Outsourced" } as const;
export const VENDOR_ACCESS = ["FULL_ACCESS", "LIMITED_ACCESS", "HOSTING_ONLY", "ANONYMISED_ONLY"] as const;
export const VENDOR_ACCESS_LABELS = {
  FULL_ACCESS: "Yes - Full access",
  LIMITED_ACCESS: "Yes - Limited / role-based",
  HOSTING_ONLY: "No - Hosting only",
  ANONYMISED_ONLY: "No - Anonymised only",
} as const;
export const RISK_TIERS = ["LOW", "MEDIUM", "HIGH"] as const;

export const label = (v: string) =>
  v.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// ---------- Vendors & TPRM ----------
export const VENDOR_TYPES = [
  "SaaS Platform", "Cloud Hosting", "Payment Processor", "HR / Payroll", "Marketing",
  "Analytics", "Background Verification", "Communication", "Other",
] as const;
export const VENDOR_ROLES = ["PROCESSOR", "SUB_PROCESSOR", "JOINT_FIDUCIARY", "INDEPENDENT_CONTROLLER"] as const;
export const VENDOR_ROLE_LABELS: Record<string, string> = {
  PROCESSOR: "Data Processor",
  SUB_PROCESSOR: "Sub-Processor",
  JOINT_FIDUCIARY: "Joint Data Fiduciary",
  INDEPENDENT_CONTROLLER: "Independent Data Fiduciary",
  OTHER: "Other (legacy)",
};
export const CERTIFICATIONS = [
  "ISO 27001", "ISO 27701", "SOC 2 Type II", "PCI DSS", "HIPAA", "IT Act 2000 (India)", "None",
] as const;
export const DSR_CHANNELS = ["Email", "Portal", "API", "Phone Hotline", "None / Manual"] as const;
export const DSR_SLAS = ["7 days", "14 days", "21 days", "30 days", "60 days", "90 days", "No SLA"] as const;

// Technical and organisational safeguards (Rule 6 of the DPDP Rules plus common good practice).
export const SECURITY_CONTROLS = [
  "Encryption at rest (Rule 6(1)(a))",
  "Encryption in transit (TLS 1.2+)",
  "Pseudonymisation / tokenisation",
  "Data masking",
  "Access control: RBAC / least privilege (Rule 6(1)(b))",
  "Multi-factor authentication",
  "Audit logs and monitoring (Rule 6(1)(c))",
  "Logs retained for one year (Rule 6(1)(e))",
  "Backup and recovery (Rule 6(1)(d))",
  "Processor contract / DPA (Rule 6(1)(f))",
  "Vulnerability management",
  "Endpoint security / EDR",
  "Data loss prevention",
  "Shadow-IT discovery (CASB)",
  "Secure SDLC / privacy by design",
  "Periodic VAPT",
  "Incident response plan",
] as const;

// ---------- RoPA ----------
export const LEGAL_BASIS_OPTIONS = [
  { code: "CONSENT", label: "Consent", ref: "Sec 6" },
  { code: "VOLUNTARY", label: "Sec 7(a) - Voluntarily provided", ref: "Sec 7(a)" },
  { code: "STATE_BENEFIT", label: "Sec 7(b) - State subsidy / benefit / service", ref: "Sec 7(b)" },
  { code: "STATE_FUNCTION", label: "Sec 7(c) - Function of the State", ref: "Sec 7(c)" },
  { code: "LEGAL_OBLIGATION", label: "Sec 7(d) - Compliance with law", ref: "Sec 7(d)" },
  { code: "COURT_ORDER", label: "Sec 7(e) - Court / tribunal order", ref: "Sec 7(e)" },
  { code: "MEDICAL_EMERGENCY", label: "Sec 7(f) - Medical emergency", ref: "Sec 7(f)" },
  { code: "EPIDEMIC", label: "Sec 7(g) - Epidemic / public health", ref: "Sec 7(g)" },
  { code: "DISASTER", label: "Sec 7(h) - Disaster / public order", ref: "Sec 7(h)" },
  { code: "EMPLOYMENT", label: "Sec 7(i) - Employment purposes", ref: "Sec 7(i)" },
] as const;
export const LEGAL_BASIS_CODES = [
  "CONSENT", "VOLUNTARY", "STATE_BENEFIT", "STATE_FUNCTION", "LEGAL_OBLIGATION",
  "COURT_ORDER", "MEDICAL_EMERGENCY", "EPIDEMIC", "DISASTER", "EMPLOYMENT",
] as const;
export const legalBasisLabel = (code: string) =>
  LEGAL_BASIS_OPTIONS.find((b) => b.code === code)?.label ?? (code === "LEGITIMATE_USE" ? "Legitimate use (legacy)" : code);

export const ROPA_ROLES = ["DATA_FIDUCIARY", "DATA_PROCESSOR"] as const;
export const ROPA_ROLE_LABELS = { DATA_FIDUCIARY: "Data Fiduciary", DATA_PROCESSOR: "Data Processor" } as const;

export const PRINCIPAL_CATEGORY_OPTIONS = [
  "Customer", "Employee", "Candidate", "Vendor Contact", "Visitor", "Child (under 18)", "Other",
] as const;

export const PROCESSING_PURPOSES = [
  "Employee Onboarding", "Payroll Processing", "Performance Management", "Benefits Administration",
  "Recruitment & Selection", "Background Verification", "Customer Service Delivery", "Order Fulfilment",
  "Marketing & Communication", "Lead Generation", "Vendor Management", "Statutory Tax Filing",
  "Regulatory Reporting", "Fraud Detection & Prevention", "Cyber Security Monitoring",
  "Analytics & Improvement", "Legal & Contractual Obligations", "Health & Safety",
] as const;
