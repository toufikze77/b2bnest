import { describe, expect, it } from 'vitest';
import { compactNumber, currencySymbol, formatMoney, formatTotals } from './money';

describe('formatMoney', () => {
  it('formats GBP and USD in en-GB, whole numbers by default', () => {
    expect(formatMoney(1234.56, 'GBP')).toBe('£1,235');
    expect(formatMoney(1234.56, 'usd')).toBe('US$1,235');
    expect(formatMoney(0, 'GBP')).toBe('£0');
  });
  it('shows 2 decimals only when asked', () => {
    expect(formatMoney(64.5, 'GBP', { cents: true })).toBe('£64.50');
  });
  it('prints a plain number when the currency is missing — never "$"', () => {
    for (const c of [null, undefined, '', '  ']) {
      const s = formatMoney(1200, c);
      expect(s).toBe('1,200');
      expect(s).not.toContain('$');
    }
  });
  it('prints the code, not a guessed symbol, for an unknown code', () => {
    expect(formatMoney(1200, 'not-a-code')).toBe('1,200 NOT-A-CODE');
    expect(formatMoney(1200, 'not-a-code')).not.toContain('$');
  });
  it('symbols, compact ticks and per-currency totals', () => {
    expect(currencySymbol('GBP')).toBe('£');
    expect(currencySymbol('')).toBe('');
    expect([950, 12000, 12500, 1200000, 3e9].map(compactNumber)).toEqual(['950', '12k', '12.5k', '1.2m', '3bn']);
    expect(formatTotals([{ currency: 'GBP', amount: 1200 }, { currency: 'USD', amount: 500 }])).toBe('£1,200 + US$500');
    expect(formatTotals([])).toBe('0');
  });
});
