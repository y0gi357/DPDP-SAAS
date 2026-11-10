import "./phase2.css";
import { label } from "@/lib/enums";

export function PageHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <>
      <h1>{title}</h1>
      {sub && <p className="muted" style={{ marginTop: 0 }}>{sub}</p>}
    </>
  );
}

export function Field({ label: l, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`field${wide ? " span2" : ""}`}>
      <span className="l">{l}</span>
      {children}
    </label>
  );
}

export function Select({
  name, options, value, allowEmpty, emptyLabel, required,
}: {
  name: string;
  options: readonly string[] | { value: string; label: string }[];
  value?: string | null;
  allowEmpty?: boolean;
  emptyLabel?: string;
  required?: boolean;
}) {
  const opts = (options as (string | { value: string; label: string })[]).map((o) =>
    typeof o === "string" ? { value: o, label: label(o) } : o,
  );
  return (
    <select name={name} required={required} defaultValue={value ?? (allowEmpty ? "" : opts[0]?.value)}>
      {allowEmpty && <option value="">{emptyLabel ?? "-"}</option>}
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Check({ name, text, checked }: { name: string; text: string; checked?: boolean }) {
  return (
    <label className="check">
      <input type="checkbox" name={name} defaultChecked={checked} /> {text}
    </label>
  );
}

export function MultiCheck({
  name, options, selected, labelOf,
}: { name: string; options: readonly string[]; selected?: string[]; labelOf?: (v: string) => string }) {
  return (
    <div className="checks">
      {options.map((o) => (
        <label key={o}>
          <input type="checkbox" name={name} value={o} defaultChecked={selected?.includes(o)} /> {(labelOf ?? label)(o)}
        </label>
      ))}
    </div>
  );
}

export function ErrorNote({ msg }: { msg?: string }) {
  return msg ? <div className="err" style={{ marginBottom: 10 }}>{msg}</div> : null;
}

export function RowActions({
  editHref, onDelete, id, editable,
}: { editHref: string; onDelete: (fd: FormData) => Promise<void>; id: string; editable: boolean }) {
  if (!editable) return null;
  return (
    <div className="row">
      <a className="btn" href={editHref}>Edit</a>
      <form action={onDelete}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="danger sm">Delete</button>
      </form>
    </div>
  );
}

export const fmtDate = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
