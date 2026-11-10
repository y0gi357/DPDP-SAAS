import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { firstError, opt, req } from "@/lib/form";
import { RISK_TIERS, label } from "@/lib/enums";
import { assessRopa } from "@/lib/ropa-assess";
import { DPIA_LABELS, DPIA_STATUSES, canSetDpiaStatus, dpiaNeeded, mitigationsFor, necessityText, proportionalityText, residualFor } from "@/lib/dpia";
import { ErrorNote, PageHead, RowActions, fmtDate } from "@/components/ui";

type Tx = Parameters<Parameters<typeof withTenant>[1]>[0];

async function generate() {
  "use server";
  const s = await requireSession("edit_data");
  let created = 0, refreshed = 0, flagged = 0;
  await withTenant(s, async (tx) => {
    const [org, ropa, existing] = await Promise.all([
      tx.organisation.findUniqueOrThrow({ where: { id: s.orgId } }),
      tx.ropaRecord.findMany({ include: { department: true, vendors: { include: { vendor: true } } } }),
      tx.dpia.findMany(),
    ]);
    const byRopa = new Map(existing.filter((d) => d.ropaId).map((d) => [d.ropaId!, d]));
    for (const r of ropa) {
      const a = assessRopa(r, org);
      if (!dpiaNeeded(a.risk.level, org.isSDF)) continue;
      const res = residualFor(a.risk.level);
      const risk = {
        riskLevel: a.risk.level, riskScore: a.risk.score, riskFactors: a.risk.factors, sdfMandated: org.isSDF,
        mitigations: mitigationsFor(a.risk.factors.map((f) => f.key)), residualLevel: res.level, residualNote: res.note,
      };
      const ex = byRopa.get(r.id);
      if (!ex) {
        await tx.dpia.create({
          data: {
            ...risk, orgId: s.orgId, ropaId: r.id, activity: r.activity, department: r.department?.name ?? null,
            necessity: necessityText(r), proportionality: proportionalityText(r.piiFields.length, r.dataCategories.length), auto: true,
          },
        });
        created++;
      } else if (ex.auto && ex.status === "DRAFT") {
        await tx.dpia.update({ where: { id: ex.id }, data: risk });
        refreshed++;
      } else if (ex.riskLevel !== a.risk.level && !ex.outdated) {
        await tx.dpia.update({ where: { id: ex.id }, data: { outdated: true } }); // keep what was reviewed, flag the change
        flagged++;
      }
    }
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "dpia.generated", entity: "Dpia", meta: { created, refreshed, flagged } });
  });
  revalidatePath("/dpia");
  revalidatePath("/dashboard");
  redirect(`/dpia?msg=${encodeURIComponent(`Generated ${created}, refreshed ${refreshed} draft(s), flagged ${flagged} changed.`)}`);
}

async function clearDrafts() {
  "use server";
  const s = await requireSession("edit_data");
  await withTenant(s, async (tx) => {
    const r = await tx.dpia.deleteMany({ where: { auto: true, status: "DRAFT" } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "dpia.cleared", entity: "Dpia", meta: { count: r.count } });
  });
  revalidatePath("/dpia");
  revalidatePath("/dashboard");
  redirect("/dpia");
}

async function addManual(fd: FormData) {
  "use server";
  const s = await requireSession("edit_data");
  const ropaId = String(fd.get("ropaId") ?? "");
  let err: string | null = null;
  await withTenant(s, async (tx) => {
    const r = await tx.ropaRecord.findUnique({ where: { id: ropaId }, include: { department: true, vendors: { include: { vendor: true } } } });
    if (!r) { err = "Choose an activity."; return; }
    if (await tx.dpia.findFirst({ where: { ropaId } })) { err = "That activity already has a DPIA."; return; }
    const org = await tx.organisation.findUniqueOrThrow({ where: { id: s.orgId } });
    const a = assessRopa(r, org);
    const res = residualFor(a.risk.level);
    const row = await tx.dpia.create({
      data: {
        orgId: s.orgId, ropaId, activity: r.activity, department: r.department?.name ?? null,
        riskLevel: a.risk.level, riskScore: a.risk.score, riskFactors: a.risk.factors, sdfMandated: org.isSDF,
        necessity: necessityText(r), proportionality: proportionalityText(r.piiFields.length, r.dataCategories.length),
        mitigations: mitigationsFor(a.risk.factors.map((f) => f.key)), residualLevel: res.level, residualNote: res.note, auto: false,
      },
    });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "dpia.created", entity: "Dpia", entityId: row.id });
  });
  if (err) redirect(`/dpia?error=${encodeURIComponent(err)}`);
  revalidatePath("/dpia");
  revalidatePath("/dashboard");
  redirect("/dpia");
}

