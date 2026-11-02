// Phase 30: exports for drafted documents, all built from the text on screen (including the user's edits).
// PDF with jspdf (wrapped text, page numbers), Word with the docx package (real headings and bold, not an HTML file
// renamed .doc). Both libraries load only when an export is asked for.
import { type Block, type Inline, inlineText, parseMarkdown } from '@/lib/legalMarkdown';

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s-]+/g, '_').replace(/_+/g, '_').slice(0, 40);

/** "<type>_<other-party>_<date>", e.g. service_agreement_beta_client_plc_2026-11-01 (no other party: left out). */
export function documentFileName(docType: string, otherParty: string | undefined, date: Date, ext: string): string {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const parts = [slug(docType) || 'document', otherParty ? slug(otherParty) : '', day].filter(Boolean);
  return `${parts.join('_')}.${ext}`;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const markdownBlob = (markdown: string) => new Blob([markdown], { type: 'text/markdown;charset=utf-8' });

const HEADING_SIZE: Record<number, number> = { 1: 18, 2: 14, 3: 12, 4: 11 };

export async function buildPdf(markdown: string, title: string): Promise<Blob> {
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF({ unit: 'pt', format: 'a4' });
  doc.setProperties({ title });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56; const bottom = pageH - 56;
  let y = margin;
  const write = (text: string, opts: { size?: number; bold?: boolean; indent?: number; gap?: number; prefix?: string } = {}) => {
    const size = opts.size ?? 10.5;
    const indent = opts.indent ?? 0;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lh = size * 1.35;
    const prefixW = opts.prefix ? doc.getTextWidth(`${opts.prefix} `) : 0;
    const lines = doc.splitTextToSize(text, pageW - margin * 2 - indent - prefixW) as string[];
    lines.forEach((line, i) => {
      if (y + lh > bottom) { doc.addPage(); y = margin; }
      if (i === 0 && opts.prefix) doc.text(opts.prefix, margin + indent, y);
      doc.text(line, margin + indent + prefixW, y);
      y += lh;
    });
    y += opts.gap ?? 6;
  };
  // Phase 30d: tables (cookie lists, retention schedules) as a simple grid: equal columns, wrapped cells, rows that
  // move to the next page whole (a row taller than a page is split line by line).
  const writeTable = (header: Inline[][] | null, rows: Inline[][][]) => {
    const size = 9; const lh = size * 1.3; const pad = 4;
    const cols = Math.max(1, (header ?? rows[0] ?? []).length);
    const colW = (pageW - margin * 2) / cols;
    const drawRow = (row: Inline[][], bold: boolean) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
      const wrapped = row.map((c) => doc.splitTextToSize(inlineText(c), colW - pad * 2) as string[]);
      const lines = Math.max(1, ...wrapped.map((w) => w.length));
      const h = lines * lh + pad * 2;
      if (y + h > bottom && h <= bottom - margin) { doc.addPage(); y = margin; }
      const top = y;
      for (let li = 0; li < lines; li++) {
        if (y + lh > bottom) { doc.addPage(); y = margin; }
        wrapped.forEach((w, ci) => { if (w[li]) doc.text(w[li], margin + ci * colW + pad, y + pad + size); });
        y += lh;
      }
      y += pad * 2;
      if (y > top) for (let ci = 0; ci <= cols; ci++) doc.line(margin + ci * colW, top, margin + ci * colW, y);
      doc.line(margin, top, margin + cols * colW, top);
      doc.line(margin, y, margin + cols * colW, y);
    };
    doc.setDrawColor(180);
    if (header) drawRow(header, true);
    rows.forEach((r) => drawRow(r, false));
    y += 8;
  };
  for (const b of parseMarkdown(markdown)) {
    if (b.type === 'heading') write(inlineText(b.inlines), { size: HEADING_SIZE[b.level], bold: true, gap: 8 });
    else if (b.type === 'rule') y += 8;
    else if (b.type === 'table') writeTable(b.header, b.rows);
    else if (b.type === 'clause') {
      const bold = b.inlines.length > 0 && b.inlines.every((i) => i.bold);
      write(inlineText(b.inlines), { indent: b.depth * 16, prefix: b.number, bold });
    } else if (b.type === 'bullet') write(inlineText(b.inlines), { indent: 8, prefix: '•' });
    else write(inlineText(b.inlines), { indent: b.type === 'quote' ? 12 : 0 });
  }
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text(`Page ${p} of ${pages}`, pageW / 2, pageH - 28, { align: 'center' });
  }
  return doc.output('blob');
}

export async function buildDocx(markdown: string, title: string): Promise<Blob> {
  const { AlignmentType, Document, Footer, HeadingLevel, Packer, PageNumber, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import('docx');
  const runs = (inlines: Inline[]) => inlines.map((i) => new TextRun({ text: i.text, bold: i.bold, italics: i.italic, highlight: i.placeholder ? 'yellow' : undefined }));
  const HEADINGS = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4 } as const;
  const paragraph = (b: Block) => {
    switch (b.type) {
      case 'heading': return new Paragraph({ heading: HEADINGS[b.level], children: runs(b.inlines) });
      case 'clause': return new Paragraph({ indent: { left: 360 * b.depth }, spacing: { after: 120 }, children: [new TextRun({ text: `${b.number}\t` }), ...runs(b.inlines)] });
      case 'bullet': return new Paragraph({ bullet: { level: 0 }, children: runs(b.inlines) });
      case 'quote': return new Paragraph({ indent: { left: 360 }, children: runs(b.inlines) });
      case 'rule': return new Paragraph({ children: [] });
      case 'table': {
        if (!b.header && !b.rows.length) return new Paragraph({ children: [] });
        const row = (cellsOf: Inline[][], header: boolean) => new TableRow({
          tableHeader: header,
          children: cellsOf.map((c) => new TableCell({ children: [new Paragraph({ children: runs(header ? c.map((i) => ({ ...i, bold: true })) : c) })] })),
        });
        return new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [...(b.header ? [row(b.header, true)] : []), ...b.rows.map((r) => row(r, false))],
        });
      }
      default: return new Paragraph({ spacing: { after: 120 }, children: runs(b.inlines) });
    }
  };
  const doc = new Document({
    title,
    sections: [{
      footers: {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES] })] })],
        }),
      },
      children: parseMarkdown(markdown).map(paragraph),
    }],
  });
  return Packer.toBlob(doc);
}
