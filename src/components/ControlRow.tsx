"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUSES, STATUS_LABELS } from "@/lib/controls";

export type Patch = { status?: string; owners?: string[]; target?: string; evidence?: string };
export type SaveResult = { ok: boolean; error?: string };
type Opt = { value: string; label: string };

export function ControlRow({
  control, saved, autoReason, ropa, extra, ownerOptions, editable, onSave,
}: {
  control: { id: string; code: string; title: string; refs: string; rules: string[] };
  saved: { status: string; owners: string[]; target: string; evidence: string };
  autoReason: string | null;
  ropa: { met: number; applicable: number } | null;
  extra?: string[];
  ownerOptions: Opt[];
  editable: boolean;
  onSave: (controlId: string, patch: Patch) => Promise<SaveResult>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(saved.status);
  const [owners, setOwners] = useState<string[]>(saved.owners);
  const [target, setTarget] = useState(saved.target);
  const [evidence, setEvidence] = useState(saved.evidence);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState("");

  async function save(patch: Patch) {
    setState("saving");
    try {
      const r = await onSave(control.id, patch);
      if (r.ok) { setState("saved"); router.refresh(); } else { setState("error"); setErr(r.error ?? "Could not save"); }
    } catch {
      setState("error"); setErr("Could not save");
    }
  }

  const labelOf = new Map(ownerOptions.map((o) => [o.value, o.label]));
  const toggleOwner = (v: string) => {
    const next = owners.includes(v) ? owners.filter((x) => x !== v) : [...owners, v];
    setOwners(next);
    save({ owners: next });
  };

  const tone = !ropa ? "" : ropa.met === ropa.applicable ? "ok" : ropa.met === 0 ? "bad" : "mid";
  const mismatch = ropa && status === "IMPLEMENTED" && ropa.met < ropa.applicable;

  return (
    <div className="ctl-row" data-code={control.code}>
      <div>
        <div className="code">{control.code} · {control.refs}{control.rules.length > 0 && <> · Rule: {control.rules.join(", ")}</>}</div>
        <div style={{ margin: "3px 0" }}>{control.title}</div>
        {autoReason && status === "NOT_ASSESSED" && <div className="muted" style={{ fontSize: 12 }}>Treated as not applicable: {autoReason}. Pick a status to override.</div>}
        {autoReason && status !== "NOT_ASSESSED" && status !== "NOT_APPLICABLE" && <div className="muted" style={{ fontSize: 12 }}>Note: your profile suggests this may not apply ({autoReason}).</div>}
        {extra?.map((t) => <div key={t} className="muted" style={{ fontSize: 12 }}>{t}</div>)}
        {ropa && (
          <div className={`cell ${tone}`} style={{ textAlign: "left", fontSize: 12, fontWeight: 600 }}>
            RoPA evidence: met in {ropa.met} of {ropa.applicable} {ropa.applicable === 1 ? "activity" : "activities"}
            {mismatch && <span style={{ color: "var(--bad)", fontWeight: 400 }}>. Marked Implemented, but the RoPA disagrees: review.</span>}
          </div>
        )}
      </div>
      <div className="ctl-edit">
        <select aria-label={`Status for ${control.code}`} value={status} disabled={!editable}
          onChange={(e) => { setStatus(e.target.value); save({ status: e.target.value }); }}>
          <option value="NOT_ASSESSED">Not set</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <input type="date" aria-label={`Target date for ${control.code}`} value={target} disabled={!editable}
          onChange={(e) => { setTarget(e.target.value); save({ target: e.target.value }); }} />
        <details className="owners">
          <summary>{owners.length ? `${owners.length} owner(s)` : "Assign owners"}</summary>
          <div className="ms-panel" style={{ position: "static", boxShadow: "none" }}>
            {ownerOptions.length === 0 && <div className="empty">Add SPOCs on Departments or members on the Committee first.</div>}
            {ownerOptions.map((o) => (
              <label key={o.value} className="ms-item">
                <input type="checkbox" checked={owners.includes(o.value)} disabled={!editable} onChange={() => toggleOwner(o.value)} /> {o.label}
              </label>
            ))}
          </div>
        </details>
        {owners.length > 0 && (
          <div className="chips">{owners.map((v) => <span className="chip static" key={v}>{labelOf.get(v) ?? v}</span>)}</div>
        )}
        <textarea aria-label={`Evidence for ${control.code}`} placeholder="Evidence / notes" value={evidence} disabled={!editable}
          onChange={(e) => setEvidence(e.target.value)}
          onBlur={() => { if (evidence !== saved.evidence) save({ evidence }); }} />
        <div className="muted" style={{ fontSize: 12, minHeight: 16 }} role="status">
          {state === "saving" && "Saving..."}{state === "saved" && "Saved"}{state === "error" && <span className="err">{err}</span>}
        </div>
      </div>
    </div>
  );
}
