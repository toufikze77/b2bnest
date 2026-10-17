import { describe, expect, it } from 'vitest';
import { cleanProbability, dealInsertPayload, dealUpdatePayload } from './crmDeals';

describe('deal payloads', () => {
  it('addDeal sends the currency: the deal\'s own, else the account currency, never USD by default', () => {
    expect(dealInsertPayload({ title: 'A' }, 'u1', 'gbp').currency).toBe('GBP');
    expect(dealInsertPayload({ title: 'A', currency: 'usd' }, 'u1', 'GBP').currency).toBe('USD');
    // Unknown account currency: sent explicitly as null, so the database default (USD) is not used.
    const p = dealInsertPayload({ title: 'A' }, 'u1', '');
    expect(p).toHaveProperty('currency', null);
  });

  it('probability: blank → null (sent explicitly), 0 stays 0, 100 stays 100, no 50 default', () => {
    expect(dealInsertPayload({ title: 'A' }, 'u1', 'GBP')).toHaveProperty('probability', null);
    expect(dealInsertPayload({ title: 'A', probability: 0 }, 'u1', 'GBP').probability).toBe(0);
    expect(dealInsertPayload({ title: 'A', probability: 100 }, 'u1', 'GBP').probability).toBe(100);
    expect([null, undefined, '', NaN, 'abc', -5, 140, 33.4].map(cleanProbability)).toEqual([null, null, null, null, null, 0, 100, 33]);
  });

  it('update sends only the fields given; a stage move touches nothing else', () => {
    expect(dealUpdatePayload({ stage: 'proposal' })).toEqual({ stage: 'proposal' });
    expect(dealUpdatePayload({ probability: null, currency: 'eur' })).toEqual({ probability: null, currency: 'EUR' });
    expect(dealUpdatePayload({ probability: 0 })).toEqual({ probability: 0 });
  });
});
