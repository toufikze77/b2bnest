import { describe, expect, it } from 'vitest';
import * as accessModule from './access';
import { accessFromState, isPaywallExempt, legacyStateRow, trialBannerText, type AccessStateRow } from './access';

const row = (over: Partial<AccessStateRow>): AccessStateRow => ({
  state: 'trial', trial_ends_at: '2026-11-10T00:00:00Z', days_left: 5, plan_key: null, subscription_status: null, via: 'self', owner_name: null, ...over,
});

describe('accessFromState', () => {
  it('owner, subscribed and trial have access; trial_ended does not', () => {
    for (const s of ['owner', 'subscribed', 'trial'] as const) expect(accessFromState(row({ state: s })).hasAccess).toBe(true);
    const ended = accessFromState(row({ state: 'trial_ended', days_left: 0 }));
    expect([ended.hasAccess, ended.trialEnded, ended.inTrial]).toEqual([false, true, false]);
  });

  it('maps every field of the row', () => {
    const a = accessFromState(row({ state: 'subscribed', plan_key: 'starter', subscription_status: 'past_due', via: 'company', owner_name: '  Bea Boss ', days_left: 0 }));
    expect(a).toMatchObject({ state: 'subscribed', planKey: 'starter', subscriptionStatus: 'past_due', via: 'company', ownerName: 'Bea Boss', daysLeft: 0 });
  });

  it('days left is never negative or fractional; empty owner name becomes null', () => {
    expect(accessFromState(row({ days_left: -3 })).daysLeft).toBe(0);
    expect(accessFromState(row({ days_left: 2.7 })).daysLeft).toBe(2);
    expect(accessFromState(row({ days_left: null })).daysLeft).toBe(0);
    expect(accessFromState(row({ owner_name: '   ' })).ownerName).toBeNull();
  });

  it('a missing or unknown row is "unknown": no paywall (the server still refuses paid work)', () => {
    for (const r of [null, undefined, { ...row({}), state: 'free' } as unknown as AccessStateRow]) {
      expect(accessFromState(r)).toMatchObject({ state: 'unknown', hasAccess: true, trialEnded: false });
    }
  });
});

describe('legacyStateRow (only until my_access_state is applied)', () => {
  const now = new Date('2026-10-27T12:00:00Z');
  it('applies the same order: owner, subscribed, trial, trial_ended', () => {
    expect(legacyStateRow({ roles: ['admin'], trialEndsAt: '2026-01-01T00:00:00Z', subscriber: null, now }).state).toBe('owner');
    expect(legacyStateRow({ roles: ['user'], trialEndsAt: '2026-01-01T00:00:00Z', subscriber: { subscription_status: 'past_due' }, now }).state).toBe('subscribed');
    expect(legacyStateRow({ roles: [], trialEndsAt: '2026-01-01T00:00:00Z', subscriber: { subscription_status: 'canceled', subscribed: true }, now }).state).toBe('trial_ended');
    expect(legacyStateRow({ roles: [], trialEndsAt: '2026-01-01T00:00:00Z', subscriber: { subscription_status: null, subscribed: true }, now }).state).toBe('subscribed');
    const t = legacyStateRow({ roles: [], trialEndsAt: '2026-10-30T13:00:00Z', subscriber: null, now });
    expect([t.state, t.days_left]).toEqual(['trial', 4]);
    expect(legacyStateRow({ roles: [], trialEndsAt: now.toISOString(), subscriber: null, now }).state).toBe('trial_ended');
    expect(legacyStateRow({ roles: [], trialEndsAt: null, subscriber: null, now }).state).toBe('trial_ended');
  });
});

