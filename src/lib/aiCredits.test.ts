import { describe, expect, it } from 'vitest';
import { CREDITS_USAGE_NOTE, NOT_STARTED_LINE, TRIAL_AI_CREDITS, creditLevel, creditPercent, creditsLeftLine, parseCreditsInfo, resetLine, topupLine } from '@/lib/aiCredits';

import { CREDITS_PER_DOCUMENT } from '@/lib/legalDocuments';

describe('credit usage note (Phase 30e)', () => {
  it('states the real document cost and the 1-credit Advisor answer', () => {
    expect(CREDITS_PER_DOCUMENT).toBe(10);
    expect(CREDITS_USAGE_NOTE).toBe(`Advisor answers use 1 credit, contracts and legal notices use ${CREDITS_PER_DOCUMENT}. Unused monthly credits don't roll over; top-up credits last 12 months and are used after your monthly credits.`);
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
    expect(creditsLeftLine({ remaining: 42, limit: 250 })).toBe('42 of 250 AI credits left this month');
    expect(creditsLeftLine({ remaining: 1200, limit: 5000 })).toBe('1,200 of 5,000 AI credits left this month');
    expect(creditsLeftLine({ remaining: 0, limit: 0 })).toBe('No AI credits on this plan');
    expect(resetLine('2026-12-01T00:00:00Z')).toBe('Resets 1 December 2026');
    expect(resetLine(null)).toBeNull();
    expect(resetLine('not a date')).toBeNull();
  });
  it('no subscribers row: keeps the 10/10 the server will create, drops the moving reset date', () => {
    expect(parseCreditsInfo({ credits_remaining: 10, credits_limit: 10, reset_date: '2026-12-01T10:00:00Z', subscription_tier: 'free' }, false))
      .toEqual({ remaining: 50, limit: 50, resetDate: null, tier: 'free', notStarted: true, monthlyRemaining: 50, topupCredits: 0, topupNextExpiry: null });
    expect(parseCreditsInfo({ credits_remaining: 3, credits_limit: 250, reset_date: '2026-12-01T00:00:00Z', subscription_tier: 'Business' }, true))
      .toEqual({ remaining: 3, limit: 250, resetDate: '2026-12-01T00:00:00Z', tier: 'Business', notStarted: false, monthlyRemaining: 3, topupCredits: 0, topupNextExpiry: null });
    expect(parseCreditsInfo(null, true)).toBeNull();
    expect(parseCreditsInfo({ credits_remaining: '3' }, true)).toBeNull();
  });
});

describe('trial credits (Phase 35)', () => {
  it('50, the same number the SQL creates and the no-row RPC answers', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sql = fs.readFileSync(path.resolve(__dirname, '../../docs/phase35/proposal.sql'), 'utf8');
    expect(TRIAL_AI_CREDITS).toBe(50);
    expect(sql).toContain("false, 'free', 50, 50)");
    expect(sql).toContain("json_build_object('credits_remaining',50,'credits_limit',50,");
    expect(NOT_STARTED_LINE).toBe('Your 50 credits start counting from your first AI request.');
  });
});

describe('top-up credits (Phase 37)', () => {
  it('reads the split from the Phase 37 RPC; the total is what can be spent', () => {
    expect(parseCreditsInfo({ credits_remaining: 342, credits_limit: 250, reset_date: '2026-12-01T00:00:00Z', subscription_tier: 'Business',
      monthly_remaining: 42, topup_credits: 300, topup_next_expiry: '2027-11-02T10:00:00Z' }, true))
      .toMatchObject({ remaining: 342, monthlyRemaining: 42, topupCredits: 300, topupNextExpiry: '2027-11-02T10:00:00Z' });
  });
  it('an owner with no row: 50 monthly plus their top-up credits', () => {
    expect(parseCreditsInfo({ credits_remaining: 150, credits_limit: 50, monthly_remaining: 50, topup_credits: 100, topup_next_expiry: '2027-11-02T10:00:00Z' }, false))
      .toMatchObject({ remaining: 150, monthlyRemaining: 50, topupCredits: 100 });
  });
  it('lines: "left this month" is monthly only; the top-up line', () => {
    expect(creditsLeftLine({ remaining: 342, limit: 250, monthlyRemaining: 42, topupCredits: 300 })).toBe('42 of 250 AI credits left this month');
    expect(topupLine({ topupCredits: 300, topupNextExpiry: '2027-11-02T10:00:00Z' })).toBe('+ 300 top-up credits (expire from 2 November 2027)');
    expect(topupLine({ topupCredits: 1, topupNextExpiry: null })).toBe('+ 1 top-up credit');
    expect(topupLine({ topupCredits: 0, topupNextExpiry: null })).toBeNull();
  });
  it('the SQL answers carry the fields the app reads', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sql = fs.readFileSync(path.resolve(__dirname, '../../docs/phase37/proposal.sql'), 'utf8');
    for (const k of ["'monthly_remaining'", "'topup_credits'", "'topup_next_expiry'"]) expect(sql).toContain(k);
  });
});
