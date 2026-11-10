import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withTenant } from "@/lib/tenant";
import { hit, ipFrom } from "@/lib/ratelimit";
import { sendPortalLink } from "@/lib/business-consent";

export const dynamic = "force-dynamic";
export default async function PrivacyEntry({ params, searchParams }: { params: Promise<{ orgId: string }>; searchParams: Promise<{ sent?: string }> }) {
  const { orgId } = await params;
  const { sent } = await searchParams;
  async function requestLink(fd: FormData) {
    "use server";
    const email = z.string().trim().toLowerCase().email().max(200).safeParse(fd.get("email"));
    const limits = await Promise.all([hit(`privacy-entry:ip:${ipFrom(await headers())}`, 10, 3600), hit(`privacy-entry:org:${orgId}`, 100, 3600)]);
    if (email.success && limits.every((x) => x.ok) && (await hit(`privacy-entry:email:${orgId}:${email.data}`, 3, 3600)).ok) {
      const subject = await withTenant({ orgId }, (tx) => tx.consentSubject.findUnique({ where: { orgId_email: { orgId, email: email.data } }, select: { id: true } }));
      if (subject) await sendPortalLink({ orgId }, subject.id);
    }
    redirect(`/privacy/${encodeURIComponent(orgId)}?sent=1`);
  }
  return <main className="auth"><h1>Your privacy choices</h1><div className="card">{sent ? <p>If this address is enrolled, a private link has been sent. Check your inbox. You can request another link later if necessary.</p> : <form action={requestLink}><p>Enter the email address you use with this organisation. Your private link expires in 24 hours.</p><label>Email<input name="email" type="email" required maxLength={200} autoComplete="email" /></label><button>Send private link</button></form>}</div></main>;
}
