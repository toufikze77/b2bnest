import { describe, expect, it } from 'vitest';
import {
  csvFileName, dayOf, daysBetween, inBounds, leadSourceReport, leadSourcesCsvRows, loadReportRange, MIN_FOR_RATE, monthsFor, needsAttention,
  needsAttentionCsvRows, NO_SOURCE, pipelineByStage, pipelineCsvRows, rangeBounds, ReportContact, ReportDeal, saveReportRange, validProbability,
  winLoss, winLossCsvRows,
} from './crmReports';
import { toCsv } from './crmAnalytics';

// Explicit fixtures. "Today" is a fixed local day so the tests never depend on the clock.
const today = new Date(2026, 9, 18, 15, 30); // 18 Oct 2026, afternoon (local)
const ALL = { from: null, to: null };
let n = 0;
const deal = (o: Partial<ReportDeal> = {}): ReportDeal => ({
  id: `d${++n}`, title: `Deal ${n}`, stage: 'proposal', value: 1000, currency: 'GBP', probability: 50, close_date: null,
  contact_id: null, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-10T10:00:00Z', ...o,
});
const contact = (o: Partial<ReportContact> = {}): ReportContact => ({
  id: `c${++n}`, name: `Contact ${n}`, status: 'lead', source: 'Referral', created_at: '2026-10-01T10:00:00Z', last_contact: '2026-10-15', ...o,
});

describe('calendar days and the date range', () => {
  it('reads date-only values as written and timestamps as the local day; rejects nonsense', () => {
    expect(dayOf('2026-10-01')).toBe('2026-10-01');
    expect(dayOf('2026-02-30')).toBeNull();
    expect(dayOf('')).toBeNull();
    expect(dayOf('not a date')).toBeNull();
    const local = new Date(2026, 9, 1, 0, 30); // just after local midnight
    expect(dayOf(local.toISOString())).toBe('2026-10-01');
    expect(daysBetween('2026-09-30', '2026-10-18')).toBe(18);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2); // across the clock change
  });
  it('bounds are inclusive calendar days', () => {
    expect(rangeBounds('30d', today)).toEqual({ from: '2026-09-19', to: '2026-10-18' });
    expect(rangeBounds('90d', today)).toEqual({ from: '2026-07-21', to: '2026-10-18' });
    expect(rangeBounds('year', today)).toEqual({ from: '2026-01-01', to: '2026-10-18' });
    expect(rangeBounds('all', today)).toEqual({ from: null, to: null });
    const b = rangeBounds('30d', today);
    expect([inBounds('2026-09-19', b), inBounds('2026-09-18', b), inBounds('2026-10-18', b), inBounds('2026-10-19', b)]).toEqual([true, false, true, false]);
    expect(inBounds('2026-10-18T23:59:00', b)).toBe(true); // a local time late on the last day is still that day
    expect(inBounds(null, b)).toBe(false);
    expect(inBounds(null, ALL)).toBe(true);
  });
  it('remembers the range per user, with a safe default', () => {
    const m = new Map<string, string>();
    const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
    expect(loadReportRange('u1', s)).toBe('all');
    expect(saveReportRange('u1', '90d', s)).toBe(true);
    expect(loadReportRange('u1', s)).toBe('90d');
    expect(loadReportRange('u2', s)).toBe('all');
    m.set('b2bnest.crm.reportRange.u1', 'forever');
    expect(loadReportRange('u1', s)).toBe('all');
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadReportRange('u1', broken)).toBe('all');
    expect(saveReportRange('u1', '30d', broken)).toBe(false);
    expect(loadReportRange(null, s)).toBe('all');
  });
});

describe('pipeline by stage and weighted forecast', () => {
  it('weighted = value × probability / 100; no probability is left out of the weighted figure and counted; 0% is a real 0', () => {
    const p = pipelineByStage([
      deal({ stage: 'proposal', value: 1000, probability: 50 }),
      deal({ stage: 'Proposal', value: 400, probability: null }),
      deal({ stage: 'lead', value: 300, probability: 0 }),
      deal({ stage: 'lead', value: 200, probability: 150 }), // not a valid percentage: treated as no probability
      deal({ stage: 'won', value: 9999 }), deal({ stage: 'Closed Lost', value: 9999 }), // closed: not in the pipeline
    ], 'GBP', ALL);
    expect(p.rows.map((r) => [r.stage, r.count, r.value, r.weighted, r.withProbability, r.noProbability])).toEqual([
      ['Lead', 2, 500, 0, 1, 1],
      ['Proposal', 2, 1400, 500, 1, 1],
    ]);
    expect(p.totals).toEqual({ count: 4, value: 1900, weighted: 500, withProbability: 2, noProbability: 2 });
    expect([validProbability(null), validProbability(''), validProbability(0), validProbability(100), validProbability(-1), validProbability('x')]).toEqual([null, null, 0, 100, null, null]);
  });
  it('one currency only: other currencies are listed as excluded with a count, never converted', () => {
    const p = pipelineByStage([deal({ currency: 'GBP' }), deal({ currency: 'USD' }), deal({ currency: 'usd' }), deal({ currency: null })], 'GBP', ALL);
    expect(p.totals.count).toBe(1);
    expect(p.excluded).toEqual([{ currency: 'USD', count: 2 }, { currency: '', count: 1 }]);
    // Production today: 4 USD deals at 50%, report currency GBP → nothing in GBP, all four listed.
    const prod = pipelineByStage([1, 2, 3, 4].map(() => deal({ currency: 'USD', probability: 50 })), 'GBP', ALL);
    expect([prod.rows.length, prod.excluded]).toEqual([0, [{ currency: 'USD', count: 4 }]]);
  });
  it('filters by created date', () => {
    const p = pipelineByStage([deal({ created_at: '2026-09-19T08:00:00' }), deal({ created_at: '2026-09-18T20:00:00' })], 'GBP', rangeBounds('30d', today));
    expect(p.totals.count).toBe(1);
  });
});

