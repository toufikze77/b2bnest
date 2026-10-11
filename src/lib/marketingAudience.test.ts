import { describe, it, expect } from 'vitest';
import { filterAudience, crmSummary } from './marketingAudience';

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
  it('summary uses recorded data, no invented conversion rate', () => {
    const s = crmSummary(cs, [{ value: 1000, probability: 50, stage: 'proposal' }, { value: 500, probability: 100, stage: 'closed-won' }]);
    expect(s).toEqual({ contacts: 3, openDeals: 1, weightedPipeline: 500, customerShare: 33 });
    expect(crmSummary([], []).customerShare).toBeNull();
  });
});
