"use client";
import "./phase2.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_ITEMS, NAV, isActive, type NavGroup } from "@/lib/modules";

export function SideNav({ showAudit, showTeam = false }: { showAudit: boolean; showTeam?: boolean }) {
  const pathname = usePathname() ?? "";
  const admin: NavGroup = { heading: "Admin", items: [...(showTeam ? [ADMIN_ITEMS.team] : []), ...(showAudit ? [ADMIN_ITEMS.audit] : [])] };
  const groups = admin.items.length ? [...NAV, admin] : NAV;
  return (
    <div className="navgroups">
      {groups.map((g) => (
        <div key={g.heading} role="group" aria-label={g.heading}>
          <div className="navhead">{g.heading}</div>
          {g.items.map((it) => {
            const on = isActive(pathname, it.href) && !(it.href === "/consent" && pathname.startsWith("/consent/records"));
            return <Link key={it.href} href={it.href} className={`navlink${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>{it.label}</Link>;
          })}
        </div>
      ))}
    </div>
  );
}
