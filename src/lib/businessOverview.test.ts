import { describe, expect, it } from 'vitest';
import {
  CARD_LINKS, chartMonths, defaultSections, inRange, invoiceStatusInPeriod, loadSections, moneyInOutByMonth, OverviewInput, overviewCards,
  periodRange, pipelineByStage, projectsByStatus, saveSections, sectionsKey, tasksByStatus, topCustomersInPeriod,
} from './businessOverview';

const now = new Date(2026, 9, 17, 12); // 17 Oct 2026
let n = 0;
const inv = (status: string, total: number, currency: string, created: string, extra: Record<string, unknown> = {}) =>
  ({ id: `i${++n}`, status, total_amount: total, currency, created_at: created, due_date: null as string | null, client_name: 'Acme', paid_at: null as string | null, archived_at: null as string | null, ...extra });
const input = (over: Partial<OverviewInput> = {}): OverviewInput => ({ invoices: [], expenses: [], deals: [], contacts: [], projects: [], tasks: [], ...over });

describe('periods', () => {
  it('ranges start on the right day and All time has no start', () => {
    expect(periodRange('month', now)).toEqual({ from: '2026-10-01', to: '2026-10-17' });
    expect(periodRange('30d', now)).toEqual({ from: '2026-09-18', to: '2026-10-17' });
    expect(periodRange('quarter', now)).toEqual({ from: '2026-10-01', to: '2026-10-17' });
    expect(periodRange('quarter', new Date(2026, 4, 9))).toEqual({ from: '2026-04-01', to: '2026-05-09' });
    expect(periodRange('year', now)).toEqual({ from: '2026-01-01', to: '2026-10-17' });
    expect(periodRange('all', now)).toEqual({ from: null, to: '2026-10-17' });
    expect(inRange('2026-09-30', periodRange('month', now))).toBe(false);
    expect(inRange('2026-10-01T08:00:00', periodRange('month', now))).toBe(true);
    expect(chartMonths('year')).toBe(12);
    expect(chartMonths('month')).toBe(6);
  });
});

