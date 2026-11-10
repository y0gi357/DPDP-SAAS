import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { loadGaps } from "@/lib/gaps-load";
import { SEV_WEIGHT, isClosed, type GapStatusKey, type Severity } from "@/lib/gaps";
import { PageHead } from "@/components/ui";
import { GapRow, type GapPatch } from "@/components/GapRow";
import type { SaveResult } from "@/components/ControlRow";

const STATUSES = ["OPEN", "IN_PROGRESS", "ADDRESSED", "ACCEPTED"] as const;
const patchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  owners: z.array(z.string().max(60)).max(20).optional(),
  due: z.string().max(10).optional(),
  notes: z.string().max(2000).optional(),
});

async function saveGap(key: string, patch: GapPatch): Promise<SaveResult> {
  "use server";
  const s = await requireSession("assess");
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success || !/^[A-Za-z0-9_:.-]{1,140}$/.test(key)) return { ok: false, error: "Invalid value" };
  const p = parsed.data;

  const { gaps } = await loadGaps(s);
  if (!gaps.some((g) => g.key === key)) return { ok: false, error: "This gap is no longer detected" };

  let dueDate: Date | null | undefined;
  if (p.due !== undefined) {
    dueDate = p.due ? new Date(p.due) : null;
    if (dueDate && Number.isNaN(dueDate.getTime())) return { ok: false, error: "Invalid date" };
  }
  if (p.status === "ACCEPTED" && !can(s.role, "edit_org")) return { ok: false, error: "Only an admin can accept a risk." };

  let error: string | null = null;
  await withTenant(s, async (tx) => {
    const existing = await tx.gapTracking.findUnique({ where: { orgId_gapKey: { orgId: s.orgId, gapKey: key } } });
    if (p.status === "ACCEPTED" && !(p.notes ?? existing?.notes ?? "").trim()) { error = "Write the justification in Notes before accepting a risk."; return; }

    let owners = p.owners;
    if (owners) {
      const d = await tx.department.findMany({ where: { id: { in: owners.filter((o) => o.startsWith("dept:")).map((o) => o.slice(5)) } }, select: { id: true } });
      const m = await tx.committeeMember.findMany({ where: { id: { in: owners.filter((o) => o.startsWith("member:")).map((o) => o.slice(7)) } }, select: { id: true } });
      const ok = new Set([...d.map((x) => `dept:${x.id}`), ...m.map((x) => `member:${x.id}`)]);
      owners = owners.filter((o) => ok.has(o));
    }
    const base = {
      ...(p.status !== undefined && { status: p.status }),
      ...(owners !== undefined && { owners }),
      ...(dueDate !== undefined && { dueDate }),
      ...(p.notes !== undefined && { notes: p.notes || null }),
      updatedBy: s.userId,
    };
    const row = await tx.gapTracking.upsert({
      where: { orgId_gapKey: { orgId: s.orgId, gapKey: key } },
      create: { orgId: s.orgId, gapKey: key, ...base },
      update: base,
    });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "gap.updated", entity: "GapTracking", entityId: row.id, meta: { gapKey: key, fields: Object.keys(p) } });
  });
  if (error) return { ok: false, error };
  revalidatePath("/dashboard");
  return { ok: true };
}

async function setControlStatus(controlId: string, status: string): Promise<SaveResult> {
  "use server";
  const s = await requireSession("assess");
  const st = z.enum(["PARTIAL", "PLANNED", "NOT_APPLICABLE"]).safeParse(status);
  if (!st.success) return { ok: false, error: "Invalid status" };
  if (!(await prisma.control.findUnique({ where: { id: controlId }, select: { id: true } }))) return { ok: false, error: "Unknown control" };
  await withTenant(s, async (tx) => {
    const row = await tx.controlAssessment.upsert({
      where: { orgId_controlId: { orgId: s.orgId, controlId } },
      create: { orgId: s.orgId, controlId, status: st.data, updatedBy: s.userId },
      update: { status: st.data, updatedBy: s.userId },
    });
    await audit(tx, { orgId: s.orgId, userId: s.userId, action: "control.assessed", entity: "ControlAssessment", entityId: row.id, meta: { controlId, status: st.data, via: "gaps" } });
  });
  revalidatePath("/dashboard");
  revalidatePath("/controls");
  return { ok: true };
}

