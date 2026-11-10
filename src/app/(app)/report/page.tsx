import Link from "next/link";
import { requireSession } from "@/lib/session";
import { loadGaps } from "@/lib/gaps-load";
import { flowSnapshot } from "@/lib/snapshot";
import { buildSteps, progressOf } from "@/lib/flow";
import { tally } from "@/lib/controls";
import { isClosed, type GapStatusKey } from "@/lib/gaps";
import { PageHead } from "@/components/ui";

export default async function Report() {
  const s = await requireSession("view");
  const d = await loadGaps(s);
  const snap = flowSnapshot(d);
  const prog = progressOf(buildSteps(snap));
  const overall = tally(d.raw.controlRows.map((c) => c.status));
  const openCrit = d.gaps.filter((g) => g.severity === "Critical" && !isClosed((d.trackingByKey.get(g.key)?.status ?? "OPEN") as GapStatusKey)).length;
  const dpiaMissing = snap.dpia.needed - snap.dpia.withDpia;

  const checks: { ok: boolean; text: string; href: string }[] = [
    { ok: !!d.org.dpoEmail && !!d.org.grievanceEmail, text: "DPO and grievance contacts recorded", href: "/org" },
    { ok: d.raw.committee.length > 0, text: "Steering committee constituted", href: "/committee" },
    { ok: snap.ropaCount > 0, text: `${snap.ropaCount} processing activit${snap.ropaCount === 1 ? "y" : "ies"} recorded`, href: "/ropa" },
    { ok: overall.counts.NOT_ASSESSED === 0, text: overall.counts.NOT_ASSESSED ? `${overall.counts.NOT_ASSESSED} control(s) not yet assessed (counted against your score)` : "All applicable controls assessed", href: "/controls" },
    { ok: dpiaMissing <= 0, text: dpiaMissing > 0 ? `${dpiaMissing} activit${dpiaMissing === 1 ? "y" : "ies"} still need a DPIA` : "DPIAs in place where needed", href: "/dpia" },
    { ok: openCrit === 0, text: openCrit ? `${openCrit} critical gap(s) still open` : "No open critical gaps", href: "/gaps" },
    { ok: snap.breaches.overdue === 0, text: snap.breaches.overdue ? `${snap.breaches.overdue} breach(es) past the 72-hour report deadline` : "No breach deadlines missed", href: "/breaches" },
    { ok: !d.libLabel?.includes("draft"), text: `Control library ${d.libLabel ?? "-"} is a working draft pending legal review`, href: "/controls" },
  ];

  return (
    <>
      <PageHead title="Generate Report" sub="A board-ready assessment of your DPDPA implementation, in Word and PDF with the same content." />
      <div className="tiles">
        <div className="tile"><div className="t">Control score</div><div className="n">{overall.score}%</div></div>
        <div className="tile"><div className="t">Roadmap</div><div className="n">{prog.pct}%</div></div>
        <div className="tile"><div className="t">Open critical gaps</div><div className="n" style={{ color: openCrit ? "var(--bad)" : "var(--ok)" }}>{openCrit}</div></div>
      </div>
      <div className="grid">
        <div className="card"><h2>Word document</h2><p className="muted">Editable .docx for stakeholder review, with a branded cover, page numbers and formatted tables.</p>
          <a className="btn" href="/report/docx" download>Download .docx</a></div>
        <div className="card"><h2>PDF</h2><p className="muted">A print-ready .pdf with the same sections. Text in non-Latin scripts appears as "?" in the PDF; use the Word file for those.</p>
          <a className="btn" href="/report/pdf" download>Download .pdf</a></div>
      </div>
      <div className="card">
        <h2>Pre-flight checklist</h2>
        <p className="muted" style={{ marginTop: 0 }}>You can generate at any time. Items marked with a warning will show up as gaps in the report.</p>
        {checks.map((c) => (
          <div className="chk-row" key={c.text}>
            <div><span style={{ color: c.ok ? "var(--ok)" : "var(--warn)" }}>{c.ok ? "✓" : "!"}</span> {c.text}</div>
            {!c.ok && <Link className="btn" href={c.href}>Fix</Link>}
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>The report contains 17 sections: summary, roadmap, organisation, committee, departments, applications, RoPA, lawful bases, vendors, DPIAs, control coverage, priority gaps, remediation plan, breach register, consent evidence, owner worklist and method.</p>
    </>
  );
}
