import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { firstError, idOf, opt, req } from "@/lib/form";
import { COVERAGE, SENIOR_DESIGNATIONS } from "@/lib/enums";
import { ErrorNote, Field, PageHead, RowActions, Select } from "@/components/ui";

const schema = z.object({
  name: req(120),
  designation: z.enum(SENIOR_DESIGNATIONS, { message: "Select a senior designation" }),
  function: opt(120),
  email: z.string().trim().email().max(200).optional().or(z.literal("")).transform((v) => v || null),
});

async function save(fd: FormData) {
  "use server";
  const s = await requireSession("edit_org");
  const id = idOf(fd);
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/committee?error=${encodeURIComponent(firstError(parsed.error))}`);
  await withTenant(s, async (tx) => {
    const row = id
      ? await tx.committeeMember.update({ where: { id }, data: parsed.data })
      : await tx.committeeMember.create({ data: { ...parsed.data, orgId: s.orgId } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: id ? "committee.updated" : "committee.added", entity: "CommitteeMember", entityId: row.id });
  });
  revalidatePath("/committee");
  redirect("/committee");
}

async function remove(fd: FormData) {
  "use server";
  const s = await requireSession("edit_org");
  const id = String(fd.get("id") ?? "");
  await withTenant(s, async (tx) => {
    await tx.committeeMember.delete({ where: { id } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "committee.removed", entity: "CommitteeMember", entityId: id });
  });
  revalidatePath("/committee");
}

export default async function Committee({ searchParams }: { searchParams: Promise<{ edit?: string; error?: string }> }) {
  const s = await requireSession("view");
  const { edit, error } = await searchParams;
  const editable = can(s.role, "edit_org");
  const rows = await withTenant(s, (tx) => tx.committeeMember.findMany({ orderBy: { createdAt: "asc" } }));
  const cur = rows.find((r) => r.id === edit);

  // Keep a legacy free-text designation selectable when editing an older record.
  const options: string[] = [...SENIOR_DESIGNATIONS];
  if (cur?.designation && !options.includes(cur.designation)) options.unshift(cur.designation);

  const missing = COVERAGE.filter((c) => !rows.some((r) => r.designation && c.match.test(r.designation))).map((c) => c.name);

  return (
    <>
      <PageHead title="DPDPA Steering Committee" sub="Cross-functional governance body of senior leaders accountable for data protection decisions." />
      {rows.length > 0 && missing.length > 0 && (
        <div className="notice">Functions not yet represented: {missing.join(", ")}. (Guidance for a well-rounded committee, not a legal requirement.)</div>
      )}
      <ErrorNote msg={error} />
      {editable && (
        <form action={save} className="card">
          <h2>{cur ? "Edit committee member" : "Add committee member"}</h2>
          {cur && <input type="hidden" name="id" value={cur.id} />}
          <div className="fields">
            <Field label="Name *"><input name="name" defaultValue={cur?.name} placeholder="Full name" required /></Field>
            <Field label="Senior designation *">
              <Select name="designation" required allowEmpty emptyLabel="Select a senior designation..." options={options} value={cur?.designation} />
            </Field>
            <Field label="Function / department"><input name="function" defaultValue={cur?.function ?? ""} placeholder="e.g. Information Security" /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={cur?.email ?? ""} placeholder="name@company.com" /></Field>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            Steering committee membership is restricted to CXO and Function-Head level. Operational owners join sub-working groups, not the steering body.
          </p>
          <div className="row">
            <button type="submit">{cur ? "Update" : "Save"}</button>
            {cur && <a className="btn" href="/committee">Cancel</a>}
          </div>
        </form>
      )}
      <div className="card">
        {rows.length === 0 ? <div className="empty">No members yet.</div> : (
          <table>
            <thead><tr><th>Name</th><th>Designation</th><th>Function</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td><td>{r.designation}</td><td>{r.function}</td><td>{r.email}</td>
                  <td><RowActions id={r.id} editable={editable} editHref={`/committee?edit=${r.id}`} onDelete={remove} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
