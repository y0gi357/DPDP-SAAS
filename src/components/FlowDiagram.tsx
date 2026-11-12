"use client";
import { useEffect, useState } from "react";
import { DiagramViewport } from "./DiagramViewport";
import Link from "next/link";
import { BANDS, EDGES, EXTERNALS, H, LABELS, NH, NW, PHASE4, REVIEW, STAGES, STORES, W, edgeState, phaseOfStage, stageState } from "@/lib/flow-layout";

export type StepView = {
  n: number; id: string; title: string; phase: string; status: "done" | "progress" | "todo" | "na";
  detail: string; receives: string; produces: string; refs: string[]; href: string;
};
const STATUS_TEXT = { done: "Completed", progress: "In progress", todo: "Not started", na: "Not applicable" } as const;

export function FlowDiagram({ steps, nextN, initialSelected = null }: { steps: StepView[]; nextN: number | null; initialSelected?: number | null }) {
  const [sel, setSel] = useState<number | null>(initialSelected);
  const [playing, setPlaying] = useState(false);
  const total = steps.length;

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setSel((p) => Math.min((p ?? 0) + 1, total)), 1800);
    return () => clearInterval(t);
  }, [playing, total]);
  useEffect(() => {
    if (playing && sel === total) setPlaying(false); // stop as soon as the last stage is shown
  }, [playing, sel, total]);

  const byN = new Map(steps.map((s) => [s.n, s]));
  const cur = sel ? byN.get(sel) : undefined;
  const curPhase = sel ? phaseOfStage(sel) : null;
  const pick = (n: number) => { setPlaying(false); setSel(n); };

  // Boxes touched by a flowing edge light up too (data stores, outside parties, the review loop).
  const hot = new Set<string>();
  for (const e of EDGES) if (edgeState(e, sel) === "active") { hot.add(e.from); hot.add(e.to); }

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 8 }}>
        <span className="muted" style={{ fontSize: 13 }}>{total} stages in 7 phases. Select a stage to see the flow at that point.</span>
        <div className="row">
          {sel !== null && <button type="button" className="ghost sm" onClick={() => { setPlaying(false); setSel(null); }}>Clear selection</button>}
          <button type="button" className="ghost sm" onClick={() => { if (playing) setPlaying(false); else { setSel(1); setPlaying(true); } }}>
            {playing ? "Stop walkthrough" : "Play walkthrough"}
          </button>
        </div>
      </div>
      <DiagramViewport label="Implementation flow">
        <svg className={`flowd${sel !== null ? " focus" : ""}`} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="group" aria-label="Implementation flow diagram">
          <defs>
            <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" className="arrow" /></marker>
            <marker id="flow-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L10 5 L0 10 z" className="arrow hot" /></marker>
          </defs>
          {BANDS.map((b) => <rect key={b.phase} className={`band${b.phase === curPhase ? " active" : ""}`} x={b.x} y={b.y} width={b.w} height={b.h} />)}
          {LABELS.map((l) => {
            const on = l.phase === curPhase;
            return (
              <g key={l.label} textAnchor={l.anchor} className={on ? "plabel active" : "plabel"}>
                <text className="tag" x={l.x} y={l.y}>{l.tag}</text>
                <text className="phase" x={l.x} y={l.y + 20}>{l.label}</text>
                {on && <line className="under" x1={l.anchor === "middle" ? l.x - 44 : l.x} x2={l.anchor === "middle" ? l.x + 44 : l.x + 88} y1={l.y + 28} y2={l.y + 28} />}
              </g>
            );
          })}
          <g className={curPhase === PHASE4.phase ? "plabel active" : "plabel"}>
            <text className="tag" x={PHASE4.x} y={PHASE4.y}>{PHASE4.tag}</text>
            <text className="phase" x={PHASE4.x + 70} y={PHASE4.y}>{PHASE4.title}</text>
            <text className="sub" x={PHASE4.x + 70} y={PHASE4.y + 20}>{PHASE4.sub}</text>
            {curPhase === PHASE4.phase && <line className="under" x1={PHASE4.x} x2={PHASE4.x + 62} y1={PHASE4.y + 10} y2={PHASE4.y + 10} />}
          </g>

          {STORES.map((d) => (
            <g key={d.id} className={`store${hot.has(d.id) ? " hot" : ""}`}>
              <rect x={d.x} y={d.y} width={d.w} height={d.h} />
              <line x1={d.x + 44} y1={d.y} x2={d.x + 44} y2={d.y + d.h} />
              <text className="id" x={d.x + 22} y={d.y + 27} textAnchor="middle">{d.id}</text>
              <text className="title" x={d.x + 58} y={d.y + 18}>{d.title}</text>
              <text className="sub" x={d.x + 58} y={d.y + 35}>{d.sub}</text>
            </g>
          ))}
          {EXTERNALS.map((e) => (
            <g key={e.id} className={`ext${hot.has(e.id) ? " hot" : ""}`}>
              <rect className="shadow" x={e.x + 4} y={e.y + 4} width={e.w} height={e.h} />
              <rect x={e.x} y={e.y} width={e.w} height={e.h} />
              {e.lines.map((t, i) => <text key={i} className="title" x={e.x + e.w / 2} y={e.y + e.h / 2 - 6 + (i - (e.lines.length - 1) / 2) * 15} textAnchor="middle">{t}</text>)}
              <text className="sub" x={e.x + e.w / 2} y={e.y + e.h / 2 + 8 + (e.lines.length - 1) * 8 + 8} textAnchor="middle">{e.sub}</text>
            </g>
          ))}
          <g className={`review${hot.has("review") ? " hot" : ""}`}>
            <rect x={REVIEW.x} y={REVIEW.y} width={REVIEW.w} height={REVIEW.h} rx="8" />
            <text className="title" x={REVIEW.x + 16} y={REVIEW.y + 24}>{REVIEW.title}</text>
            {REVIEW.lines.map((t, i) => <text key={i} className="sub" x={REVIEW.x + 16} y={REVIEW.y + 44 + i * 15}>{t}</text>)}
          </g>

          {EDGES.map((e) => {
            const st = edgeState(e, sel);
            return (
              <polyline
                key={`${e.from}-${e.to}`} data-edge={`${e.from}-${e.to}`} data-state={st}
                className={`edge${e.dashed ? " dashed" : ""} ${st}`} fill="none"
                points={e.pts.map((p) => p.join(",")).join(" ")}
                markerEnd={st === "active" ? "url(#flow-arrow-hot)" : "url(#flow-arrow)"}
              />
            );
          })}

          {STAGES.map((s) => {
            const st = byN.get(s.n);
            if (!st) return null;
            const state = stageState(s.n, sel);
            const two = s.lines.length === 2;
            return (
              <g
                key={s.n}
                className={`stage ${st.status} ${state}`}
                role="button" tabIndex={0}
                aria-label={`Stage ${s.n}: ${st.title}, ${STATUS_TEXT[st.status]}`}
                aria-pressed={sel === s.n}
                onClick={() => pick(s.n)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(s.n); } }}
              >
                <rect x={s.x} y={s.y} width={NW} height={NH} rx="8" />
                <circle cx={s.x + 18} cy={s.y + 20} r="11" />
                <text className="num" x={s.x + 18} y={s.y + 24} textAnchor="middle">{st.status === "done" ? "✓" : s.n}</text>
                {s.lines.map((t, i) => <text key={i} className="title" x={s.x + 36} y={s.y + (two ? 21 + i * 14 : 25)}>{t}</text>)}
                <text className="sub" x={s.x + 36} y={s.y + NH - 10}>{s.sub}</text>
              </g>
            );
          })}
        </svg>
      </DiagramViewport>
      <div className="legend">
          <span><i className="dot done" /> Completed</span><span><i className="dot progress" /> In progress</span>
          <span><i className="dot todo" /> Not started</span><span><i className="dot na" /> Not applicable</span>
          <span><i className="dot sel" /> Selected stage</span><span><i className="dot ahead" /> Still to come</span>
          <span><i className="dot ext" /> External entity</span><span><i className="dot store" /> Data store</span>
      </div>

      <div className="card" aria-live="polite">
        {cur ? (
          <>
            <div className="toolbar">
              <h2 style={{ margin: 0 }}>{cur.n}. {cur.title} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>{cur.phase}</span></h2>
              <span className={`badge ${cur.status === "done" ? "low" : cur.status === "progress" ? "medium" : ""}`}>{STATUS_TEXT[cur.status]}</span>
            </div>
            <p style={{ margin: "8px 0 4px" }}>{cur.detail}</p>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>Receives: {cur.receives}. Produces: {cur.produces}.</p>
            <p className="code" style={{ margin: "6px 0 10px" }}>{cur.refs.join(" · ")}</p>
            <div className="row">
              <Link className="btn" href={cur.href}>Open {cur.title}</Link>
              {cur.n < total && <button type="button" className="ghost sm" onClick={() => pick(cur.n + 1)}>Next stage</button>}
            </div>
          </>
        ) : (
          <div className="toolbar">
            <div>
              <h2 style={{ margin: 0 }}>Select any stage in the diagram</h2>
              <p className="muted" style={{ margin: "4px 0 0" }}>Stages 1 to 9 set up the programme and map your processing. Stages 10 to 19 are the duties each activity must meet. Stages 20 to 22 close the loop.</p>
            </div>
            <button type="button" onClick={() => pick(nextN ?? 1)}>{nextN && nextN > 1 ? `Go to next stage (${nextN})` : "Start with stage 1"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
