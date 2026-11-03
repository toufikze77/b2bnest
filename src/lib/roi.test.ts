import { describe, expect, it } from 'vitest';
import {
  annualisedText, bestByRoi, calculate, EMPTY_FORM, loadScenarios, money, parseNumber, percent, SCENARIOS_KEY, scenariosCsv, validate, verdict,
  type RoiForm, type RoiInputs,
} from '@/lib/roi';

const inputs = (o: Partial<RoiInputs>): RoiInputs => ({ investment: 0, monthlyCost: 0, mode: 'total', totalReturn: 0, monthlyReturn: 0, months: 12, residual: 0, discountRate: null, ...o });
const form = (o: Partial<RoiForm>): RoiForm => ({ ...EMPTY_FORM, ...o });

describe('ROI formulas against hand-calculated values (Phase 38)', () => {
  it('A: £10,000, £100 a month, £1,200 a month back, 12 months, 10% a year', () => {
    // Total cost 10,000 + 100 x 12 = 11,200. Returns 1,200 x 12 = 14,400. Net 3,200. ROI 3,200 / 11,200 = 28.57%.
    // Payback 10,000 / (1,200 - 100) = 9.09 months. Annualised over exactly 12 months = ROI = 28.57%.
    // Break-even 11,200 / 12 = 933.33 a month. NPV: monthly rate 1.1^(1/12) - 1 = 0.0079741;
    // sum of 1/(1+m)^k for k = 1..12 = (1 - 1/1.1) / 0.0079741 = 11.40049; NPV = -10,000 + 1,100 x 11.40049 = 2,540.54.
    const r = calculate(inputs({ investment: 10000, monthlyCost: 100, mode: 'monthly', monthlyReturn: 1200, months: 12, discountRate: 10 }));
    expect(r).toEqual({ totalCost: 11200, totalReturn: 14400, netProfit: 3200, roiPercent: 28.57, paybackMonths: 9.1, annualisedRoiPercent: 28.57, breakEvenMonthlyReturn: 933.33, npv: 2540.54 });
    expect(verdict(r, 12)).toBe('Pays back in 10 months, with £3,200.00 profit over 12 months.');
  });
  it('B: returns below cost: negative ROI, not paid back, annualised not shown under a year', () => {
    // Cost 5,000, return 4,000 over 6 months: net -1,000, ROI -20%.
    const r = calculate(inputs({ investment: 5000, totalReturn: 4000, months: 6 }));
    expect(r).toMatchObject({ netProfit: -1000, roiPercent: -20, paybackMonths: null, annualisedRoiPercent: null, npv: null });
    expect(verdict(r, 6)).toBe('Loses money over this period: £1,000.00 less back than it costs over 6 months.');
    expect(annualisedText(r)).toMatch(/^Not shown for periods under a year/);
  });
  it('C: 24 months: compound annualised ROI', () => {
    // £20,000 in, £30,000 back over 24 months: ROI 50%; annualised 1.5^(12/24) - 1 = 22.47%; payback 20,000 / 1,250 = 16.
    const r = calculate(inputs({ investment: 20000, totalReturn: 30000, months: 24 }));
    expect(r).toMatchObject({ roiPercent: 50, annualisedRoiPercent: 22.47, paybackMonths: 16, breakEvenMonthlyReturn: 833.33 });
    expect(annualisedText(r)).toBe('22.47% a year, compounded.');
  });
  it('D: residual value: paid back only at the end, NPV slightly negative at 5%', () => {
    // £10,000 in, £200 a month for 12 months, sold for £8,000 at the end: return 2,400 + 8,000 = 10,400; net 400; ROI 4%.
    // Monthly returns alone would take 50 months; with the resale at month 12 it is paid back at 12.
    // NPV at 5% a year: -10,000 + 200 x 11.6919 + 8,000 / 1.05 = -43.32. Break-even (10,000 - 8,000) / 12 = 166.67.
    const r = calculate(inputs({ investment: 10000, mode: 'monthly', monthlyReturn: 200, months: 12, residual: 8000, discountRate: 5 }));
    expect(r).toMatchObject({ totalReturn: 10400, netProfit: 400, roiPercent: 4, paybackMonths: 12, npv: -43.32, breakEvenMonthlyReturn: 166.67 });
  });
  it('a 0% discount rate: NPV is the plain net cash', () => {
    expect(calculate(inputs({ investment: 1000, mode: 'monthly', monthlyReturn: 100, months: 12, discountRate: 0 })).npv).toBe(200);
  });
  it('very large numbers and decimals stay finite and exact to the penny', () => {
    const r = calculate(inputs({ investment: 999_999_999_999.99, totalReturn: 1_000_000_000_000, months: 600 }));
    expect(Number.isFinite(r.roiPercent) && Number.isFinite(r.annualisedRoiPercent!)).toBe(true);
    expect(calculate(inputs({ investment: 0.1, totalReturn: 0.3, months: 12 })).netProfit).toBe(0.2);
  });
});

