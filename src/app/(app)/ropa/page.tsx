import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { firstError, flag, idOf, opt, req } from "@/lib/form";
import {
  ASSET_TYPE_LABELS, LEGAL_BASIS_CODES, PRINCIPAL_CATEGORY_OPTIONS, PROCESSING_PURPOSES, ROPA_ROLES, ROPA_ROLE_LABELS, legalBasisLabel,
} from "@/lib/enums";
import { PII_KEYS, categoriesOf, categoryLabel } from "@/lib/pii";
import { DEFS, GROUPS, buildCtx, MANUAL_STATUSES } from "@/lib/ropa-checks";
import { assessRopa } from "@/lib/ropa-assess";
import { inferLawfulBasis, inferPrincipal, inferPurpose } from "@/lib/ropa-infer";
import { ErrorNote, PageHead, RowActions } from "@/components/ui";
import { RopaForm } from "@/components/RopaForm";

const schema = z.object({
  activity: req(160),
  purpose: req(400),
  purposeCategory: z.enum(PROCESSING_PURPOSES).optional().or(z.literal("")).transform((v) => v || null),
  departmentId: opt(60),
  principalCategory: z.enum(PRINCIPAL_CATEGORY_OPTIONS),
  role: z.enum(ROPA_ROLES),
  legalBasis: z.enum(LEGAL_BASIS_CODES),
  source: opt(200),
  storage: opt(200),
  retention: opt(120),
  crossBorderCountry: opt(80),
  otherParties: opt(400),
  notes: opt(2000),
});

const TECH_KEYS = ["tech_encryption", "tech_access", "tech_logging", "tech_backup"] as const;
const isIndia = (c: string | null | undefined) => !c || c.trim().toLowerCase() === "india";

