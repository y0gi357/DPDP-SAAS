// Data flow diagram built from the RoPA: principals -> systems -> departments -> processors -> cross-border.
// Pure functions. renderSvg returns a string so the same output serves the page and the SVG download.

export type FlowRopa = {
  id: string; activity: string; departmentId: string | null; departmentName: string | null;
  principalCategory: string; dataCategories: string[]; crossBorder: boolean; crossBorderCountry: string | null;
  assets: { id: string; name: string; hostingLocation: string | null; hostedInIndia: boolean }[];
  vendors: { id: string; name: string; country: string | null; hasContract: boolean }[];
};

export type FlowNode = { id: string; col: number; label: string; flags: string[]; activities: string[] };
export type FlowEdge = { from: string; to: string; activities: string[]; categories: string[]; crossBorder: boolean };

export const COLUMNS = ["Data Principals", "Systems & Apps", "Processing / Depts", "Processors", "Cross-Border"] as const;
const isIndia = (c: string | null | undefined) => !c || c.trim().toLowerCase() === "india";

export function buildFlow(ropa: FlowRopa[]) {
  const nodes = new Map<string, FlowNode>();
  const edges = new Map<string, FlowEdge>();
  const node = (id: string, col: number, label: string, flags: string[], activity: string) => {
    const n = nodes.get(id) ?? { id, col, label, flags, activities: [] };
    if (!n.activities.includes(activity)) n.activities.push(activity);
    nodes.set(id, n);
    return n;
  };
  const link = (a: FlowNode, b: FlowNode, r: FlowRopa) => {
    const k = `${a.id}>${b.id}`;
    const e = edges.get(k) ?? { from: a.id, to: b.id, activities: [], categories: [], crossBorder: b.col === 4 };
    if (!e.activities.includes(r.activity)) e.activities.push(r.activity);
    for (const c of r.dataCategories) if (!e.categories.includes(c)) e.categories.push(c);
    edges.set(k, e);
  };

  for (const r of ropa) {
    const stages: FlowNode[][] = [
      [node(`P:${r.principalCategory}`, 0, r.principalCategory, [], r.activity)],
      r.assets.map((a) => node(`A:${a.id}`, 1, a.name, a.hostedInIndia ? [] : ["outside India"], r.activity)),
      r.departmentName ? [node(`D:${r.departmentId ?? r.departmentName}`, 2, r.departmentName, [], r.activity)] : [],
      r.vendors.map((v) => node(`V:${v.id}`, 3, v.name, [...(v.hasContract ? [] : ["no DPA"]), ...(isIndia(v.country) ? [] : ["abroad"])], r.activity)),
      r.crossBorder ? [node(`C:${r.crossBorderCountry ?? "Overseas"}`, 4, r.crossBorderCountry ?? "Overseas", [], r.activity)] : [],
    ].filter((s) => s.length > 0);
    for (let i = 0; i + 1 < stages.length; i++) for (const a of stages[i]) for (const b of stages[i + 1]) link(a, b, r);
  }

  const all = [...nodes.values()];
  const list = [...edges.values()];
  return {
    nodes: all,
    edges: list,
    stats: {
      systems: all.filter((n) => n.col === 1).length,
      departments: all.filter((n) => n.col === 2).length,
      processors: all.filter((n) => n.col === 3).length,
      crossBorderFlows: list.filter((e) => e.crossBorder).length,
      flows: list.length,
    },
  };
}

export type Flow = ReturnType<typeof buildFlow>;
const NW = 168, NH = 38, GAPY = 14, GAPX = 96, PAD = 20, HEAD = 34;

export function layoutFlow(flow: Flow) {
  const used = [...new Set(flow.nodes.map((n) => n.col))].sort();
  const xOf = new Map(used.map((c, i) => [c, PAD + i * (NW + GAPX)]));
  const placed = new Map<string, FlowNode & { x: number; y: number }>();
  let height = HEAD + PAD;
  for (const col of used) {
    const colNodes = flow.nodes.filter((n) => n.col === col).sort((a, b) => a.label.localeCompare(b.label));
    colNodes.forEach((n, i) => placed.set(n.id, { ...n, x: xOf.get(col)!, y: HEAD + i * (NH + GAPY) }));
    height = Math.max(height, HEAD + colNodes.length * (NH + GAPY) + PAD);
  }
  const width = PAD * 2 + used.length * NW + (used.length - 1) * GAPX;
  const edges = flow.edges.flatMap((e) => {
    const a = placed.get(e.from), b = placed.get(e.to);
    if (!a || !b) return [];
    const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, mx = (x1 + x2) / 2;
    return [{ ...e, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, sw: 1.5 + Math.min(e.activities.length, 4) * 0.6 }];
  });
  return {
    width: Math.max(width, 240), height,
    headers: used.map((c) => ({ x: xOf.get(c)!, label: COLUMNS[c] })),
    nodes: [...placed.values()], edges,
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}...` : s);

/** SVG markup. "file" mode embeds its own colours so the download looks right anywhere. */
export function renderSvg(layout: ReturnType<typeof layoutFlow>, mode: "page" | "file" = "page", labelOf: (c: string) => string = (c) => c): string {
  const style = mode === "file"
    ? `<style>.h{font:600 12px sans-serif;fill:#5b6475}.n rect{fill:#fff;stroke:#c9cfda}.n text{font:12px sans-serif;fill:#14171f}.f{font:10px sans-serif;fill:#a15c07}.e{fill:none;stroke:#8aa1d8;opacity:.6}.e.x{stroke:#b42318;opacity:.85;stroke-dasharray:5 3}.bg{fill:#fff}</style><rect class="bg" width="100%" height="100%"/>`
    : "";
  const edges = layout.edges.map((e) =>
    `<path class="e${e.crossBorder ? " x" : ""}" d="${e.d}" stroke-width="${e.sw}"><title>${esc(e.activities.join(", "))}${e.categories.length ? ` | ${esc(e.categories.map(labelOf).join(", "))}` : ""}${e.crossBorder ? " | cross-border" : ""}</title></path>`).join("");
  const nodes = layout.nodes.map((n) =>
    `<g class="n"><rect x="${n.x}" y="${n.y}" width="${NW}" height="${NH}" rx="8"/><text x="${n.x + 10}" y="${n.y + (n.flags.length ? 16 : 24)}">${esc(clip(n.label, 24))}</text>${n.flags.length ? `<text class="f" x="${n.x + 10}" y="${n.y + 30}">${esc(n.flags.join(" · "))}</text>` : ""}<title>${esc(n.label)}: ${esc(n.activities.join(", "))}</title></g>`).join("");
  const heads = layout.headers.map((h) => `<text class="h" x="${h.x}" y="22">${esc(h.label)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" role="img" aria-label="Data flow diagram">${style}${heads}${edges}${nodes}</svg>`;
}
