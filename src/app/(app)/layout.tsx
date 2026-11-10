import { redirect } from "next/navigation";
import { auth, signOut, unstable_update } from "@/auth";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { sendVerification } from "@/lib/auth-flows";
import { SideNav } from "@/components/SideNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const memberships = await withTenant(s, (tx) =>
    tx.membership.findMany({ where: { userId: s.userId }, include: { org: { select: { id: true, name: true } } }, orderBy: { id: "asc" } }),
  );
  const orgName = memberships.find((m) => m.orgId === s.orgId)?.org.name ?? "DPDPA Platform";

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }
  async function switchOrg(fd: FormData) {
    "use server";
    const current = await auth();
    const orgId = String(fd.get("orgId") ?? "");
    if (!current?.user?.id) redirect("/login");
    // Only organisations this person belongs to; the session callback checks again.
    const ok = await withTenant({ userId: current.user.id }, (tx) => tx.membership.findFirst({ where: { userId: current.user.id, orgId } }));
    if (!ok) redirect("/dashboard");
    await unstable_update({ orgId } as never);
    redirect("/dashboard");
  }
  async function resendVerification() {
    "use server";
    const c = await auth();
    if (!c?.user?.id) redirect("/login");
    const u = await prisma.user.findUnique({ where: { id: c.user.id } });
    if (u && !u.emailVerifiedAt) await sendVerification(u);
    redirect("/dashboard?verify=sent");
  }

  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand">
          {orgName}
          <div className="muted" style={{ fontSize: 11, fontWeight: 500, letterSpacing: ".06em", textTransform: "uppercase" }}>DPDPA implementation</div>
        </div>
        {memberships.length > 1 && (
          <form action={switchOrg} className="row" style={{ margin: "0 8px 8px" }}>
            <select name="orgId" defaultValue={s.orgId} aria-label="Switch organisation" style={{ flex: 1, minWidth: 0 }}>
              {memberships.map((m) => <option key={m.orgId} value={m.orgId}>{m.org.name}</option>)}
            </select>
            <button type="submit" className="ghost sm">Go</button>
          </form>
        )}
        <SideNav showAudit={can(s.role, "view_audit_log")} showTeam={can(s.role, "manage_members")} />
        <form action={logout} style={{ marginTop: 16 }}>
          <button className="ghost" type="submit">Sign out ({s.role.toLowerCase()})</button>
        </form>
      </nav>
      <main className="main">
        {!s.emailVerified && (
          <div className="notice row" style={{ justifyContent: "space-between" }}>
            <span>Please confirm your email address. We sent a link when you signed up.</span>
            <form action={resendVerification}><button type="submit" className="ghost sm">Resend</button></form>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
