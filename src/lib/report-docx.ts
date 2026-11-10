import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, Packer, PageNumber, Paragraph, ShadingType,
  Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType, type FileChild,
} from "docx";
import type { Block, ReportModel } from "./report";

const TOTAL = 9026; // A4 portrait, 1 inch margins, in twentieths of a point
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "C9CFDA" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NAVY = "1F3A8A";

function cell(text: string, w: number, header: boolean, bold = false) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: BORDERS,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    shading: header ? { type: ShadingType.CLEAR, fill: NAVY, color: "auto" } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, bold: header || bold, color: header ? "FFFFFF" : undefined, size: 18 })] })],
  });
}

function table(head: string[] | null, rows: string[][], widths?: number[]) {
  const n = head?.length ?? 2;
  const frac = widths && widths.length === n ? widths : Array(n).fill(1 / n);
  const cols = frac.map((f) => Math.round(f * TOTAL));
  const body = rows.map((r) => new TableRow({ cantSplit: true, children: cols.map((w, i) => cell(r[i] ?? "", w, false, !head && i === 0)) }));
  return new Table({
    width: { size: TOTAL, type: WidthType.DXA }, columnWidths: cols, layout: TableLayoutType.FIXED,
    rows: [...(head ? [new TableRow({ tableHeader: true, children: cols.map((w, i) => cell(head[i], w, true)) })] : []), ...body],
  });
}

function blocks(bs: Block[]): FileChild[] {
  const out: FileChild[] = [];
  for (const b of bs) {
    if (b.kind === "p") out.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: b.text, size: 21 })] }));
    else if (b.kind === "bullets") for (const t of b.items) out.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: t, size: 21 })] }));
    else if (b.kind === "table") { out.push(table(b.head, b.rows, b.widths)); out.push(new Paragraph({ spacing: { after: 160 }, children: [] })); }
    else { out.push(table(null, b.rows.map(([k, v]) => [k, v]), [0.32, 0.68])); out.push(new Paragraph({ spacing: { after: 160 }, children: [] })); }
  }
  return out;
}

export async function renderDocx(m: ReportModel): Promise<Buffer> {
  const cover: FileChild[] = [
    new Paragraph({ spacing: { before: 3000 }, children: [] }),
    new Paragraph({ children: [new TextRun({ text: "DPDPA Implementation Assessment", bold: true, size: 56, color: NAVY })] }),
    new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: m.orgName, size: 36 })] }),
    new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: `Overall control score: ${m.score}%`, size: 28, bold: true })] }),
    new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: `Generated ${m.generatedOn} · Control library ${m.libLabel}`, size: 22, color: "5B6475" })] }),
    new Paragraph({ spacing: { before: 3000 }, children: [new TextRun({ text: m.disclaimer, size: 18, italics: true, color: "5B6475" })] }),
  ];
  const body: FileChild[] = m.sections.flatMap((s, i) => [
    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 140 }, children: [new TextRun({ text: `${i + 1}. ${s.title}`, bold: true, size: 30, color: NAVY })] }),
    ...blocks(s.blocks),
  ]);
  const doc = new Document({
    creator: "DPDPA Compliance Platform",
    title: `DPDPA Implementation Assessment - ${m.orgName}`,
    styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
    sections: [
      { properties: { page: { size: { width: 11906, height: 16838 } } }, children: cover },
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1440, right: 1440 } } },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [`${m.orgName} · DPDPA assessment · Page `, PageNumber.CURRENT], size: 16, color: "5B6475" })] })] }) },
        children: body,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
