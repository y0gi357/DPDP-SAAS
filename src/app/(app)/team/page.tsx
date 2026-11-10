import { headers as _h } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { hit } from "@/lib/ratelimit";
import { appUrl, emailConfigured, sendEmail } from "@/lib/email";
import { invitationMail } from "@/lib/mail-templates";
import { TTL, newToken } from "@/lib/tokens";
import { INVITABLE, ROLES, ROLE_LABELS, canChangeRole, canInvite, canRemove, type RoleName } from "@/lib/team";
import { ErrorNote, PageHead, fmtDate } from "@/components/ui";
void _h;

const back = (q: string): never => redirect(`/team?${q}`);
const err = (m: string): never => back(`error=${encodeURIComponent(m)}`);

async function createInvite(s: { orgId: string; userId: string; role: string; emailVerified: boolean }, email: string, role: RoleName) {
  const verdict = canInvite(s.role, role);
  if (!verdict.ok) return err(verdict.reason);
  if (!s.emailVerified) return err("Confirm your own email address before inviting others.");
  if (!(await hit(`invite:${s.orgId}`, 20, 3600)).ok) return err("Too many invitations this hour. Try again later.");

  let problem: string | null = null, link = "", orgName = "", inviter = "";
  await withTenant(s, async (tx) => {
    if (await tx.membership.findFirst({ where: { user: { email } } })) { problem = "That person is already a member."; return; }
    await tx.invitation.updateMany({ where: { email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    const { token, hash } = newToken();
    await tx.invitation.create({ data: { orgId: s.orgId, email, role, tokenHash: hash, invitedBy: s.userId, expiresAt: new Date(Date.now() + TTL.invite) } });
    const [org, me] = await Promise.all([tx.organisation.findUniqueOrThrow({ where: { id: s.orgId }, select: { name: true } }), tx.user.findUniqueOrThrow({ where: { id: s.userId }, select: { name: true } })]);
    orgName = org.name; inviter = me.name; link = `${appUrl()}/invite/${token}`;
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "member.invited", entity: "Invitation", meta: { email, role } });
  });
  if (problem) return err(problem);

  let delivered = false;
  try { delivered = (await sendEmail({ to: email, ...invitationMail({ orgName, inviter, role, link }) })).delivered; } catch (e) { console.error("invitation email failed", e); }
  revalidatePath("/team");
  // Without a mail server (local development) hand the link to the admin instead.
  if (!delivered && process.env.NODE_ENV !== "production") return back(`link=${encodeURIComponent(link)}&to=${encodeURIComponent(email)}`);
  return back(delivered ? `sent=${encodeURIComponent(email)}` : `error=${encodeURIComponent("The invitation was created but the email could not be sent. Check the mail settings, then use Resend.")}`);
}

async function invite(fd: FormData) {
  "use server";
  const s = await requireSession("manage_members");
  const email = z.string().trim().toLowerCase().email().max(200).safeParse(fd.get("email"));
  if (!email.success) return err("Enter a valid email address.");
  await createInvite(s, email.data, String(fd.get("role")) as RoleName);
}

async function resend(fd: FormData) {
  "use server";
  const s = await requireSession("manage_members");
  const inv = await withTenant(s, (tx) => tx.invitation.findUnique({ where: { id: String(fd.get("id") ?? "") } }));
  if (!inv) return err("Invitation not found.");
  await createInvite(s, inv.email, inv.role as RoleName);
}

async function revoke(fd: FormData) {
  "use server";
  const s = await requireSession("manage_members");
  const id = String(fd.get("id") ?? "");
  await withTenant(s, async (tx) => {
    await tx.invitation.updateMany({ where: { id, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "member.invite_revoked", entity: "Invitation", entityId: id });
  });
  revalidatePath("/team");
}

async function context(s: { orgId: string; userId: string }, targetId: string) {
  return withTenant(s, async (tx) => {
    const [target, me, owners] = await Promise.all([
      tx.membership.findUnique({ where: { id: targetId }, include: { user: { select: { email: true } } } }),
      tx.membership.findUnique({ where: { orgId_userId: { orgId: s.orgId, userId: s.userId } } }),
      tx.membership.count({ where: { role: "OWNER" } }),
    ]);
    return { target, me, owners };
  });
}

async function changeRole(fd: FormData) {
  "use server";
  const s = await requireSession("manage_members");
  const newRole = String(fd.get("role") ?? "");
  const { target, me, owners } = await context(s, String(fd.get("id") ?? ""));
  if (!target || !me) return err("Member not found.");
  const v = canChangeRole({ actorRole: s.role, actorMembershipId: me.id, targetMembershipId: target.id, targetRole: target.role, newRole, ownerCount: owners });
  if (!v.ok) return err(v.reason);
  await withTenant(s, async (tx) => {
    await tx.membership.update({ where: { id: target.id }, data: { role: newRole as RoleName } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "member.role_changed", entity: "Membership", entityId: target.id, meta: { email: target.user.email, from: target.role, to: newRole } });
  });
  revalidatePath("/team");
}

async function removeMember(fd: FormData) {
  "use server";
  const s = await requireSession("manage_members");
  const { target, me, owners } = await context(s, String(fd.get("id") ?? ""));
  if (!target || !me) return err("Member not found.");
  const v = canRemove({ actorRole: s.role, actorMembershipId: me.id, targetMembershipId: target.id, targetRole: target.role, ownerCount: owners });
  if (!v.ok) return err(v.reason);
  await withTenant(s, async (tx) => {
    await tx.membership.delete({ where: { id: target.id } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "member.removed", entity: "Membership", entityId: target.id, meta: { email: target.user.email, role: target.role } });
  });
  revalidatePath("/team");
}

export default async function Team({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string; link?: string; to?: string }> }) {
  const s = await requireSession("manage_members");
  const { error, sent, link, to } = await searchParams;
  const [members, invites, me] = await withTenant(s, (tx) =>
    Promise.all([
      tx.membership.findMany({ include: { user: { select: { name: true, email: true, emailVerifiedAt: true } } }, orderBy: { id: "asc" } }),
      tx.invitation.findMany({ where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
      tx.membership.findUnique({ where: { orgId_userId: { orgId: s.orgId, userId: s.userId } }, select: { id: true } }),
    ]),
  );
  const owners = members.filter((m) => m.role === "OWNER").length;
  const safeLink = link && link.startsWith(appUrl() + "/invite/") ? link : null;

  return (
    <>
      <PageHead title="Team & access" sub="Invite colleagues and control what each person can do. Changes take effect immediately." />
      {sent && <div style={{ color: "var(--ok)", marginBottom: 10 }}>Invitation sent to {sent}.</div>}
      {safeLink && (
        <div className="notice">
          Email is not set up on this server, so send this link to {to} yourself. It works once, for 7 days:
          <div className="code" style={{ wordBreak: "break-all", marginTop: 6 }}>{safeLink}</div>
        </div>
      )}
      <ErrorNote msg={error} />
      {!emailConfigured() && process.env.NODE_ENV === "production" && <div className="notice">SMTP_URL is not set, so invitation emails cannot be sent.</div>}

      <form action={invite} className="card">
        <h2>Invite someone</h2>
        <div className="row">
          <input name="email" type="email" placeholder="colleague@company.com" required style={{ minWidth: 260 }} />
          <select name="role" defaultValue="SPOC">{INVITABLE.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
          <button type="submit">Send invitation</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Admins manage the team and settings. SPOCs edit data and assess controls. Auditors can read everything but change nothing.</p>
      </form>

      <div className="card" style={{ overflowX: "auto" }}>
        <h2>Members ({members.length})</h2>
        <table>
          <thead><tr><th>Name</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {members.map((m) => {
              const self = m.id === me?.id;
              return (
                <tr key={m.id}>
                  <td>{m.user.name}{self && " (you)"}<div className="code">{m.user.email}{!m.user.emailVerifiedAt && " · unverified"}</div></td>
                  <td>
                    <form action={changeRole} className="row">
                      <input type="hidden" name="id" value={m.id} />
                      <select name="role" defaultValue={m.role} disabled={self} aria-label={`Role for ${m.user.email}`}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
                      {!self && <button type="submit" className="ghost sm">Update</button>}
                    </form>
                  </td>
                  <td>{!self && <form action={removeMember}><input type="hidden" name="id" value={m.id} /><button type="submit" className="danger sm">Remove</button></form>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>{owners} owner{owners === 1 ? "" : "s"}. An organisation always keeps at least one.</p>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <h2>Pending invitations ({invites.length})</h2>
        {invites.length === 0 ? <div className="empty">No pending invitations.</div> : (
          <table>
            <thead><tr><th>Email</th><th>Role</th><th>Expires</th><th></th></tr></thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id}>
                  <td>{i.email}</td><td>{ROLE_LABELS[i.role as RoleName]}</td><td>{fmtDate(i.expiresAt)}</td>
                  <td><div className="row">
                    <form action={resend}><input type="hidden" name="id" value={i.id} /><button type="submit" className="ghost sm">Resend</button></form>
                    <form action={revoke}><input type="hidden" name="id" value={i.id} /><button type="submit" className="danger sm">Cancel</button></form>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
