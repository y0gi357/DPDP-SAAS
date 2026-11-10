import Link from "next/link";
import { prisma } from "@/lib/db";
import { consumeToken } from "@/lib/auth-flows";

export default async function VerifyEmail({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userId = await consumeToken("VERIFY_EMAIL", token);
  if (userId) await prisma.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  return (
    <div className="auth">
      <h1>{userId ? "Email confirmed" : "Link not valid"}</h1>
      <div className="card">
        <p style={{ margin: 0 }}>{userId ? "Thanks. Your email address is confirmed." : "This link has expired or was already used. Sign in and use the Resend button in the banner to get a new one."}</p>
      </div>
      <p className="muted"><Link href="/dashboard">Continue to the platform</Link></p>
    </div>
  );
}
