"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SaveResult } from "./ControlRow";

export type GapView = {
  key: string; scope: string; severity: string; title: string; detail: string; recommendation: string; href: string;
  controlId?: string; controlStatus?: string;
};
export type GapPatch = { status?: string; owners?: string[]; due?: string; notes?: string };

const STATUS_LABELS: Record<string, string> = { OPEN: "Open", IN_PROGRESS: "In progress", ADDRESSED: "Addressed", ACCEPTED: "Accepted risk" };

export function GapRow({
  gap, tracking, ownerOptions, editable, canAccept, overdue, onSave, onControl,
}: {
  gap: GapView;
  tracking: { status: string; owners: string[]; due: string; notes: string };
  ownerOptions: { value: string; label: string }[];
  editable: boolean;
  canAccept: boolean;
  overdue: boolean;
  onSave: (key: string, patch: GapPatch) => Promise<SaveResult>;
  onControl: (controlId: string, status: string) => Promise<SaveResult>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(tracking.status);
  const [owners, setOwners] = useState<string[]>(tracking.owners);
  const [due, setDue] = useState(tracking.due);
  const [notes, setNotes] = useState(tracking.notes);
  const [msg, setMsg] = useState<{ kind: "idle" | "saving" | "saved" | "error"; text?: string }>({ kind: "idle" });

  async function run(p: Promise<SaveResult>) {
    setMsg({ kind: "saving" });
    try {
      const r = await p;
      if (r.ok) { setMsg({ kind: "saved" }); router.refresh(); } else setMsg({ kind: "error", text: r.error ?? "Could not save" });
    } catch { setMsg({ kind: "error", text: "Could not save" }); }
  }

  function changeStatus(next: string) {
    if (next === "ACCEPTED" && !notes.trim()) { setMsg({ kind: "error", text: "Write the justification in Notes before accepting a risk." }); return; }
    setStatus(next);
    run(onSave(gap.key, { status: next }));
  }
  const toggleOwner = (v: string) => {
    const next = owners.includes(v) ? owners.filter((x) => x !== v) : [...owners, v];
    setOwners(next);
    run(onSave(gap.key, { owners: next }));
  };
  const labelOf = new Map(ownerOptions.map((o) => [o.value, o.label]));
  const sev = gap.severity.toLowerCase();

  return (
    <details className="card gap" data-key={gap.key}>
      <summary>
        <span className={`badge ${sev === "critical" ? "high" : sev}`}>{gap.severity}</span>{" "}
        <span className="chip static">{gap.scope}</span>{" "}
        <span>{gap.title}</span>{" "}
        <span className="badge">{STATUS_LABELS[status]}{status === "ADDRESSED" ? " (verify)" : ""}</span>
        {overdue && <> <span className="badge high">Overdue</span></>}
      </summary>
      <div style={{ marginTop: 10 }}>
        <p style={{ margin: "0 0 6px" }}>{gap.detail}</p>
        <p className="muted" style={{ margin: "0 0 10px" }}><strong>Recommended:</strong> {gap.recommendation}</p>
        <div className="row" style={{ marginBottom: 10 }}>
          <a className="btn" href={gap.href}>Open to fix</a>
          {editable && gap.controlId && (
            <>
              <span className="muted" style={{ fontSize: 12 }}>Quick update:</span>
              {(["PARTIAL", "PLANNED", "NOT_APPLICABLE"] as const).map((s) => (
                <button key={s} type="button" className="ghost sm" onClick={() => run(onControl(gap.controlId!, s))}>
                  {s === "PARTIAL" ? "Mark partial" : s === "PLANNED" ? "Mark planned" : "Mark N/A"}
                </button>
              ))}
            </>
          )}
        </div>
        <div className="fields">
          <label className="field"><span className="l">Remediation status</span>
            <select aria-label={`Status for ${gap.key}`} value={status} disabled={!editable} onChange={(e) => changeStatus(e.target.value)}>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v} disabled={v === "ACCEPTED" && !canAccept}>{l}{v === "ACCEPTED" && !canAccept ? " (admin only)" : ""}</option>)}
            </select></label>
          <label className="field"><span className="l">Due date</span>
            <input type="date" aria-label={`Due date for ${gap.key}`} value={due} disabled={!editable}
              onChange={(e) => { setDue(e.target.value); run(onSave(gap.key, { due: e.target.value })); }} /></label>
          <div className="field"><span className="l">Owners</span>
            <details className="owners">
              <summary>{owners.length ? `${owners.length} owner(s)` : "Assign owners"}</summary>
              <div className="ms-panel" style={{ position: "static", boxShadow: "none" }}>
                {ownerOptions.length === 0 && <div className="empty">Add SPOCs or committee members first.</div>}
                {ownerOptions.map((o) => (
                  <label key={o.value} className="ms-item">
                    <input type="checkbox" checked={owners.includes(o.value)} disabled={!editable} onChange={() => toggleOwner(o.value)} /> {o.label}
                  </label>
                ))}
              </div>
            </details>
            {owners.length > 0 && <div className="chips">{owners.map((v) => <span className="chip static" key={v}>{labelOf.get(v) ?? v}</span>)}</div>}
          </div>
        </div>
        <label className="field" style={{ marginTop: 10 }}><span className="l">Notes (required to accept a risk)</span>
          <textarea aria-label={`Notes for ${gap.key}`} value={notes} disabled={!editable} onChange={(e) => setNotes(e.target.value)}
            onBlur={() => { if (notes !== tracking.notes) run(onSave(gap.key, { notes })); }} /></label>
        <div className="muted" style={{ fontSize: 12, minHeight: 16 }} role="status">
          {msg.kind === "saving" && "Saving..."}{msg.kind === "saved" && "Saved"}{msg.kind === "error" && <span className="err">{msg.text}</span>}
        </div>
      </div>
    </details>
  );
}
