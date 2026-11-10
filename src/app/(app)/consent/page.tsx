import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { firstError, opt } from "@/lib/form";
import { CMP_ITEMS, CMP_LABELS, CMP_STATES, deriveNoticeItems, generateNotice } from "@/lib/notice";
import { ErrorNote, PageHead } from "@/components/ui";
import { CM_FIELDS, CM_GROUPS, readCmEvidence, validateCmEvidence } from "@/lib/cm-readiness";
import { CopyButton } from "@/components/CopyButton";

const lines = (s: string) => s.split("\n").map((x) => x.trim().slice(0, 200)).filter(Boolean).slice(0, 100);

const noticeSchema = z.object({
  rightsPortalUrl: z.string().trim().max(300).refine((v) => !v || /^https?:\/\//i.test(v), "Use a full link starting with http:// or https://").optional().transform((v) => v || null),
  crossBorderText: opt(800),
  dataItems: z.string().max(8000).default(""),
  purposes: z.string().max(8000).default(""),
});

async function saveNotice(fd: FormData) {
  "use server";
  const s = await requireSession("edit_data");
  const parsed = noticeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/consent?error=${encodeURIComponent(firstError(parsed.error))}`);
  const d = parsed.data;
  const data = { rightsPortalUrl: d.rightsPortalUrl, crossBorderText: d.crossBorderText, dataItems: lines(d.dataItems), purposes: lines(d.purposes) };
  await withTenant(s, async (tx) => {
    await tx.consentConfig.upsert({ where: { orgId: s.orgId }, create: { orgId: s.orgId, ...data }, update: data });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "notice.updated", entity: "ConsentConfig" });
  });
  revalidatePath("/consent");
  redirect("/consent?saved=1");
}

async function saveCmp(fd: FormData) {
  "use server";
  const s = await requireSession("edit_data");
  const cmp: Record<string, string> = {};
  for (const i of CMP_ITEMS) { const v = String(fd.get(`cmp_${i.id}`) ?? ""); if ((CMP_STATES as readonly string[]).includes(v)) cmp[i.id] = v; }
  const checked = validateCmEvidence(Object.fromEntries(CM_FIELDS.map((f) => [f.key, fd.get(`cm_${f.key}`) ?? ""])), cmp);
  if (!checked.ok) redirect(`/consent?tab=cmp&error=${encodeURIComponent(checked.error)}`);
  const stored = { ...cmp, _cmReadiness: checked.evidence, _cmReviewedAt: new Date().toISOString(), _cmReviewedBy: s.userId };
  const cmpNotes = String(fd.get("cmpNotes") ?? "").slice(0, 2000) || null;
  await withTenant(s, async (tx) => {
    await tx.consentConfig.upsert({ where: { orgId: s.orgId }, create: { orgId: s.orgId, cmp: stored, cmpNotes }, update: { cmp: stored, cmpNotes } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "consent.updated", entity: "ConsentConfig", meta: { checklist: cmp, cmReadiness: checked.evidence } });
  });
  revalidatePath("/consent");
  revalidatePath("/controls");
  revalidatePath("/flow");
  revalidatePath("/report");
  redirect("/consent?tab=cmp&saved=1");
}

export default async function Consent({ searchParams }: { searchParams: Promise<{ tab?: string; error?: string; saved?: string }> }) {
  const s = await requireSession("view");
  const { tab, error, saved } = await searchParams;
  const editable = can(s.role, "edit_data");
  const [org, cfg, ropa] = await withTenant(s, (tx) =>
    Promise.all([
      tx.organisation.findUniqueOrThrow({ where: { id: s.orgId } }),
      tx.consentConfig.findUnique({ where: { orgId: s.orgId } }),
      tx.ropaRecord.findMany({ select: { piiFields: true, dataCategories: true, purposeCategory: true, purpose: true, legalBasis: true, crossBorder: true } }),
    ]),
  );
  const derived = deriveNoticeItems(ropa);
  const dataItems = cfg?.dataItems.length ? cfg.dataItems : derived.dataItems;
  const purposes = cfg?.purposes.length ? cfg.purposes : derived.purposes;
  const notice = generateNotice({
    orgName: org.name, dpoName: org.dpoName, dpoEmail: org.dpoEmail, grievanceEmail: org.grievanceEmail,
    rightsPortalUrl: cfg?.rightsPortalUrl, dataItems, purposes, legalBases: [...new Set(ropa.map((r) => r.legalBasis))],
    handlesChildren: org.handlesChildrenData, crossBorder: org.transfersAbroad || ropa.some((r) => r.crossBorder), crossBorderText: cfg?.crossBorderText, date: new Date(),
  });
  const cmp = (cfg?.cmp ?? {}) as Record<string, string>;
  const cmEvidence = readCmEvidence(cfg?.cmp);
  const answered = CMP_ITEMS.filter((i) => cmp[i.id]).length;
  const active = tab === "cmp" ? "cmp" : "notice";

  return (
    <>
      <PageHead title="Notice & Consent" sub="A privacy notice generated from your RoPA, and a checklist for your consent platform." />
      <div className="row" style={{ marginBottom: 12 }}>
        <a className="btn" href="/consent/records">Customer consent records</a>
        <a className={active === "notice" ? "btn" : "ghost btn"} href="/consent" style={active === "notice" ? { borderColor: "var(--accent)" } : undefined}>Privacy notice</a>
        <a className={active === "cmp" ? "btn" : "ghost btn"} href="/consent?tab=cmp" style={active === "cmp" ? { borderColor: "var(--accent)" } : undefined}>Consent management ({answered}/{CMP_ITEMS.length})</a>
      </div>
      <ErrorNote msg={error} />
      {saved && <div style={{ color: "var(--ok)", marginBottom: 10 }}>Saved.</div>}

      {active === "notice" && (
        <div className="grid" style={{ gridTemplateColumns: "minmax(280px, 1fr) minmax(320px, 1.4fr)", alignItems: "start" }}>
          <form action={saveNotice} className="card">
            <h2>Notice settings</h2>
            <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 10 }}>
              <label className="field"><span className="l">Rights portal link (withdraw consent, exercise rights)</span>
                <input name="rightsPortalUrl" defaultValue={cfg?.rightsPortalUrl ?? ""} placeholder="https://example.com/privacy/rights" /></label>
              <label className="field"><span className="l">Personal data items (one per line)</span>
                <textarea name="dataItems" defaultValue={cfg?.dataItems.join("\n") ?? ""} placeholder={derived.dataItems.slice(0, 6).join("\n")} style={{ minHeight: 120 }} />
                <span className="muted" style={{ fontSize: 12 }}>Leave blank to use the {derived.dataItems.length} item(s) from your RoPA.</span></label>
              <label className="field"><span className="l">Purposes (one per line)</span>
                <textarea name="purposes" defaultValue={cfg?.purposes.join("\n") ?? ""} placeholder={derived.purposes.slice(0, 4).join("\n")} style={{ minHeight: 90 }} />
                <span className="muted" style={{ fontSize: 12 }}>Leave blank to use the {derived.purposes.length} purpose(s) from your RoPA.</span></label>
              <label className="field"><span className="l">Cross-border statement (optional)</span>
                <textarea name="crossBorderText" defaultValue={cfg?.crossBorderText ?? ""} /></label>
              {editable && <button type="submit">Save</button>}
            </fieldset>
            <p className="muted" style={{ fontSize: 12 }}>Contact details come from Organisation Setup. Rights, withdrawal and Board-complaint wording is built in.</p>
          </form>
          <div className="card">
            <div className="toolbar"><h2>Generated notice (draft)</h2><CopyButton text={notice} filename="privacy-notice.txt" /></div>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, margin: 0, maxHeight: 620, overflow: "auto" }}>{notice}</pre>
            <p className="muted" style={{ fontSize: 12 }}>A starting point. Have counsel review it before publishing, and translate it as needed (Sec 5(3)).</p>
          </div>
        </div>
      )}

      {active === "cmp" && (
        <form action={saveCmp} className="card">
          <h2>Consent platform checklist</h2>
          <p>Fiduciary readiness covers receiving instructions through a Consent Manager, checking its registration, and passing withdrawals to processors. The original overall integration answer is retained; assess each new item separately.</p>
          <p className="muted">“In place” on the three readiness items requires supporting evidence below. “Not applicable” requires a reason. These are staff assessments; saving them does not verify registration, receive external instructions, or send processor notifications.</p>
          <p className="code">References: Sec 6(6), 6(7), 6(9), Sec 8(2); <a href="https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf" target="_blank" rel="noopener noreferrer">official DPDP Rules, Rule 4</a>.</p>
          <p className="muted" style={{ marginTop: 0 }}>Answers show up as evidence on the matching controls in Controls Assessment.</p>
          <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
            {CMP_ITEMS.map((i) => (
              <div className="chk-row" key={i.id}>
                <div><div>{i.label}</div><div className="code">{i.refs}</div></div>
                <select aria-label={i.label} name={`cmp_${i.id}`} defaultValue={cmp[i.id] ?? ""}>
                  <option value="">Not answered</option>
                  {CMP_STATES.map((st) => <option key={st} value={st}>{CMP_LABELS[st]}</option>)}
                </select>
              </div>
            ))}
            {CM_GROUPS.map((g) => (
              <section key={g.key} style={{ marginTop: 24 }}>
                <h3>{g.title}</h3><p className="muted">{g.help}</p>
                <div className="fields">
                  {CM_FIELDS.filter((f) => f.group === g.key).map((f) => (
                    <label className={`field${"type" in f && f.type === "textarea" ? " span2" : ""}`} key={f.key}>
                      <span className="l">{f.label}</span>
                      {"type" in f && f.type === "textarea"
                        ? <textarea name={`cm_${f.key}`} defaultValue={cmEvidence[f.key]} maxLength={f.max} />
                        : <input name={`cm_${f.key}`} type={"type" in f ? f.type : "text"} defaultValue={cmEvidence[f.key]} maxLength={f.max} max={"type" in f && f.type === "date" ? new Date().toISOString().slice(0, 10) : undefined} />}
                    </label>
                  ))}
                </div>
              </section>
            ))}
            <p><a href="/consent/records">Open customer decisions and manual processor withdrawal follow-up</a></p>
            {cmp._cmReviewedAt && <p className="code">Readiness last saved: {cmp._cmReviewedAt} · user {cmp._cmReviewedBy}</p>}
            <label className="field" style={{ marginTop: 12 }}><span className="l">Notes</span><textarea name="cmpNotes" defaultValue={cfg?.cmpNotes ?? ""} /></label>
            {editable && <div className="row" style={{ marginTop: 12 }}><button type="submit">Save</button></div>}
          </fieldset>
        </form>
      )}
    </>
  );
}
