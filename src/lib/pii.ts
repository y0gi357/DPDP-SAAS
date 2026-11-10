// Data-inventory taxonomy: 11 data categories and the individual PII fields under them.
// Plain data, no imports: safe to use from client components.

export const DATA_CATEGORIES = [
  { key: "IDENTITY", label: "Identity Data", eg: "Name, PAN, Aadhaar" },
  { key: "CONTACT", label: "Contact Data", eg: "Email, Phone, Address" },
  { key: "FINANCIAL", label: "Financial Data", eg: "Bank Account, UPI" },
  { key: "DEMOGRAPHIC", label: "Demographic Data", eg: "Gender, Age, Marital Status" },
  { key: "EMPLOYMENT", label: "Employment Data", eg: "Designation, Salary, Employee ID" },
  { key: "HEALTH_SENSITIVE", label: "Health & Sensitive Data", eg: "Medical, Disability" },
  { key: "BEHAVIOURAL", label: "Behavioural / Usage Data", eg: "Browsing, Purchases, Call recordings" },
  { key: "LOCATION", label: "Location Data", eg: "GPS, Geofence" },
  { key: "DEVICE_NETWORK", label: "Device & Network Data", eg: "IP, Device ID, Cookies" },
  { key: "CHILDREN", label: "Children's Data", eg: "Child's name, school, guardian" },
  { key: "BIOMETRIC", label: "Biometric Data", eg: "Fingerprint, Face, Iris" },
] as const;

export type CategoryKey = (typeof DATA_CATEGORIES)[number]["key"];
export const DATA_CATEGORY_KEYS: string[] = DATA_CATEGORIES.map((c) => c.key);

export function categoryLabel(key: string): string {
  return (
    DATA_CATEGORIES.find((c) => c.key === key)?.label ??
    key.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) // legacy keys
  );
}

const raw: Record<CategoryKey, [string, string][]> = {
  IDENTITY: [
    ["FULL_NAME", "Full Name"], ["DOB", "Date of Birth"], ["PAN", "PAN"], ["AADHAAR", "Aadhaar Number"],
    ["PASSPORT", "Passport Number"], ["VOTER_ID", "Voter ID"], ["DRIVING_LICENCE", "Driving Licence"],
    ["PHOTO", "Photograph"], ["SIGNATURE", "Signature"], ["PARENT_SPOUSE_NAME", "Father's / Spouse's Name"],
    ["USER_ID", "Username / Customer ID"],
  ],
  CONTACT: [
    ["EMAIL", "Email"], ["PHONE", "Mobile / Phone"], ["ADDRESS", "Address"],
    ["ALT_CONTACT", "Alternate Contact Details"], ["EMERGENCY_CONTACT", "Emergency Contact"],
  ],
  FINANCIAL: [
    ["BANK_ACCOUNT", "Bank Account Number"], ["UPI", "UPI ID"], ["CARD", "Credit / Debit Card Number"],
    ["TRANSACTIONS", "Transaction History"], ["CREDIT_SCORE", "Credit Score / Report"],
    ["TAX_RECORDS", "Tax / ITR Records"], ["LOAN", "Loan / EMI Details"], ["INVESTMENTS", "Investment Details"],
    ["INSURANCE_POLICY", "Insurance Policy Details"],
  ],
  DEMOGRAPHIC: [
    ["GENDER", "Gender"], ["AGE_BAND", "Age / Age Band"], ["MARITAL_STATUS", "Marital Status"],
    ["NATIONALITY", "Nationality"], ["RELIGION", "Religion"], ["CASTE", "Caste / Community"],
    ["LANGUAGE", "Language Preference"], ["EDUCATION", "Education / Qualifications"], ["INCOME_BAND", "Income Band"],
  ],
  EMPLOYMENT: [
    ["EMPLOYEE_ID", "Employee ID"], ["DESIGNATION", "Designation"], ["EMP_DEPARTMENT", "Department"],
    ["SALARY", "Salary / CTC"], ["DOJ", "Date of Joining / Exit"], ["RESUME", "Resume / CV"],
    ["BGV", "Background Verification Report"], ["PERFORMANCE", "Performance Reviews"],
    ["ATTENDANCE", "Attendance & Leave Records"], ["PF_UAN", "PF / UAN / ESI Number"],
    ["DISCIPLINARY", "Disciplinary Records"], ["PREV_EMPLOYER", "Previous Employment History"],
  ],
  HEALTH_SENSITIVE: [
    ["MEDICAL_RECORDS", "Medical Records"], ["HEALTH_INSURANCE", "Health Insurance Details"],
    ["DISABILITY", "Disability Status"], ["PRESCRIPTIONS", "Prescriptions / Diagnosis"],
    ["VACCINATION", "Vaccination Status"], ["SEXUAL_ORIENTATION", "Sexual Orientation"],
    ["CRIMINAL", "Criminal Record / Police Verification"],
  ],
  BEHAVIOURAL: [
    ["BROWSING", "Browsing History"], ["USAGE_LOGS", "Clickstream / Usage Logs"], ["PURCHASES", "Purchase History"],
    ["PREFERENCES", "Preferences / Interests"], ["SEARCH_QUERIES", "Search Queries"],
    ["SUPPORT_TRANSCRIPTS", "Chat / Support Transcripts"], ["CALL_RECORDINGS", "Call Recordings"],
    ["SURVEY", "Survey / Feedback Responses"],
  ],
  LOCATION: [
    ["GPS", "Precise GPS Location"], ["GEO_IP", "IP-derived Location"],
    ["GEOFENCE", "Check-in / Geofence Data"], ["TRAVEL", "Travel Itinerary"],
  ],
  DEVICE_NETWORK: [
    ["IP_ADDRESS", "IP Address"], ["DEVICE_ID", "Device ID / IMEI"], ["MAC", "MAC Address"],
    ["COOKIE_ID", "Cookie / Advertising ID"], ["USER_AGENT", "Browser / User-Agent"],
    ["SESSION_ID", "Session ID / Tokens"], ["ACCESS_LOGS", "System Access Logs"],
    ["CREDENTIALS", "Login Credentials (hashed)"],
  ],
  CHILDREN: [
    ["CHILD_NAME", "Child's Name"], ["CHILD_DOB", "Child's Date of Birth"], ["SCHOOL", "School / Grade"],
    ["GUARDIAN", "Parent / Guardian Details"], ["PARENT_CONSENT", "Verifiable Parental Consent Record"],
  ],
  BIOMETRIC: [
    ["FINGERPRINT", "Fingerprint"], ["FACE", "Face Template"], ["IRIS", "Iris Scan"], ["VOICEPRINT", "Voice Print"],
  ],
};

