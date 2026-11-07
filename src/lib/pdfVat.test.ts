// HMRC P4 follow-up: the downloaded / emailed invoice PDF prints VAT per treatment for a recorded invoice, read back
// from the real jsPDF page content. Not-recorded invoices and quotes keep the single tax line.
import { describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { drawDocumentPdf, renderDocumentPdf, type RenderableDocument } from './documentTemplates';
import { addToNet, fromPence, isRecordedInvoice, lineNetPence, VAT_RATES, type VatTreatment } from '@/lib/vat';

/** The text drawn on each page (jsPDF keeps every page's content stream in pdf.internal.pages). */
function pageTexts(pdf: jsPDF): string[][] {
  const pages = (pdf.internal as unknown as { pages: (string[] | null)[] }).pages;
  const unescape = (s: string) => s.replace(/\\([()\\])/g, '$1').replace(/\\(\d{3})/g, (_m, o) => String.fromCharCode(parseInt(o, 8)));
  return pages.slice(1).map((lines) => (lines ?? []).join('\n').match(/\((?:\\.|[^\\)])*\) Tj/g)?.map((t) => unescape(t.slice(1, -4))) ?? []);
}
const allText = (pdf: jsPDF) => pageTexts(pdf).flat();

/** A recorded invoice built with the shared P4 maths (VAT per line, rounded, then summed), as the invoice form saves it. */
function recorded(lines: [string, number, number, VatTreatment][]): RenderableDocument {
  const items = lines.map(([description, quantity, rate, t]) => {
    const s = addToNet(lineNetPence(quantity, rate), t);
    return { description, quantity, rate, amount: fromPence(s.net), vat_treatment: t, vat_rate: VAT_RATES[t], net: fromPence(s.net), vat: fromPence(s.vat), gross: fromPence(s.gross) };
  });
  const pence = (k: 'net' | 'vat' | 'gross') => items.reduce((n, i) => n + Math.round(i[k] * 100), 0);
  const doc: RenderableDocument = {
    type: 'invoice', number: 'INV-9', company_name: 'Acme Trading Ltd', client_name: 'Priya Shah', items, status: 'sent',
    subtotal: fromPence(pence('net')), tax_amount: fromPence(pence('vat')), total_amount: fromPence(pence('gross')), tax_rate: 0,
    vat_status: 'recorded', tax_point_date: '2026-11-07',
  };
  expect(isRecordedInvoice(doc)).toBe(true);
  return doc;
}

describe('invoice PDF: VAT per treatment', () => {
  it('a recorded mixed-rate invoice: each treatment with net, VAT and gross; totals equal the stored values; the tax point', () => {
    const doc = recorded([['Consulting', 3, 19.99, 'standard'], ['Fuel', 1, 10.1, 'reduced'], ['Books', 1, 10.1, 'zero']]);
    const text = allText(drawDocumentPdf(doc, 'classic', 'GBP'));
    expect(text).toEqual(expect.arrayContaining(['Standard 20%', 'Net £59.97', 'VAT £11.99 · Gross £71.96']));
    expect(text).toEqual(expect.arrayContaining(['Reduced 5%', 'Net £10.10', 'VAT £0.51 · Gross £10.61']));
    expect(text).toEqual(expect.arrayContaining(['Zero rate', 'VAT £0.00 · Gross £10.10']));
    expect(text).toEqual(expect.arrayContaining(['Subtotal', '£80.17', 'VAT total', '£12.50', 'TOTAL', '£92.67']));
    expect(text).toEqual(expect.arrayContaining(['Tax point', '7 Nov 2026']));
    expect(text).not.toContain('Exempt');
    expect(text.some((t) => t.startsWith('Tax ('))).toBe(false);
  });

  it('zero, exempt and outside scope are shown separately, each with 0 VAT', () => {
    const doc = recorded([['A', 1, 5, 'zero'], ['B', 1, 6, 'exempt'], ['C', 1, 7, 'outside_scope']]);
    const text = allText(drawDocumentPdf(doc, 'modern', 'GBP'));
    expect(text).toEqual(expect.arrayContaining(['Zero rate', 'Exempt', 'Outside scope', 'VAT £0.00 · Gross £5.00', 'VAT £0.00 · Gross £6.00', 'VAT £0.00 · Gross £7.00']));
    expect(text).toEqual(expect.arrayContaining(['VAT total', '£0.00', '£18.00']));
  });

  it('an invoice that is not recorded keeps the single tax line; nothing is worked out for it', () => {
    const old: RenderableDocument = { type: 'invoice', number: 'INV-1', items: [{ description: 'Old', quantity: 1, rate: 100, amount: 100 }], subtotal: 100, tax_rate: 20, tax_amount: 20, total_amount: 120, vat_status: 'not_recorded', tax_point_date: null };
    const text = allText(drawDocumentPdf(old, 'classic', 'GBP'));
    expect(text).toEqual(expect.arrayContaining(['Tax (20%)', '£20.00', '£120.00']));
    expect(text).not.toContain('VAT total');
    expect(text).not.toContain('Standard 20%');
    expect(text).not.toContain('Tax point');
  });

  it('a quote keeps its single tax line even if its lines look like VAT lines', () => {
    const q = { ...recorded([['Work', 1, 100, 'standard']]), type: 'quote' as const, tax_rate: 20 };
    const text = allText(drawDocumentPdf(q, 'classic', 'GBP'));
    expect(text).toContain('Tax (20%)');
    expect(text).not.toContain('VAT total');
    expect(text).not.toContain('Tax point');
  });

  it('five treatments and a long item list: the whole totals block stays on one page, above the footer', () => {
    const lines: [string, number, number, VatTreatment][] = [];
    const ts: VatTreatment[] = ['standard', 'reduced', 'zero', 'exempt', 'outside_scope'];
    for (let i = 0; i < 37; i++) lines.push([`Item ${i + 1} with a fairly long description to wrap`, 1, 10 + i, ts[i % 5]]);
    const pdf = drawDocumentPdf(recorded(lines), 'bold', 'GBP');
    const pages = pageTexts(pdf);
    expect(pages.length).toBeGreaterThan(1);
    const withTotal = pages.findIndex((p) => p.includes('TOTAL'));
    for (const label of ['Subtotal', 'Standard 20%', 'Reduced 5%', 'Zero rate', 'Exempt', 'Outside scope', 'VAT total']) {
      expect(pages[withTotal]).toContain(label);
    }
    // Nothing of the totals is drawn below 280 mm (the footer is at 288 mm).
    const content = ((pdf.internal as unknown as { pages: string[][] }).pages[withTotal + 1]).join('\n');
    const m = /([\d.]+) ([\d.]+) Td\n\(TOTAL\) Tj/.exec(content)!;
    expect(297 - (Number(m[2]) * 25.4) / 72).toBeLessThan(282);
  });

  it('the logo still draws on a recorded invoice', async () => {
    const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const bytes = Uint8Array.from(atob(PNG), (c) => c.charCodeAt(0));
    const fetchImpl = vi.fn(async () => ({ ok: true, headers: new Headers(), arrayBuffer: async () => bytes.slice().buffer })) as unknown as typeof fetch;
    const addImage = vi.spyOn(jsPDF.API as unknown as { addImage: (...a: unknown[]) => unknown }, 'addImage');
    const pdf = await renderDocumentPdf({ ...recorded([['Work', 1, 100, 'standard']]), logo_url: 'https://cdn.test/logo.png' }, 'classic', 'GBP', { fetchImpl });
    expect(addImage).toHaveBeenCalledTimes(1);
    expect(allText(pdf)).toContain('Standard 20%');
    addImage.mockRestore();
  });
});
