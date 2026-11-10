"use client";
import { useState } from "react";
import { MultiSelect } from "./MultiSelect";
import { DATA_CATEGORIES } from "@/lib/pii";
import {
  CERTIFICATIONS, DSR_CHANNELS, DSR_SLAS, RISK_TIERS, SECURITY_CONTROLS, VENDOR_ROLE_LABELS, VENDOR_ROLES, VENDOR_TYPES, label,
} from "@/lib/enums";

export type SubRow = { name: string; purpose: string; country: string; dpa: "yes" | "no" };
export type VendorFormValue = {
  id: string; name: string; type: string; role: string; country: string | null; service: string | null;
  riskTier: string; lastReview: string; contactName: string | null; contactEmail: string | null;
  dataCategories: string[]; hasContract: boolean; contractExpiry: string; breachClause: boolean;
  certifications: string[]; securityControls: string[]; dsrContact: string | null; dsrChannel: string; dsrSla: string;
  subs: SubRow[];
};

const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }));

export function VendorForm({ action, cur }: { action: (fd: FormData) => Promise<void>; cur?: VendorFormValue }) {
  const [cats, setCats] = useState<string[]>(cur?.dataCategories ?? []);
  const [certs, setCerts] = useState<string[]>(cur?.certifications ?? []);
  const [controls, setControls] = useState<string[]>(cur?.securityControls ?? []);
  const [subs, setSubs] = useState<SubRow[]>(cur?.subs ?? []);
  const setSub = (i: number, patch: Partial<SubRow>) => setSubs((s) => s.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  // Role list always includes a legacy value so an older record can still be saved.
  const roles: string[] = [...VENDOR_ROLES];
  if (cur && !roles.includes(cur.role)) roles.unshift(cur.role);

  return (
    <form action={action} className="card">
      <h2>{cur ? "Edit vendor / processor" : "Add vendor / processor"}</h2>
      {cur && <input type="hidden" name="id" value={cur.id} />}
      {cats.map((c) => <input key={c} type="hidden" name="dataCategories" value={c} />)}
      {certs.map((c) => <input key={c} type="hidden" name="certifications" value={c} />)}
      {controls.map((c) => <input key={c} type="hidden" name="securityControls" value={c} />)}

      <h3 className="sect">Vendor profile</h3>
      <div className="fields">
        <label className="field"><span className="l">Vendor name *</span>
          <input name="name" defaultValue={cur?.name} required /></label>
        <label className="field"><span className="l">Vendor type</span>
          <select name="type" defaultValue={cur?.type ?? "SaaS Platform"}>
            {VENDOR_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select></label>
        <label className="field"><span className="l">Role under DPDPA</span>
          <select name="role" defaultValue={cur?.role ?? "PROCESSOR"}>
            {roles.map((r) => <option key={r} value={r}>{VENDOR_ROLE_LABELS[r] ?? r}</option>)}
          </select></label>
        <label className="field"><span className="l">Country / jurisdiction</span>
          <input name="country" defaultValue={cur?.country ?? "India"} /></label>
        <label className="field span2"><span className="l">Services provided</span>
          <textarea name="service" defaultValue={cur?.service ?? ""} placeholder="Brief description of services and what personal data is processed" /></label>
        <label className="field"><span className="l">Risk rating</span>
          <select name="riskTier" defaultValue={cur?.riskTier ?? "MEDIUM"}>
            {RISK_TIERS.map((r) => <option key={r} value={r}>{label(r)}</option>)}
          </select></label>
        <label className="field"><span className="l">Last review / audit</span>
          <input name="lastReview" type="date" defaultValue={cur?.lastReview ?? ""} /></label>
        <label className="field"><span className="l">Relationship contact</span>
          <input name="contactName" defaultValue={cur?.contactName ?? ""} placeholder="Name" /></label>
        <label className="field"><span className="l">Contact email</span>
          <input name="contactEmail" type="email" defaultValue={cur?.contactEmail ?? ""} /></label>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <span className="l">Data categories shared</span>
        <MultiSelect placeholder="Select..." options={DATA_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} selected={cats} onChange={setCats} />
      </div>

      <h3 className="sect">Contracts &amp; compliance</h3>
      <div className="fields">
        <label className="field"><span className="l">Data processing agreement (DPA)</span>
          <select name="dpa" defaultValue={cur?.hasContract ? "yes" : "no"}>
            <option value="yes">Yes: DPA / Sec 8(2) contract executed</option>
            <option value="no">No: DPA missing (Sec 8(2) gap)</option>
          </select></label>
        <label className="field"><span className="l">Contract expiry</span>
          <input name="contractExpiry" type="date" defaultValue={cur?.contractExpiry ?? ""} /></label>
        <div className="field"><span className="l">Breach notification clause</span>
          <label className="check"><input type="checkbox" name="breachClause" defaultChecked={cur?.breachClause} /> Vendor must notify breaches within 24h</label></div>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <span className="l">Certifications</span>
        <MultiSelect placeholder="Select..." options={opts(CERTIFICATIONS)} selected={certs} onChange={setCerts} />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <span className="l">Security controls implemented (per Rule 6)</span>
        <MultiSelect placeholder="Select..." options={opts(SECURITY_CONTROLS)} selected={controls} onChange={setControls} />
        <span className="muted" style={{ fontSize: 12 }}>Encryption at rest, access controls, audit logs and other Rule 6 safeguards. Missing controls will be flagged in Gap Analysis.</span>
      </div>

      <h3 className="sect">Data Principal rights routing (DSR)</h3>
      <div className="fields">
        <label className="field"><span className="l">DSR contact (email or URL)</span>
          <input name="dsrContact" defaultValue={cur?.dsrContact ?? ""} placeholder="privacy@vendor.com" /></label>
        <label className="field"><span className="l">Channel</span>
          <select name="dsrChannel" defaultValue={cur?.dsrChannel ?? "Email"}>{DSR_CHANNELS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="field"><span className="l">Response SLA</span>
          <select name="dsrSla" defaultValue={cur?.dsrSla ?? "30 days"}>{DSR_SLAS.map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>

      <div className="toolbar" style={{ marginTop: 18 }}>
        <div>
          <h3 className="sect" style={{ border: 0, margin: 0, padding: 0 }}>Sub-processors</h3>
          <span className="muted" style={{ fontSize: 12 }}>Each sub-processor needs a downstream DPA (Sec 8(2)). Missing flow-down DPAs are flagged in Gap Analysis.</span>
        </div>
        <button type="button" className="ghost sm" onClick={() => setSubs((s) => [...s, { name: "", purpose: "", country: "India", dpa: "no" }])}>+ Add sub-processor</button>
      </div>
      <div style={{ marginTop: 8 }}>
        {subs.length === 0 && <div className="empty">No sub-processors declared.</div>}
        {subs.map((r, i) => (
          <div className="fields" key={i} style={{ gridTemplateColumns: "2fr 2fr 1fr 1.4fr auto", alignItems: "end", marginBottom: 8 }}>
            <label className="field"><span className="l">Name</span><input name="spName" value={r.name} onChange={(e) => setSub(i, { name: e.target.value })} /></label>
            <label className="field"><span className="l">Purpose</span><input name="spPurpose" value={r.purpose} onChange={(e) => setSub(i, { purpose: e.target.value })} /></label>
            <label className="field"><span className="l">Country</span><input name="spCountry" value={r.country} onChange={(e) => setSub(i, { country: e.target.value })} /></label>
            <label className="field"><span className="l">DPA in place?</span>
              <select name="spDpa" value={r.dpa} onChange={(e) => setSub(i, { dpa: e.target.value as "yes" | "no" })}>
                <option value="yes">Yes</option><option value="no">No</option>
              </select></label>
            <button type="button" className="danger sm" onClick={() => setSubs((s) => s.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button type="submit">{cur ? "Update vendor" : "Save vendor"}</button>
        {cur && <a className="btn" href="/vendors">Cancel</a>}
      </div>
    </form>
  );
}
