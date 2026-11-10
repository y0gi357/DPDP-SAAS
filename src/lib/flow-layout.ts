// Geometry for the implementation-flow diagram. Pure data so it can be tested for overlaps and bad edges.
export const NW = 160, NH = 62, PITCH = 188, X0 = 40, W = 1380, H = 900;
type Pt = [number, number];

export type StageBox = { n: number; x: number; y: number; lines: string[]; sub: string };
const ROW_A = 84, ROW_B = 462, ROW_C = 602, ROW_D = 800;

const titles: Record<number, string[]> = {
  1: ["Organisation", "Setup"], 2: ["DPDPA", "Committee"], 3: ["Departments &", "SPOCs"], 4: ["Apps &", "Data Sources"], 5: ["Vendors & TPRM"],
  6: ["RoPA /", "Data Mapping"], 7: ["Data Flow"], 8: ["DPIA"], 9: ["Controls", "Assessment"], 10: ["Notice"], 11: ["Consent &", "Withdrawal"],
  12: ["Children & PwD"], 13: ["Security", "Safeguards"], 14: ["Retention &", "Erasure"], 15: ["Data Principal", "Rights"], 16: ["Grievance &", "Contact"],
  17: ["Breach Response"], 18: ["Cross-border", "Transfer"], 19: ["SDF Obligations"], 20: ["Gap Analysis"], 21: ["Generate Report"], 22: ["Dashboard"],
};
const subs: Record<number, string> = {
  1: "Profile & scope", 2: "Roster & DPO", 3: "Dept register", 4: "App inventory", 5: "Processor register", 6: "Control checklist", 7: "Flow maps", 8: "DPIA records",
  9: "Control scores", 10: "Itemised notice", 11: "Consent records", 12: "Verified consent", 13: "Rule 6 measures", 14: "Erasure schedule", 15: "Request workflow",
  16: "Redressal process", 17: "72-hour reporting", 18: "Transfer register", 19: "DPO, audit, DPIA", 20: "Remediation plan", 21: "Board report", 22: "Live posture",
};

const pos = (n: number): Pt =>
  n <= 7 ? [X0 + (n - 1) * PITCH, ROW_A]
  : n === 8 ? [X0 + 6 * PITCH, 184]
  : n === 9 ? [X0 + 6 * PITCH, 284]
  : n <= 14 ? [228 + (n - 10) * PITCH, ROW_B]
  : n <= 19 ? [228 + (19 - n) * PITCH, ROW_C]
  : [228 + (n - 20) * PITCH, ROW_D];

export const STAGES: StageBox[] = Array.from({ length: 22 }, (_, i) => {
  const n = i + 1; const [x, y] = pos(n);
  return { n, x, y, lines: titles[n], sub: subs[n] };
});
const S = (n: number) => STAGES[n - 1];

export const STORES = [
  { id: "D1", x: 40, y: 178, w: 940, h: 44, title: "Assessment inventory", sub: "Organisation, committee, departments, apps, processors" },
  { id: "D2", x: 604, y: 282, w: 526, h: 44, title: "RoPA control checklist", sub: "Notice, consent, retention, rights, technical safeguards" },
];
export const EXTERNALS = [
  { id: "dp", x: 40, y: ROW_B, w: 160, h: 202, lines: ["Data Principal"], sub: "External entity" },
  { id: "proc", x: 1168, y: ROW_B, w: 160, h: NH, lines: ["Data Processors"], sub: "External entity" },
  { id: "board", x: 1168, y: ROW_C, w: 160, h: NH, lines: ["Data Protection", "Board"], sub: "External entity" },
];
export const REVIEW = { x: 792, y: 792, w: 338, h: 78, title: "Review cycle", lines: ["The committee reviews the dashboard each quarter.", "Open gaps go back to the RoPA (6) and Controls (9)."] };

