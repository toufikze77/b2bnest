// HMRC P5: the nine boxes from the preview function's totals (pence inside; boxes 6 to 9 whole pounds, rounded down).
import { describe, expect, it } from 'vitest';
import { BOX_NUMBERS, computeReturnBoxes, explainBox, formatBox, returnPreviewCsv, wholePounds, type PreviewRow } from './returnBoxes';
import { VAT_RETURN_RULES, WHOLE_POUND_ROUNDING } from './returnRules';

const inc = (source: string, treatment: string, records: number, net: number | string, vat: number | string, nr: number | string = 0): PreviewRow =>
  ({ row_kind: 'included', source, treatment, reason: null, records, net, vat, vat_not_reclaimable: nr });
const out = (source: string, reason: string, records: number, nr = 0): PreviewRow =>
  ({ row_kind: 'left_out', source, treatment: null, reason, records, net: 0, vat: 0, vat_not_reclaimable: nr });

// The worked example in docs/hmrc-p5/README.md.
const example: PreviewRow[] = [
  inc('invoices', 'standard', 1, 1000, 200), inc('invoices', 'reduced', 1, 100, 5), inc('invoices', 'zero', 1, 50, 0), inc('invoices', 'outside_scope', 1, 300, 0),
  inc('expenses', 'standard', 2, '450.00', '60.00', '30.00'),
  out('expenses', 'vat_not_reclaimable', 1, 30), out('invoices', 'not_recorded', 2), out('bills', 'no_company', 1), out('invoices', 'not_gbp', 0),
];

describe('computeReturnBoxes', () => {
  it('the worked example: boxes 1 to 9', () => {
    const b = computeReturnBoxes(example);
    expect(b.box1).toBe(20500); // 200 + 5
    expect(b.box2).toBe(0);
    expect(b.box3).toBe(20500); // 1 + 2
    expect(b.box4).toBe(6000); // reclaimable VAT only
    expect(b.box5).toBe(14500);
    expect(b.netDirection).toBe('to_pay');
    expect(b.box6).toBe(1150); // 1000 + 100 + 50; outside scope (300) left out
    expect(b.box7).toBe(450); // includes the purchase whose VAT is not reclaimable
    expect(b.box8).toBe(0);
    expect(b.box9).toBe(0);
    expect(b.included).toEqual({ sales: 4, purchases: 2 });
    expect(b.leftOut).toEqual([
      { reason: 'vat_not_reclaimable', source: 'expenses', records: 1, vat: 3000 },
      { reason: 'not_recorded', source: 'invoices', records: 2, vat: 0 },
      { reason: 'no_company', source: 'bills', records: 1, vat: 0 },
    ]); // a zero count is not listed
  });

  it('box 3 = box 1 + box 2; box 5 = box 3 - box 4 as a positive figure with to-pay / to-reclaim', () => {
    const reclaim = computeReturnBoxes([inc('invoices', 'standard', 1, 100, 20), inc('bills', 'standard', 1, 500, 100)]);
    expect(reclaim.box3).toBe(reclaim.box1 + reclaim.box2);
    expect(reclaim.box5).toBe(8000);
    expect(reclaim.netDirection).toBe('to_reclaim');
    expect(computeReturnBoxes([inc('invoices', 'standard', 1, 100, 20), inc('bills', 'standard', 1, 100, 20)]).netDirection).toBe('nil');
    expect(computeReturnBoxes([]).box5).toBe(0);
  });

  it('boxes 6 and 7 are whole pounds, pence rounded down; zero-rated and exempt count, outside scope does not', () => {
    expect(WHOLE_POUND_ROUNDING).toBe('down');
    expect(wholePounds(99)).toBe(0);
    expect(wholePounds(12399)).toBe(123);
    const b = computeReturnBoxes([inc('invoices', 'zero', 1, '10.99', 0), inc('invoices', 'exempt', 1, '20.99', 0), inc('invoices', 'outside_scope', 1, 1000, 0),
      inc('bills', 'reduced', 1, '33.33', '1.67'), inc('expenses', 'outside_scope', 1, 500, 0)]);
    expect(b.box6).toBe(31); // 31.98 down to 31
    expect(b.box7).toBe(33); // 33.33 down to 33; outside scope left out
    expect(b.box4).toBe(167);
    expect(b.box1).toBe(0);
  });

  it('sums money exactly in pence (no floating-point drift)', () => {
    const rows = Array.from({ length: 10 }, () => inc('invoices', 'standard', 1, '0.10', '0.02'));
    const b = computeReturnBoxes(rows);
    expect(b.sales[0]).toMatchObject({ records: 10, net: 100, vat: 20 });
    expect(b.box1).toBe(20);
  });

  it('expenses and bills add up per treatment; unknown treatments are ignored', () => {
    const b = computeReturnBoxes([inc('expenses', 'standard', 1, 10, 2), inc('bills', 'standard', 2, 20, 4), inc('bills', 'luxury', 1, 99, 9)]);
    expect(b.purchases).toEqual([{ treatment: 'standard', records: 3, net: 3000, vat: 600, vatNotReclaimable: 0 }]);
  });
});

describe('explanations, formatting and CSV', () => {
  it('every box has a one-line explanation; the rules are all marked not verified', () => {
    for (const n of BOX_NUMBERS) expect(explainBox(n)).toMatch(new RegExp(`^Box ${n} = `));
    expect(explainBox(1)).toBe('Box 1 = VAT on standard and reduced sales lines recorded in this period.');
    expect(VAT_RETURN_RULES.every((r) => r.verified === false)).toBe(true);
  });
  it('boxes 1 to 5 in pounds and pence, 6 to 9 in whole pounds', () => {
    expect(formatBox(1, 123456)).toBe('1,234.56');
    expect(formatBox(6, 1234)).toBe('1,234');
  });
  it('the CSV has the nine boxes and the per-treatment totals, and no individual record', () => {
    const csv = returnPreviewCsv(computeReturnBoxes(example), { from: '2026-10-01', to: '2026-12-31' });
    expect(csv).toContain('Period,2026-10-01,2026-12-31');
    expect(csv).toContain('1,VAT due on sales,205.00');
    expect(csv).toContain('5,Net VAT (to pay),145.00');
    expect(csv).toContain('6,"Total value of sales, excluding VAT",1150');
    expect(csv).toContain('sales,Outside scope,1,300.00,0.00,0.00');
    expect(csv).toContain('purchases,Standard 20%,2,450.00,60.00,30.00');
    expect(csv.split('\n').filter((l) => /^\d,/.test(l))).toHaveLength(9);
    expect(csv).toContain('(preview only: nothing is sent to HMRC');
    expect(csv).not.toMatch(/ready to file/i);
  });
});
