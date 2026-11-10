import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withTenant } from "./tenant";
import { can, type Action } from "./rbac";

/**
 * Resolves the signed-in person for this request. The role comes from the database on every call,
 * so a removed member or a changed role takes effect immediately, and a password change signs out older sessions.
 */
export async function requireSession(needs?: Action) {
  const s = await auth();
  if (!s?.user?.orgId) redirect("/login");
  const { id: userId, orgId } = s.user;

  const [m, u] = await withTenant({ userId, orgId }, (tx) =>
    Promise.all([
      tx.membership.findUnique({ where: { orgId_userId: { orgId, userId } }, select: { role: true } }),
      tx.user.findUnique({ where: { id: userId }, select: { passwordChangedAt: true, emailVerifiedAt: true } }),
    ]),
  );
  if (!m || !u) redirect("/login?error=access");
  if (u.passwordChangedAt && s.user.issuedAt && u.passwordChangedAt.getTime() / 1000 > s.user.issuedAt) redirect("/login?error=expired");

  const ctx = { userId, orgId, role: m.role as string, emailVerified: !!u.emailVerifiedAt };
  if (needs && !can(ctx.role, needs)) redirect("/dashboard");
  return ctx;
}