describe('validation (plain errors under each field)', () => {
  it('empty, zero, negative, not numbers, zero timeframe, too large', () => {
    expect(validate(form({})).errors).toMatchObject({ investment: 'Enter the initial investment.', totalReturn: 'Enter the expected total return.' });
    expect(validate(form({ investment: '0', totalReturn: '1' })).errors.investment).toBe('The initial investment must be more than £0.');
    expect(validate(form({ investment: '-5', totalReturn: '1' })).errors.investment).toBe("The initial investment can't be negative.");
    expect(validate(form({ investment: 'abc', totalReturn: '1' })).errors.investment).toMatch(/as a number/);
    expect(validate(form({ investment: '100', totalReturn: '1', months: '0' })).errors.months).toBe('The timeframe must be at least 1 month.');
    expect(validate(form({ investment: '100', totalReturn: '1', months: '1.5' })).errors.months).toBe('Enter whole months, for example 12.');
    expect(validate(form({ investment: '2000000000000', totalReturn: '1' })).errors.investment).toMatch(/at most £1,000,000,000,000/);
    expect(validate(form({ investment: '100', totalReturn: '1', discountRate: '150' })).errors.discountRate).toBe('Enter a rate between 0% and 100%.');
  });
  it('accepts £ and thousands separators; the other return field is ignored', () => {
    expect(parseNumber('£1,234.50')).toBe(1234.5);
    const v = validate(form({ investment: '£1,000', mode: 'monthly', monthlyReturn: '150', totalReturn: 'nonsense' }));
    expect(v.errors).toEqual({});
    expect(v.inputs).toMatchObject({ investment: 1000, monthlyReturn: 150, totalReturn: 0 });
  });
  it('formatting never shows NaN or Infinity', () => {
    expect(money(Number.NaN)).toBe('£0.00');
    expect(percent(Number.POSITIVE_INFINITY)).toBe('0.00%');
    expect(money(1234.5)).toBe('£1,234.50');
  });
});

describe('scenarios and CSV', () => {
  it('best by ROI; corrupt storage is ignored', () => {
    expect(bestByRoi([calculate(inputs({ investment: 100, totalReturn: 120 })), calculate(inputs({ investment: 100, totalReturn: 150 }))])).toBe(1);
    expect(bestByRoi([])).toBe(-1);
    localStorage.setItem(SCENARIOS_KEY, '{not json');
    expect(loadScenarios()).toEqual([]);
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify([{ id: 'x', name: 'ok', form: form({ investment: '100', totalReturn: '120' }), savedAt: '' }, { id: 'y', name: 'bad', form: { investment: 'zz' } }, 'junk']));
    expect(loadScenarios().map((s) => s.name)).toEqual(['ok']);
    localStorage.clear();
  });
  it('CSV through the Phase 36 helper: escaping and formula neutralising', () => {
    const csv = scenariosCsv([
      { id: '1', name: '=HYPERLINK("x")', form: form({ investment: '10000', mode: 'monthly', monthlyCost: '100', monthlyReturn: '1200', discountRate: '10' }), savedAt: '' },
      { id: '2', name: 'Van, "new"\nmodel', form: form({ investment: '5000', totalReturn: '4000', months: '6' }), savedAt: '' },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Scenario,Initial investment (GBP),Monthly cost (GBP),Months,Total cost (GBP),Total return (GBP),Net profit (GBP),ROI %,Payback (months),Annualised ROI %,NPV (GBP)');
    expect(lines[1]).toBe(`"'=HYPERLINK(""x"")",10000,100,12,11200,14400,3200,28.57,9.1,28.57,2540.54`);
    expect(csv).toContain('"Van, ""new""\nmodel",5000,0,6,5000,4000,-1000,-20,,,');
  });
});