export const PII_FIELDS: { key: string; label: string; category: CategoryKey }[] = (
  Object.entries(raw) as [CategoryKey, [string, string][]][]
).flatMap(([category, items]) => items.map(([key, label]) => ({ key, label, category })));

const BY_KEY = new Map(PII_FIELDS.map((f) => [f.key, f]));
export const PII_KEYS = new Set(PII_FIELDS.map((f) => f.key));

/** Categories covered by a set of PII fields, in taxonomy order. */
export function categoriesOf(fieldKeys: string[]): string[] {
  const set = new Set(fieldKeys.map((k) => BY_KEY.get(k)?.category).filter(Boolean) as string[]);
  return DATA_CATEGORY_KEYS.filter((c) => set.has(c));
}

// Typical PII per department. First matching rule wins (security before IT on purpose).
const TEMPLATES: { match: RegExp; fields: string[] }[] = [
  { match: /human|\bhr\b|people/i, fields: ["FULL_NAME", "DOB", "PAN", "AADHAAR", "PHOTO", "EMAIL", "PHONE", "ADDRESS", "EMERGENCY_CONTACT", "BANK_ACCOUNT", "TAX_RECORDS", "GENDER", "MARITAL_STATUS", "EDUCATION", "EMPLOYEE_ID", "DESIGNATION", "SALARY", "DOJ", "RESUME", "BGV", "PERFORMANCE", "ATTENDANCE", "PF_UAN", "HEALTH_INSURANCE"] },
  { match: /financ|account/i, fields: ["FULL_NAME", "PAN", "EMAIL", "PHONE", "ADDRESS", "BANK_ACCOUNT", "UPI", "CARD", "TRANSACTIONS", "TAX_RECORDS", "SALARY", "EMPLOYEE_ID"] },
  { match: /sales|marketing/i, fields: ["FULL_NAME", "EMAIL", "PHONE", "ADDRESS", "DESIGNATION", "PURCHASES", "PREFERENCES", "BROWSING", "USAGE_LOGS", "COOKIE_ID", "IP_ADDRESS", "SURVEY"] },
  { match: /customer|support|success/i, fields: ["FULL_NAME", "EMAIL", "PHONE", "ADDRESS", "USER_ID", "SUPPORT_TRANSCRIPTS", "CALL_RECORDINGS", "PURCHASES", "TRANSACTIONS", "IP_ADDRESS", "DEVICE_ID"] },
  { match: /security|infosec/i, fields: ["FULL_NAME", "EMAIL", "EMPLOYEE_ID", "USER_ID", "IP_ADDRESS", "DEVICE_ID", "MAC", "ACCESS_LOGS", "SESSION_ID", "CREDENTIALS", "GEO_IP"] },
  { match: /information tech|\bit\b|infrastructure/i, fields: ["FULL_NAME", "EMAIL", "EMPLOYEE_ID", "USER_ID", "IP_ADDRESS", "DEVICE_ID", "MAC", "ACCESS_LOGS", "CREDENTIALS", "SESSION_ID"] },
  { match: /engineer|product/i, fields: ["USER_ID", "EMAIL", "IP_ADDRESS", "DEVICE_ID", "USER_AGENT", "USAGE_LOGS", "ACCESS_LOGS", "SESSION_ID", "CREDENTIALS"] },
  { match: /\bai\b|data science|analytics/i, fields: ["USER_ID", "USAGE_LOGS", "BROWSING", "PURCHASES", "PREFERENCES", "GEO_IP", "DEVICE_ID", "AGE_BAND", "GENDER"] },
  { match: /legal|compliance|audit/i, fields: ["FULL_NAME", "EMAIL", "PHONE", "ADDRESS", "PAN", "SIGNATURE"] },
];

export function templateFor(departmentName: string): string[] | null {
  return TEMPLATES.find((t) => t.match.test(departmentName))?.fields ?? null;
}

export const STANDARD_DEPARTMENTS = [
  "Engineering / Product", "Information Technology", "Information Security", "Human Resources",
  "Finance & Accounts", "Sales & Marketing", "Customer Success / Support", "AI / Data Science",
  "Legal & Compliance",
];

// Fail fast on typos in the templates.
for (const t of TEMPLATES) for (const k of t.fields) if (!PII_KEYS.has(k)) throw new Error(`pii.ts: unknown field ${k}`);
