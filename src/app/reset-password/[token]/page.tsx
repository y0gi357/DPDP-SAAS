import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { consumeToken, peekToken } from "@/lib/auth-flows";
import { validatePassword } from "@/lib/password";

export default async function ResetPassword({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const valid = await peekToken("RESET_PASSWORD", token);

  async function reset(fd: FormData) {
    "use server";
    const t = String(fd.get("token") ?? "");
    const back = (m: string): never => redirect(`/reset-password/${encodeURIComponent(t)}?error=${encodeURIComponent(m)}`);
    const pw = String(fd.get("password") ?? ""), again = String(fd.get("again") ?? "");
    const peek = await peekToken("RESET_PASSWORD", t);
    if (!peek) return redirect("/forgot-password");
    const user = await prisma.user.findUnique({ where: { id: peek.userId } });
    if (!user) return redirect("/forgot-password");
    if (pw !== again) return back("The two passwords do not match.");
    const weak = validatePassword(pw, { email: user.email, name: user.name });
    if (weak) return back(weak);
    if (!(await consumeToken("RESET_PASSWORD", t))) return redirect("/forgot-password");
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(pw, 12), passwordChangedAt: new Date(), failedLogins: 0, lockedUntil: null, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
    });
    redirect("/login?reset=1");
  }

  return (
    <div className="auth">
      <h1>Choose a new password</h1>
      {!valid ? (
        <div className="card"><p style={{ margin: 0 }}>This link has expired or was already used. <Link href="/forgot-password">Request a new one</Link>.</p></div>
      ) : (
        <form action={reset} className="card">
          <input type="hidden" name="token" value={token} />
          <input name="password" type="password" placeholder="New password (12+ characters)" required minLength={12} autoComplete="new-password" />
          <input name="again" type="password" placeholder="Repeat the password" required minLength={12} autoComplete="new-password" />
          {error && <div className="err">{error}</div>}
          <button type="submit">Change password</button>
          <span className="muted" style={{ fontSize: 13 }}>This signs you out everywhere else.</span>
        </form>
      )}
    </div>
  );
}
