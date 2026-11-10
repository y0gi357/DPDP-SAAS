import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { STATUSES, STATUS_LABELS, effective, tally, type AnyStatus } from "@/lib/controls";
import { ropaLibEvidence } from "@/lib/ropa-checks";
import { CMP_ITEMS, CMP_LABELS } from "@/lib/notice";
import { assessRopa } from "@/lib/ropa-assess";
import { cmControlEvidence } from "@/lib/cm-readiness";
import { PageHead } from "@/components/ui";
import { ControlRow, type Patch, type SaveResult } from "@/components/ControlRow";

const patchSchema = z.object({
  status: z.enum(["NOT_ASSESSED", ...STATUSES]).optional(),
  owners: z.array(z.string().max(60)).max(20).optional(),
  target: z.string().max(10).optional(),
  evidence: z.string().max(4000).optional(),
});

async function saveControl(controlId: string, patch: Patch): Promise<SaveResult> {
  "use server";
  const s = await requireSession("assess");
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Invalid value" };
  const p = parsed.data;
  if (!(await prisma.control.findUnique({ where: { id: controlId }, select: { id: true } }))) return { ok: false, error: "Unknown control" };

  let targetDate: Date | null | undefined;
  if (p.target !== undefined) {
    targetDate = p.target ? new Date(p.target) : null;
    if (targetDate && Number.isNaN(targetDate.getTime())) return { ok: false, error: "Invalid date" };
  }

  await withTenant(s, async (tx) => {
    let owners = p.owners;
    if (owners) {
      // Keep only owners that exist in this organisation.
      const deptIds = owners.filter((o) => o.startsWith("dept:")).map((o) => o.slice(5));
      const memberIds = owners.filter((o) => o.startsWith("member:")).map((o) => o.slice(7));
      const [d, m] = await Promise.all([
        tx.department.findMany({ where: { id: { in: deptIds } }, select: { id: true } }),
        tx.committeeMember.findMany({ where: { id: { in: memberIds } }, select: { id: true } }),
      ]);
      const ok = new Set([...d.map((x) => `dept:${x.id}`), ...m.map((x) => `member:${x.id}`)]);
      owners = owners.filter((o) => ok.has(o));
    }
    const base = {
      ...(p.status !== undefined && { status: p.status }),
      ...(owners !== undefined && { owners }),
      ...(targetDate !== undefined && { targetDate }),
      ...(p.evidence !== undefined && { evidence: p.evidence || null }),
      updatedBy: s.userId,
    };
    const row = await tx.controlAssessment.upsert({
      where: { orgId_controlId: { orgId: s.orgId, controlId } },
      create: { orgId: s.orgId, controlId, ...base },
      update: base,
    });
    await audit(tx, {
      orgId: s.orgId, userId: s.userId, action: p.status !== undefined ? "control.assessed" : "control.updated",
      entity: "ControlAssessment", entityId: row.id, meta: { controlId, fields: Object.keys(p) },
    });
  });
  revalidatePath("/dashboard");
  return { ok: true };
}

async function bulkSet(fd: FormData) {
  "use server";
  const s = await requireSession("assess");
  const status = z.enum(STATUSES).safeParse(fd.get("status"));
  const sectionId = String(fd.get("sectionId") ?? "");
  if (!status.success) redirect("/controls");
  const controls = await prisma.control.findMany({ where: { sectionId, libraryVersion: { isActive: true } }, select: { id: true } });
  await withTenant(s, async (tx) => {
    for (const c of controls) {
      await tx.controlAssessment.upsert({
        where: { orgId_controlId: { orgId: s.orgId, controlId: c.id } },
        create: { orgId: s.orgId, controlId: c.id, status: status.data, updatedBy: s.userId },
        update: { status: status.data, updatedBy: s.userId },
      });
    }
    if (controls.length) await audit(tx, { orgId: s.orgId, userId: s.userId, action: "control.bulk_assessed", entity: "ControlAssessment", meta: { sectionId, status: status.data, count: controls.length } });
  });
  revalidatePath("/controls");
  revalidatePath("/dashboard");
  redirect(`/controls?open=${encodeURIComponent(String(fd.get("sectionKey") ?? ""))}`);
}

