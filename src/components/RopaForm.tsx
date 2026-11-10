"use client";
import { useState } from "react";
import { MultiSelect } from "./MultiSelect";
import { DATA_CATEGORIES, PII_FIELDS, categoriesOf, templateFor } from "@/lib/pii";
import {
  LEGAL_BASIS_OPTIONS, PRINCIPAL_CATEGORY_OPTIONS, PROCESSING_PURPOSES, ROPA_ROLES, ROPA_ROLE_LABELS,
} from "@/lib/enums";
import { GROUPS, MANUAL_STATUSES, buildCtx, evaluate } from "@/lib/ropa-checks";

export type RopaFormValue = {
  id: string; activity: string; purpose: string; purposeCategory: string | null; departmentId: string | null;
  principalCategory: string; role: string; piiFields: string[]; dataCategories: string[]; source: string | null;
  storage: string | null; retention: string | null; legalBasis: string; otherParties: string; crossBorder: boolean;
  crossBorderCountry: string | null; notes: string | null; assetIds: string[]; vendorIds: string[];
  controlEval: Record<string, string>; techDetails: Record<string, string>;
};
type AssetOpt = { id: string; name: string; piiFields: string[]; dataCategories: string[] };
type VendorOpt = { id: string; name: string; country: string | null; hasContract: boolean };

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
const toggle = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

