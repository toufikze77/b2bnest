import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accessFromState, type Access } from '@/lib/access';

let user: { id: string; email: string } | null = { id: 'u1', email: 'u@t.test' };
let access: Access & { loading: boolean };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user, loading: false }) }));
vi.mock('@/hooks/useAccess', () => ({ useAccess: () => access }));
vi.mock('@/components/PricingPlans', () => ({ default: ({ variant }: { variant?: string }) => <div data-testid="plans">plans:{variant}<button>Subscribe</button></div> }));

import PaywallGate, { NOTHING_DELETED, NOTHING_DELETED_MEMBER } from './PaywallGate';
import TrialBanner from './TrialBanner';

const set = (state: 'owner' | 'subscribed' | 'trial' | 'trial_ended', over: Record<string, unknown> = {}) => {
  access = { ...accessFromState({ state, trial_ends_at: null, days_left: 3, plan_key: null, subscription_status: null, via: 'self', ...over }), loading: false };
};
const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><PaywallGate><p>the app</p></PaywallGate></MemoryRouter>);

describe('PaywallGate', () => {
  beforeEach(() => { user = { id: 'u1', email: 'u@t.test' }; set('trial'); });

  it('blocks the app when the trial has ended (owner view: three plans, links, no deletion)', () => {
    set('trial_ended');
    at('/dashboard');
    expect(screen.queryByText('the app')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Your 14-day trial has ended' })).toBeInTheDocument();
    expect(screen.getByTestId('plans')).toHaveTextContent('plans:paywall');
    expect(screen.getByText(NOTHING_DELETED)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings: billing' })).toHaveAttribute('href', '/settings?tab=billing');
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
  });

  it('member view: names the owner, no payment buttons', () => {
    set('trial_ended', { via: 'company', owner_name: 'Bea Boss' });
    at('/crm');
    expect(screen.getByRole('heading', { level: 1, name: "Your company's trial has ended" })).toBeInTheDocument();
    expect(screen.getByText(/Ask Bea Boss to choose a plan/)).toBeInTheDocument();
    expect(screen.queryByTestId('plans')).toBeNull();
    expect(screen.queryByRole('button', { name: /subscribe/i })).toBeNull();
    expect(screen.getByText(NOTHING_DELETED_MEMBER)).toBeInTheDocument();
  });

  it('member view without a name on file says "the account owner"', () => {
    set('trial_ended', { via: 'company', owner_name: null });
    at('/crm');
    expect(screen.getByText(/Ask the account owner to choose a plan/)).toBeInTheDocument();
  });

  it.each(['/pricing', '/settings', '/support/portal', '/help', '/contact', '/business-resources', '/knowledge-base/security', '/f/x', '/p/y', '/forms/b2b', '/onboarding'])(
    'does not block the exempt route %s', (path) => {
      set('trial_ended');
      at(path);
      expect(screen.getByText('the app')).toBeInTheDocument();
    });

  it.each(['owner', 'subscribed', 'trial'] as const)('does not block when the state is %s', (state) => {
    set(state);
    at('/dashboard');
    expect(screen.getByText('the app')).toBeInTheDocument();
  });

  it('does not block signed-out visitors or while loading', () => {
    set('trial_ended');
    user = null;
    at('/dashboard');
    expect(screen.getByText('the app')).toBeInTheDocument();
    user = { id: 'u1', email: 'u@t.test' };
    access = { ...access, loading: true };
    at('/crm');
    expect(screen.getAllByText('the app').length).toBeGreaterThan(0);
  });
});

describe('TrialBanner', () => {
  it('shows days left with a link to Pricing during a trial', () => {
    set('trial', { days_left: 6 });
    render(<MemoryRouter><TrialBanner /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Free trial: 6 days left');
    expect(screen.getByRole('link', { name: 'Choose a plan' })).toHaveAttribute('href', '/pricing');
  });

  it.each(['owner', 'subscribed', 'trial_ended'] as const)('is hidden for %s', (state) => {
    set(state);
    const { container } = render(<MemoryRouter><TrialBanner /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
