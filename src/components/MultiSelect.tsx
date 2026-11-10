"use client";
import { useEffect, useRef, useState } from "react";

export type Opt = { value: string; label: string; group?: string };

export function MultiSelect({
  options, selected, onChange, placeholder,
}: { options: Opt[]; selected: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const needle = q.trim().toLowerCase();
  const shown = options.filter((o) => !needle || `${o.label} ${o.group ?? ""}`.toLowerCase().includes(needle));
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const byValue = new Map(options.map((o) => [o.value, o.label]));

  let lastGroup: string | undefined;
  return (
    <div className="ms" ref={ref}>
      <button type="button" className="ms-trigger" onClick={() => setOpen((o) => !o)}>
        <span className={selected.length ? "" : "muted"}>{selected.length ? `${selected.length} selected` : placeholder}</span>
        <span className="muted">▾</span>
      </button>
      {open && (
        <div className="ms-panel">
          <input
            autoFocus
            placeholder="Search..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
          />
          <div className="ms-list">
            {shown.length === 0 && <div className="empty">No matches</div>}
            {shown.map((o) => {
              const header = o.group && o.group !== lastGroup ? o.group : null;
              lastGroup = o.group;
              return (
                <div key={o.value}>
                  {header && <div className="ms-group">{header}</div>}
                  <label className="ms-item">
                    <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} /> {o.label}
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {selected.length > 0 && (
        <div className="chips">
          {selected.map((v) => (
            <span className="chip" key={v}>
              {byValue.get(v) ?? v}
              <button type="button" aria-label={`Remove ${byValue.get(v) ?? v}`} onClick={() => toggle(v)}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