describe('overviewCards', () => {
  const data = input({
    invoices: [
      inv('paid', 100, 'GBP', '2026-06-01T09:00:00Z', { paid_at: '2026-10-05T09:00:00Z' }), // paid this month (by paid date)
      inv('paid', 40, 'GBP', '2026-10-03T09:00:00Z'), // no paid date: dated by invoice date, this month
      inv('paid', 70, 'GBP', '2026-08-01T09:00:00Z', { paid_at: '2026-08-02T09:00:00Z' }), // paid earlier
      inv('sent', 300, 'GBP', '2026-10-01T09:00:00Z', { due_date: '2026-10-10' }), // overdue
      inv('sent', 50, 'GBP', '2026-10-01T09:00:00Z', { due_date: '2026-11-10' }),
      inv('sent', 999, 'GBP', '2026-10-01T09:00:00Z', { due_date: '2026-10-01', archived_at: '2026-10-16T09:00:00Z' }), // archived: ignored
      inv('paid', 500, 'USD', '2026-10-01T09:00:00Z', { paid_at: '2026-10-02T09:00:00Z' }), // other currency
    ],
    expenses: [{ amount: 20, date: '2026-10-02', status: 'paid' }, { amount: 5, date: '2026-09-02', status: 'pending' }],
    deals: [{ stage: 'proposal', value: 1000, currency: 'GBP' }, { stage: 'Closed Won', value: 5000, currency: 'GBP' }, { stage: 'lost', value: 1, currency: 'GBP' }, { stage: 'Discovery call', value: 200, currency: 'GBP' }, { stage: 'lead', value: 7, currency: 'USD' }],
    contacts: [{ status: 'lead', created_at: '2026-10-01' }, { status: 'customer', created_at: '2026-09-01' }],
    projects: [{ status: 'active' }, { status: 'completed' }, { status: 'planning' }],
    tasks: [{ status: 'todo', due_date: '2026-10-01' }, { status: 'in-progress', due_date: '2026-12-01' }, { status: 'done', due_date: '2026-10-01' }],
  });

  it('money in uses the paid date (invoice date when none), one currency, archived left out', () => {
    const c = overviewCards(data, 'GBP', 'GBP', 'month', now);
    expect(c.moneyIn).toEqual({ amount: 140, count: 2 });
    expect(overviewCards(data, 'GBP', 'GBP', 'all', now).moneyIn).toEqual({ amount: 210, count: 3 });
    expect(c.excludedInvoices).toEqual([{ currency: 'USD', count: 1 }]);
    expect(overviewCards(data, 'USD', 'GBP', 'month', now).moneyIn).toEqual({ amount: 500, count: 1 });
  });

  it('outstanding and overdue as of today (shared status helper); archived never counts', () => {
    const c = overviewCards(data, 'GBP', 'GBP', 'month', now);
    expect(c.outstanding).toEqual({ amount: 350, count: 2 });
    expect(c.overdue).toEqual({ amount: 300, count: 1 });
  });

  it('money out only in the account currency (expenses have no currency)', () => {
    expect(overviewCards(data, 'GBP', 'GBP', 'month', now).moneyOut).toEqual({ amount: 20, count: 1 });
    expect(overviewCards(data, 'USD', 'GBP', 'month', now).moneyOut).toBeNull();
  });

  it('pipeline uses isClosedStage (won/lost/closed out, custom stages in); tasks, projects, contacts', () => {
    const c = overviewCards(data, 'GBP', 'GBP', 'month', now);
    expect(c.openPipeline).toEqual({ amount: 1200, count: 2 });
    expect(c.otherCurrencyDeals).toBe(1);
    expect([c.openTasks, c.overdueTasks, c.activeProjects, c.contacts]).toEqual([2, 1, 2, 2]);
  });

  it('expenses to pay: every expense not marked paid (pending, approved, no status), any date, account currency only', () => {
    const d = input({ expenses: [
      { amount: 40, date: '2026-10-02', status: 'pending' }, // "Mobile Bill"
      { amount: 15.5, date: '2025-01-10', status: 'approved' }, // old but still unpaid
      { amount: 9, date: '2026-10-01', status: null }, // database default is pending
      { amount: 300, date: '2026-10-03', status: 'paid' },
      { amount: 7, date: '2026-10-04', status: 'Paid' },
    ] });
    expect(overviewCards(d, 'GBP', 'GBP', 'month', now).expensesToPay).toEqual({ amount: 64.5, count: 3 });
    expect(overviewCards(d, 'GBP', 'GBP', 'all', now).expensesToPay).toEqual({ amount: 64.5, count: 3 }); // not period-based
    expect(overviewCards(d, 'USD', 'GBP', 'month', now).expensesToPay).toBeNull(); // not included in another currency
    expect(overviewCards(input(), 'GBP', 'GBP', 'month', now).expensesToPay).toEqual({ amount: 0, count: 0 });
    // Money out keeps its meaning: every expense dated in the period, paid or not.
    expect(overviewCards(d, 'GBP', 'GBP', 'month', now).moneyOut).toEqual({ amount: 356, count: 4 });
  });

  it('every card is a link and none goes to the Dashboard', () => {
    for (const v of Object.values(CARD_LINKS)) expect(v.to).not.toBe('/dashboard');
    expect(CARD_LINKS.expensesToPay.to).toBe('/business-tools?tool=business-finance-assistant&tab=expenses');
    expect(CARD_LINKS.moneyIn.to).toBe('/business-tools?tool=business-finance-assistant&tab=invoices');
    expect(CARD_LINKS.moneyOut.to).toBe('/business-tools?tool=business-finance-assistant&tab=expenses');
    expect(CARD_LINKS.openPipeline.to).toBe('/crm?tab=deals');
  });
});

