"use client";
import { useState } from "react";
import { MultiSelect } from "./MultiSelect";
import { DATA_CATEGORIES, PII_FIELDS, categoriesOf, templateFor } from "@/lib/pii";
import { SOURCING, SOURCING_LABELS, VENDOR_ACCESS, VENDOR_ACCESS_LABELS } from "@/lib/enums";

export type AssetFormValue = {
  id: string; name: string; type: string; departmentId: string | null; ownerName: string | null;
  hostingLocation: string | null; hostedInIndia: boolean; sourcing: string; vendorName: string | null;
  vendorAccess: string | null; dataCategories: string[]; piiFields: string[];
};

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

export function AssetForm({
  action, depts, vendorNames, typeOptions, cur,
}: {
  action: (fd: FormData) => Promise<void>;
  depts: { id: string; name: string }[];
  vendorNames: string[];
  typeOptions: { value: string; label: string }[];
  cur?: AssetFormValue;
}) {
  const [deptId, setDeptId] = useState(cur?.departmentId ?? "");
  const [sourcing, setSourcing] = useState(cur?.sourcing ?? "IN_HOUSE");
  const [cats, setCats] = useState<string[]>(cur?.dataCategories ?? []);
  const [fields, setFields] = useState<string[]>(cur?.piiFields ?? []);
  const [note, setNote] = useState("");

  function onDept(id: string) {
    setDeptId(id);
    const d = depts.find((x) => x.id === id);
    const t = d ? templateFor(d.name) : null;
    if (d && t) {
      setFields(t);
      setCats((c) => union(c, categoriesOf(t)));
      setNote(`Pre-selected ${t.length} typical fields for ${d.name}. Deselect anything this application does not collect.`);
    } else {
      setNote("");
    }
  }
  function onFields(next: string[]) {
    setFields(next);
    setCats((c) => union(c, categoriesOf(next))); // a selected field implies its category
  }

  return (
    <form action={action} className="card">
      <h2>{cur ? "Edit application / data source" : "Add application / data source"}</h2>
      {cur && <input type="hidden" name="id" value={cur.id} />}
      {cats.map((c) => <input key={c} type="hidden" name="dataCategories" value={c} />)}
      {fields.map((f) => <input key={f} type="hidden" name="piiFields" value={f} />)}

      <h3 className="sect">Basics</h3>
      <div className="fields">
        <label className="field"><span className="l">Application name *</span>
          <input name="name" defaultValue={cur?.name} placeholder="e.g., HRMS, ERP, CRM" required /></label>
        <label className="field"><span className="l">Type</span>
          <select name="type" defaultValue={cur?.type ?? "SAAS"}>
            {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select></label>
        <label className="field"><span className="l">Department</span>
          <select name="departmentId" value={deptId} onChange={(e) => onDept(e.target.value)}>
            <option value="">Select department...</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <span className="muted" style={{ fontSize: 12 }}>
            {depts.length === 0 ? "Add departments first (Departments & SPOCs)." : "Selecting a department auto-pre-selects the typical PII fields below."}
          </span></label>
        <label className="field"><span className="l">Hosting / region</span>
          <input name="hostingLocation" defaultValue={cur?.hostingLocation ?? ""} placeholder="e.g., AWS Mumbai (ap-south-1)" />
          <span className="check" style={{ marginTop: 4 }}>
            <input type="checkbox" name="hostedInIndia" defaultChecked={cur ? cur.hostedInIndia : true} /> Hosted in India
          </span></label>
        <label className="field"><span className="l">Application owner</span>
          <input name="ownerName" defaultValue={cur?.ownerName ?? ""} placeholder="Name / role" /></label>
      </div>

      <h3 className="sect">Sourcing &amp; vendor</h3>
      <div className="fields">
        <label className="field"><span className="l">Application is</span>
          <select name="sourcing" value={sourcing} onChange={(e) => setSourcing(e.target.value)}>
            {SOURCING.map((s) => <option key={s} value={s}>{SOURCING_LABELS[s]}</option>)}
          </select></label>
        {sourcing === "OUTSOURCED" && (
          <>
            <label className="field"><span className="l">Vendor name *</span>
              <input name="vendorName" list="vendor-names" defaultValue={cur?.vendorName ?? ""} placeholder="Vendor / supplier name" required />
              <datalist id="vendor-names">{vendorNames.map((v) => <option key={v} value={v} />)}</datalist>
              <span className="muted" style={{ fontSize: 12 }}>Vendors already in TPRM are suggested; a new name is added to Vendors automatically.</span></label>
            <label className="field"><span className="l">Does vendor access the data? *</span>
              <select name="vendorAccess" defaultValue={cur?.vendorAccess ?? "HOSTING_ONLY"} required>
                {VENDOR_ACCESS.map((v) => <option key={v} value={v}>{VENDOR_ACCESS_LABELS[v]}</option>)}
              </select></label>
          </>
        )}
      </div>

      <h3 className="sect">Data inventory</h3>
      <div className="field" style={{ marginBottom: 12 }}>
        <span className="l">Data categories</span>
        <MultiSelect
          placeholder="Select categories..."
          options={DATA_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
          selected={cats}
          onChange={setCats}
        />
        <span className="muted" style={{ fontSize: 12 }}>
          {DATA_CATEGORIES.slice(0, 5).map((c) => `${c.label} = ${c.eg}`).join("; ")}.
        </span>
      </div>
      <div className="field">
        <span className="l">PII fields collected ({fields.length} selected)</span>
        <MultiSelect
          placeholder="Select PII fields..."
          options={PII_FIELDS.map((f) => ({ value: f.key, label: f.label, group: DATA_CATEGORIES.find((c) => c.key === f.category)?.label }))}
          selected={fields}
          onChange={onFields}
        />
        <span className="muted" style={{ fontSize: 12 }}>
          {note || "Pre-selected based on the chosen department. Deselect anything this application does NOT actually collect. Add anything missing using the search."}
        </span>
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button type="submit">{cur ? "Update" : "Save"}</button>
        {cur && <a className="btn" href="/apps">Cancel</a>}
      </div>
    </form>
  );
}