export const BANDS = [
  { phase: 1, x: 214, y: 20, w: 376, h: 340 },   // Mobilization
  { phase: 3, x: 1154, y: 20, w: 188, h: 340 },  // Analysis
  { phase: 4, x: 40, y: 392, w: 1300, h: 310 },  // Operationalize
];
export const LABELS = [
  { phase: 0, x: 120, tag: "Start", label: "Foundation", y: 40, anchor: "middle" },
  { phase: 1, x: 402, tag: "Phase 1", label: "Mobilization", y: 40, anchor: "middle" },
  { phase: 2, x: 872, tag: "Phase 2", label: "Discovery", y: 40, anchor: "middle" },
  { phase: 3, x: 1248, tag: "Phase 3", label: "Analysis", y: 40, anchor: "middle" },
  { phase: 5, x: 272, tag: "Phase 5", label: "Remediation", y: 762, anchor: "start" },
  { phase: 6, x: 438, tag: "Close", label: "Reporting", y: 762, anchor: "start" },
] as const;
export const PHASE4 = { phase: 4, x: 420, y: 418, tag: "Phase 4", title: "Operationalize: the Data Principal lifecycle", sub: "What every processing activity must satisfy, and who it touches" };

export type Edge = { pts: Pt[]; dashed?: boolean; from: string; to: string; rank: number };
const midY = (n: number) => S(n).y + NH / 2;
const midX = (n: number) => S(n).x + NW / 2;
const stageNo = (id: string) => (/^s(\d+)$/.exec(id) ? Number(id.slice(1)) : 0);
const edge = (from: string, to: string, pts: Pt[], dashed = false): Edge => ({ from, to, pts, dashed, rank: Math.max(stageNo(from), stageNo(to)) });
const right = (a: number, b: number) => edge(`s${a}`, `s${b}`, [[S(a).x + NW, midY(a)], [S(b).x, midY(b)]]);
const left = (a: number, b: number) => edge(`s${a}`, `s${b}`, [[S(a).x, midY(a)], [S(b).x + NW, midY(b)]]);
const down = (a: number, b: number) => edge(`s${a}`, `s${b}`, [[midX(a), S(a).y + NH], [midX(b), S(b).y]]);

export const EDGES: Edge[] = [
  ...[1, 2, 3, 4, 5, 6].map((n) => right(n, n + 1)),
  down(7, 8), down(8, 9),
  ...[1, 2, 3, 4, 5].map((n) => edge(`s${n}`, "D1", [[midX(n), S(n).y + NH], [midX(n), 178]])),   // records feed the inventory
  edge("s6", "D2", [[midX(6), S(6).y + NH], [midX(6), 282]]),                                    // RoPA feeds its checklist store
  edge("D2", "s9", [[1130, 304], [S(9).x, 304]]),                                                 // checklist feeds the control assessment
  edge("s9", "s10", [[midX(9), S(9).y + NH], [midX(9), 372], [308, 372], [308, ROW_B]]),          // assessment drives the duties
  ...[10, 11, 12, 13].map((n) => right(n, n + 1)),
  down(14, 15),
  ...[15, 16, 17, 18].map((n) => left(n, n + 1)),
  edge("s19", "s20", [[250, S(19).y + NH], [250, S(20).y]]),
  right(20, 21), right(21, 22),
  edge("dp", "s10", [[200, 493], [228, 493]], true),
  edge("s14", "proc", [[S(14).x + NW, 493], [1168, 493]], true),
  edge("s15", "board", [[S(15).x + NW, 633], [1168, 633]], true),
  edge("s22", "review", [[S(22).x + NW, 831], [792, 831]], true),
];

/** Which phase a stage belongs to (matches PHASES in flow.ts). */
export const phaseOfStage = (n: number) => (n === 1 ? 0 : n <= 3 ? 1 : n <= 6 ? 2 : n <= 9 ? 3 : n <= 19 ? 4 : n === 20 ? 5 : 6);

export type EdgeState = "idle" | "active" | "passed" | "ahead";
/** How an edge looks while stage `sel` is selected: flowing into/out of it, already travelled, or still to come. */
export function edgeState(e: Edge, sel: number | null): EdgeState {
  if (sel == null) return "idle";
  if (e.from === `s${sel}` || e.to === `s${sel}`) return "active";
  return e.rank < sel ? "passed" : "ahead";
}
export function stageState(n: number, sel: number | null): "idle" | "sel" | "passed" | "ahead" {
  return sel == null ? "idle" : n === sel ? "sel" : n < sel ? "passed" : "ahead";
}
