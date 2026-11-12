"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { departmentRoles, departmentRoleLabels, departmentSchema, type DepartmentInput } from "@/lib/departments";
import { Field } from "./ui";

type Contact = DepartmentInput["contacts"][number];
const emptyContact = (): Contact => ({ subFunction: "", name: "", email: "", designation: "", phone: "", responsibilities: "", roles: [], isPrimary: false });
function Roles({ value, onChange, legend }: { value: Contact["roles"]; onChange: (v: Contact["roles"]) => void; legend: string }) {
  return <fieldset className="department-roles"><legend>{legend}</legend><div className="checks">
    {departmentRoles.map((r) => <label key={r}><input type="checkbox" checked={value.includes(r)} onChange={(e) => onChange(e.target.checked ? (r === "NOT_APPLICABLE" ? [r] : [...value.filter((x) => x !== "NOT_APPLICABLE"), r]) : value.filter((x) => x !== r))} />{departmentRoleLabels[r]}</label>)}
  </div></fieldset>;
}
function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save department" : "Add department"}</button>;
}
export default function DepartmentForm({ id, initial, action }: { id?: string; initial?: DepartmentInput; action: (fd: FormData) => Promise<void> }) {
  const [value, setValue] = useState<DepartmentInput>(initial ?? { name: "", headName: "", roles: [], contacts: [] });
  const [error, setError] = useState("");
  const patch = (i: number, update: Partial<Contact>) => setValue((v) => ({ ...v, contacts: v.contacts.map((c, n) => n === i ? { ...c, ...update } : c) }));
  return <form action={action} className="card" onSubmit={(event) => {
    const parsed = departmentSchema.safeParse(value);
    if (!parsed.success) { event.preventDefault(); const issue = parsed.error.issues[0]; setError(`${issue.path.join(".")}: ${issue.message}`); }
    else setError("");
  }}>
    <h2>{id ? "Edit department" : "Add department"}</h2>
    {id && <input type="hidden" name="id" value={id} />}
    <input type="hidden" name="department" value={JSON.stringify(value)} />
    {error && <div className="err" role="alert">{error}</div>}
    <div className="fields">
      <Field label="Department"><input value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} required maxLength={120} /></Field>
      <Field label="Department head"><input value={value.headName} onChange={(e) => setValue({ ...value, headName: e.target.value })} maxLength={120} /></Field>
    </div>
    <Roles legend="Department roles (select one or more)" value={value.roles} onChange={(roles) => setValue({ ...value, roles })} />
    <p className="muted">Roles describe your internal assessment of processing responsibilities; selecting a role does not establish a legal status.</p>
    <div className="toolbar"><h3>Sub-functions & SPOCs</h3><button className="ghost" type="button" disabled={value.contacts.length >= 100} onClick={() => setValue({ ...value, contacts: [...value.contacts, emptyContact()] })}>+ Add sub-function</button></div>
    {!value.contacts.length && <p className="muted">Add sub-functions such as Helpdesk, Payroll or Product Management. Each can have its own SPOC.</p>}
    {value.contacts.map((c, i) => <fieldset className="department-contact" key={c.id ?? `new-${i}`}>
      <legend>Sub-function {i + 1}</legend>
      <div className="fields">
        <Field label="Sub-function"><input value={c.subFunction} onChange={(e) => patch(i, { subFunction: e.target.value })} required maxLength={120} /></Field>
        <Field label="SPOC name"><input value={c.name} onChange={(e) => patch(i, { name: e.target.value })} maxLength={120} /></Field>
        <Field label="SPOC email"><input value={c.email} onChange={(e) => patch(i, { email: e.target.value })} type="email" maxLength={200} /></Field>
        <Field label="Designation"><input value={c.designation} onChange={(e) => patch(i, { designation: e.target.value })} maxLength={120} /></Field>
        <Field label="Phone"><input value={c.phone} onChange={(e) => patch(i, { phone: e.target.value })} type="tel" maxLength={40} /></Field>
        <Field label="Responsibilities"><textarea value={c.responsibilities} onChange={(e) => patch(i, { responsibilities: e.target.value })} maxLength={2000} /></Field>
      </div>
      <Roles legend="Sub-function roles" value={c.roles} onChange={(roles) => patch(i, { roles })} />
      <div className="toolbar">
        <label className="check"><input type="radio" name="primaryContact" checked={c.isPrimary} onChange={() => setValue({ ...value, contacts: value.contacts.map((x, n) => ({ ...x, isPrimary: n === i })) })} />Primary department SPOC</label>
        <button type="button" className="danger" onClick={() => setValue({ ...value, contacts: value.contacts.filter((_, n) => n !== i) })}>Remove sub-function {i + 1}</button>
      </div>
    </fieldset>)}
    <p className="muted">You can save a sub-function before assigning its SPOC. Choose one named primary SPOC for department-level gap checks. These contacts do not receive application login access; use Team & Access for invitations.</p>
    <div className="row"><Submit editing={!!id} /><a className="btn" href="/departments">{id ? "Cancel" : "Clear"}</a></div>
  </form>;
}
