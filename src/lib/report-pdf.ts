import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportModel } from "./report";

// jsPDF's built-in fonts cover Latin-1 only. Map common typography, replace anything else.
export function pdfSafe(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...")
    .replace(/\u2192/g, "->").replace(/\u2265/g, ">=").replace(/\u2264/g, "<=").replace(/\u20B9/g, "Rs ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "?");
}

const NAVY: [number, number, number] = [31, 58, 138];

export function renderPdf(m: ReportModel): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 48, CW = W - 2 * M;
  const last = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Cover
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 190, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(26);
  doc.text("DPDPA Implementation Assessment", M, 110);
  doc.setFont("helvetica", "normal"); doc.setFontSize(15);
  doc.text(doc.splitTextToSize(pdfSafe(m.orgName), CW), M, 145);
  doc.setTextColor(20, 23, 31); doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text(`Overall control score: ${m.score}%`, M, 260);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(91, 100, 117);
  doc.text(`Generated ${m.generatedOn}  |  Control library ${pdfSafe(m.libLabel)}`, M, 284);
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(pdfSafe(m.disclaimer), CW), M, H - 130);

  doc.addPage();
  let y = M;
  const ensure = (need: number) => { if (y + need > H - 56) { doc.addPage(); y = M; } };

  m.sections.forEach((s, i) => {
    ensure(70);
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...NAVY);
    doc.text(pdfSafe(`${i + 1}. ${s.title}`), M, y); y += 22;
    doc.setTextColor(20, 23, 31);
    for (const b of s.blocks) {
      if (b.kind === "p") {
        doc.setFont("helvetica", "normal"); doc.setFontSize(10);
        const lines = doc.splitTextToSize(pdfSafe(b.text), CW);
        ensure(lines.length * 13 + 6); doc.text(lines, M, y); y += lines.length * 13 + 6;
      } else if (b.kind === "bullets") {
        doc.setFont("helvetica", "normal"); doc.setFontSize(10);
        for (const t of b.items) {
          const lines = doc.splitTextToSize(pdfSafe(t), CW - 14);
          ensure(lines.length * 13 + 3); doc.text("-", M, y); doc.text(lines, M + 14, y); y += lines.length * 13 + 3;
        }
        y += 4;
      } else {
        const widths = b.kind === "table" ? b.widths : [0.32, 0.68];
        const head = b.kind === "table" ? [b.head.map(pdfSafe)] : undefined;
        const body = (b.kind === "table" ? b.rows : b.rows.map(([k, v]) => [k, v])).map((r) => r.map(pdfSafe));
        autoTable(doc, {
          startY: y, head, body, margin: { left: M, right: M }, theme: "grid",
          styles: { fontSize: 8, cellPadding: 4, lineColor: [201, 207, 218], lineWidth: 0.5, overflow: "linebreak" },
          headStyles: { fillColor: NAVY, textColor: 255 },
          columnStyles: widths && widths.length === (head?.[0].length ?? 2)
            ? Object.fromEntries(widths.map((f, idx) => [idx, { cellWidth: f * CW, ...(b.kind === "kv" && idx === 0 ? { fontStyle: "bold" as const } : {}) }])) : undefined,
        });
        y = last() + 14;
      }
    }
    y += 6;
  });

  const pages = doc.getNumberOfPages();
  for (let p = 2; p <= pages; p++) {
    doc.setPage(p); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 128, 140);
    doc.text(pdfSafe(`${m.orgName} | DPDPA assessment | Page ${p - 1} of ${pages - 1}`), W / 2, H - 28, { align: "center" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
