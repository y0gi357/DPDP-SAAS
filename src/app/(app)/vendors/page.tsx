import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { firstError, flag, idOf, isUnique, opt, optDate, req } from "@/lib/form";
import { CERTIFICATIONS, DSR_CHANNELS, DSR_SLAS, RISK_TIERS, SECURITY_CONTROLS, VENDOR_ROLE_LABELS, VENDOR_TYPES, label } from "@/lib/enums";
import { DATA_CATEGORY_KEYS, categoryLabel } from "@/lib/pii";
import { ErrorNote, PageHead, RowActions, fmtDate } from "@/components/ui";
import { VendorForm, type SubRow } from "@/components/VendorForm";

const schema = z.object({
  name: req(120),
  type: z.enum(VENDOR_TYPES),
  role: z.enum(["PROCESSOR", "SUB_PROCESSOR", "JOINT_FIDUCIARY", "INDEPENDENT_CONTROLLER", "OTHER"]),
  country: opt(80),
  service: opt(1000),
  riskTier: z.enum(RISK_TIERS),
  lastReview: optDate,
  contactName: opt(120),
  contactEmail: z.string().trim().email().max(200).optional().or(z.literal("")).transform((v) => v || null),
  dpa: z.enum(["yes", "no"]),
  contractExpiry: optDate,
  dsrContact: opt(200),
  dsrChannel: z.enum(DSR_CHANNELS),
  dsrSla: z.enum(DSR_SLAS),
});

const pick = (fd: FormData, key: string, allowed: readonly string[]) =>
  [...new Set(fd.getAll(key).map(String))].filter((v) => allowed.includes(v));