describe('sections', () => {
  it('money in and out by month: paid by paid date, expenses only in the account currency', () => {
    const r = moneyInOutByMonth({
      invoices: [inv('paid', 100, 'GBP', '2026-06-01T09:00:00Z', { paid_at: '2026-10-05T09:00:00Z' }), inv('paid', 60, 'GBP', '2026-08-10T09:00:00Z'), inv('paid', 9, 'GBP', '2026-10-01T09:00:00Z', { archived_at: '2026-10-02T00:00:00Z', paid_at: '2026-10-02T00:00:00Z' })],
      expenses: [{ amount: 30, date: '2026-10-02' }, { amount: 12.5, date: '2026-08-20' }],
    }, 'GBP', 'GBP', 6, now);
    expect(r.rows.map((x) => [x.key, x.moneyIn, x.moneyOut])).toEqual([
      ['2026-05', 0, 0], ['2026-06', 0, 0], ['2026-07', 0, 0], ['2026-08', 60, 12.5], ['2026-09', 0, 0], ['2026-10', 100, 30],
    ]);
    const usd = moneyInOutByMonth({ invoices: [], expenses: [{ amount: 30, date: '2026-10-02' }] }, 'USD', 'GBP', 6, now);
    expect(usd.expensesIncluded).toBe(false);
    expect(usd.rows.every((x) => x.moneyOut === null)).toBe(true);
  });

  it('invoice status breakdown counts invoices dated in the period, archived left out', () => {
    expect(invoiceStatusInPeriod([inv('paid', 1, 'GBP', '2026-10-02'), inv('draft', 1, 'GBP', '2026-10-03'), inv('draft', 1, 'GBP', '2026-07-03'), inv('sent', 1, 'GBP', '2026-10-03', { archived_at: '2026-10-04' })], 'month', now))
      .toEqual([{ chip: 'draft', label: 'Draft', count: 1 }, { chip: 'paid', label: 'Paid', count: 1 }].sort((a, b) => b.count - a.count));
  });

  it('pipeline by stage: open stages only, one currency, largest first', () => {
    const r = pipelineByStage([{ stage: 'proposal', value: 1000, currency: 'GBP' }, { stage: 'Proposal', value: 500, currency: 'GBP' }, { stage: 'lead', value: 200, currency: 'GBP' }, { stage: 'won', value: 9, currency: 'GBP' }, { stage: 'lead', value: 1, currency: 'EUR' }], 'GBP');
    expect(r.rows).toEqual([{ stage: 'Proposal', value: 1500, count: 2 }, { stage: 'Lead', value: 200, count: 1 }]);
    expect(r.otherCurrency).toBe(1);
  });

  it('tasks by status with overdue; projects by status', () => {
    const t = tasksByStatus([{ status: 'todo', due_date: '2026-10-01' }, { status: 'todo', due_date: null }, { status: 'done', due_date: '2026-01-01' }], now);
    expect(t).toEqual({ rows: [{ status: 'To do', count: 2 }, { status: 'Done', count: 1 }], overdue: 1 });
    expect(projectsByStatus([{ status: 'active' }, { status: 'active' }, { status: null }])).toEqual([{ status: 'Active', count: 2 }, { status: 'Planning', count: 1 }]);
  });

  it('top customers for invoices dated in the period, one currency', () => {
    const docs = [inv('sent', 300, 'GBP', '2026-10-02', { client_name: 'Beta' }), inv('paid', 100, 'GBP', '2026-10-05', { client_name: 'Acme' }), inv('paid', 900, 'GBP', '2026-05-05', { client_name: 'Old' }), inv('draft', 999, 'GBP', '2026-10-05', { client_name: 'Draft Co' })];
    expect(topCustomersInPeriod(docs, 'GBP', 'month', 5, now).map((t) => t.name)).toEqual(['Beta', 'Acme']);
    expect(topCustomersInPeriod(docs, 'GBP', 'all', 5, now)[0].name).toBe('Old');
  });
});

describe('customise: saved sections', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, m }; };
  it('defaults to every section on; saves per user and company; ignores broken data', () => {
    const s = mem();
    expect(loadSections('u1', 'o1', s)).toEqual(defaultSections());
    saveSections('u1', 'o1', { ...defaultSections(), pipeline: false }, s);
    expect(loadSections('u1', 'o1', s).pipeline).toBe(false);
    expect(loadSections('u1', 'o2', s).pipeline).toBe(true);
    s.setItem(sectionsKey('u1', 'o1'), '{not json');
    expect(loadSections('u1', 'o1', s)).toEqual(defaultSections());
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} };
    expect(loadSections('u1', 'o1', throwing)).toEqual(defaultSections());
    expect(saveSections('u1', 'o1', defaultSections(), throwing)).toBe(false);
  });
});
