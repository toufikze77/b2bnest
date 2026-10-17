import { describe, expect, it } from 'vitest';
import { countBy, formatMoney, isClosedStage, rotaToday, sumByCurrency, summarizeMoney, summarizePipeline } from './dashboardWidgets';

describe('dashboard widget aggregation', () => {
  it('never mixes currencies', () => {
    const t = sumByCurrency([{ a: 10, c: 'gbp' }, { a: 5, c: 'USD' }, { a: '2.5', c: 'GBP' }, { a: 1, c: null }], (r) => r.a, (r) => r.c);
    expect(t).toEqual([
      { currency: 'GBP', amount: 12.5, count: 2 },
      { currency: '', amount: 1, count: 1 },
      { currency: 'USD', amount: 5, count: 1 },
    ]);
  });

  it('formats a missing currency as a plain number', () => {
    expect(formatMoney(1200, '')).toBe('1,200');
    expect(formatMoney(1200, 'GBP')).toBe('£1,200');
  });

  it('splits paid and outstanding invoices and leaves drafts out', () => {
    const m = summarizeMoney(
      [{ status: 'paid', total_amount: 100, currency: 'GBP' }, { status: 'sent', total_amount: 40, currency: 'GBP' }, { status: 'draft', total_amount: 999, currency: 'GBP' }, { status: 'cancelled', total_amount: 7, currency: 'GBP' }],
      [{ status: 'pending', amount: 30, currency: 'GBP' }, { status: 'paid', amount: 20, currency: 'GBP' }],
    );
    expect(m.paid).toEqual([{ currency: 'GBP', amount: 100, count: 1 }]);
    expect(m.outstanding).toEqual([{ currency: 'GBP', amount: 40, count: 1 }]);
    expect(m.bills).toEqual([{ currency: 'GBP', amount: 30, count: 1 }]);
  });

  it('counts only open deals in the pipeline', () => {
    expect(isClosedStage('closed-won')).toBe(true);
    expect(isClosedStage('Lost')).toBe(true);
    expect(isClosedStage('proposal')).toBe(false);
    const p = summarizePipeline([{ stage: 'lead', value: 10, currency: 'GBP' }, { stage: 'Lead', value: 5, currency: 'GBP' }, { stage: 'won', value: 100, currency: 'GBP' }, { stage: null, value: 1, currency: 'GBP' }]);
    expect(p.openCount).toBe(3);
    expect(p.stages).toEqual([
      { stage: 'lead', count: 2, total: [{ currency: 'GBP', amount: 15, count: 2 }] },
      { stage: 'no stage', count: 1, total: [{ currency: 'GBP', amount: 1, count: 1 }] },
    ]);
  });

  it('counts by key case-insensitively', () => {
    expect(countBy([{ s: 'Lead' }, { s: 'lead' }, { s: null }], (r) => r.s)).toEqual(new Map([['lead', 2], ['', 1]]));
  });

  it('orders today\'s shifts and names employees', () => {
    const r = rotaToday(
      [{ id: 's2', employee_id: 'e2', start_time: '13:00:00', end_time: '17:00:00', role: null, status: 'published' }, { id: 's1', employee_id: 'e1', start_time: '09:00:00', end_time: '12:30:00', role: 'Till', status: 'draft' }],
      [{ id: 'e1', full_name: 'Sam' }],
    );
    expect(r.map((s) => [s.name, s.start, s.end])).toEqual([['Sam', '09:00', '12:30'], ['Unnamed employee', '13:00', '17:00']]);
  });
});