async function save(fd: FormData) {
  "use server";
  const s = await requireSession("edit_data");
  const id = idOf(fd);
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/ropa?error=${encodeURIComponent(firstError(parsed.error))}`);
  const d = parsed.data;

  const piiFields = [...new Set(fd.getAll("piiFields").map(String))].filter((k) => PII_KEYS.has(k));
  const dataCategories = [...new Set([...fd.getAll("dataCategories").map(String), ...categoriesOf(piiFields)])];
  const assetIds = [...new Set(fd.getAll("assetIds").map(String))];
  const vendorIds = [...new Set(fd.getAll("vendorIds").map(String))];
  const otherParties = (d.otherParties ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 20);
  const crossBorder = flag(fd, "crossBorder");

  await withTenant(s, async (tx) => {
    // FK checks bypass RLS: confirm every referenced row belongs to this organisation.
    if (d.departmentId && !(await tx.department.findUnique({ where: { id: d.departmentId } }))) throw new Error("Invalid department");
    if (assetIds.length && (await tx.dataAsset.count({ where: { id: { in: assetIds } } })) !== assetIds.length) throw new Error("Invalid application");
    const vendors = vendorIds.length ? await tx.vendor.findMany({ where: { id: { in: vendorIds } }, select: { country: true } }) : [];
    if (vendors.length !== vendorIds.length) throw new Error("Invalid vendor");

    // Keep only manual checklist answers for items that apply; N/A and auto items are computed.
    const ctx = buildCtx({ role: d.role, lawfulBasis: d.legalBasis, dataCategories, piiFields, principalCategory: d.principalCategory, crossBorder }, vendors.map((v) => v.country));
    const controlEval: Record<string, string> = {};
    for (const def of DEFS) {
      if (def.na?.(ctx) || def.auto) continue;
      const v = String(fd.get(`chk_${def.id}`) ?? "");
      if ((MANUAL_STATUSES as readonly string[]).includes(v)) controlEval[def.id] = v;
    }
    const techDetails: Record<string, string> = {};
    for (const k of TECH_KEYS) { const v = String(fd.get(k) ?? "").trim().slice(0, 300); if (v) techDetails[k] = v; }

    const { otherParties: _omit, ...rest } = d;
    const data = { ...rest, piiFields, dataCategories, otherParties, crossBorder, controlEval, techDetails };
    const row = id
      ? await tx.ropaRecord.update({ where: { id }, data })
      : await tx.ropaRecord.create({ data: { ...data, orgId: s.orgId } });
    await tx.ropaAsset.deleteMany({ where: { ropaId: row.id } });
    await tx.ropaVendor.deleteMany({ where: { ropaId: row.id } });
    if (assetIds.length) await tx.ropaAsset.createMany({ data: assetIds.map((assetId) => ({ ropaId: row.id, assetId, orgId: s.orgId })) });
    if (vendorIds.length) await tx.ropaVendor.createMany({ data: vendorIds.map((vendorId) => ({ ropaId: row.id, vendorId, orgId: s.orgId })) });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: id ? "ropa.updated" : "ropa.created", entity: "RopaRecord", entityId: row.id });
  });
  revalidatePath("/ropa");
  revalidatePath("/dashboard");
  redirect("/ropa");
}

async function remove(fd: FormData) {
  "use server";
  const s = await requireSession("edit_data");
  const id = String(fd.get("id") ?? "");
  await withTenant(s, async (tx) => {
    await tx.ropaRecord.delete({ where: { id } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "ropa.deleted", entity: "RopaRecord", entityId: id });
  });
  revalidatePath("/ropa");
  revalidatePath("/dashboard");
}

async function buildFromApps() {
  "use server";
  const s = await requireSession("edit_data");
  let made = 0;
  await withTenant(s, async (tx) => {
    const org = await tx.organisation.findUniqueOrThrow({ where: { id: s.orgId } });
    const apps = (await tx.dataAsset.findMany({
      where: { ropaLinks: { none: {} } }, include: { department: true, vendor: true }, take: 200,
    })).filter((a) => a.piiFields.length > 0 || a.dataCategories.length > 0);
    for (const a of apps) {
      const dept = a.department?.name ?? null;
      const purposeCategory = inferPurpose(dept);
      const abroad = !a.hostedInIndia || !isIndia(a.vendor?.country);
      await tx.ropaRecord.create({
        data: {
          orgId: s.orgId,
          activity: `${a.name} - personal data processing`,
          purpose: `Processing of personal data held in ${a.name}${dept ? ` for ${dept}` : ""}`,
          purposeCategory,
          departmentId: a.departmentId,
          principalCategory: inferPrincipal(dept),
          role: org.actsAsFiduciary ? "DATA_FIDUCIARY" : "DATA_PROCESSOR",
          piiFields: a.piiFields,
          dataCategories: a.dataCategories,
          source: "Direct from Data Principal (review)",
          storage: [ASSET_TYPE_LABELS[a.type] ?? a.type, a.hostingLocation].filter(Boolean).join(" - "),
          legalBasis: inferLawfulBasis(dept) as (typeof LEGAL_BASIS_CODES)[number],
          crossBorder: abroad,
          crossBorderCountry: abroad ? (a.vendor?.country && !isIndia(a.vendor.country) ? a.vendor.country : a.hostingLocation) : null,
          notes: "Auto-generated from the application inventory. Review the lawful basis, purpose and retention.",
          autoGenerated: true,
          assets: { create: [{ assetId: a.id, orgId: s.orgId }] },
          vendors: a.vendorId ? { create: [{ vendorId: a.vendorId, orgId: s.orgId }] } : undefined,
        },
      });
      made++;
    }
    if (made) await audit(tx, { orgId: s.orgId, userId: s.userId, action: "ropa.generated", entity: "RopaRecord", meta: { count: made } });
  });
  revalidatePath("/ropa");
  revalidatePath("/dashboard");
  redirect(`/ropa?built=${made}`);
}

export default async function Ropa({ searchParams }: { searchParams: Promise<{ edit?: string; error?: string; q?: string; built?: string }> }) {
  const s = await requireSession("view");
  const { edit, error, q, built } = await searchParams;
  const editable = can(s.role, "edit_data");
  const [rows, depts, assets, vendors, org, candidates] = await withTenant(s, (tx) =>
    Promise.all([
      tx.ropaRecord.findMany({
        orderBy: { createdAt: "desc" },
        include: { department: true, assets: { include: { asset: true } }, vendors: { include: { vendor: true } } },
      }),
      tx.department.findMany({ orderBy: { name: "asc" } }),
      tx.dataAsset.findMany({ orderBy: { name: "asc" } }),
      tx.vendor.findMany({ orderBy: { name: "asc" } }),
      tx.organisation.findUniqueOrThrow({ where: { id: s.orgId } }),
      tx.dataAsset.findMany({ where: { ropaLinks: { none: {} } }, select: { piiFields: true, dataCategories: true } }),
    ]),
  );
  const buildable = candidates.filter((a) => a.piiFields.length > 0 || a.dataCategories.length > 0).length;
  const cur = rows.find((r) => r.id === edit);

  const needle = (q ?? "").trim().toLowerCase();
  const shown = rows.filter((r) => !needle || `${r.activity} ${r.purpose} ${r.department?.name ?? ""}`.toLowerCase().includes(needle));
  const scored = shown.map((r) => ({ r, a: assessRopa(r, org) }));
  const matrixGroups = GROUPS.filter((g) => g.id !== "extra");

  return (
    <>
      <PageHead title="RoPA / Data Mapping" sub="Record of Processing Activities with a per-activity compliance checklist. Risk bands are a screening heuristic to prioritise DPIAs." />
      {built && <div style={{ color: "var(--ok)", marginBottom: 10 }}>Generated {built} processing activit{built === "1" ? "y" : "ies"} from your applications. Review each one.</div>}
      <ErrorNote msg={error} />
      {editable && buildable > 0 && (
        <form action={buildFromApps} className="card row" style={{ justifyContent: "space-between" }}>
          <span className="muted">{buildable} application(s) with personal data have no RoPA activity yet.</span>
          <button type="submit" className="ghost">Build RoPA from apps</button>
        </form>
      )}
      {editable && (
        <RopaForm
          key={cur?.id ?? `new-${rows.length}`}
          action={save}
          defaultRole={org.actsAsFiduciary ? "DATA_FIDUCIARY" : "DATA_PROCESSOR"}
          depts={depts.map((d) => ({ id: d.id, name: d.name }))}
          assets={assets.map((a) => ({ id: a.id, name: a.name, piiFields: a.piiFields, dataCategories: a.dataCategories }))}
          vendors={vendors.map((v) => ({ id: v.id, name: v.name, country: v.country, hasContract: v.hasContract }))}
          cur={cur && {
            id: cur.id, activity: cur.activity, purpose: cur.purpose, purposeCategory: cur.purposeCategory, departmentId: cur.departmentId,
            principalCategory: cur.principalCategory, role: cur.role, piiFields: cur.piiFields, dataCategories: cur.dataCategories,
            source: cur.source, storage: cur.storage, retention: cur.retention, legalBasis: cur.legalBasis,
            otherParties: cur.otherParties.join(", "), crossBorder: cur.crossBorder, crossBorderCountry: cur.crossBorderCountry, notes: cur.notes,
            assetIds: cur.assets.map((x) => x.assetId), vendorIds: cur.vendors.map((x) => x.vendorId),
            controlEval: (cur.controlEval ?? {}) as Record<string, string>, techDetails: (cur.techDetails ?? {}) as Record<string, string>,
          }}
        />
      )}

      <form method="get" className="row" style={{ marginBottom: 10 }}>
        <input name="q" defaultValue={q ?? ""} placeholder="Filter activities..." />
        <button type="submit" className="ghost sm">Filter</button>
        {q && <a className="btn" href="/ropa">Clear</a>}
      </form>

      <div className="card" style={{ overflowX: "auto" }}>
        {scored.length === 0 ? <div className="empty">{rows.length ? "No activities match." : "No processing activities yet."}</div> : (
          <table>
            <thead><tr><th>Activity</th><th>Data</th><th>Systems &amp; parties</th><th>Basis</th><th>Checklist</th><th>Risk</th><th></th></tr></thead>
            <tbody>
              {scored.map(({ r, a }) => (
                <tr key={r.id}>
                  <td>{r.activity}{r.autoGenerated && <> <span className="badge">auto</span></>}
                    <div className="code">{r.department?.name ?? "No department"} · {r.purposeCategory ?? "-"} · {ROPA_ROLE_LABELS[r.role]} · {r.principalCategory}</div></td>
                  <td>{r.dataCategories.map((c) => <span key={c} className="chip static" style={{ marginRight: 4 }}>{categoryLabel(c)}</span>)}
                    <div className="code">{r.piiFields.length} PII field(s)</div></td>
                  <td>
                    {r.assets.map((x) => x.asset.name).join(", ")}
                    <div>{r.vendors.map((x) => (
                      <span key={x.vendorId} style={{ marginRight: 6 }}>{x.vendor.name}
                        {!isIndia(x.vendor.country) && <> <span className="badge medium">X-BORDER</span></>}
                        {!x.vendor.hasContract && <> <span className="badge high">NO DPA</span></>}</span>))}</div>
                    {r.otherParties.length > 0 && <div className="code">Also: {r.otherParties.join(", ")}</div>}
                  </td>
                  <td>{legalBasisLabel(r.legalBasis)}{r.retention && <div className="code">Retention: {r.retention}</div>}
                    {a.ctx.crossBorder && <div className="code">Cross-border{r.crossBorderCountry ? `: ${r.crossBorderCountry}` : ""}</div>}</td>
                  <td>{a.ev.pct}%<div className="bar" style={{ width: 90 }}><i style={{ width: `${a.ev.pct}%` }} /></div>
                    <div className="code">{a.ev.met} met · {a.ev.partial} partial · {a.ev.notMet} not met</div></td>
                  <td title={a.risk.factors.map((f) => `${f.label} (+${f.weight}, ${f.ref})`).join("\n")}>
                    <span className={`badge ${a.risk.level.toLowerCase()}`}>{a.risk.level} ({a.risk.score})</span></td>
                  <td><RowActions id={r.id} editable={editable} editHref={`/ropa?edit=${r.id}`} onDelete={remove} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {scored.length > 0 && (
        <div className="card" style={{ overflowX: "auto" }}>
          <h2>Checklist coverage</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Items met out of applicable items, per activity and area. Grey means nothing applies.</p>
          <table>
            <thead><tr><th>Activity</th>{matrixGroups.map((g) => <th key={g.id} className="cell">{g.label.replace(" (Rule 6)", "")}</th>)}</tr></thead>
            <tbody>
              {scored.map(({ r, a }) => (
                <tr key={r.id}>
                  <td>{r.activity}</td>
                  {matrixGroups.map((g) => {
                    const items = a.ev.items.filter((x) => x.def.group === g.id && x.status !== "N/A");
                    const met = items.filter((x) => x.status === "Met").length;
                    const cls = items.length === 0 ? "na" : met === items.length ? "ok" : met === 0 ? "bad" : "mid";
                    return <td key={g.id} className={`cell ${cls}`}>{items.length ? `${met}/${items.length}` : "-"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
