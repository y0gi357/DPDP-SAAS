// Department-driven defaults used when generating RoPA records from apps. Always reviewable by the user.
export function inferLawfulBasis(dept: string | null | undefined): string {
  const d = (dept ?? "").toLowerCase();
  if (/human|\bhr\b|people/.test(d)) return "EMPLOYMENT";
  if (/financ|account|legal|compliance|audit/.test(d)) return "LEGAL_OBLIGATION";
  return "CONSENT";
}

export function inferPrincipal(dept: string | null | undefined): string {
  const d = (dept ?? "").toLowerCase();
  if (/human|\bhr\b|people/.test(d)) return "Employee";
  if (/sales|marketing|customer|support|success/.test(d)) return "Customer";
  if (/financ|account/.test(d)) return "Vendor Contact";
  return "Customer";
}

export function inferPurpose(dept: string | null | undefined): string {
  const d = (dept ?? "").toLowerCase();
  if (/human|\bhr\b|people/.test(d)) return "Employee Onboarding";
  if (/financ|account/.test(d)) return "Payroll Processing";
  if (/sales|marketing/.test(d)) return "Marketing & Communication";
  if (/customer|support|success/.test(d)) return "Customer Service Delivery";
  if (/security|infosec/.test(d)) return "Cyber Security Monitoring";
  if (/\bai\b|data science|analytics/.test(d)) return "Analytics & Improvement";
  if (/legal|compliance|audit/.test(d)) return "Legal & Contractual Obligations";
  return "Customer Service Delivery";
}
