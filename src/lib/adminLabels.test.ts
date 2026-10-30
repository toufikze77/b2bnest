import { describe, expect, it } from 'vitest';
import { NO_PLAN, planDisplayName, planKeyOf } from './plans';
import { accountPlanLabel, csvPlanRows, subscriptionStatusLabel } from './adminLabels';

describe('planDisplayName (Phase 22): one display name for every stored plan value', () => {
  it('every key and tier name, any case, legacy keys', () => {
    const cases: [string | null | undefined, string][] = [
      ['starter', 'Solo'], ['Starter', 'Solo'], ['STARTER', 'Solo'], [' starter ', 'Solo'],
      ['professional', 'Business'], ['Professional', 'Business'], ['pRoFeSsIoNaL', 'Business'], ['professional_legacy', 'Business'],
      ['enterprise', 'Scale'], ['Enterprise', 'Scale'], ['enterprise_legacy', 'Scale'],
    ];
    for (const [v, name] of cases) expect(planDisplayName(v), String(v)).toBe(name);
  });
  it('missing, "free" and unknown values are "No plan", never the raw value or "Free"', () => {
    for (const v of [null, undefined, '', '  ', 'free', 'Free', 'gold', 'premium', 'paid']) expect(planDisplayName(v), String(v)).toBe(NO_PLAN);
  });
  it('planKeyOf gives the stored key for CSV key columns', () => {
    expect(['Starter', 'professional', 'Enterprise', 'professional_legacy', 'free', null].map(planKeyOf))
      .toEqual(['starter', 'professional', 'enterprise', 'professional', null, null]);
  });
});

describe('accountPlanLabel (Admin → Users Plan column)', () => {
  it('paying accounts show the plan; others show their real access state; never "Free"', () => {
    expect(accountPlanLabel({ subscribed: true, plan: 'Professional', plan_key: 'professional', access_state: 'subscribed' })).toBe('Business');
    expect(accountPlanLabel({ subscribed: true, plan: 'Enterprise' })).toBe('Scale');
    expect(accountPlanLabel({ subscribed: false, access_state: 'trial' })).toBe('Trial');
    expect(accountPlanLabel({ subscribed: false, access_state: 'trial_ended' })).toBe('Trial ended');
    expect(accountPlanLabel({ subscribed: false, access_state: 'suspended' })).toBe('Suspended');
    expect(accountPlanLabel({ subscribed: false, access_state: 'owner' })).toBe('Full access (owner)');
    // Before the Phase 22 SQL: no access_state, so the old trial flag, else "No plan".
    expect(accountPlanLabel({ subscribed: false, is_trial_active: true })).toBe('Trial');
    expect(accountPlanLabel({ subscribed: false, is_trial_active: false })).toBe(NO_PLAN);
    expect(accountPlanLabel({ subscribed: false, plan: 'free' })).toBe(NO_PLAN);
  });
});

describe('subscription statuses and CSV rows', () => {
  it('status labels', () => {
    expect(['active', 'cancelled', 'not_completed', 'no_plan', 'free', 'trial', undefined].map(subscriptionStatusLabel))
      .toEqual(['Active', 'Cancelled', 'Checkout not completed', NO_PLAN, NO_PLAN, 'Trial', NO_PLAN]);
  });
  it('CSV: plan becomes the display name, the raw key stays in its own column, "free" status becomes no_plan', () => {
    expect(csvPlanRows([
      { email: 'a', plan: 'Professional', plan_key: 'professional', subscribed: true, status: 'active' },
      { email: 'b', plan: 'free', plan_key: null, subscribed: false, status: 'free' },
      { email: 'c', plan: 'Enterprise', plan_key: 'enterprise', subscribed: false, status: 'cancelled' },
    ])).toEqual([
      { email: 'a', plan: 'Business', plan_key: 'professional', subscribed: true, status: 'active' },
      { email: 'b', plan: NO_PLAN, plan_key: '', subscribed: false, status: 'no_plan' },
      { email: 'c', plan: 'Scale', plan_key: 'enterprise', subscribed: false, status: 'cancelled' },
    ]);
    expect(csvPlanRows([{ name: 'Acme', subscription_plan: 'Starter' }], 'subscription_plan')).toEqual([{ name: 'Acme', subscription_plan: 'Solo', plan_key: 'starter' }]);
  });
});
