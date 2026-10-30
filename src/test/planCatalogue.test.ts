import { describe, expect, it } from 'vitest';
import { PLANS, SEAT_LIMITS_ENFORCED, SEAT_LIMITS_NOTE, limitText, planNameForTier } from '@/lib/plans';
import { PLAN_CATALOG, planFromAmount, planFromLookupKey } from '../../supabase/functions/_shared/plans.ts';

// The Pricing page (browser) and billing (server) must describe exactly the same plans.
describe('plan catalogue: browser and server agree', () => {
  it('same plans, in the same order, with the same names and stored tiers', () => {
    expect(PLANS.map((p) => [p.id, p.name, p.tier])).toEqual(Object.values(PLAN_CATALOG).map((p) => [p.key, p.name, p.tier]));
  });

  it.each(PLANS.map((p) => [p.id, p] as const))('%s: prices, AI credits and limits match', (id, plan) => {
    const s = PLAN_CATALOG[id];
    expect(plan.monthly * 100).toBe(s.prices.month.amount);
    expect(plan.annual * 100).toBe(s.prices.year.amount);
    expect(plan.aiCredits).toBe(s.aiCreditLimit);
    expect({ members: plan.users, admins: plan.admins }).toEqual(s.limits);
    if (plan.legacy || s.legacy) {
      expect(plan.legacy!.monthly * 100).toBe(s.legacy!.prices.month.amount);
      expect(plan.legacy!.annual * 100).toBe(s.legacy!.prices.year.amount);
      expect({ members: plan.legacy!.users, admins: plan.legacy!.admins }).toEqual(s.legacy!.limits);
    }
  });

  it('the owner decisions of 23 Oct 2026', () => {
    expect(PLANS.map((p) => [p.name, p.monthly, p.annual, p.users, p.admins, p.aiCredits])).toEqual([
      ['Solo', 19, 190, 1, 1, 250],
      ['Business', 59, 590, 50, 5, 1000],
      ['Scale', 89, 890, 100, 10, 5000],
    ]);
    expect(PLANS.filter((p) => p.popular).map((p) => p.name)).toEqual(['Business']);
    for (const p of PLANS) expect(p.annual).toBe(p.monthly * 10);
  });
});

describe('legacy prices', () => {
  it('existing Professional (£35/£350, 5 users) and Enterprise (£85/£850, 25 users) keep their price and user limit', () => {
    expect(PLANS.find((p) => p.id === 'professional')!.legacy).toEqual({ monthly: 35, annual: 350, users: 5, admins: 5 });
    expect(PLANS.find((p) => p.id === 'enterprise')!.legacy).toEqual({ monthly: 85, annual: 850, users: 25, admins: 10 });
    expect(PLANS.find((p) => p.id === 'starter')!.legacy).toBeUndefined();
  });

  it('the server resolves every legacy price to the right plan by lookup key or by amount', () => {
    expect(planFromLookupKey('b2bnest_professional_annual_gbp')).toMatchObject({ plan: { key: 'professional' }, legacy: true });
    expect(planFromAmount(3500, 'month')).toMatchObject({ plan: { key: 'professional' }, legacy: true });
    expect(planFromAmount(8500, 'month')).toMatchObject({ plan: { key: 'enterprise' }, legacy: true });
    expect(planFromAmount(85000, 'year')).toMatchObject({ plan: { key: 'enterprise' }, legacy: true });
  });

  it('stored tiers show the new display names', () => {
    expect(['Starter', 'Professional', 'Enterprise', 'free', null].map(planNameForTier)).toEqual(['Solo', 'Business', 'Scale', 'No plan', 'No plan']);
  });
});

describe('limits wording', () => {
  it('plain facts, and says they are not applied while enforcement is off', () => {
    expect(limitText(PLANS[1])).toBe('50 users, up to 5 admins');
    expect(limitText(PLANS[0])).toBe('1 user (you are the admin)');
    expect(SEAT_LIMITS_ENFORCED).toBe(false);
    expect(SEAT_LIMITS_NOTE).toMatch(/aren't applied yet/);
  });
});

describe('public SEO copy matches the catalogue', () => {
  it('index.html FAQ and llms.txt name today\'s plans and prices, not the old ones', async () => {
    const fs = await import('node:fs');
    for (const file of ['index.html', 'public/llms.txt']) {
      const text = fs.readFileSync(file, 'utf8');
      for (const p of PLANS) expect(text, file).toContain(p.name);
      for (const p of PLANS) expect(text, file).toContain(`£${p.monthly}`);
      expect(text, file).not.toMatch(/Professional is £35|Enterprise £85|Professional: £35|Enterprise: £85/);
    }
  });
});

// Phase 19 (owner decision 28 Oct 2026): Workflow Studio is in Business and Scale, not Solo. The Pricing list, the
// Pricing FAQ and the server rule must say the same thing.
import { WORKFLOWS_FAQ_ANSWER } from '@/components/PricingPlans';
import { WORKFLOW_PLAN_KEYS, workflowsIncluded as serverRule } from '../../supabase/functions/_shared/workflow-access.ts';
describe('workflows by plan', () => {
  it('Business and Scale list Workflow Studio; Solo does not; the server rule agrees for every plan', () => {
    const lists = Object.fromEntries(PLANS.map((p) => [p.id, p.features.join(' | ')]));
    expect(lists.starter).not.toMatch(/workflow/i);
    expect(lists.professional).toMatch(/Workflow Studio/);
    expect(lists.enterprise).toMatch(/Workflow Studio/);
    for (const p of PLANS) {
      expect(serverRule({ state: 'subscribed', plan_key: p.id }), p.id).toBe(/workflow/i.test(p.features.join(' ')));
    }
    expect([...WORKFLOW_PLAN_KEYS]).toEqual(['professional', 'enterprise']);
    expect(WORKFLOWS_FAQ_ANSWER).toMatch(/^Business and Scale include Workflow Studio\. Solo doesn't\./);
  });
});

// Phase 22: the prices Admin uses for MRR/ARR/Value (docs/phase22/proposal.sql → public.plan_prices) are the catalogue's.
import fs from 'node:fs';
import path from 'node:path';
describe('Admin price table (docs/phase22) matches the catalogue', () => {
  it('every current and legacy price, with its lookup key, plan and interval', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../../docs/phase22/proposal.sql'), 'utf8');
    const rows = [...sql.matchAll(/\('(b2bnest_[a-z_]+)',\s*'(\w+)',\s*'(month|year)',\s*(\d+),\s*(true|false)\)/g)]
      .map((m) => ({ lookupKey: m[1], plan: m[2], interval: m[3], amount: Number(m[4]), legacy: m[5] === 'true' }));
    const expected = Object.values(PLAN_CATALOG).flatMap((p) => (['month', 'year'] as const).flatMap((i) => [
      { lookupKey: p.prices[i].lookupKey, plan: p.key, interval: i, amount: p.prices[i].amount, legacy: false },
      ...(p.legacy ? [{ lookupKey: p.legacy.prices[i].lookupKey, plan: p.key, interval: i, amount: p.legacy.prices[i].amount, legacy: true }] : []),
    ]));
    const sort = (a: { lookupKey: string }, b: { lookupKey: string }) => a.lookupKey.localeCompare(b.lookupKey);
    expect(rows.sort(sort)).toEqual(expected.sort(sort));
    expect(rows).toHaveLength(10);
  });
});
