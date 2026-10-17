import { describe, expect, it } from 'vitest';
import {
  averageWonDeal, clearReportCurrency, contactsAdded, csvField, dealsInCurrency, excludedNote, isWon, lastMonths, leadSources,
  loadReportCurrency, monthlyWon, reportRows, saveReportCurrency, toCsv, totalsByCurrency, winRate,
} from './crmAnalytics';

const today = new Date(2026, 9, 17); // 17 Oct 2026
const c = (source: string | null, created_at: string | null, status = 'lead') => ({ source, created_at, status });
const d = (stage: string | null, value: number | null, currency: string | null, close_date: string | null = null) => ({ stage, value, currency, close_date });

describe('lead sources', () => {
  it('counts per source, blank = "Not set", ranked, with shares', () => {
    const r = leadSources([c('Referral', null), c(' referral ', null), c(null, null), c('', null), c('Web', null)]);
    expect(r.map((x) => [x.label, x.count])).toEqual([['Not set', 2], ['Referral', 2], ['Web', 1]]);
    expect(r[0].share).toBeCloseTo(0.4);
    expect(leadSources([])).toEqual([]);
  });
});

describe('monthly won deals by close date', () => {
  it('only won deals, only the chosen currency, by close month; no close date is counted, not guessed', () => {
    const r = monthlyWon([
      d('won', 1000, 'GBP', '2026-10-02'),
      d('Closed Won', 500, 'gbp', '2026-09-30'),
      d('closed', 200, 'GBP', '2026-05-01'),
      d('won', 50, 'GBP', null),
      d('won', 999, 'USD', '2026-10-01'),
      d('proposal', 7777, 'GBP', '2026-10-01'),
      d('won', 10, 'GBP', '2025-01-01'),
    ], 'GBP', 6, today);
    expect(r.rows.map((x) => x.key)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(r.rows.map((x) => [x.value, x.count])).toEqual([[200, 1], [0, 0], [0, 0], [0, 0], [500, 1], [1000, 1]]);
    expect(r.noCloseDate).toBe(1);
    expect(r.outsideRange).toBe(1);
    expect(r.excluded).toEqual([{ currency: 'USD', count: 1 }]);
  });
  it('12-month range', () => {
    expect(lastMonths(12, today)[0].key).toBe('2025-11');
  });
});

describe('contacts added and customers now', () => {
  it('counts by created month; a rate only when the month has at least 5 contacts', () => {
    const many = Array.from({ length: 5 }, (_, i) => c('x', `2026-10-0${i + 1}T10:00:00Z`, i < 2 ? 'customer' : 'lead'));
    const r = contactsAdded([...many, c('x', '2026-09-10T10:00:00Z', 'customer'), c('x', null)], 6, today);
    const oct = r.rows.at(-1)!, sep = r.rows.at(-2)!;
    expect([oct.added, oct.customersNow, oct.rate]).toEqual([5, 2, 0.4]);
    expect([sep.added, sep.customersNow, sep.rate]).toEqual([1, 1, null]);
    expect(r.noDate).toBe(1);
  });
});

describe('win rate and average deal size', () => {
  it('win rate = won / (won + lost); null without closed deals', () => {
    expect(winRate([d('won', 1, 'GBP'), d('lost', 1, 'GBP'), d('Closed Lost', 1, 'GBP'), d('proposal', 1, 'GBP')])).toEqual({ won: 1, lost: 2, rate: 1 / 3 });
    expect(winRate([d('proposal', 1, 'GBP')]).rate).toBeNull();
  });
  it('average won deal per currency, never mixed', () => {
    expect(averageWonDeal([d('won', 100, 'GBP'), d('won', 300, 'GBP'), d('won', 50, 'USD'), d('lost', 9999, 'GBP')]))
      .toEqual([{ currency: 'GBP', average: 200, count: 2 }, { currency: 'USD', average: 50, count: 1 }]);
    expect(isWon('closed')).toBe(true);
  });
  it('totals per currency: open vs won', () => {
    expect(totalsByCurrency([d('proposal', 100, 'GBP'), d('won', 40, 'GBP'), d('lost', 5, 'GBP'), d('lead', 7, null)]))
      .toEqual([{ currency: 'GBP', open: 100, openCount: 1, won: 40, wonCount: 1 }, { currency: '', open: 7, openCount: 1, won: 0, wonCount: 0 }]);
  });
});

describe('report currency', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, m }; };
  it('defaults to the account currency, remembers a hand-picked one per user, resets', () => {
    const s = mem();
    expect(loadReportCurrency('u1', 'gbp', s)).toBe('GBP');
    saveReportCurrency('u1', 'usd', s);
    expect(loadReportCurrency('u1', 'GBP', s)).toBe('USD');
    expect(loadReportCurrency('u2', 'GBP', s)).toBe('GBP');
    clearReportCurrency('u1', s);
    expect(loadReportCurrency('u1', 'GBP', s)).toBe('GBP');
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    expect(loadReportCurrency('u1', 'GBP', broken)).toBe('GBP');
    expect(saveReportCurrency('u1', 'USD', broken)).toBe(false);
  });
  it('only deals in the chosen currency are counted; the rest are listed', () => {
    const r = dealsInCurrency([d('lead', 1, 'GBP'), d('lead', 1, 'USD'), d('lead', 1, 'usd'), d('lead', 1, null)], 'GBP');
    expect(r.included).toHaveLength(1);
    expect(r.excluded).toEqual([{ currency: 'USD', count: 2 }, { currency: '', count: 1 }]);
    expect(excludedNote(r.excluded)).toBe('2 deals in USD and 1 deal with no currency set are not included, because there is no exchange-rate data and nothing is converted.');
    expect(excludedNote([])).toBeNull();
  });
});

describe('CSV export', () => {
  it('quotes commas, quotes and newlines, and neutralises formulas', () => {
    expect(csvField('Acme, Ltd')).toBe('"Acme, Ltd"');
    expect(csvField('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvField('a\nb')).toBe('"a\nb"');
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvField(-12.5)).toBe('-12.5');
    expect(toCsv([['a', 'b,c'], [1, null]])).toBe('a,"b,c"\r\n1,');
  });
  it('report rows contain only real figures, per currency', () => {
    const rows = reportRows([c('Web, direct', '2026-10-01T00:00:00Z', 'customer')], [d('won', 100, 'GBP', '2026-10-01'), d('proposal', 50, 'USD')], today);
    const csv = toCsv(rows);
    expect(csv).toContain('Lead sources,"Web, direct",,100,1');
    expect(csv).toContain('Pipeline,Won value,GBP,100,1,All time');
    expect(csv).toContain('Pipeline,Open pipeline,USD,50,1');
    expect(csv).not.toMatch(/24\.5|32500|47200|1840/);
  });
});
