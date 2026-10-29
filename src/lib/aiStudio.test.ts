import { describe, expect, it } from 'vitest';
import { accessFromState, type AccessStateRow } from './access';
import { aiFeatureLock, creditsLeftText, resultLabel, EXAMPLE_FIGURES_LABEL, GENERAL_TRENDS_LABEL } from './aiStudio';
import { checkAccess } from '../../supabase/functions/_shared/access.ts';
import { workflowsIncluded } from '../../supabase/functions/_shared/workflow-access.ts';

const row = (state: AccessStateRow['state'], plan_key: string | null = null, via: 'self' | 'company' = 'self'): AccessStateRow =>
  ({ state, plan_key, via, trial_ends_at: null, days_left: 0, subscription_status: plan_key ? 'active' : null });

describe('AI Studio locks follow the server rules (Phase 20)', () => {
  const rows = [row('trial'), row('owner'), row('subscribed', 'starter'), row('subscribed', 'professional'), row('subscribed', 'enterprise'),
    row('subscribed', 'starter', 'company'), row('trial_ended'), row('trial_ended', null, 'company'), row('suspended')];

  it('Advisor, Analytics and Personalization are locked exactly when the AI functions refuse (checkAccess)', async () => {
    for (const r of rows) {
      const server = await checkAccess({ rpc: () => Promise.resolve({ data: [r], error: null }) });
      for (const id of ['advisor', 'analytics', 'personalization'] as const) {
        expect(!!aiFeatureLock(accessFromState(r), id), `${id} ${JSON.stringify(r)}`).toBe(!server.ok);
      }
    }
  });

  it('Workflows are locked exactly when the workflow rule refuses (Solo, trial ended, suspended)', () => {
    for (const r of rows) {
      expect(!!aiFeatureLock(accessFromState(r), 'workflows'), JSON.stringify(r)).toBe(!workflowsIncluded(r));
    }
    expect(aiFeatureLock(accessFromState(row('subscribed', 'starter')), 'workflows')!.badge).toBe('Business');
    expect(aiFeatureLock(accessFromState(row('subscribed', 'starter', 'company')), 'workflows')!.message).toMatch(/company's plan/);
  });

  it('a suspended account never gets plan or payment wording; an unknown state is never shown locked', () => {
    const s = aiFeatureLock(accessFromState(row('suspended')), 'advisor')!;
    expect([s.action, s.badge]).toEqual(['contact', 'Unavailable']);
    expect(aiFeatureLock({ state: 'unknown', planKey: null, via: 'self' }, 'advisor')).toBeNull();
    expect(aiFeatureLock({ state: 'unknown', planKey: null, via: 'self' }, 'workflows')).toBeNull();
  });
});

describe('labels', () => {
  it('cost and document results say example figures; trends say general', () => {
    expect(resultLabel('cost_forecast', 'example_figures')).toBe(EXAMPLE_FIGURES_LABEL);
    expect(resultLabel('document_usage', undefined)).toBe(EXAMPLE_FIGURES_LABEL);
    expect(resultLabel('industry_trend', undefined)).toBe(GENERAL_TRENDS_LABEL);
  });
  it('credits left only when the server sent both numbers', () => {
    expect(creditsLeftText({ credits_remaining: 41, credits_limit: 250 })).toBe('You have 41 of 250 AI credits left this month.');
    expect(creditsLeftText({ credits_remaining: 41 })).toBeNull();
    expect(creditsLeftText(null)).toBeNull();
  });
});