async function save(fd: FormData) {
  "use server";
  const s = await requireSession("edit_data");
  const id = idOf(fd);
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/vendors?error=${encodeURIComponent(firstError(parsed.error))}`);
  const { dpa, ...d } = parsed.data;

  // Sub-processor rows arrive as parallel arrays.
  const names = fd.getAll("spName").map(String), purposes = fd.getAll("spPurpose").map(String);
  const countries = fd.getAll("spCountry").map(String), dpas = fd.getAll("spDpa").map(String);
  const subs = names
    .map((n, i) => ({ name: n.trim().slice(0, 120), purpose: purposes[i]?.trim().slice(0, 200) || null, country: countries[i]?.trim().slice(0, 80) || null, dpaSigned: dpas[i] === "yes" }))
    .filter((r) => r.name)
    .slice(0, 50);

  const data = {
    ...d,
    hasContract: dpa === "yes",
    breachClause: flag(fd, "breachClause"),
    dataCategories: pick(fd, "dataCategories", DATA_CATEGORY_KEYS),
    certifications: pick(fd, "certifications", CERTIFICATIONS),
    securityControls: pick(fd, "securityControls", SECURITY_CONTROLS),
  };

  let err: string | null = null;
  try {
    await withTenant(s, async (tx) => {
      const row = id
        ? await tx.vendor.update({ where: { id }, data })
        : await tx.vendor.create({ data: { ...data, orgId: s.orgId } });
      await tx.subProcessor.deleteMany({ where: { vendorId: row.id } });
      if (subs.length) await tx.subProcessor.createMany({ data: subs.map((r) => ({ ...r, orgId: s.orgId, vendorId: row.id })) });
      await audit(tx, { orgId: s.orgId, userId: s.userId, action: id ? "vendor.updated" : "vendor.created", entity: "Vendor", entityId: row.id });
    });
  } catch (e) {
    if (isUnique(e)) err = "A vendor with that name already exists."; else throw e;
  }
  if (err) redirect(`/vendors?error=${encodeURIComponent(err)}`);
  revalidatePath("/vendors");
  redirect("/vendors");
}

async function remove(fd: FormData) {
  "use server";
  const s = await requireSession("edit_data");
  const id = String(fd.get("id") ?? "");
  await withTenant(s, async (tx) => {
    await tx.vendor.delete({ where: { id } });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "vendor.deleted", entity: "Vendor", entityId: id });
  });
  revalidatePath("/vendors");
}

const YEAR = 365 * 24 * 3600 * 1000;

export default async function Vendors({ searchParams }: { searchParams: Promise<{ edit?: string; error?: string }> }) {
  const s = await requireSession("view");
  const { edit, error } = await searchParams;
  const editable = can(s.role, "edit_data");
  const rows = await withTenant(s, (tx) =>
    tx.vendor.findMany({
      orderBy: { name: "asc" },
      include: { subProcessors: true, _count: { select: { ropaLinks: true, assets: true } } },
    }),
  );
  const cur = rows.find((r) => r.id === edit);
  const now = Date.now();

  const noDpa = rows.filter((r) => !r.hasContract).length;
  const subGaps = rows.filter((r) => r.subProcessors.some((p) => !p.dpaSigned)).length;
  const noDsr = rows.filter((r) => !r.dsrContact).length;

  return (
    <>
      <PageHead title="Vendors & TPRM" sub="Data Processors and other recipients of personal data. A Data Processor may only be engaged under a valid contract (Sec 8(2))." />
      {(noDpa > 0 || subGaps > 0 || noDsr > 0) && (
        <div className="notice">
          {[noDpa && `${noDpa} vendor(s) without a DPA`, subGaps && `${subGaps} with sub-processors lacking a DPA`, noDsr && `${noDsr} without a DSR contact`].filter(Boolean).join(" · ")}
        </div>
      )}
      <ErrorNote msg={error} />
      {editable && (
        <VendorForm
          key={cur?.id ?? `new-${rows.length}`}
          action={save}
          cur={cur && {
            id: cur.id, name: cur.name, type: cur.type, role: cur.role, country: cur.country, service: cur.service,
            riskTier: cur.riskTier, lastReview: fmtDate(cur.lastReview), contactName: cur.contactName, contactEmail: cur.contactEmail,
            dataCategories: cur.dataCategories, hasContract: cur.hasContract, contractExpiry: fmtDate(cur.contractExpiry),
            breachClause: cur.breachClause, certifications: cur.certifications, securityControls: cur.securityControls,
            dsrContact: cur.dsrContact, dsrChannel: cur.dsrChannel, dsrSla: cur.dsrSla,
            subs: cur.subProcessors.map((p): SubRow => ({ name: p.name, purpose: p.purpose ?? "", country: p.country ?? "", dpa: p.dpaSigned ? "yes" : "no" })),
          }}
        />
      )}
      <div className="card" style={{ overflowX: "auto" }}>
        {rows.length === 0 ? <div className="empty">No vendors yet.</div> : (
          <table>
            <thead><tr><th>Vendor</th><th>Role</th><th>Contract</th><th>Sub-processors</th><th>Certifications</th><th>DSR</th><th>Risk</th><th>Used in</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const gap = r.subProcessors.filter((p) => !p.dpaSigned).length;
                const overdue = !r.lastReview || now - r.lastReview.getTime() > YEAR;
                return (
                  <tr key={r.id}>
                    <td>{r.name}<div className="code">{r.type} · {r.country ?? "-"}</div>
                      <div className="code">Reviewed: {r.lastReview ? fmtDate(r.lastReview) : "never"}{overdue && <> <span className="badge medium">Review overdue</span></>}</div></td>
                    <td>{VENDOR_ROLE_LABELS[r.role] ?? r.role}</td>
                    <td>{r.hasContract ? <>DPA signed{r.contractExpiry && <div className="code">until {fmtDate(r.contractExpiry)}</div>}</> : <span className="badge high">DPA missing</span>}
                      {r.breachClause && <div className="code">24h breach clause</div>}</td>
                    <td>{r.subProcessors.length}{gap > 0 && <> <span className="badge medium">DPA gap ({gap})</span></>}</td>
                    <td>{r.certifications.filter((c) => c !== "None").join(", ") || "-"}</td>
                    <td>{r.dsrContact ? <>{r.dsrChannel}<div className="code">{r.dsrSla}</div></> : <span className="badge medium">No DSR contact</span>}</td>
                    <td><span className={`badge ${r.riskTier.toLowerCase()}`}>{label(r.riskTier)}</span></td>
                    <td>{r._count.assets} app(s), {r._count.ropaLinks} RoPA<div className="code">{r.dataCategories.map(categoryLabel).join(", ")}</div></td>
                    <td><RowActions id={r.id} editable={editable} editHref={`/vendors?edit=${r.id}`} onDelete={remove} /></td>
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