describe('trial banner and exempt routes', () => {
  it('banner only during a trial, with the right plural', () => {
    expect(trialBannerText(accessFromState(row({ days_left: 5 })))).toBe('Free trial: 5 days left');
    expect(trialBannerText(accessFromState(row({ days_left: 1 })))).toBe('Free trial: 1 day left');
    for (const s of ['owner', 'subscribed', 'trial_ended'] as const) expect(trialBannerText(accessFromState(row({ state: s })))).toBeNull();
  });

  it('exempt routes stay open after the trial ends', () => {
    for (const p of ['/pricing', '/settings', '/settings/', '/auth', '/forgot-password', '/reset-password', '/join', '/onboarding', '/profile-setup',
      '/payment-success', '/support/portal', '/help', '/contact', '/privacy', '/terms', '/business-resources', '/knowledge-base',
      '/knowledge-base/security', '/blog', '/f/abc', '/p/my-page', '/forms/b2b', '/forms/work-request']) {
      expect(isPaywallExempt(p), p).toBe(true);
    }
  });

  it('the app itself is not exempt', () => {
    for (const p of ['/dashboard', '/crm', '/project-management', '/business-tools', '/support-desk', '/workspaces/1', '/rota', '/ai-studio', '/pricingx', '/fo', '/admin']) {
      expect(isPaywallExempt(p), p).toBe(false);
    }
  });

  it('no email-based owner list is left in the access module (Phase 12b: owner access comes only from the server)', () => {
    expect(Object.keys(accessModule).filter((k) => /email|owner_?emails/i.test(k))).toEqual([]);
  });
});

describe('suspended (Phase 12c)', () => {
  it('maps to no access, not trial_ended, no trial, no plan, and no banner', () => {
    const a = accessFromState({ state: 'suspended', trial_ends_at: null, days_left: 0, plan_key: null, subscription_status: null, via: 'self', owner_name: null });
    expect(a).toMatchObject({ state: 'suspended', suspended: true, hasAccess: false, trialEnded: false, inTrial: false, daysLeft: 0, planKey: null, via: 'self' });
    expect(trialBannerText(a)).toBeNull();
  });

  it('every other state is not suspended', () => {
    for (const s of ['owner', 'subscribed', 'trial', 'trial_ended'] as const) expect(accessFromState(row({ state: s })).suspended).toBe(false);
    expect(accessFromState(null).suspended).toBe(false);
  });
});

import { UNKNOWN_ACCESS, workflowsFor, workflowsIncluded, workflowsNeedUpgrade } from './access';
import { workflowsIncluded as serverRule } from '../../supabase/functions/_shared/workflow-access.ts';

describe('workflows by plan (Phase 19): the app uses the same rule as the server', () => {
  const row = (state: AccessStateRow['state'], plan_key: string | null, via: 'self' | 'company' = 'self'): AccessStateRow =>
    ({ state, plan_key, via, trial_ends_at: null, days_left: 0, subscription_status: plan_key ? 'active' : null });
  it('every state and plan, including company members and unknown plans', () => {
    const cases: [AccessStateRow, boolean, boolean][] = [
      [row('trial', null), true, false],
      [row('trial', null, 'company'), true, false],
      [row('owner', null), true, false],
      [row('subscribed', 'professional'), true, false],
      [row('subscribed', 'enterprise'), true, false],
      [row('subscribed', 'professional', 'company'), true, false],
      [row('subscribed', 'starter'), false, true],
      [row('subscribed', 'starter', 'company'), false, true],
      [row('subscribed', 'gold'), false, true],
      [row('subscribed', null), false, true],
      [row('trial_ended', null), false, false],
      [row('suspended', null), false, false],
    ];
    for (const [r, included, upgrade] of cases) {
      const a = accessFromState(r);
      expect(workflowsIncluded(a), JSON.stringify(r)).toBe(included);
      expect(workflowsNeedUpgrade(a), JSON.stringify(r)).toBe(upgrade);
      expect(workflowsIncluded(a)).toBe(serverRule({ state: r.state, plan_key: r.plan_key, via: r.via }));
    }
  });
  it('access not read yet (unknown) is not "included", but never shows the upgrade panel either', () => {
    expect(workflowsFor(UNKNOWN_ACCESS)).toEqual({ included: false, reason: 'unknown_state', via: 'self' });
    expect(workflowsNeedUpgrade(UNKNOWN_ACCESS)).toBe(false);
  });
});