const schema = z.object({
  id: req(60),
  necessity: req(4000),
  proportionality: req(4000),
  mitigations: z.string().max(6000),
  residualLevel: z.enum(RISK_TIERS),
  residualNote: opt(1000),
  reviewNotes: opt(3000),
  status: z.enum(DPIA_STATUSES),
  approverRef: opt(60),
});

async function save(fd: FormData) {
  "use server";
  const s = await requireSession("edit_data");
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/dpia?error=${encodeURIComponent(firstError(parsed.error))}`);
  const d = parsed.data;
  const mitigations = d.mitigations.split("\n").map((x) => x.trim().slice(0, 500)).filter(Boolean).slice(0, 30);
  let err: string | null = null, msg: string | null = null;

  await withTenant(s, async (tx: Tx) => {
    const ex = await tx.dpia.findUniqueOrThrow({ where: { id: d.id } });
    let status = d.status;
    if (status !== ex.status && !canSetDpiaStatus(s.role, status)) { err = "Only an admin can approve or reject a DPIA."; return; }

    const contentChanged =
      d.necessity !== ex.necessity || d.proportionality !== ex.proportionality ||
      mitigations.join("\n") !== ex.mitigations.join("\n") || d.residualLevel !== ex.residualLevel;
    if (ex.status === "APPROVED" && contentChanged && status === "APPROVED") {
      status = "UNDER_REVIEW"; // editing an approved DPIA sends it back for re-approval
      msg = "You edited an approved DPIA, so it is back under review and needs approving again.";
    }

    let approverRef: string | null = null, approvedAt: Date | null = null;
    if (status === "APPROVED") {
      const mid = (d.approverRef ?? "").replace(/^member:/, "");
      if (!d.approverRef?.startsWith("member:") || !(await tx.committeeMember.findUnique({ where: { id: mid } }))) { err = "Choose the committee member who approved it."; return; }
      approverRef = d.approverRef;
      approvedAt = ex.status === "APPROVED" && ex.approvedAt ? ex.approvedAt : new Date();
    }

    // A reviewer who reopens a flagged DPIA pulls in the current risk from the RoPA.
    let refresh = {};
    if (ex.outdated && ex.ropaId && (status === "DRAFT" || status === "UNDER_REVIEW")) {
      const r = await tx.ropaRecord.findUnique({ where: { id: ex.ropaId }, include: { department: true, vendors: { include: { vendor: true } } } });
      if (r) {
        const org = await tx.organisation.findUniqueOrThrow({ where: { id: s.orgId } });
        const a = assessRopa(r, org);
        refresh = { riskLevel: a.risk.level, riskScore: a.risk.score, riskFactors: a.risk.factors, outdated: false };
      }
    }

    await tx.dpia.update({
      where: { id: d.id },
      data: {
        necessity: d.necessity, proportionality: d.proportionality, mitigations, residualLevel: d.residualLevel,
        residualNote: d.residualNote, reviewNotes: d.reviewNotes, status, approverRef, approvedAt, auto: ex.auto && !contentChanged, ...refresh,
      },
    });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "dpia.updated", entity: "Dpia", entityId: d.id, meta: { status, from: ex.status } });
  });
  if (err) redirect(`/dpia?edit=${d.id}&error=${encodeURIComponent(err)}`);
  revalidatePath("/dpia");
  revalidatePath("/dashboard");
  redirect(msg ? `/dpia?msg=${encodeURIComponent(msg)}` : "/dpia");
}

async function remove(fd: FormData) {
  "use server";
  const s = await requireSession("edit_data");
  const id = String(fd.get("id") ?? "");
  await withTenant(s, async (tx) => {
    await tx.dpia.delete({ where: { id } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "dpia.deleted", entity: "Dpia", entityId: id });
  });
  revalidatePath("/dpia");
  revalidatePath("/dashboard");
}

type Factor = { label: string; weight: number; ref: string };

export default async function DpiaPage({ searchParams }: { searchParams: Promise<{ edit?: string; error?: string; msg?: string }> }) {
  const s = await requireSession("view");
  const { edit, error, msg } = await searchParams;
  const editable = can(s.role, "edit_data");
  const admin = can(s.role, "edit_org");
  const [rows, org, ropa, members] = await withTenant(s, (tx) =>
    Promise.all([
      tx.dpia.findMany({ orderBy: [{ riskScore: "desc" }, { activity: "asc" }] }),
      tx.organisation.findUniqueOrThrow({ where: { id: s.orgId } }),
      tx.ropaRecord.findMany({ include: { department: true, vendors: { include: { vendor: true } } } }),
      tx.committeeMember.findMany({ orderBy: { name: "asc" } }),
    ]),
  );
  const cur = rows.find((r) => r.id === edit);
  const hasDpia = new Set(rows.map((r) => r.ropaId).filter(Boolean));
  const needed = ropa.filter((r) => dpiaNeeded(assessRopa(r, org).risk.level, org.isSDF));
  const missing = needed.filter((r) => !hasDpia.has(r.id)).length;
  const count = (st: string) => rows.filter((r) => r.status === st).length;
  const memberName = new Map(members.map((m) => [`member:${m.id}`, `${m.name} (${m.designation ?? "Member"})`]));
  const withoutDpia = ropa.filter((r) => !hasDpia.has(r.id));

  return (
    <>
      <PageHead title="DPIA" sub="Data Protection Impact Assessments, generated from your RoPA risk scores and taken through review and approval by a named committee member." />
      {org.isSDF && <div className="notice">Your organisation is a notified Significant Data Fiduciary. DPIAs are generated for every activity as a cautious default. Sec 10(2)(c) and Rule 13 require periodic DPIAs and audits, so confirm the scope with your counsel.</div>}
      {msg && <div style={{ color: "var(--ok)", marginBottom: 10 }}>{msg}</div>}
      <ErrorNote msg={error} />

      <div className="tiles">
        <div className="tile"><div className="t">Activities needing a DPIA</div><div className="n">{needed.length}</div></div>
        <div className="tile"><div className="t">Missing</div><div className="n" style={{ color: missing ? "var(--bad)" : "var(--ok)" }}>{missing}</div></div>
        <div className="tile"><div className="t">Approved</div><div className="n" style={{ color: "var(--ok)" }}>{count("APPROVED")}</div></div>
        <div className="tile"><div className="t">Under review</div><div className="n" style={{ color: "var(--warn)" }}>{count("UNDER_REVIEW")}</div></div>
        <div className="tile"><div className="t">Draft</div><div className="n">{count("DRAFT")}</div></div>
        <div className="tile"><div className="t">Rejected</div><div className="n" style={{ color: "var(--bad)" }}>{count("REJECTED")}</div></div>
      </div>

      {editable && !cur && (
        <div className="card row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            <form action={generate}><button type="submit">Generate from RoPA</button></form>
            <form action={clearDrafts}><button type="submit" className="ghost">Clear auto-generated drafts</button></form>
          </div>
          {withoutDpia.length > 0 && (
            <form action={addManual} className="row">
              <select name="ropaId" defaultValue=""><option value="" disabled>Add a DPIA for an activity...</option>
                {withoutDpia.map((r) => <option key={r.id} value={r.id}>{r.activity}</option>)}</select>
              <button type="submit" className="ghost">Add</button>
            </form>
          )}
        </div>
      )}

      {cur && (
        <form action={save} className="card">
          <h2>{cur.activity}{cur.department ? ` · ${cur.department}` : ""}</h2>
          <input type="hidden" name="id" value={cur.id} />
          <div className="row" style={{ marginBottom: 8 }}>
            <span className={`badge ${cur.riskLevel.toLowerCase()}`}>{cur.riskLevel} risk ({cur.riskScore})</span>
            {cur.outdated && <span className="badge medium">Risk changed since review: saving as draft or under review refreshes it</span>}
          </div>
          <ul className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            {(cur.riskFactors as Factor[]).map((f) => <li key={f.label}>{f.label} (+{f.weight}, {f.ref})</li>)}
          </ul>
          <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="fields">
              <label className="field span2"><span className="l">Necessity and lawful basis</span><textarea name="necessity" defaultValue={cur.necessity} required style={{ minHeight: 90 }} /></label>
              <label className="field span2"><span className="l">Proportionality</span><textarea name="proportionality" defaultValue={cur.proportionality} required style={{ minHeight: 90 }} /></label>
              <label className="field span2"><span className="l">Mitigations (one per line)</span><textarea name="mitigations" defaultValue={cur.mitigations.join("\n")} style={{ minHeight: 130 }} /></label>
              <label className="field"><span className="l">Residual risk after mitigation</span>
                <select name="residualLevel" defaultValue={cur.residualLevel}>{RISK_TIERS.map((r) => <option key={r} value={r}>{label(r)}</option>)}</select></label>
              <label className="field"><span className="l">Residual risk note</span><input name="residualNote" defaultValue={cur.residualNote ?? ""} /></label>
              <label className="field span2"><span className="l">Reviewer notes</span><textarea name="reviewNotes" defaultValue={cur.reviewNotes ?? ""} /></label>
              <label className="field"><span className="l">Status</span>
                <select name="status" defaultValue={cur.status}>
                  {DPIA_STATUSES.map((st) => <option key={st} value={st} disabled={!canSetDpiaStatus(s.role, st) && st !== cur.status}>{DPIA_LABELS[st]}{!canSetDpiaStatus(s.role, st) && st !== cur.status ? " (admin only)" : ""}</option>)}
                </select></label>
              <label className="field"><span className="l">Approved by (committee member, needed to approve)</span>
                <select name="approverRef" defaultValue={cur.approverRef ?? ""}>
                  <option value="">-</option>
                  {members.map((m) => <option key={m.id} value={`member:${m.id}`}>{m.name} ({m.designation ?? "Member"})</option>)}
                </select></label>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>Editing an approved DPIA sends it back to review. {admin ? "" : "Approval and rejection need an admin."}</p>
            {editable && <div className="row"><button type="submit">Save</button><a className="btn" href="/dpia">Cancel</a></div>}
          </fieldset>
        </form>
      )}

      <div className="card" style={{ overflowX: "auto" }}>
        {rows.length === 0 ? <div className="empty">No DPIAs yet. Generate them from your RoPA once activities are scored.</div> : (
          <table>
            <thead><tr><th>Activity</th><th>Risk</th><th>Status</th><th>Residual</th><th>Approval</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.activity}{!r.auto && <> <span className="badge">manual</span></>}<div className="code">{r.department ?? "-"}{r.sdfMandated ? " · SDF" : ""}</div></td>
                  <td title={(r.riskFactors as Factor[]).map((f) => f.label).join("\n")}><span className={`badge ${r.riskLevel.toLowerCase()}`}>{r.riskLevel} ({r.riskScore})</span>
                    {r.outdated && <div><span className="badge medium">Risk changed</span></div>}</td>
                  <td>{DPIA_LABELS[r.status]}</td>
                  <td><span className={`badge ${r.residualLevel.toLowerCase()}`}>{label(r.residualLevel)}</span></td>
                  <td>{r.approverRef ? <>{memberName.get(r.approverRef) ?? "Former member"}<div className="code">{fmtDate(r.approvedAt)}</div></> : "-"}</td>
                  <td><RowActions id={r.id} editable={editable} editHref={`/dpia?edit=${r.id}`} onDelete={remove} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
