// Phase 30d: a full-length (3,000+ word) document renders on screen and exports to PDF and Word without breaking:
// headings, nested numbering, (a) lists, a table, placeholders, long PDF pagination with page numbers.
import { inflateRawSync } from 'node:zlib';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LegalMarkdown from '@/components/legal/LegalMarkdown';
import { buildDocx, buildPdf } from '@/lib/legalExport';
import { parseMarkdown } from '@/lib/legalMarkdown';

const NOT_LEGAL_ADVICE = 'This document was drafted with AI from the details provided. It is not legal advice. Have it checked by a qualified solicitor before you rely on it.';
const sentence = 'The Supplier shall perform the Services with reasonable skill and care and in accordance with good industry practice in the United Kingdom.';

function longDocument(clauses = 30): string {
  const parts = ['# Service Agreement', '', 'This agreement is dated [Date] between [Supplier] (company number [Company number]) and Beta Client plc.', ''];
  for (let c = 1; c <= clauses; c++) {
    parts.push(`## ${c}. **Clause ${c} heading**`, '');
    for (let s = 1; s <= 4; s++) parts.push(`${c}.${s} ${sentence} Payment is due within [30 days: confirm].`);
    parts.push(`${c}.4.1 ${sentence}`, `(a) ${sentence}`, `(b) ${sentence}`, '');
  }
  parts.push('## Schedule 1: retention', '', '| Record | Period | Reason |', '|---|---|---|',
    '| Invoices | 6 years [confirm] | HMRC requirements for business records |', '| Contracts | 6 years after the end | Limitation period |', '');
  parts.push('Signed by [Name], [Position], for and on behalf of [Supplier]: ______________ Date: [Date]', '', NOT_LEGAL_ADVICE);
  return parts.join('\n');
}

const DOC = longDocument();
const words = DOC.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;

const bytes = (b: Blob) => new Promise<Uint8Array>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
  r.onerror = () => reject(r.error);
  r.readAsArrayBuffer(b);
});

/** Reads one file out of a zip (local file headers; what docx writes). */
function unzipEntry(zip: Uint8Array, name: string): string {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let i = 0;
  while (i + 30 < zip.length && view.getUint32(i, true) === 0x04034b50) {
    const method = view.getUint16(i + 8, true);
    const size = view.getUint32(i + 18, true);
    const nameLen = view.getUint16(i + 26, true);
    const extraLen = view.getUint16(i + 28, true);
    const entry = new TextDecoder().decode(zip.subarray(i + 30, i + 30 + nameLen));
    const start = i + 30 + nameLen + extraLen;
    if (entry === name) {
      const data = zip.subarray(start, start + size);
      return new TextDecoder().decode(method === 8 ? inflateRawSync(data) : data);
    }
    i = start + size;
  }
  throw new Error(`${name} not found`);
}

describe('a 3,000-word document', () => {
  it('is really that long', () => {
    expect(words).toBeGreaterThan(3000);
  });

  it('parses: headings, nested numbering, (a) lists and a table', () => {
    const blocks = parseMarkdown(DOC);
    expect(blocks.filter((b) => b.type === 'heading')).toHaveLength(32);
    const clauses = blocks.filter((b) => b.type === 'clause');
    expect(clauses).toHaveLength(30 * 7);
    expect(clauses.find((b) => b.type === 'clause' && b.number === '30.4.1')).toMatchObject({ depth: 2 });
    const table = blocks.find((b) => b.type === 'table');
    expect(table).toMatchObject({ type: 'table' });
    if (table?.type === 'table') {
      expect(table.header?.map((c) => c.map((i) => i.text).join(''))).toEqual(['Record', 'Period', 'Reason']);
      expect(table.rows).toHaveLength(2);
      expect(table.rows[0][1].some((i) => i.placeholder && i.text === '[confirm]')).toBe(true);
    }
    expect(blocks.at(-1)).toMatchObject({ type: 'paragraph' });
  });

  it('renders every clause, the table and the last line', () => {
    const { container } = render(<LegalMarkdown markdown={DOC} />);
    expect(container.querySelectorAll('h2')).toHaveLength(1);
    expect(container.querySelectorAll('h3')).toHaveLength(31);
    expect(container.textContent).toContain('30.4.1');
    expect(container.querySelectorAll('table th')).toHaveLength(3);
    expect(container.querySelectorAll('table tbody tr')).toHaveLength(2);
    expect(container.textContent).not.toContain('|---|');
    expect(container.querySelectorAll('mark[data-placeholder]').length).toBeGreaterThan(60);
    expect(container.textContent?.trimEnd().endsWith(NOT_LEGAL_ADVICE)).toBe(true);
  });

  it('PDF: many pages, every page numbered "Page n of N", the last clause and the table on the last pages', async () => {
    const pdf = new TextDecoder('latin1').decode(await bytes(await buildPdf(DOC, 'Service Agreement')));
    expect(pdf.startsWith('%PDF')).toBe(true);
    const totals = [...pdf.matchAll(/Page (\d+) of (\d+)/g)];
    const pages = Number(totals[0][2]);
    expect(pages).toBeGreaterThanOrEqual(8);
    expect(totals).toHaveLength(pages);
    expect(totals.map((m) => Number(m[1]))).toEqual(Array.from({ length: pages }, (_, i) => i + 1));
    expect(pdf).toContain('30.4.1');
    expect(pdf).toContain('Invoices');
    expect(pdf).toContain('qualified solicitor');
  });

  it('Word: the document XML holds the last clause, a real table and the final line', async () => {
    const zip = await bytes(await buildDocx(DOC, 'Service Agreement'));
    expect([zip[0], zip[1]]).toEqual([0x50, 0x4b]);
    const xml = unzipEntry(zip, 'word/document.xml');
    expect(xml).toContain('30.4.1');
    expect(xml).toContain('<w:tbl>');
    expect((xml.match(/<w:tr[ >]/g) ?? []).length).toBe(3);
    expect(xml).toContain('qualified solicitor');
    expect(xml).toContain('Heading2');
  });
});
