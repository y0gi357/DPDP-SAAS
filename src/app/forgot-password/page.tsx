import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hit, ipFrom } from "@/lib/ratelimit";
import { appUrl, sendEmail } from "@/lib/email";
import { issueToken } from "@/lib/auth-flows";
import { resetPasswordMail } from "@/lib/mail-templates";
import { TTL } from "@/lib/tokens";

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;

  async function request(fd: FormData) {
    "use server";
    const email = z.string().trim().toLowerCase().email().safeParse(fd.get("email"));
    if (email.success) {
      const [byIp, byEmail] = await Promise.all([hit(`forgot:i:${ipFrom(await headers())}`, 10, 3600), hit(`forgot:e:${email.data}`, 3, 3600)]);
      if (byIp.ok && byEmail.ok) {
        const user = await prisma.user.findUnique({ where: { email: email.data } });
        if (user) {
          try {
            const token = await issueToken(user.id, "RESET_PASSWORD", TTL.reset);
            await sendEmail({ to: user.email, ...resetPasswordMail(user.name, `${appUrl()}/reset-password/${token}`) });
          } catch (e) { console.error("reset email failed", e); }
        }
      }
    }
    redirect("/forgot-password?sent=1"); // same answer whether or not the account exists
  }

  return (
    <div className="auth">
      <h1>Reset your password</h1>
      {sent ? (
        <div className="card"><p style={{ margin: 0 }}>If an account exists for that address, we have sent a link that works for one hour. Check your inbox and spam folder.</p></div>
      ) : (
        <form action={request} className="card">
          <input name="email" type="email" placeholder="Your email" required autoComplete="email" />
          <button type="submit">Send reset link</button>
        </form>
      )}
      <p className="muted"><Link href="/login">Back to sign in</Link></p>
    </div>
  );
}