const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
const fmt = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export default async function Gaps({ searchParams }: { searchParams: Promise<{ severity?: string; scope?: string; status?: string; q?: string; n?: string }> }) {
  const s = await requireSession("view");
  const sp = await searchParams;
  const editable = can(s.role, "assess");
  const { gaps, trackingByKey, ownerOptions } = await loadGaps(s);

  const stateOf = (key: string): GapStatusKey => (trackingByKey.get(key)?.status ?? "OPEN") as GapStatusKey;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = (key: string) => { const t = trackingByKey.get(key); return !!t?.dueDate && t.dueDate < today && !isClosed(stateOf(key)); };

  const active = gaps.filter((g) => !isClosed(stateOf(g.key)));
  const countSev = (sev: Severity) => active.filter((g) => g.severity === sev).length;
  const scopes = [...new Set(gaps.map((g) => g.scope))].sort();

  const sev = (SEVERITIES as readonly string[]).includes(sp.severity ?? "") ? sp.severity! : "ALL";
  const scope = scopes.includes(sp.scope ?? "") ? sp.scope! : "ALL";
  const status = ["ACTIVE", "ALL", ...STATUSES].includes(sp.status ?? "") ? sp.status! : "ACTIVE";
  const needle = (sp.q ?? "").trim().toLowerCase();
  const limit = Math.min(Math.max(parseInt(sp.n ?? "60", 10) || 60, 20), 1000);

  const filtered = gaps.filter((g) => {
    const st = stateOf(g.key);
    if (status === "ACTIVE" ? isClosed(st) : status !== "ALL" && st !== status) return false;
    if (sev !== "ALL" && g.severity !== sev) return false;
    if (scope !== "ALL" && g.scope !== scope) return false;
    return !needle || `${g.title} ${g.detail}`.toLowerCase().includes(needle);
  });
  const shown = filtered.slice(0, limit);
  const qs = (extra: Record<string, string>) => new URLSearchParams({ severity: sev, scope, status, q: sp.q ?? "", ...extra }).toString();

  return (
    <>
      <PageHead title="Gap Analysis & Remediation" sub="Gaps are detected from your controls, RoPA, vendors, applications and governance records, then tracked here through to closure." />
      <div className="tiles">
        {SEVERITIES.map((v) => (
          <div className="tile" key={v}><div className="t">{v}</div>
            <div className="n" style={{ color: v === "Critical" || v === "High" ? "var(--bad)" : v === "Medium" ? "var(--warn)" : "var(--ok)" }}>{countSev(v)}</div></div>
        ))}
        <div className="tile"><div className="t">Overdue</div><div className="n" style={{ color: "var(--bad)" }}>{gaps.filter((g) => overdue(g.key)).length}</div></div>
        <div className="tile"><div className="t">Addressed</div><div className="n">{gaps.filter((g) => stateOf(g.key) === "ADDRESSED").length}</div></div>
        <div className="tile"><div className="t">Accepted risk</div><div className="n">{gaps.filter((g) => stateOf(g.key) === "ACCEPTED").length}</div></div>
      </div>

      <form method="get" className="row" style={{ marginBottom: 12 }}>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search gaps..." />
        <select name="severity" defaultValue={sev}><option value="ALL">All severities</option>{SEVERITIES.map((v) => <option key={v}>{v}</option>)}</select>
        <select name="scope" defaultValue={scope}><option value="ALL">All scopes</option>{scopes.map((v) => <option key={v}>{v}</option>)}</select>
        <select name="status" defaultValue={status}>
          <option value="ACTIVE">Active (open + in progress)</option><option value="ALL">All</option>
          <option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option>
          <option value="ADDRESSED">Addressed</option><option value="ACCEPTED">Accepted risk</option>
        </select>
        <button type="submit" className="ghost sm">Apply</button>
        <a className="btn" href="/gaps">Clear</a>
        <a className="btn" href="/gaps/export">Download remediation plan (CSV)</a>
      </form>

      <p className="muted" style={{ fontSize: 13 }}>{filtered.length} gap(s) match. Unassessed controls count as gaps until you set a status.</p>
      {shown.length === 0 && <div className="card empty">{gaps.length === 0 ? "No gaps detected." : "No gaps match these filters."}</div>}
      {shown.map((g) => {
        const t = trackingByKey.get(g.key);
        return (
          <GapRow
            key={g.key}
            gap={g}
            tracking={{ status: t?.status ?? "OPEN", owners: t?.owners ?? [], due: fmt(t?.dueDate), notes: t?.notes ?? "" }}
            ownerOptions={ownerOptions}
            editable={editable}
            canAccept={can(s.role, "edit_org")}
            overdue={overdue(g.key)}
            onSave={saveGap}
            onControl={setControlStatus}
          />
        );
      })}
      {filtered.length > shown.length && <a className="btn" href={`/gaps?${qs({ n: String(limit + 60) })}`}>Show 60 more ({filtered.length - shown.length} remaining)</a>}
    </>
  );
}
