import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import DepartmentForm from "@/components/DepartmentForm";
import { departmentSchema, departmentRoles, rolesLabel } from "@/lib/departments";
import { saveDepartment, DepartmentContactError } from "@/lib/department-service";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { firstError, idOf, isUnique } from "@/lib/form";
import { STANDARD_DEPARTMENTS } from "@/lib/pii";
import { ErrorNote, PageHead, RowActions } from "@/components/ui";

async function save(fd: FormData) {
  "use server";
  const s = await requireSession("edit_org");
  const id = idOf(fd);
  let input: unknown;
  try { input = JSON.parse(String(fd.get("department") ?? "")); }
  catch { redirect("/departments?error=Invalid%20department%20form"); }
  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) redirect(`/departments?error=${encodeURIComponent(firstError(parsed.error))}`);
  let err: string | null = null;
  try {
    await withTenant(s, (tx) => saveDepartment(tx, s, id, input));
  } catch (e) {
    if (isUnique(e)) err = "A department with that name already exists.";
    else if (e instanceof DepartmentContactError) err = e.message;
    else throw e;
  }
  if (err) redirect(`/departments?error=${encodeURIComponent(err)}`);
  revalidatePath("/", "layout");
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
  revalidatePath("/", "layout");
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
  revalidatePath("/", "layout");
  redirect("/departments");
}

export default async function Departments({ searchParams }: { searchParams: Promise<{ edit?: string; error?: string }> }) {
  const s = await requireSession("view");
  const { edit, error } = await searchParams;
  const editable = can(s.role, "edit_org");
  const rows = await withTenant(s, (tx) =>
    tx.department.findMany({ orderBy: { name: "asc" }, include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }, { id: "asc" }] }, _count: { select: { assets: true, ropa: true } } } }),
  );
  const cur = rows.find((r) => r.id === edit);

  return (
    <>
      <PageHead title="Departments, Sub-functions & SPOCs" sub="Map department responsibilities and assign privacy contacts to each sub-function." />
      <ErrorNote msg={error} />
      {editable && STANDARD_DEPARTMENTS.some((n) => !rows.some((r) => r.name === n)) && (
        <form action={addStandard} className="card row" style={{ justifyContent: "space-between" }}>
          <span className="muted">Quick start: add the standard departments ({STANDARD_DEPARTMENTS.length}) so apps can pre-select typical PII.</span>
          <button type="submit" className="ghost">Add standard departments</button>
        </form>
      )}
      {editable && <DepartmentForm key={cur?.id ?? "new"} action={save} id={cur?.id} initial={cur ? {
        name: cur.name, headName: cur.headName ?? "", roles: cur.roles.filter((r): r is typeof departmentRoles[number] => departmentRoles.includes(r as typeof departmentRoles[number])),
        contacts: cur.contacts.map((c) => ({ id: c.id, subFunction: c.subFunction, name: c.name, email: c.email ?? "", designation: c.designation ?? "", phone: c.phone ?? "", responsibilities: c.responsibilities ?? "", isPrimary: c.isPrimary, roles: c.roles.filter((r): r is typeof departmentRoles[number] => departmentRoles.includes(r as typeof departmentRoles[number])) })),
      } : undefined} />}
      {rows.length === 0 && <div className="card empty">No departments yet.</div>}
      {rows.map((r) => <section className="card" key={r.id} aria-label={r.name}>
        <div className="toolbar">
          <div><h2>{r.name}</h2><p className="muted">{r.contacts.length} sub-functions · {r.contacts.filter((c) => c.name && c.email).length} with name and email · {r._count.assets} assets · {r._count.ropa} RoPA activities</p></div>
          <RowActions id={r.id} editable={editable} editHref={`/departments?edit=${r.id}`} onDelete={remove} />
        </div>
        <p><strong>Head:</strong> {r.headName || "Not assigned"} · <strong>Roles:</strong> {rolesLabel(r.roles)}</p>
        {!r.contacts.length ? <p className="notice">No sub-functions or SPOCs recorded. Edit this department to add them.</p> : <div className="department-table"><table>
          <thead><tr><th>Sub-function</th><th>SPOC</th><th>Contact</th><th>Roles</th><th>Responsibilities</th></tr></thead>
          <tbody>{r.contacts.map((c) => <tr key={c.id}>
            <td>{c.subFunction}</td>
            <td>{c.name || "Not assigned"}{c.isPrimary && <div className="badge">Primary SPOC</div>}{c.designation && <div className="muted">{c.designation}</div>}</td>
            <td>{c.email || "Email not provided"}{c.phone && <div>{c.phone}</div>}</td>
            <td>{rolesLabel(c.roles)}</td><td style={{ whiteSpace: "pre-wrap" }}>{c.responsibilities || "—"}</td>
          </tr>)}</tbody>
        </table></div>}
      </section>)}
    </>
  );
}