describe('win and loss', () => {
  const won = (close: string | null, created = '2026-09-01T09:00:00Z', o: Partial<ReportDeal> = {}) => deal({ stage: 'won', close_date: close, created_at: created, ...o });
  const lost = (close: string, o: Partial<ReportDeal> = {}) => deal({ stage: 'lost', close_date: close, ...o });
  it('per month by close date in one currency; win rate and cycle over every currency', () => {
    const w = winLoss([
      won('2026-10-05', '2026-09-25T09:00:00Z', { value: 500 }), won('2026-09-20', '2026-09-10', { value: 300 }),
      lost('2026-10-02', { value: 100 }), won('2026-10-10', '2026-10-01', { currency: 'USD', value: 700 }),
      won('2026-08-01'), // outside the last 30 days
    ], 'GBP', rangeBounds('30d', today));
    expect(w.rows.map((r) => [r.key, r.wonCount, r.wonValue, r.lostCount, r.lostValue])).toEqual([['2026-09', 1, 300, 0, 0], ['2026-10', 1, 500, 1, 100]]);
    expect([w.won, w.lost, w.rate]).toEqual([3, 1, 0.75]);
    expect(w.excluded).toEqual([{ currency: 'USD', count: 1 }]);
    expect(w.cycle).toEqual({ averageDays: 9.7, count: 3, skipped: 0 }); // 10, 10 and 9 days
  });
  it('sales cycle skips a missing close date or a close date before the created date, and says how many', () => {
    const w = winLoss([won('2026-10-05', '2026-10-01'), won('2026-09-01', '2026-10-01'), won('2026-10-01', 'garbage'), won(null)], 'GBP', ALL);
    expect(w.cycle).toEqual({ averageDays: 4, count: 1, skipped: 2 });
    expect(w.noCloseDate).toBe(1);
    expect(winLoss([deal({ stage: 'proposal' })], 'GBP', ALL).rate).toBeNull();
  });
  it('"All time" months span the first to the last close month, capped', () => {
    expect(monthsFor(ALL, ['2026-01-31', '2026-03-01']).months.map((m) => m.key)).toEqual(['2026-01', '2026-02', '2026-03']);
    const long = monthsFor(ALL, ['2020-01-01', '2026-10-01'], 24);
    expect([long.months.length, long.capped, long.months[0].key]).toEqual([24, true, '2024-11']);
    expect(monthsFor(ALL, []).months).toEqual([]);
  });
});

describe('lead sources', () => {
  it('joins deals by contact_id; no source is grouped; under 5 contacts shows counts only', () => {
    const a = contact({ source: 'Referral' }), b = contact({ source: ' referral ' }), c = contact({ source: null }), d = contact({ source: '' });
    const big = [1, 2, 3, 4, 5].map(() => contact({ source: 'Web form' }));
    const deals = [
      deal({ contact_id: a.id, stage: 'won', value: 800 }), deal({ contact_id: a.id, stage: 'won', value: 200 }), deal({ contact_id: a.id, stage: 'proposal' }),
      deal({ contact_id: b.id, stage: 'won', currency: 'USD', value: 5 }),
      deal({ contact_id: big[0].id, stage: 'won', value: 50 }), deal({ contact_id: big[1].id, stage: 'lead' }),
      deal({ contact_id: null }), deal({ contact_id: 'missing' }),
    ];
    const r = leadSourceReport([a, b, c, d, ...big], deals, 'GBP', ALL);
    expect(r.rows.map((x) => [x.label, x.contacts, x.withDeal, x.withWon, x.wonValue, x.wonDealsElsewhere, x.rate])).toEqual([
      ['Web form', 5, 2, 1, 50, 0, 0.2],
      ['Referral', 2, 2, 2, 1000, 1, null],
      [NO_SOURCE, 2, 0, 0, 0, 0, null],
    ]);
    expect(MIN_FOR_RATE).toBe(5);
    expect([r.unlinkedDeals, r.wonElsewhere, r.contactsInRange]).toEqual([2, 1, 9]);
  });
  it('filters contacts by their created date', () => {
    const r = leadSourceReport([contact({ created_at: '2026-09-19' }), contact({ created_at: '2026-09-18' })], [], 'GBP', rangeBounds('30d', today));
    expect(r.contactsInRange).toBe(1);
  });
});

