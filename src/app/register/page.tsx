import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { hit, ipFrom } from "@/lib/ratelimit";
import { validatePassword } from "@/lib/password";
import { sendVerification } from "@/lib/auth-flows";

const schema = z.object({
  orgName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().max(200),
});
const fail = (m: string): never => redirect(`/register?error=${encodeURIComponent(m)}`);

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const closed = process.env.ALLOW_SIGNUP === "false";

  async function register(formData: FormData) {
    "use server";
    if (process.env.ALLOW_SIGNUP === "false") fail("Sign-up is closed. Ask your administrator for an invitation.");
    if (!(await hit(`register:${ipFrom(await headers())}`, 5, 3600)).ok) fail("Too many sign-ups from this network. Try again later.");
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail("Check your details.");
    const { orgName, name, email, password } = parsed.data;
    const weak = validatePassword(password, { email, name });
    if (weak) return fail(weak);
    if (await prisma.user.findUnique({ where: { email } })) return fail("That email is already registered. Sign in or reset your password.");

    const user = await prisma.user.create({ data: { email, name, passwordHash: await bcrypt.hash(password, 12) } });
    const orgId = randomUUID();
    await withTenant({ orgId, userId: user.id }, async (tx) => {
      await tx.organisation.create({ data: { id: orgId, name: orgName } });
      await tx.membership.create({ data: { orgId, userId: user.id, role: "OWNER" } });
      await audit(tx, { orgId, userId: user.id, action: "org.created", entity: "Organisation", entityId: orgId });
    });
    await sendVerification(user);
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  }

  return (
    <div className="auth">
      <h1>Create your organisation</h1>
      {closed ? <div className="notice">Sign-up is closed. Ask your administrator for an invitation.</div> : (
        <form action={register} className="card">
          <input name="orgName" placeholder="Organisation name" required />
          <input name="name" placeholder="Your name" required autoComplete="name" />
          <input name="email" type="email" placeholder="Work email" required autoComplete="email" />
          <input name="password" type="password" placeholder="Password (12+ characters)" required minLength={12} autoComplete="new-password" />
          {error && <div className="err">{error}</div>}
          <button type="submit">Create account</button>
        </form>
      )}
      <p className="muted">Already registered? <Link href="/login">Sign in</Link></p>
    </div>
  );
}
