// HMRC P4: VAT money maths in pence. Hand-worked examples.
import { describe, expect, it } from 'vitest';
import {
  addToNet, fromPence, isRecorded, isRecordedInvoice, isRecordedMoneyOut, lineNetPence, splitFromGross, sumLines, toPence, treatmentsIn,
  VAT_RATES, VAT_TREATMENTS, vatOnNet, vatProblem,
} from '@/lib/vat';

describe('pence', () => {
  it('toPence is exact for money and never uses floating sums', () => {
    expect(toPence('12.34')).toBe(1234);
    expect(toPence(0.1 + 0.2)).toBe(30);
    expect(toPence(19.99)).toBe(1999);
    expect(toPence('-3.5')).toBe(-350);
    expect(toPence('1.005')).toBe(101);
    expect(toPence('')).toBe(0);
    expect(Number.isNaN(toPence('abc'))).toBe(true);
    expect(fromPence(1999)).toBe(19.99);
  });
});

describe('VAT per treatment', () => {
  it('rates come from one place', () => {
    expect(VAT_RATES).toEqual({ standard: 20, reduced: 5, zero: 0, exempt: 0, outside_scope: 0 });
    expect(VAT_TREATMENTS).toHaveLength(5);
  });
  it('addToNet rounds half away from zero to the penny', () => {
    expect(addToNet(10000, 'standard')).toEqual({ net: 10000, vat: 2000, gross: 12000, rate: 20, treatment: 'standard' });
    expect(addToNet(3, 'standard').vat).toBe(1); // 0.6p -> 1p
    expect(addToNet(2, 'standard').vat).toBe(0); // 0.4p -> 0p
    expect(addToNet(10, 'reduced').vat).toBe(1); // 0.5p -> 1p (half up)
    expect(addToNet(-10, 'reduced').vat).toBe(-1); // credit line: half away from zero
    expect(addToNet(999, 'reduced')).toMatchObject({ vat: 50, gross: 1049 });
  });
  it('splitFromGross for each treatment', () => {
    expect(splitFromGross(12000, 'standard')).toMatchObject({ net: 10000, vat: 2000 });
    expect(splitFromGross(100, 'standard')).toMatchObject({ net: 83, vat: 17 }); // 16.67p -> 17p
    expect(splitFromGross(1050, 'reduced')).toMatchObject({ net: 1000, vat: 50 });
    expect(splitFromGross(1999, 'standard')).toMatchObject({ net: 1666, vat: 333 }); // 333.17 -> 333
    for (const t of ['zero', 'exempt', 'outside_scope'] as const) {
      expect(splitFromGross(1234, t)).toEqual({ net: 1234, vat: 0, gross: 1234, rate: 0, treatment: t });
      expect(addToNet(1234, t).vat).toBe(0);
    }
  });
  it('zero, exempt and outside scope all give 0 VAT but stay distinct groups', () => {
    const t = sumLines([{ treatment: 'zero', netPence: 100 }, { treatment: 'exempt', netPence: 200 }, { treatment: 'outside_scope', netPence: 300 }]);
    expect(t.vat).toBe(0);
    expect(treatmentsIn(t)).toEqual(['zero', 'exempt', 'outside_scope']);
    expect(t.byTreatment).toEqual({ zero: { net: 100, vat: 0, gross: 100 }, exempt: { net: 200, vat: 0, gross: 200 }, outside_scope: { net: 300, vat: 0, gross: 300 } });
  });
});

describe('invoices: per line, then summed', () => {
  it('mixed-rate invoice reconciles exactly', () => {
    const t = sumLines([
      { treatment: 'standard', netPence: 3 }, { treatment: 'standard', netPence: 3 }, // 0.6p each -> 1p each
      { treatment: 'reduced', netPence: 1010 }, { treatment: 'zero', netPence: 500 }, { treatment: 'exempt', netPence: 200 },
    ]);
    expect(t).toMatchObject({ net: 1716, vat: 53, gross: 1769 });
    expect(t.byTreatment.standard).toEqual({ net: 6, vat: 2, gross: 8 }); // not round(6 x 20%) = 1
    expect(t.lines.reduce((s, l) => s + l.vat, 0)).toBe(t.vat);
    expect(t.lines.reduce((s, l) => s + l.gross, 0)).toBe(t.gross);
  });
  it('line net is quantity x unit price, to the penny', () => {
    expect(lineNetPence(3, '19.99')).toBe(5997);
    expect(lineNetPence(0.5, '0.05')).toBe(3); // 2.5p -> 3p
    expect(lineNetPence('1.25', 10)).toBe(1250);
  });
  it('isRecordedInvoice needs a tax point and exact line and document totals', () => {
    const line = (t: string, net: number, vat: number, rate: number) => ({ vat_treatment: t, vat_rate: rate, net, vat, gross: Math.round((net + vat) * 100) / 100 });
    const doc = { vat_status: 'recorded', tax_point_date: '2026-11-07', items: [line('standard', 100, 20, 20), line('zero', 5, 0, 0)], subtotal: 105, tax_amount: 20, total_amount: 125 };
    expect(isRecordedInvoice(doc)).toBe(true);
    expect(isRecorded(doc, 'invoice')).toBe(true);
    expect(isRecordedInvoice({ ...doc, tax_point_date: null })).toBe(false);
    expect(isRecordedInvoice({ ...doc, tax_amount: 20.01 })).toBe(false);
    expect(isRecordedInvoice({ ...doc, items: [line('standard', 100, 19, 20)] })).toBe(false);
    expect(isRecordedInvoice({ subtotal: 100, tax_amount: 20, total_amount: 120, items: [{ amount: 100 }] })).toBe(false); // an old invoice
  });
});

describe('expenses and bills', () => {
  it('a recorded record needs net + VAT = gross and VAT matching its treatment, 1p tolerance', () => {
    expect(vatProblem({ treatment: 'standard', net: 1000, vat: 200, gross: 1200 })).toBeNull();
    expect(vatProblem({ treatment: 'standard', net: 1000, vat: 201, gross: 1201 })).toBeNull();
    expect(vatProblem({ treatment: 'standard', net: 1000, vat: 202, gross: 1202 })).toMatch(/1p at most/);
    expect(vatProblem({ treatment: 'zero', net: 1000, vat: 1, gross: 1001 })).toMatch(/no VAT/);
    expect(vatProblem({ treatment: 'exempt', net: 1000, vat: 0, gross: 1000 })).toBeNull();
    expect(vatProblem({ treatment: 'standard', net: 1000, vat: 200, gross: 1250 })).toMatch(/equal the total/);
    const rec = { amount: 12, net_amount: 10, vat_amount: 2, vat_treatment: 'standard', vat_rate: 20, vat_status: 'recorded', tax_point_date: '2026-11-07' };
    expect(isRecordedMoneyOut(rec)).toBe(true);
    expect(isRecordedMoneyOut({ amount: 12 })).toBe(false); // before the SQL / an old record
    expect(isRecordedMoneyOut({ ...rec, vat_status: 'not_recorded' })).toBe(false);
    expect(vatOnNet(1000, 'reduced')).toBe(50);
  });
});
