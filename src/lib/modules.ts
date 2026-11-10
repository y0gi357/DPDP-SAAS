// Sidebar structure. Groups follow the phases of the Implementation Flow diagram.
export type NavItem = { href: string; label: string };
export type NavGroup = { heading: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { heading: "Start here", items: [{ href: "/flow", label: "Implementation Flow" }, { href: "/org", label: "Organisation Setup" }] },
  { heading: "Phase 1 – Mobilization", items: [{ href: "/committee", label: "DPDPA Committee" }, { href: "/departments", label: "Departments & SPOCs" }] },
  { heading: "Phase 2 – Discovery", items: [{ href: "/apps", label: "Apps & Data Sources" }, { href: "/vendors", label: "Vendors & TPRM" }, { href: "/ropa", label: "RoPA / Data Mapping" }] },
  { heading: "Phase 3 – Analysis", items: [{ href: "/dfd", label: "Data Flow" }, { href: "/dpia", label: "DPIA" }, { href: "/controls", label: "Controls Assessment" }] },
  { heading: "Phase 4 – Operationalize", items: [{ href: "/consent", label: "Notice & Consent" }, { href: "/consent/records", label: "Consent records" }, { href: "/breaches", label: "Breach Register" }] },
  { heading: "Phase 5 – Remediation", items: [{ href: "/gaps", label: "Gap Analysis & Remediation" }] },
  { heading: "Reporting", items: [{ href: "/report", label: "Generate Report" }, { href: "/dashboard", label: "Dashboard" }] },
];
export const ADMIN_ITEMS = { team: { href: "/team", label: "Team & access" }, audit: { href: "/audit-log", label: "Audit log" } } as const;
export const ADMIN_GROUP: NavGroup = { heading: "Admin", items: [ADMIN_ITEMS.team, ADMIN_ITEMS.audit] }; // everything the group can hold

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