describe('needs attention (as of today)', () => {
  it('open deals past their close date; open deals not updated for 30 days or more; leads and prospects not contacted for over 30 days or never', () => {
    const r = needsAttention([
      contact({ name: 'Never', status: 'lead', last_contact: null }),
      contact({ name: 'Old', status: 'Prospect', last_contact: '2026-09-17' }), // 31 days
      contact({ name: 'Exactly30', status: 'lead', last_contact: '2026-09-18' }), // 30 days: not "older than 30"
      contact({ name: 'Customer', status: 'customer', last_contact: null }),
    ], [
      deal({ title: 'Late', close_date: '2026-10-17' }), deal({ title: 'Due today', close_date: '2026-10-18' }),
      deal({ title: 'Won late', stage: 'won', close_date: '2026-01-01' }),
      deal({ title: 'Stale30', updated_at: '2026-09-18T12:00:00' }), deal({ title: 'Fresh29', updated_at: '2026-09-19T12:00:00' }),
      deal({ title: 'NoUpdated', updated_at: null, created_at: '2026-08-01T00:00:00Z' }),
    ], today);
    expect(r.overdue.map((x) => [x.deal.title, x.days])).toEqual([['Late', 1]]);
    expect(r.stale.map((x) => [x.deal.title, x.days])).toEqual([['NoUpdated', 78], ['Stale30', 30]]);
    expect(r.cold.map((x) => [x.contact.name, x.days])).toEqual([['Never', null], ['Old', 31]]);
  });
});

describe('CSV per section', () => {
  const deals = [
    deal({ title: '=HYPERLINK("x")', stage: 'proposal', value: 100, probability: 50, currency: 'GBP' }),
    deal({ stage: 'lead', value: 70, probability: null, currency: 'USD' }),
    deal({ stage: 'won', close_date: '2026-10-05', created_at: '2026-10-01', value: 300, currency: 'GBP' }),
  ];
  it('header row always present, even with no data', () => {
    expect(pipelineCsvRows([], 'GBP', 'all', today)).toEqual([['Stage', 'Currency', 'Open deals', 'Total value', 'Weighted forecast', 'Deals with no probability', 'Date range', 'Filtered by']]);
    expect(winLossCsvRows([], 'GBP', 'all', today)[0][0]).toBe('Month');
    expect(leadSourcesCsvRows([], [], 'GBP', 'all', today)).toHaveLength(1);
    expect(needsAttentionCsvRows([], [], today)).toEqual([['List', 'Name', 'Stage or status', 'Date', 'Days', 'Value', 'Currency']]);
  });
  it('one row per currency where money is involved, report currency first', () => {
    expect(pipelineCsvRows(deals, 'GBP', 'all', today).slice(1).map((r) => [r[0], r[1], r[3], r[4], r[5]])).toEqual([
      ['Proposal', 'GBP', 100, 50, 0], ['Total', 'GBP', 100, 50, 0], ['Lead', 'USD', 70, 0, 1], ['Total', 'USD', 70, 0, 1],
    ]);
    const wl = winLossCsvRows(deals, 'GBP', 'all', today);
    expect(wl[1]).toEqual(['2026-10', 'GBP', 1, 300, 0, 0, 'All time', 'Close date']);
    expect(wl.find((r) => r[0] === 'Average sales cycle (days)')).toEqual(['Average sales cycle (days)', 'All currencies', 1, 4, '', '', 'All time', 'Created to close date; 0 skipped']);
  });
  it('escapes commas, quotes and new lines, and neutralises formulas with a leading single quote', () => {
    const c = contact({ name: '-Danger, "Ltd"\nline2', status: 'lead', last_contact: null });
    const csv = toCsv(needsAttentionCsvRows([c, contact({ name: '@Ann', last_contact: null }), contact({ name: '+44 Co', last_contact: null })], deals, today));
    expect(csv).toContain(`"'-Danger, ""Ltd""\nline2"`);
    expect(csv).toContain(`,'@Ann,`);
    expect(csv).toContain(`,'+44 Co,`);
    expect(toCsv(pipelineCsvRows(deals, 'GBP', 'all', today))).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(csvFileName('pipeline', today)).toBe('crm-pipeline-2026-10-18.csv');
  });
});
