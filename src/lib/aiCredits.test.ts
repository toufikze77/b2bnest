import { describe, expect, it } from 'vitest';
import { CREDITS_USAGE_NOTE, creditLevel, creditPercent, creditsLeftLine, parseCreditsInfo, resetLine } from '@/lib/aiCredits';

import { CREDITS_PER_DOCUMENT } from '@/lib/legalDocuments';

describe('credit usage note (Phase 30e)', () => {
  it('states the real document cost and the 1-credit Advisor answer', () => {
    expect(CREDITS_PER_DOCUMENT).toBe(10);
    expect(CREDITS_USAGE_NOTE).toBe(`Advisor answers use 1 credit, contracts and legal notices use ${CREDITS_PER_DOCUMENT}. Unused credits don't roll over.`);
  });
});

describe('aiCredits helpers', () => {
  it('levels: ok, low (<20%), critical (<10%), none (limit 0, never divides by zero)', () => {
    expect(creditLevel(50, 250)).toBe('ok');
    expect(creditLevel(49, 250)).toBe('low');
    expect(creditLevel(24, 250)).toBe('critical');
    expect(creditLevel(0, 0)).toBe('none');
    expect(creditPercent(5, 0)).toBe(0);
    expect(creditPercent(300, 250)).toBe(100);
  });
  it('text, en-GB', () => {
    expect(creditsLeftLine({ remaining: 42, limit: 250 })).toBe('42 of 250 AI credits left');
    expect(creditsLeftLine({ remaining: 1200, limit: 5000 })).toBe('1,200 of 5,000 AI credits left');
    expect(creditsLeftLine({ remaining: 0, limit: 0 })).toBe('No AI credits on this plan');
    expect(resetLine('2026-12-01T00:00:00Z')).toBe('Resets 1 December 2026');
    expect(resetLine(null)).toBeNull();
    expect(resetLine('not a date')).toBeNull();
  });
  it('no subscribers row: keeps the 10/10 the server will create, drops the moving reset date', () => {
    expect(parseCreditsInfo({ credits_remaining: 10, credits_limit: 10, reset_date: '2026-12-01T10:00:00Z', subscription_tier: 'free' }, false))
      .toEqual({ remaining: 10, limit: 10, resetDate: null, tier: 'free', notStarted: true });
    expect(parseCreditsInfo({ credits_remaining: 3, credits_limit: 250, reset_date: '2026-12-01T00:00:00Z', subscription_tier: 'Business' }, true))
      .toEqual({ remaining: 3, limit: 250, resetDate: '2026-12-01T00:00:00Z', tier: 'Business', notStarted: false });
    expect(parseCreditsInfo(null, true)).toBeNull();
    expect(parseCreditsInfo({ credits_remaining: '3' }, true)).toBeNull();
  });
});
