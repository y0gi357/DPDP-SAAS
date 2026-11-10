import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { firstError, idOf, opt, optDate, optInt, req } from "@/lib/form";
import { ErrorNote, Field, PageHead, RowActions, fmtDate } from "@/components/ui";

const NATURES = ["Unauthorised access", "Loss or theft of device", "Ransomware or malware", "Misdirected disclosure", "Insider misuse", "Vendor or processor breach", "Other"] as const;
const STATUSES = ["OPEN", "CONTAINED", "CLOSED"] as const;
const HOUR = 3600 * 1000;

const schema = z.object({
  title: req(160),
  detectedAt: z.string().min(1, "Required").transform((v) => new Date(v)).refine((d) => !Number.isNaN(d.getTime()), "Invalid date"),
  nature: z.enum(NATURES),
  description: req(2000),
  dataAffected: opt(500),
  principalsAffected: optInt(1_000_000_000),
  boardIntimatedAt: optDate,
  principalsIntimatedAt: optDate,
  detailedReportAt: optDate,
  status: z.enum(STATUSES),
  rootCause: opt(2000),
  measures: opt(2000),
});

async function save(fd: FormData) {
  "use server";
  const s = await requireSession("edit_data");
  const id = idOf(fd);
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/breaches?error=${encodeURIComponent(firstError(parsed.error))}`);
  const d = parsed.data;
  for (const [name, when] of [["Board intimation", d.boardIntimatedAt], ["Principal intimation", d.principalsIntimatedAt], ["Detailed report", d.detailedReportAt]] as const)
    if (when && when < d.detectedAt) redirect(`/breaches?error=${encodeURIComponent(`${name} cannot be before the detection date.`)}`);
  await withTenant(s, async (tx) => {
    const row = id ? await tx.breach.update({ where: { id }, data: d }) : await tx.breach.create({ data: { ...d, orgId: s.orgId } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: id ? "breach.updated" : "breach.recorded", entity: "Breach", entityId: row.id });
  });
  revalidatePath("/breaches"); revalidatePath("/gaps"); revalidatePath("/dashboard");
  redirect("/breaches");
}

async function remove(fd: FormData) {
  "use server";
  const s = await requireSession("edit_data");
  const id = String(fd.get("id") ?? "");
  await withTenant(s, async (tx) => {
    await tx.breach.delete({ where: { id } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "breach.deleted", entity: "Breach", entityId: id });
  });
  revalidatePath("/breaches"); revalidatePath("/gaps");
}

export default async function Breaches({ searchParams }: { searchParams: Promise<{ edit?: string; error?: string }> }) {
  const s = await requireSession("view");
  const { edit, error } = await searchParams;
  const editable = can(s.role, "edit_data");
  const rows = await withTenant(s, (tx) => tx.breach.findMany({ orderBy: { detectedAt: "desc" } }));
  const cur = rows.find((r) => r.id === edit);
  const now = Date.now();

  return (
    <>
      <PageHead title="Breach Register" sub="Record personal data breaches and track the intimations the Act requires: the Board and each affected Data Principal without delay, and a detailed report to the Board within 72 hours (Sec 8(6), Rule 7)." />
      <div className="notice">Dates only. Deadlines are counted from the start of the detection day, so an item can show as overdue a few hours early. That errs on the safe side.</div>
      <ErrorNote msg={error} />
      {editable && (
        <form action={save} className="card" key={cur?.id ?? `new-${rows.length}`}>
          <h2>{cur ? "Edit breach" : "Record a breach"}</h2>
          {cur && <input type="hidden" name="id" value={cur.id} />}
          <div className="fields">
            <Field label="Title *"><input name="title" defaultValue={cur?.title} required /></Field>
            <Field label="Detected on *"><input name="detectedAt" type="date" defaultValue={fmtDate(cur?.detectedAt)} required /></Field>
            <Field label="Nature of breach">
              <select name="nature" defaultValue={cur?.nature ?? NATURES[0]}>{NATURES.map((n) => <option key={n}>{n}</option>)}</select></Field>
            <Field label="Status"><select name="status" defaultValue={cur?.status ?? "OPEN"}>{STATUSES.map((n) => <option key={n} value={n}>{n[0] + n.slice(1).toLowerCase()}</option>)}</select></Field>
            <Field label="Data Principals affected"><input name="principalsAffected" inputMode="numeric" defaultValue={cur?.principalsAffected ?? ""} /></Field>
            <Field label="Data affected"><input name="dataAffected" defaultValue={cur?.dataAffected ?? ""} placeholder="e.g. names, emails, order history" /></Field>
            <Field label="Description *" wide><textarea name="description" defaultValue={cur?.description} required /></Field>
            <Field label="Board intimated on"><input name="boardIntimatedAt" type="date" defaultValue={fmtDate(cur?.boardIntimatedAt)} /></Field>
            <Field label="Affected Data Principals told on"><input name="principalsIntimatedAt" type="date" defaultValue={fmtDate(cur?.principalsIntimatedAt)} /></Field>
            <Field label="Detailed report to Board on"><input name="detailedReportAt" type="date" defaultValue={fmtDate(cur?.detailedReportAt)} /></Field>
            <Field label="Root cause" wide><textarea name="rootCause" defaultValue={cur?.rootCause ?? ""} /></Field>
            <Field label="Measures taken" wide><textarea name="measures" defaultValue={cur?.measures ?? ""} /></Field>
          </div>
          <div className="row" style={{ marginTop: 12 }}><button type="submit">{cur ? "Update" : "Save"}</button>{cur && <a className="btn" href="/breaches">Cancel</a>}</div>
        </form>
      )}
      <div className="card" style={{ overflowX: "auto" }}>
        {rows.length === 0 ? <div className="empty">No breaches recorded.</div> : (
          <table>
            <thead><tr><th>Detected</th><th>Breach</th><th>Board told</th><th>Principals told</th><th>72h report</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((b) => {
                const due = new Date(b.detectedAt.getTime() + 72 * HOUR);
                return (
                  <tr key={b.id}>
                    <td>{fmtDate(b.detectedAt)}</td>
                    <td>{b.title}<div className="code">{b.nature}{b.principalsAffected != null ? ` · ${b.principalsAffected} affected` : ""}</div></td>
                    <td>{b.boardIntimatedAt ? fmtDate(b.boardIntimatedAt) : <span className={`badge ${now - b.detectedAt.getTime() > 24 * HOUR ? "high" : "medium"}`}>Not yet</span>}</td>
                    <td>{b.principalsIntimatedAt ? fmtDate(b.principalsIntimatedAt) : <span className={`badge ${now - b.detectedAt.getTime() > 72 * HOUR ? "high" : "medium"}`}>Not yet</span>}</td>
                    <td>{b.detailedReportAt ? fmtDate(b.detailedReportAt) : now > due.getTime() ? <span className="badge high">Overdue (was {fmtDate(due)})</span> : <span className="badge medium">Due {fmtDate(due)}</span>}</td>
                    <td>{b.status[0] + b.status.slice(1).toLowerCase()}</td>
                    <td><RowActions id={b.id} editable={editable} editHref={`/breaches?edit=${b.id}`} onDelete={remove} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
