import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { firstError, idOf, isUnique, opt, req } from "@/lib/form";
import { STANDARD_DEPARTMENTS } from "@/lib/pii";
import { ErrorNote, Field, PageHead, RowActions } from "@/components/ui";

const schema = z.object({
  name: req(120),
  headName: opt(120),
  spocName: opt(120),
  spocEmail: z.string().trim().email().max(200).optional().or(z.literal("")).transform((v) => v || null),
});

async function save(fd: FormData) {
  "use server";
  const s = await requireSession("edit_org");
  const id = idOf(fd);
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/departments?error=${encodeURIComponent(firstError(parsed.error))}`);
  let err: string | null = null;
  try {
    await withTenant(s, async (tx) => {
      const row = id
        ? await tx.department.update({ where: { id }, data: parsed.data })
        : await tx.department.create({ data: { ...parsed.data, orgId: s.orgId } });
      await audit(tx, { orgId: s.orgId, userId: s.userId, action: id ? "department.updated" : "department.created", entity: "Department", entityId: row.id });
    });
  } catch (e) {
    if (isUnique(e)) err = "A department with that name already exists."; else throw e;
  }
  if (err) redirect(`/departments?error=${encodeURIComponent(err)}`);
  revalidatePath("/departments");
  redirect("/departments");
}

async function remove(fd: FormData) {
  "use server";
  const s = await requireSession("edit_org");
  const id = String(fd.get("id") ?? "");
  await withTenant(s, async (tx) => {
    await tx.department.delete({ where: { id } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "department.deleted", entity: "Department", entityId: id });
  });
  revalidatePath("/departments");
}

async function addStandard() {
  "use server";
  const s = await requireSession("edit_org");
  await withTenant(s, async (tx) => {
    const have = new Set((await tx.department.findMany({ select: { name: true } })).map((d) => d.name));
    const toAdd = STANDARD_DEPARTMENTS.filter((n) => !have.has(n));
    if (!toAdd.length) return;
    await tx.department.createMany({ data: toAdd.map((name) => ({ orgId: s.orgId, name })) });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "department.seeded", entity: "Department", meta: { added: toAdd.length } });
  });
  revalidatePath("/departments");
  redirect("/departments");
}

export default async function Departments({ searchParams }: { searchParams: Promise<{ edit?: string; error?: string }> }) {
  const s = await requireSession("view");
  const { edit, error } = await searchParams;
  const editable = can(s.role, "edit_org");
  const rows = await withTenant(s, (tx) =>
    tx.department.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { assets: true, ropa: true } } } }),
  );
  const cur = rows.find((r) => r.id === edit);

  return (
    <>
      <PageHead title="Departments & SPOCs" sub="Each department nominates a single point of contact (SPOC) for privacy questions." />
      <ErrorNote msg={error} />
      {editable && STANDARD_DEPARTMENTS.some((n) => !rows.some((r) => r.name === n)) && (
        <form action={addStandard} className="card row" style={{ justifyContent: "space-between" }}>
          <span className="muted">Quick start: add the standard departments ({STANDARD_DEPARTMENTS.length}) so apps can pre-select typical PII.</span>
          <button type="submit" className="ghost">Add standard departments</button>
        </form>
      )}
      {editable && (
        <form action={save} className="card">
          <h2>{cur ? "Edit department" : "Add department"}</h2>
          {cur && <input type="hidden" name="id" value={cur.id} />}
          <div className="fields">
            <Field label="Department"><input name="name" defaultValue={cur?.name} required /></Field>
            <Field label="Head"><input name="headName" defaultValue={cur?.headName ?? ""} /></Field>
            <Field label="SPOC name"><input name="spocName" defaultValue={cur?.spocName ?? ""} /></Field>
            <Field label="SPOC email"><input name="spocEmail" type="email" defaultValue={cur?.spocEmail ?? ""} /></Field>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="submit">{cur ? "Update" : "Add"}</button>
            {cur && <a className="btn" href="/departments">Cancel</a>}
          </div>
        </form>
      )}
      <div className="card">
        {rows.length === 0 ? <div className="empty">No departments yet.</div> : (
          <table>
            <thead><tr><th>Department</th><th>Head</th><th>SPOC</th><th>Assets</th><th>RoPA</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td><td>{r.headName}</td>
                  <td>{r.spocName}{r.spocEmail ? <div className="code">{r.spocEmail}</div> : null}</td>
                  <td>{r._count.assets}</td><td>{r._count.ropa}</td>
                  <td><RowActions id={r.id} editable={editable} editHref={`/departments?edit=${r.id}`} onDelete={remove} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
