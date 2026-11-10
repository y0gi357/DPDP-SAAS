import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { withTenant } from "@/lib/tenant";
import { choiceLabel, choices, latestDecisions, portalSubject, recordDecision } from "@/lib/business-consent";
import { hit, ipFrom } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const when = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
export default async function CustomerConsent({ params, searchParams }: { params: Promise<{ orgId: string; token: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { orgId, token } = await params;
  const sp = await searchParams;
  const here = `/privacy/${encodeURIComponent(orgId)}/${encodeURIComponent(token)}`;
  const data = await withTenant({ orgId }, async (tx) => {
    const subject = await portalSubject(tx, orgId, token);
    if (!subject) return null;
    const [org, purposes, events] = await Promise.all([
      tx.organisation.findUnique({ where: { id: orgId }, select: { name: true, dpoEmail: true, grievanceEmail: true } }),
      tx.consentPurpose.findMany({ include: { notices: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { createdAt: "asc" } }),
      tx.consentEvent.findMany({ where: { subjectId: subject.id }, include: { notice: true, tasks: true }, orderBy: { revision: "desc" } }),
    ]);
    return { subject, org, purposes, events };
  });
  async function choose(fd: FormData) {
    "use server";
    const parsed = z.object({ purposeId: z.string().min(1).max(60), noticeId: z.string().min(1).max(60), choice: z.enum(choices) }).safeParse(Object.fromEntries(fd));
    if (!parsed.success) redirect(`${here}?error=Invalid%20choice`);
    if (!(await hit(`privacy-choice:${orgId}:${ipFrom(await headers())}`, 120, 3600)).ok) redirect(`${here}?error=Too%20many%20requests.%20Try%20again%20later.`);
    try {
      const d = parsed.data;
      await recordDecision(orgId, token, d.purposeId, d.noticeId, d.choice);
    } catch (e) {
      const known = ["Withdraw your existing consent before declining a new notice.","This private link has expired. Request a new link.", "Purpose not found.", "This purpose no longer accepts new choices.", "The notice has changed. Refresh and read the latest version before choosing.", "There is no matching active consent to withdraw. Refresh the page."];
      const message = e instanceof Error && known.includes(e.message) ? e.message : "Could not save your choice. Please retry.";
      redirect(`${here}?error=${encodeURIComponent(message)}`);
    }
    redirect(`${here}?saved=1`);
  }
  if (!data) return <main className="auth"><h1>Private link expired or unavailable</h1><p><Link href={`/privacy/${encodeURIComponent(orgId)}`}>Request a new private link</Link></p></main>;
  const latest = latestDecisions(data.events);
  return <main style={{ maxWidth: 860, margin: "32px auto", padding: "0 20px" }}>
    <h1>Your privacy choices</h1><p>{data.org?.name} · {data.subject.email}</p>
    <p>Choose separately for each purpose. Nothing is selected for you. You can decline or withdraw here without contacting support. Withdrawal does not affect processing already lawfully carried out; processing required or authorised by law may continue.</p>
    <p className="muted">Keep this private link to yourself. It expires {data.subject.tokenExpiresAt && when(data.subject.tokenExpiresAt)}.</p>
    {sp.error && <p className="err" role="alert">{sp.error}</p>}{sp.saved && <p role="status" style={{ color: "var(--ok)" }}>Your choice has been recorded.</p>}
    {data.purposes.filter((p) => p.active || latest.get(p.id)?.choice === "GRANTED").map((p) => {
      const n = p.notices[0], e = latest.get(p.id);
      if (!n) return null;
      return <section className="card" key={p.id}>
        <h2>{n.title}</h2><p>{n.description}</p><p><strong>Data used:</strong> {n.dataItems.join(", ")}</p>
        <p className="code">Notice version {n.version} · Language {n.language} · Published {when(n.publishedAt)}</p>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{n.text}</pre>
        <p>Your choice: <strong>{e ? choiceLabel[e.choice] : "Not yet provided"}</strong>{e && ` · version ${e.notice.version} · ${when(e.createdAt)}`}</p>
        {e?.choice === "GRANTED" && e.noticeId !== n.id && <p className="notice">Your recorded grant relates to an older notice. Read the new notice before making a new choice. You can still withdraw the existing grant.</p>}
        {p.active && <form action={choose} className="row"><input type="hidden" name="purposeId" value={p.id} /><input type="hidden" name="noticeId" value={n.id} /><button name="choice" value="GRANTED" className="ghost">Give consent for this purpose</button>{e?.choice !== "GRANTED" && <button name="choice" value="DENIED" className="ghost">Decline this purpose</button>}</form>}
        {e?.choice === "GRANTED" && <form action={choose} style={{ marginTop: 10 }}><input type="hidden" name="purposeId" value={p.id} /><input type="hidden" name="noticeId" value={e.noticeId} /><button name="choice" value="WITHDRAWN" className="ghost">Withdraw consent for this purpose</button></form>}
      </section>;
    })}
    {!data.purposes.some((p) => p.active && p.notices.length) && <p>No purposes currently request consent.</p>}
    <div className="card"><h2>Your records</h2><a className="btn" href={`${here}/export`}>Download your complete records (JSON)</a><p className="muted">Includes notice versions, decision timestamps and withdrawal follow-up status.</p>
      {data.events.map((e) => <details key={e.id}><summary>{when(e.createdAt)} · {e.notice.title} · {choiceLabel[e.choice]} · v{e.notice.version}</summary><p className="code">Receipt: {e.id}</p><p>{e.notice.description}</p><p>Data: {e.notice.dataItems.join(", ")}</p><pre style={{ whiteSpace: "pre-wrap" }}>{e.notice.text}</pre>{e.tasks.map((t) => <p key={t.id}>{t.target}: {t.acknowledgedAt ? `Action acknowledged ${when(t.acknowledgedAt)}` : "Awaiting organisation follow-up"}</p>)}</details>)}
      {!data.events.length && <p>No decisions yet.</p>}
    </div>
    <p>Questions: {data.org?.dpoEmail ?? "Contact the organisation"}{data.org?.grievanceEmail && ` · Grievances: ${data.org.grievanceEmail}`}</p>
    <Link href={`/privacy/${encodeURIComponent(orgId)}`}>Request a new access link</Link>
  </main>;
}
