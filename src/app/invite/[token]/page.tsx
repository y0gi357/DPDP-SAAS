import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth, signIn, unstable_update } from "@/auth";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { hit, ipFrom } from "@/lib/ratelimit";
import { validatePassword } from "@/lib/password";
import { hashToken, isExpired } from "@/lib/tokens";
import { ROLE_LABELS, type RoleName } from "@/lib/team";

async function loadInvite(token: string) {
  const hash = hashToken(token);
  const inv = await withTenant({ inviteHash: hash }, (tx) => tx.invitation.findUnique({ where: { tokenHash: hash } }));
  if (!inv || inv.acceptedAt || inv.revokedAt || isExpired(inv.expiresAt)) return null;
  const org = await withTenant({ orgId: inv.orgId }, (tx) => tx.organisation.findUnique({ where: { id: inv.orgId }, select: { name: true } }));
  return { inv, hash, orgName: org?.name ?? "an organisation" };
}

/** Marks the invitation used (once) and adds the person to the organisation. */
async function join(token: string, userId: string): Promise<boolean> {
  const loaded = await loadInvite(token);
  if (!loaded) return false;
  const { inv, hash } = loaded;
  const now = new Date();
  const taken = await withTenant({ inviteHash: hash }, (tx) =>
    tx.invitation.updateMany({ where: { tokenHash: hash, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { acceptedAt: now } }),
  );
  if (taken.count !== 1) return false;
  await withTenant({ orgId: inv.orgId, userId }, async (tx) => {
    const already = await tx.membership.findUnique({ where: { orgId_userId: { orgId: inv.orgId, userId } } });
    if (!already) await tx.membership.create({ data: { orgId: inv.orgId, userId, role: inv.role } });
    await audit(tx, { orgId: inv.orgId, userId, action: "member.joined", entity: "Membership", meta: { role: inv.role } });
  });
  return true;
}

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const loaded = await loadInvite(token);
  const here = `/invite/${encodeURIComponent(token)}`;

  if (!loaded) {
    return (
      <div className="auth"><h1>Invitation not valid</h1>
        <div className="card"><p style={{ margin: 0 }}>This invitation has expired, was cancelled, or was already used. Ask the person who invited you to send a new one.</p></div>
        <p className="muted"><Link href="/login">Go to sign in</Link></p></div>
    );
  }
  const { inv, orgName } = loaded;
  const existing = await prisma.user.findUnique({ where: { email: inv.email }, select: { id: true } });
  const session = await auth();
  const signedInAs = session?.user?.email?.toLowerCase();

  async function acceptExisting(fd: FormData) {
    "use server";
    const t = String(fd.get("token") ?? "");
    const l = await loadInvite(t);
    const s = await auth();
    if (!l || !s?.user?.id || s.user.email?.toLowerCase() !== l.inv.email) redirect(`/invite/${encodeURIComponent(t)}`);
    if (!(await join(t, s!.user.id))) redirect(`/invite/${encodeURIComponent(t)}`);
    await unstable_update({ orgId: l!.inv.orgId } as never);
    redirect("/dashboard");
  }

  async function acceptNew(fd: FormData) {
    "use server";
    const t = String(fd.get("token") ?? "");
    const back = (m: string): never => redirect(`/invite/${encodeURIComponent(t)}?error=${encodeURIComponent(m)}`);
    if (!(await hit(`invite-accept:${ipFrom(await headers())}`, 10, 3600)).ok) back("Too many attempts. Try again later.");
    const l = await loadInvite(t);
    if (!l) return redirect(`/invite/${encodeURIComponent(t)}`);
    const name = z.string().trim().min(2).max(120).safeParse(fd.get("name"));
    if (!name.success) return back("Enter your name.");
    const password = String(fd.get("password") ?? "");
    const weak = validatePassword(password, { email: l.inv.email, name: name.data });
    if (weak) return back(weak);
    if (await prisma.user.findUnique({ where: { email: l.inv.email } })) return redirect(`/invite/${encodeURIComponent(t)}`);
    // The link was sent to this address, so following it confirms the mailbox.
    const user = await prisma.user.create({ data: { email: l.inv.email, name: name.data, passwordHash: await bcrypt.hash(password, 12), emailVerifiedAt: new Date() } });
    if (!(await join(t, user.id))) return back("This invitation is no longer valid.");
    await signIn("credentials", { email: l.inv.email, password, redirectTo: "/dashboard" });
  }

  return (
    <div className="auth">
      <h1>Join {orgName}</h1>
      <p className="muted">You were invited as {ROLE_LABELS[inv.role as RoleName]} using <strong>{inv.email}</strong>.</p>
      {error && <div className="err" style={{ marginBottom: 10 }}>{error}</div>}
      {existing && signedInAs === inv.email ? (
        <form action={acceptExisting} className="card"><input type="hidden" name="token" value={token} /><button type="submit">Join {orgName}</button></form>
      ) : existing && signedInAs ? (
        <div className="card"><p style={{ margin: 0 }}>You are signed in as {signedInAs}, but this invitation is for {inv.email}. Sign out, then open the link again.</p></div>
      ) : existing ? (
        <div className="card"><p style={{ marginTop: 0 }}>You already have an account for this address.</p><Link className="btn" href={`/login?next=${encodeURIComponent(here)}&invited=1`}>Sign in to accept</Link></div>
      ) : (
        <form action={acceptNew} className="card">
          <input type="hidden" name="token" value={token} />
          <input name="name" placeholder="Your name" required autoComplete="name" />
          <input name="password" type="password" placeholder="Choose a password (12+ characters)" required minLength={12} autoComplete="new-password" />
          <button type="submit">Create account and join</button>
        </form>
      )}
    </div>
  );
}
