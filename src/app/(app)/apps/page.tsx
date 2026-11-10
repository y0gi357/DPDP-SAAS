import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { firstError, flag, idOf, isUnique, opt, req } from "@/lib/form";
import {
  ASSET_TYPE_LABELS, ASSET_TYPE_OPTIONS, SOURCING, VENDOR_ACCESS, VENDOR_ACCESS_LABELS,
} from "@/lib/enums";
import { DATA_CATEGORY_KEYS, PII_KEYS, categoriesOf, categoryLabel } from "@/lib/pii";
import { ErrorNote, PageHead, RowActions } from "@/components/ui";
import { AssetForm } from "@/components/AssetForm";

const schema = z.object({
  name: req(120),
  type: z.enum(ASSET_TYPE_OPTIONS),
  departmentId: opt(60),
  ownerName: opt(120),
  hostingLocation: opt(120),
  sourcing: z.enum(SOURCING),
  vendorName: opt(120),
  vendorAccess: z.enum(VENDOR_ACCESS).optional().or(z.literal("")).transform((v) => v || null),
});

async function save(fd: FormData) {
  "use server";
  const s = await requireSession("edit_data");
  const id = idOf(fd);
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/apps?error=${encodeURIComponent(firstError(parsed.error))}`);
  const d = parsed.data;
  const outsourced = d.sourcing === "OUTSOURCED";
  if (outsourced && (!d.vendorName || !d.vendorAccess)) {
    redirect(`/apps?error=${encodeURIComponent("Outsourced applications need a vendor name and a vendor data-access level.")}`);
  }

  const piiFields = [...new Set(fd.getAll("piiFields").map(String))].filter((k) => PII_KEYS.has(k));
  const picked = fd.getAll("dataCategories").map(String).filter((k) => DATA_CATEGORY_KEYS.includes(k));
  // A collected PII field always implies its category.
  const dataCategories = [...new Set([...picked, ...categoriesOf(piiFields)])];

  let err: string | null = null;
  try {
    await withTenant(s, async (tx) => {
      // FK checks bypass RLS, so confirm the referenced row belongs to this org.
      if (d.departmentId && !(await tx.department.findUnique({ where: { id: d.departmentId } }))) throw new Error("Invalid department");

      let vendorId: string | null = null;
      if (outsourced) {
        const existing = await tx.vendor.findFirst({ where: { name: { equals: d.vendorName!, mode: "insensitive" } } });
        if (existing) {
          vendorId = existing.id;
        } else {
          const v = await tx.vendor.create({ data: { orgId: s.orgId, name: d.vendorName! } });
          vendorId = v.id;
          await audit(tx, { orgId: s.orgId, userId: s.userId, action: "vendor.created", entity: "Vendor", entityId: v.id, meta: { via: "asset" } });
        }
      }

      const data = {
        name: d.name,
        type: d.type,
        departmentId: d.departmentId,
        ownerName: d.ownerName,
        hostingLocation: d.hostingLocation,
        hostedInIndia: flag(fd, "hostedInIndia"),
        sourcing: d.sourcing,
        vendorId,
        vendorAccess: outsourced ? d.vendorAccess : null,
        dataCategories,
        piiFields,
        storesPersonalData: piiFields.length > 0 || dataCategories.length > 0,
      };
      const row = id
        ? await tx.dataAsset.update({ where: { id }, data })
        : await tx.dataAsset.create({ data: { ...data, orgId: s.orgId } });
      await audit(tx, { orgId: s.orgId, userId: s.userId, action: id ? "asset.updated" : "asset.created", entity: "DataAsset", entityId: row.id });
    });
  } catch (e) {
    if (isUnique(e)) err = "An application with that name already exists."; else throw e;
  }
  if (err) redirect(`/apps?error=${encodeURIComponent(err)}`);
  revalidatePath("/apps");
  revalidatePath("/vendors");
  redirect("/apps");
}

async function remove(fd: FormData) {
  "use server";
  const s = await requireSession("edit_data");
  const id = String(fd.get("id") ?? "");
  await withTenant(s, async (tx) => {
    await tx.dataAsset.delete({ where: { id } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "asset.deleted", entity: "DataAsset", entityId: id });
  });
  revalidatePath("/apps");
}

export default async function Apps({ searchParams }: { searchParams: Promise<{ edit?: string; error?: string }> }) {
  const s = await requireSession("view");
  const { edit, error } = await searchParams;
  const editable = can(s.role, "edit_data");
  const [rows, depts, vendors] = await withTenant(s, (tx) =>
    Promise.all([
      tx.dataAsset.findMany({ orderBy: { name: "asc" }, include: { department: true, vendor: true } }),
      tx.department.findMany({ orderBy: { name: "asc" } }),
      tx.vendor.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    ]),
  );
  const cur = rows.find((r) => r.id === edit);

  const typeOptions: { value: string; label: string }[] = ASSET_TYPE_OPTIONS.map((v) => ({ value: v, label: ASSET_TYPE_LABELS[v] }));
  if (cur && !(ASSET_TYPE_OPTIONS as readonly string[]).includes(cur.type)) {
    typeOptions.unshift({ value: cur.type, label: ASSET_TYPE_LABELS[cur.type] ?? cur.type });
  }

  return (
    <>
      <PageHead title="Apps & Data Sources" sub="Systems, databases and files where personal data lives, with what they collect and who runs them." />
      <ErrorNote msg={error} />
      {editable && (
        <AssetForm
          key={cur?.id ?? `new-${rows.length}`}
          action={save}
          depts={depts.map((d) => ({ id: d.id, name: d.name }))}
          vendorNames={vendors.map((v) => v.name)}
          typeOptions={typeOptions}
          cur={cur && {
            id: cur.id, name: cur.name, type: cur.type, departmentId: cur.departmentId, ownerName: cur.ownerName,
            hostingLocation: cur.hostingLocation, hostedInIndia: cur.hostedInIndia, sourcing: cur.sourcing,
            vendorName: cur.vendor?.name ?? null, vendorAccess: cur.vendorAccess,
            dataCategories: cur.dataCategories, piiFields: cur.piiFields,
          }}
        />
      )}
      <div className="card" style={{ overflowX: "auto" }}>
        {rows.length === 0 ? <div className="empty">No applications yet.</div> : (
          <table>
            <thead><tr><th>Application</th><th>Type</th><th>Department</th><th>Sourcing</th><th>Hosting</th><th>Data categories</th><th>PII</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}{r.ownerName && <div className="code">{r.ownerName}</div>}</td>
                  <td>{ASSET_TYPE_LABELS[r.type] ?? r.type}</td>
                  <td>{r.department?.name}</td>
                  <td>
                    {r.sourcing === "IN_HOUSE" ? "In-house" : (
                      <>{r.vendor?.name ?? "Outsourced"}{r.vendorAccess && <div className="code">{VENDOR_ACCESS_LABELS[r.vendorAccess]}</div>}</>
                    )}
                  </td>
                  <td>{r.hostingLocation}{!r.hostedInIndia && <> <span className="badge medium">Outside India</span></>}</td>
                  <td>{r.dataCategories.map((c) => <span key={c} className="chip static" style={{ marginRight: 4 }}>{categoryLabel(c)}</span>)}</td>
                  <td>{r.piiFields.length}</td>
                  <td><RowActions id={r.id} editable={editable} editHref={`/apps?edit=${r.id}`} onDelete={remove} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
