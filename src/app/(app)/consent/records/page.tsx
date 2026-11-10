import Link from "next/link";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { appUrl } from "@/lib/email";
import { choiceLabel, latestDecisions } from "@/lib/business-consent";
import { PageHead, Field } from "@/components/ui";
import { publishNotice, togglePurpose, addSubject, issueLink, revokeLink, acknowledgeWithdrawal } from "./actions";

export const dynamic = "force-dynamic";
const when = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
export default async function ConsentRecords({ searchParams }: { searchParams: Promise<{ q?: string; purpose?: string; subject?: string; message?: string; devLink?: string }> }) {
  const s = await requireSession("view");
  const sp = await searchParams;
  const edit = can(s.role, "edit_data"), admin = can(s.role, "edit_org");
  const q = (sp.q ?? "").slice(0, 200).trim();
  const [purposes, subjects, tasks, counts, history] = await withTenant(s, async (tx) => Promise.all([
    tx.consentPurpose.findMany({ include: { notices: { orderBy: { version: "desc" } } }, orderBy: { createdAt: "asc" } }),
    tx.consentSubject.findMany({ where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }] } : undefined, include: { events: { orderBy: { revision: "desc" }, include: { notice: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    tx.consentWithdrawalTask.findMany({ include: { event: { include: { subject: true, notice: true } } }, orderBy: [{ acknowledgedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }], take: 100 }),
    Promise.all([tx.consentSubject.count(), tx.consentEvent.count(), tx.consentWithdrawalTask.count({ where: { acknowledgedAt: null } }), tx.consentPurpose.count({ where: { active: true } })]),
    sp.subject ? tx.consentEvent.findMany({ where: { subjectId: sp.subject }, include: { notice: true }, orderBy: { revision: "desc" }, take: 200 }) : [],
  ]));
  const chosen = purposes.find((p) => p.id === sp.purpose), notice = chosen?.notices[0];
  const safeDevLink = process.env.NODE_ENV !== "production" && sp.devLink?.startsWith(`${appUrl()}/privacy/${s.orgId}/`) ? sp.devLink : null;
  return <>
    <PageHead title="Consent records" sub="Collect customer choices for specific purposes, preserve notices and follow up on withdrawals." />
    <p><Link href="/consent">Notice drafts & readiness checklist</Link> · <a href={`/privacy/${s.orgId}`}>Customer portal entry</a></p>
    <div className="notice">Business consent management. Staff publish notices and send portal access; customers make their own choices. This module does not confer registration as a Consent Manager.</div>
    {sp.message && <p role="status">{sp.message}</p>}
    {safeDevLink && <div className="notice">Development email fallback. Treat this as a private credential (expires in 24 hours): <a href={safeDevLink}>{safeDevLink}</a></div>}
    <div className="tiles">{[["Customers", counts[0]], ["Decisions recorded", counts[1]], ["Pending withdrawal tasks", counts[2]], ["Active purposes", counts[3]]].map(([l, n]) => <div className="tile" key={l}><div className="t">{l}</div><div className="n">{n}</div></div>)}</div>
    <div className="card"><h2>Purposes & published notices</h2>
      {purposes.length === 0 && <p className="muted">Publish a purpose and notice before inviting customers.</p>}
      {purposes.map((p) => <div key={p.id} style={{ borderBottom: "1px solid var(--border)", padding: "10px 0" }}>
        <div className="row"><strong>{p.notices[0]?.title ?? p.key}</strong><span className="badge">{p.active ? "Active" : "Paused"}</span><span className="code">{p.key} · {p.notices.length} version(s)</span>
          {admin && <><Link href={`/consent/records?purpose=${p.id}#publish`}>Publish next version</Link><form action={togglePurpose}><input type="hidden" name="id" value={p.id} /><button className="ghost sm">{p.active ? "Pause" : "Resume"}</button></form></>}
        </div>
        <p className="muted">Withdrawal follow-up: {p.targets.join(", ") || "Internal processing and relevant processors"}</p>
        {p.notices.map((n) => <details key={n.id}><summary>Version {n.version} · {n.language} · {when(n.publishedAt)}</summary><p>{n.description}</p><p>Data: {n.dataItems.join(", ")}</p><pre style={{ whiteSpace: "pre-wrap" }}>{n.text}</pre></details>)}
      </div>)}
    </div>
    {admin && <form action={publishNotice} className="card" id="publish" key={chosen?.id ?? "new"}>
      <h2>{chosen ? `Publish next version: ${chosen.key}` : "Publish a new purpose"}</h2>
      <p className="muted">Review the wording before publishing. Every version is permanent. A new version requires a fresh customer choice; it never updates existing consent automatically.</p>
      <input type="hidden" name="purposeId" value={chosen?.id ?? ""} />
      <div className="fields">
        <Field label="Purpose key"><input name="key" defaultValue={chosen?.key} readOnly={!!chosen} required maxLength={80} placeholder="product-updates" /></Field>
        <Field label="Title shown to customer"><input name="title" defaultValue={notice?.title} required maxLength={160} /></Field>
        <Field label="Language code"><input name="language" defaultValue={notice?.language ?? "en"} required placeholder="en or hi" /></Field>
        <Field label="Specific purpose" wide><textarea name="description" defaultValue={notice?.description} required maxLength={2000} /></Field>
        <Field label="Personal data items (one per line)" wide><textarea name="dataItems" defaultValue={notice?.dataItems.join("\n")} required maxLength={4000} /></Field>
        <Field label="Full notice: processing, withdrawal, rights and contact details" wide><textarea name="text" defaultValue={notice?.text} required maxLength={12000} style={{ minHeight: 150 }} /></Field>
        <Field label="Systems / processors to follow up after withdrawal (one per line)" wide><textarea name="targets" defaultValue={chosen?.targets.join("\n")} maxLength={2000} placeholder="CRM\nEmail marketing platform" /></Field>
      </div><div className="row" style={{ marginTop: 12 }}><button>Publish immutable version</button>{chosen && <Link href="/consent/records#publish">New purpose</Link>}</div>
    </form>}
    {edit && <form action={addSubject} className="card"><h2>Add a customer</h2><p className="muted">Use a customer reference, not sensitive data. No consent is assumed when adding a customer or sending a link.</p><div className="row"><input name="email" type="email" placeholder="Customer email" required maxLength={200} aria-label="Customer email" /><input name="reference" placeholder="Customer reference (optional)" maxLength={120} aria-label="Customer reference" /><button>Save customer</button></div></form>}
    <div className="card" style={{ overflowX: "auto" }}><h2>Customer decisions</h2><form className="row" method="get"><input name="q" defaultValue={q} placeholder="Search email or reference" aria-label="Search customers" /><button className="ghost sm">Search</button><Link href="/consent/records">Clear</Link></form>
      <p className="muted">Showing up to 100 customers. “Awaiting choice” is not consent. A grant on an older version does not cover the latest notice.</p>
      <table><thead><tr><th>Customer</th><th>Purpose choices</th><th>Portal access</th></tr></thead><tbody>{subjects.map((c) => {
        const latest = latestDecisions(c.events);
        return <tr key={c.id}><td>{c.email}<div className="code">{c.reference}</div><Link href={`/consent/records?subject=${c.id}#history`}>History</Link></td><td>{purposes.map((p) => { const e = latest.get(p.id); return <div key={p.id}>{p.notices[0]?.title}: <strong>{e ? choiceLabel[e.choice] : "Awaiting choice"}</strong>{e && <span className="code"> · v{e.notice.version}{e.noticeId !== p.notices[0]?.id ? " · newer notice available" : ""}</span>}</div>; })}</td><td>{c.tokenExpiresAt && c.tokenExpiresAt > new Date() ? `Link valid until ${when(c.tokenExpiresAt)}` : "No active link"}{edit && <div className="row"><form action={issueLink}><input type="hidden" name="id" value={c.id} /><button className="ghost sm">Send new link</button></form><form action={revokeLink}><input type="hidden" name="id" value={c.id} /><button className="danger sm">Revoke link</button></form></div>}</td></tr>;
      })}</tbody></table>{subjects.length === 0 && <p className="empty">No customers match.</p>}
    </div>
    {sp.subject && <div className="card" id="history"><h2>Decision history</h2><p className="muted">Latest 200 decisions for this customer. Original notice versions are preserved.</p>{history.map((e) => <details key={e.id}><summary>{when(e.createdAt)} · {e.notice.title} · {choiceLabel[e.choice]} · v{e.notice.version}</summary><p className="code">Receipt {e.id} · {e.source} · sequence {e.revision}</p><p>{e.notice.description}</p><p>Data: {e.notice.dataItems.join(", ")}</p><pre style={{ whiteSpace: "pre-wrap" }}>{e.notice.text}</pre></details>)}{!history.length && <p>No decisions recorded.</p>}</div>}
    <div className="card"><h2>Withdrawal follow-up</h2><p className="muted">Manual queue, latest 100 tasks. These records do not send instructions to external systems. Stop consent-based processing and record what was done, including any lawful retention exception. A later grant does not cancel an earlier withdrawal task.</p>{tasks.map((t) => <div key={t.id} style={{ borderBottom: "1px solid var(--border)", padding: "12px 0" }}><strong>{t.target}</strong> · {t.event.subject.email} · {t.event.notice.title}<p className="code">Withdrawn {when(t.createdAt)} · {t.acknowledgedAt ? `Acknowledged ${when(t.acknowledgedAt)}` : "Pending"}</p>{t.note && <p>{t.note}</p>}{edit && !t.acknowledgedAt && <form action={acknowledgeWithdrawal} className="row"><input type="hidden" name="id" value={t.id} /><textarea name="note" aria-label={`Action taken for ${t.target}`} placeholder="Action taken / lawful retention exception" required minLength={10} maxLength={2000} /><button className="ghost sm">Acknowledge action</button></form>}</div>)}{!tasks.length && <p className="empty">No withdrawal tasks.</p>}</div>
  </>;
}
