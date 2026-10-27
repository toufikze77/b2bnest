import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let user: { id: string; email: string } | null = null;
let access: { state: string; daysLeft: number } = { state: 'unknown', daysLeft: 0 };
const invoke = vi.fn(async () => ({ data: null, error: null }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user }) }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ subscribed: false, subscription_tier: 'free', access }) }));
vi.mock('@/hooks/useBillingStatus', () => ({ useBillingStatus: () => ({ status: null }), poundsText: (p: number) => `£${p / 100}` }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...(a as [])) } } }));

import PricingPlans, { TRIAL_FAQ_ANSWER } from './PricingPlans';

const show = (variant?: 'page' | 'paywall') => render(<MemoryRouter><PricingPlans variant={variant} /></MemoryRouter>);

describe('PricingPlans', () => {
  beforeEach(() => { user = null; access = { state: 'unknown', daysLeft: 0 }; invoke.mockClear(); });

  it('FAQ: the trial ends after 14 days', () => {
    show();
    expect(TRIAL_FAQ_ANSWER).toBe('Every new account gets a 14-day free trial of all features. No card is needed. After 14 days you choose a plan to continue.');
    expect(screen.getByText(TRIAL_FAQ_ANSWER)).toBeInTheDocument();
    expect(screen.queryByText(/No credit card required/i)).toBeNull();
  });

  it('signed out: "Start Your Free Trial" goes to sign-up and calls nothing', () => {
    show();
    const link = screen.getByRole('link', { name: 'Start Your Free Trial' });
    expect(link).toHaveAttribute('href', '/auth?mode=signup');
    fireEvent.click(link);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('signed in during a trial: shows the days left, no trial button', () => {
    user = { id: 'u', email: 'u@t.test' };
    access = { state: 'trial', daysLeft: 9 };
    show();
    expect(screen.getAllByText(/Free trial: 9 days left/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Start Your Free Trial' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start Your Free Trial' })).toBeNull();
  });

  it('paywall variant: three plans and the monthly/annual toggle, no FAQ or trial CTA', () => {
    user = { id: 'u', email: 'u@t.test' };
    access = { state: 'trial_ended', daysLeft: 0 };
    show('paywall');
    for (const name of ['Solo', 'Business', 'Scale']) expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Annual billing' })).toBeInTheDocument();
    expect(screen.getByText('£19')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Annual billing' }));
    expect(screen.getByText('£190')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Subscribe' })).toHaveLength(3);
    expect(screen.queryByText('Frequently Asked Questions')).toBeNull();
    expect(screen.queryByText('Start Your Free Trial')).toBeNull();
  });

  it('Subscribe uses the existing checkout flow', async () => {
    user = { id: 'u', email: 'u@t.test' };
    show('paywall');
    fireEvent.click(screen.getAllByRole('button', { name: 'Subscribe' })[0]);
    expect(invoke).toHaveBeenCalledWith('create-subscription-checkout', { body: { planId: 'starter', isAnnual: false } });
  });
});

describe('activate-trial is retired from the app', () => {
  const SRC = path.resolve(__dirname, '..');
  const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
  it('no file in src calls or mentions activate-trial', () => {
    const hits = files(SRC).filter((f) => fs.readFileSync(f, 'utf8').includes('activate-trial')).map((f) => path.relative(SRC, f));
    expect(hits).toEqual([]);
  });
});
