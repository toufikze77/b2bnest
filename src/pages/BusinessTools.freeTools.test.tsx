// Phase 38: the free tools open for everyone; the Business Finance Assistant keeps its account and plan rules.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({ user: null as null | { id: string }, access: { loading: false, trialEnded: false, suspended: false, state: 'unknown', via: 'self', ownerName: null } as Record<string, unknown> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: st.user, loading: false, signOut: vi.fn() }) }));
vi.mock('@/hooks/useAccess', () => ({ useAccess: () => st.access }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: false }) }));
vi.mock('@/hooks/useFavoriteTools', () => ({ useFavoriteTools: () => ({ favorites: [], toggleFavorite: vi.fn(), isFavorited: () => false }) }));
vi.mock('@/components/BusinessToolsSEO', () => ({ default: () => null }));
vi.mock('@/components/PricingPlans', () => ({ default: () => <p>Plans</p> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: new Proxy({}, { get: () => { throw new Error('a free tool must not call the database'); } }) }));

import BusinessTools from './BusinessTools';
import PaywallGate from '@/components/access/PaywallGate';

const TOOLS: [string, RegExp][] = [
  ['roi-calculator', /^ROI Calculator$/],
  ['goal-tracker', /^Goal Tracker$/],
  ['customer-survey-builder', /^Customer Survey Builder$/],
  ['cost-calculator', /^Business set-up cost calculator \(UK\)$/],
  ['setup-checklist', /^Business set-up checklist \(UK\)$/],
  ['compliance', /^Compliance checker \(UK\)$/],
  ['best-practices', /^Business good practice guide$/],
];
const open = (tool: string) => render(
  <MemoryRouter initialEntries={[`/business-tools?tool=${tool}`]}>
    <Routes><Route path="/business-tools" element={<PaywallGate><BusinessTools /></PaywallGate>} /></Routes>
  </MemoryRouter>,
);
const asTrialEnded = () => { st.user = { id: 'u1' }; st.access = { ...st.access, state: 'trial_ended', trialEnded: true, suspended: false }; };
const asSuspended = () => { st.user = { id: 'u1' }; st.access = { ...st.access, state: 'suspended', trialEnded: false, suspended: true }; };

beforeEach(() => { st.user = null; st.access = { loading: false, trialEnded: false, suspended: false, state: 'unknown', via: 'self', ownerName: null }; localStorage.clear(); sessionStorage.clear(); });

describe('free Business Tools open for everyone (Phase 38)', () => {
  for (const who of ['signed out', 'trial ended', 'suspended'] as const) {
    it.each(TOOLS)(`${who}: %s shows the tool itself, with the advert card`, (tool, heading) => {
      if (who === 'trial ended') asTrialEnded();
      if (who === 'suspended') asSuspended();
      open(tool);
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
      expect(screen.queryByText('Sign in to use this tool')).toBeNull();
      expect(screen.queryByText(/trial has ended/i)).toBeNull();
      expect(screen.queryByText(/account has been suspended/i)).toBeNull();
      expect(screen.getByTestId('free-tools-banner')).toBeInTheDocument();
    });
  }

  it('the Business Finance Assistant still asks a signed-out visitor to sign in', () => {
    open('business-finance-assistant');
    expect(screen.getByText('Sign in to use this tool')).toBeInTheDocument();
    expect(screen.queryByTestId('free-tools-banner')).toBeNull();
  });

  it('the Business Finance Assistant is still behind the paywall after a trial ends', () => {
    asTrialEnded();
    open('business-finance-assistant');
    expect(screen.getByText('Your 14-day trial has ended')).toBeInTheDocument();
  });
});
