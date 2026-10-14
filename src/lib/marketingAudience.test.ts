import { describe, it, expect } from 'vitest';
import { filterAudience, crmSummary, parseFilter, resolveSelected, formatByCurrency } from './marketingAudience';

const cs = [
  { status: 'lead', source: 'LinkedIn', email: null, notes: 'LinkedIn: https://www.linkedin.com/in/a' },
  { status: 'customer', source: 'Referral', email: 'a@b.co', notes: null },
  { status: 'lead', source: 'Referral', email: '(likely @x — unverified)', notes: null },
];

describe('marketing audience', () => {
  it('email reach counts only real-format emails', () => {
    expect(filterAudience(cs, { status: 'all', source: 'all', reach: 'email' })).toHaveLength(1);
  });
  it('filters by status and source together', () => {
    expect(filterAudience(cs, { status: 'lead', source: 'Referral', reach: 'any' })).toHaveLength(1);
  });
  it('weighted pipeline uses open deals only, per currency, no invented probability', () => {
    const s = crmSummary(cs, [
      { value: 1000, probability: 50, stage: 'proposal', currency: 'USD' },
      { value: 400, probability: 25, stage: 'proposal', currency: 'GBP' },
      { value: 700, probability: null, stage: 'lead', currency: 'USD' },
      { value: 500, probability: 100, stage: 'closed-won', currency: 'USD' },
    ]);
    expect(s.openDeals).toBe(3);
    expect(s.weightedByCurrency).toEqual({ USD: 500, GBP: 100 });
    expect(s.noProbabilityDeals).toBe(1);
    expect(s.unweightedByCurrency).toEqual({ USD: 700 });
    expect(s.customerShare).toBe(33);
    expect(crmSummary([], []).customerShare).toBeNull();
  });
  it('never shows a £ total for USD deals', () => {
    expect(formatByCurrency({ USD: 500 })).toBe('US$500');
  });
  it('stored filter is sanitised', () => {
    expect(parseFilter({ reach: 'sms', status: 'lead' })).toEqual({ status: 'lead', source: 'all', reach: 'any' });
  });
  it('campaign selection hides deleted contacts and counts them', () => {
    expect(resolveSelected(['a', 'gone'], [{ id: 'a' }])).toEqual({ found: [{ id: 'a' }], missing: 1 });
  });
});