export function RopaForm({
  action, depts, assets, vendors, defaultRole, cur,
}: {
  action: (fd: FormData) => Promise<void>;
  depts: { id: string; name: string }[];
  assets: AssetOpt[];
  vendors: VendorOpt[];
  defaultRole: string;
  cur?: RopaFormValue;
}) {
  const [deptId, setDeptId] = useState(cur?.departmentId ?? "");
  const [principal, setPrincipal] = useState(cur?.principalCategory ?? "Customer");
  const [role, setRole] = useState(cur?.role ?? defaultRole);
  const [basis, setBasis] = useState(cur?.legalBasis ?? "CONSENT");
  const [fields, setFields] = useState<string[]>(cur?.piiFields ?? []);
  const [cats, setCats] = useState<string[]>(cur?.dataCategories ?? []);
  const [assetIds, setAssetIds] = useState<string[]>(cur?.assetIds ?? []);
  const [vendorIds, setVendorIds] = useState<string[]>(cur?.vendorIds ?? []);
  const [crossBorder, setCrossBorder] = useState(cur?.crossBorder ?? false);
  const [retention, setRetention] = useState(cur?.retention ?? "");
  const [saved, setSaved] = useState<Record<string, string>>(cur?.controlEval ?? {});
  const [note, setNote] = useState("");

  const chosenVendors = vendors.filter((v) => vendorIds.includes(v.id));
  const ctx = buildCtx(
    { role, lawfulBasis: basis, dataCategories: cats, piiFields: fields, principalCategory: principal, crossBorder },
    chosenVendors.map((v) => v.country),
  );
  const ev = evaluate({ ctx, lawfulBasis: basis, retention, saved });

  function onFields(next: string[]) { setFields(next); setCats((c) => union(c, categoriesOf(next))); }
  function onDept(id: string) {
    setDeptId(id);
    const d = depts.find((x) => x.id === id);
    const t = d ? templateFor(d.name) : null;
    if (d && t) { onFields(t); setNote(`Pre-selected ${t.length} typical fields for ${d.name}. Deselect anything this activity does not use.`); }
    else setNote("");
  }
  function onAsset(a: AssetOpt) {
    const adding = !assetIds.includes(a.id);
    setAssetIds((x) => toggle(x, a.id));
    if (adding) { onFields(union(fields, a.piiFields)); setCats((c) => union(c, a.dataCategories)); }
  }

  return (
    <form action={action} className="card">
      <h2>{cur ? "Edit processing activity" : "Add processing activity"}</h2>
      {cur && <input type="hidden" name="id" value={cur.id} />}
      {fields.map((f) => <input key={f} type="hidden" name="piiFields" value={f} />)}
      {cats.map((c) => <input key={c} type="hidden" name="dataCategories" value={c} />)}

      <h3 className="sect">Processing activity</h3>
      <div className="fields">
        <label className="field"><span className="l">Activity name *</span>
          <input name="activity" defaultValue={cur?.activity} placeholder="e.g. Payroll processing" required /></label>
        <label className="field"><span className="l">Department</span>
          <select name="departmentId" value={deptId} onChange={(e) => onDept(e.target.value)}>
            <option value="">Select department...</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></label>
        <label className="field"><span className="l">Purpose category</span>
          <select name="purposeCategory" defaultValue={cur?.purposeCategory ?? ""}>
            <option value="">Select...</option>
            {PROCESSING_PURPOSES.map((p) => <option key={p}>{p}</option>)}
          </select></label>
        <label className="field"><span className="l">Our role for this activity</span>
          <select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROPA_ROLES.map((r) => <option key={r} value={r}>{ROPA_ROLE_LABELS[r]}</option>)}
          </select></label>
        <label className="field"><span className="l">Data Principal category</span>
          <select name="principalCategory" value={principal} onChange={(e) => setPrincipal(e.target.value)}>
            {PRINCIPAL_CATEGORY_OPTIONS.map((p) => <option key={p}>{p}</option>)}
          </select></label>
        <label className="field span2"><span className="l">Purpose description *</span>
          <input name="purpose" defaultValue={cur?.purpose} required /></label>
      </div>

      <h3 className="sect">Data</h3>
      <div className="field">
        <span className="l">PII fields processed ({fields.length} selected)</span>
        <MultiSelect placeholder="Select PII fields..." selected={fields} onChange={onFields}
          options={PII_FIELDS.map((f) => ({ value: f.key, label: f.label, group: DATA_CATEGORIES.find((c) => c.key === f.category)?.label }))} />
        <span className="muted" style={{ fontSize: 12 }}>{note || "Fields come from the department, and from any linked apps below."}</span>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <span className="l">Data categories</span>
        <MultiSelect placeholder="Select categories..." selected={cats} onChange={setCats}
          options={DATA_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} />
      </div>
      <div className="fields" style={{ marginTop: 12 }}>
        <label className="field"><span className="l">Source of data</span>
          <input name="source" defaultValue={cur?.source ?? ""} placeholder="e.g. Direct from Data Principal" /></label>
        <label className="field"><span className="l">Storage</span>
          <input name="storage" defaultValue={cur?.storage ?? ""} placeholder="e.g. HRMS, AWS Mumbai" /></label>
        <label className="field"><span className="l">Retention period</span>
          <input name="retention" value={retention} onChange={(e) => setRetention(e.target.value)} placeholder="e.g. 3 years after exit" /></label>
      </div>

      <h3 className="sect">Systems &amp; parties</h3>
      <div className="field"><span className="l">Applications used (from Apps &amp; Data Sources)</span>
        {assets.length === 0 ? <span className="muted">No apps yet.</span> : (
          <div className="checks">
            {assets.map((a) => (
              <label key={a.id}><input type="checkbox" name="assetIds" value={a.id} checked={assetIds.includes(a.id)} onChange={() => onAsset(a)} /> {a.name}</label>
            ))}
          </div>)}
      </div>
      <div className="field" style={{ marginTop: 12 }}><span className="l">Vendors / processors involved</span>
        {vendors.length === 0 ? <span className="muted">No vendors yet.</span> : (
          <div className="checks">
            {vendors.map((v) => (
              <label key={v.id}>
                <input type="checkbox" name="vendorIds" value={v.id} checked={vendorIds.includes(v.id)} onChange={() => setVendorIds((x) => toggle(x, v.id))} /> {v.name}
                {v.country && v.country.trim().toLowerCase() !== "india" && <span className="badge medium">X-BORDER</span>}
                {!v.hasContract && <span className="badge high">NO DPA</span>}
              </label>
            ))}
          </div>)}
      </div>
      <label className="field" style={{ marginTop: 12 }}><span className="l">Other parties data is shared with (comma separated)</span>
        <input name="otherParties" defaultValue={cur?.otherParties ?? ""} placeholder="e.g. Tax authority, Auditors" /></label>

      <h3 className="sect">Legal basis &amp; transfers</h3>
      <div className="fields">
        <label className="field"><span className="l">Lawful basis</span>
          <select name="legalBasis" value={basis} onChange={(e) => setBasis(e.target.value)}>
            {LEGAL_BASIS_OPTIONS.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
          </select></label>
        <div className="field"><span className="l">Cross-border</span>
          <label className="check"><input type="checkbox" name="crossBorder" checked={crossBorder} onChange={(e) => setCrossBorder(e.target.checked)} /> Data is transferred outside India</label></div>
        <label className="field"><span className="l">Destination country</span>
          <input name="crossBorderCountry" defaultValue={cur?.crossBorderCountry ?? ""} placeholder="e.g. United States" /></label>
      </div>
      {ctx.crossBorder && !crossBorder && <p className="muted" style={{ fontSize: 12 }}>A linked vendor is outside India, so cross-border checks apply.</p>}

      <h3 className="sect">Compliance checklist</h3>
      <div className="card" style={{ background: "var(--bg)", marginBottom: 10 }}>
        <strong>{ev.pct}% compliant</strong>{" "}
        <span className="muted">
          · {ev.met} met · {ev.partial} partial · {ev.notMet} not met · {ev.applicable} applicable · recommended {ev.recMet}/{ev.recTotal}
        </span>
        <div className="bar"><i style={{ width: `${ev.pct}%` }} /></div>
        <span className="muted" style={{ fontSize: 12 }}>Items switch to N/A automatically from the role, lawful basis, children's data, vendors and cross-border settings above.</span>
      </div>
      {GROUPS.map((g) => {
        const items = ev.items.filter((x) => x.def.group === g.id);
        return (
          <div key={g.id}>
            <h4 className="chk-head">{g.label}</h4>
            {items.map((it) => (
              <div className="chk-row" key={it.def.id}>
                <div>
                  <div>{it.def.name}</div>
                  <div className="code">{it.def.ref}{it.reason ? ` · ${it.reason}` : ""}</div>
                </div>
                {it.source === "na" ? <span className="badge">N/A</span>
                  : it.source === "auto" ? <span className="badge low">{it.status} (auto)</span>
                  : (
                    <div className="seg">
                      {MANUAL_STATUSES.map((s) => (
                        <label key={s} className={it.status === s ? `on ${s.replace(" ", "").toLowerCase()}` : ""}>
                          <input type="radio" name={`chk_${it.def.id}`} value={s} checked={it.status === s}
                            onChange={() => setSaved((v) => ({ ...v, [it.def.id]: s }))} /> {s}
                        </label>
                      ))}
                    </div>)}
              </div>
            ))}
            {g.id === "security" && (
              <div className="fields" style={{ margin: "8px 0 4px" }}>
                {([["tech_encryption", "Encryption details"], ["tech_access", "Access control details"], ["tech_logging", "Logging details"], ["tech_backup", "Backup details"]] as const).map(([k, l]) => (
                  <label className="field" key={k}><span className="l">{l}</span>
                    <input name={k} defaultValue={cur?.techDetails?.[k] ?? ""} placeholder="e.g. AES-256, KMS-managed keys" /></label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <label className="field" style={{ marginTop: 14 }}><span className="l">Notes</span>
        <textarea name="notes" defaultValue={cur?.notes ?? ""} /></label>
      <div className="row" style={{ marginTop: 14 }}>
        <button type="submit">{cur ? "Update activity" : "Save activity"}</button>
        {cur && <a className="btn" href="/ropa">Cancel</a>}
      </div>
    </form>
  );
}