const FILTERS = ["ALL", ...STATUSES, "NOT_ASSESSED"] as const;
const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function Controls({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; open?: string }> }) {
  const s = await requireSession("view");
  const { q, status: statusParam, open } = await searchParams;
  const editable = can(s.role, "assess");
  const filter = (FILTERS as readonly string[]).includes(statusParam ?? "") ? (statusParam as string) : "ALL";

  const lib = await prisma.controlLibraryVersion.findFirst({
    where: { isActive: true },
    include: { sections: { orderBy: { order: "asc" }, include: { controls: { orderBy: { code: "asc" } } } } },
  });
  if (!lib) return <p>No controls library loaded. Run <code>npm run db:seed</code>.</p>;

  const [rows, org, depts, members, ropa, consent, consentEvidence] = await withTenant(s, (tx) =>
    Promise.all([
      tx.controlAssessment.findMany(),
      tx.organisation.findUniqueOrThrow({ where: { id: s.orgId } }),
      tx.department.findMany({ where: { spocName: { not: null } }, orderBy: { name: "asc" } }),
      tx.committeeMember.findMany({ orderBy: { name: "asc" } }),
      tx.ropaRecord.findMany({ include: { department: true, vendors: { include: { vendor: true } } } }),
      tx.consentConfig.findUnique({ where: { orgId: s.orgId } }),
      Promise.all([tx.consentEvent.count(), tx.consentWithdrawalTask.count({ where: { acknowledgedAt: null } })]),
    ]),
  );
  const saved = new Map(rows.map((r) => [r.controlId, r]));
  const cmp = (consent?.cmp ?? {}) as Record<string, string>;
  const cmpEvidence: Record<string, string[]> = {};
  for (const i of CMP_ITEMS) if (cmp[i.id]) for (const code of i.codes) (cmpEvidence[code] ??= []).push(`Consent setup: ${i.label}: ${(CMP_LABELS[cmp[i.id]] ?? "Not answered").toLowerCase()}`);
  for (const [code, entries] of Object.entries(cmControlEvidence(consent?.cmp))) (cmpEvidence[code] ??= []).push(...entries);
  for (const code of ["DPDP-6-001", "DPDP-6-007", "DPDP-6-010"]) (cmpEvidence[code] ??= []).push(`Consent ledger: ${consentEvidence[0]} historical decisions; ${consentEvidence[1]} withdrawal follow-up tasks pending. Review records before assessing this control.`);
  const evidence = ropaLibEvidence(ropa.map((r) => assessRopa(r, org).ev));
  const ownerOptions = [
    ...depts.map((d) => ({ value: `dept:${d.id}`, label: `${d.spocName} - ${d.name}` })),
    ...members.map((m) => ({ value: `member:${m.id}`, label: `${m.name} - Committee (${m.designation ?? "Member"})` })),
  ];

  const eff = (c: { id: string; audience: string[] }) => effective(saved.get(c.id)?.status, c.audience, org);
  const all = lib.sections.flatMap((sec) => sec.controls);
  const overall = tally(all.map((c) => eff(c).status));
  const notImpl = overall.counts.NOT_IMPLEMENTED + overall.counts.NOT_ASSESSED;

  const needle = (q ?? "").trim().toLowerCase();
  const filtersOn = !!needle || filter !== "ALL";

  return (
    <>
      <PageHead title="Controls Assessment" sub={`${all.length} controls across ${lib.sections.length} sections, mapped to the Act and Rules. Library ${lib.label}.`} />
      {lib.description?.startsWith("DRAFT") && <div className="notice">Control wording is a working draft pending legal review.</div>}

      <div className="tiles">
        <div className="tile"><div className="t">Score</div><div className="n">{overall.score}%</div><div className="bar"><i style={{ width: `${overall.score}%` }} /></div></div>
        <div className="tile"><div className="t">Implemented</div><div className="n" style={{ color: "var(--ok)" }}>{overall.counts.IMPLEMENTED}</div></div>
        <div className="tile"><div className="t">Partial</div><div className="n" style={{ color: "var(--warn)" }}>{overall.counts.PARTIAL}</div></div>
        <div className="tile"><div className="t">Planned</div><div className="n" style={{ color: "var(--accent)" }}>{overall.counts.PLANNED}</div></div>
        <div className="tile"><div className="t">Not implemented / not set</div><div className="n" style={{ color: "var(--bad)" }}>{notImpl}</div></div>
        <div className="tile"><div className="t">Not applicable</div><div className="n">{overall.counts.NOT_APPLICABLE}</div></div>
      </div>

      <form method="get" className="row" style={{ marginBottom: 12 }}>
        <input name="q" defaultValue={q ?? ""} placeholder="Search control text, ID or reference..." style={{ minWidth: 260 }} />
        <select name="status" defaultValue={filter}>
          <option value="ALL">All statuses</option>
          {STATUSES.map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
          <option value="NOT_ASSESSED">Not set</option>
        </select>
        <button type="submit" className="ghost sm">Apply</button>
        {filtersOn && <a className="btn" href="/controls">Clear</a>}
      </form>

      {lib.sections.map((sec, idx) => {
        const secTally = tally(sec.controls.map((c) => eff(c).status));
        const visible = sec.controls.filter((c) => {
          const st = eff(c).status;
          if (filter !== "ALL" && st !== filter) return false;
          if (!needle) return true;
          return `${c.code} ${c.title} ${c.actRefs.join(" ")} ${c.ruleRefs.join(" ")}`.toLowerCase().includes(needle);
        });
        if (visible.length === 0) return null;
        const isOpen = filtersOn || (open ? open === sec.key : idx === 0);
        return (
          <details className="card sec" key={sec.id} open={isOpen}>
            <summary>
              <div className="toolbar">
                <div>
                  <strong>{sec.title}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>{visible.length} of {sec.controls.length} controls · {secTally.applicable} applicable</div>
                </div>
                <div style={{ minWidth: 120, textAlign: "right" }}>
                  <strong>{secTally.score}%</strong>
                  <div className="bar"><i style={{ width: `${secTally.score}%` }} /></div>
                </div>
              </div>
            </summary>
            {editable && (
              <form action={bulkSet} className="row" style={{ margin: "10px 0 4px" }}>
                <input type="hidden" name="sectionId" value={sec.id} />
                <input type="hidden" name="sectionKey" value={sec.key} />
                <span className="muted" style={{ fontSize: 12 }}>Mark all {sec.controls.length} as:</span>
                {STATUSES.map((st) => <button key={st} type="submit" name="status" value={st} className="ghost sm">{STATUS_LABELS[st]}</button>)}
              </form>
            )}
            <div>
              {visible.map((c) => {
                const a = saved.get(c.id);
                const e = eff(c);
                return (
                  <ControlRow
                    key={c.id}
                    control={{ id: c.id, code: c.code, title: c.title, refs: c.actRefs.join(", "), rules: c.ruleRefs }}
                    saved={{ status: a?.status ?? "NOT_ASSESSED", owners: a?.owners ?? [], target: fmt(a?.targetDate ?? null), evidence: a?.evidence ?? "" }}
                    autoReason={e.reason}
                    ropa={evidence[c.code] ?? null}
                    extra={cmpEvidence[c.code]}
                    ownerOptions={ownerOptions}
                    editable={editable}
                    onSave={saveControl}
                  />
                );
              })}
            </div>
          </details>
        );
      })}
    </>
  );
}
