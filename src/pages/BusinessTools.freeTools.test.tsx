// Phase 38: the free tools open for everyone; the Business Finance Assistant keeps its account and plan rules.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({ tables: [] as string[], user: null as null | { id: string }, access: { loading: false, trialEnded: false, suspended: false, state: 'unknown', via: 'self', ownerName: null } as Record<string, unknown> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: st.user, loading: false, signOut: vi.fn() }) }));
vi.mock('@/hooks/useAccess', () => ({ useAccess: () => st.access }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: false }) }));
vi.mock('@/hooks/useFavoriteTools', () => ({ useFavoriteTools: () => ({ favorites: [], toggleFavorite: vi.fn(), isFavorited: () => false }) }));
vi.mock('@/components/BusinessToolsSEO', () => ({ default: () => null }));
vi.mock('@/components/PricingPlans', () => ({ default: () => <p>Plans</p> }));
// Signed out: no database call at all. Signed in: free_tool_items before the Phase 39 SQL is applied (table missing).
const missing = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.free_tool_items' in the schema cache" } };
const chain: Record<string, unknown> = new Proxy({}, { get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => void) => ok(missing) : () => chain) });
vi.mock('@/integrations/supabase/client', () => ({ supabase: new Proxy({}, { get: (_t, k) => {
  if (k === 'from' && st.user) return (t: string) => { st.tables.push(t); return chain; };
  throw new Error('a signed-out free tool must not call the database');
} }) }));

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
const asPaying = () => { st.user = { id: 'u1' }; st.access = { ...st.access, state: 'subscribed', trialEnded: false, suspended: false, hasAccess: true }; };
const asSuspended = () => { st.user = { id: 'u1' }; st.access = { ...st.access, state: 'suspended', trialEnded: false, suspended: true }; };

beforeEach(() => { st.tables = []; st.user = null; st.access = { loading: false, trialEnded: false, suspended: false, state: 'unknown', via: 'self', ownerName: null }; localStorage.clear(); sessionStorage.clear(); });

describe('free Business Tools open for everyone (Phase 38, free tier Phase 39)', () => {
  for (const who of ['signed out', 'trial ended', 'suspended', 'paying'] as const) {
    it.each(TOOLS)(`${who}: %s shows the tool itself`, async (tool, heading) => {
      if (who === 'trial ended') asTrialEnded();
      if (who === 'suspended') asSuspended();
      if (who === 'paying') asPaying();
      open(tool);
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
      expect(screen.queryByText('Sign in to use this tool')).toBeNull();
      expect(screen.queryByText('Your 14-day trial has ended')).toBeNull();
      expect(screen.queryByText(/account has been suspended/i)).toBeNull();
      expect(screen.queryByTestId('free-tools-banner')).toBeNull(); // the generic card is gone (Phase 39)
      if (who === 'trial ended') {
        expect(screen.getByTestId('trial-ended-note')).toHaveTextContent('Your trial has ended. The free tools stay free. See plans to unlock the rest.');
        expect(screen.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/pricing');
      } else {
        expect(screen.queryByTestId('trial-ended-note')).toBeNull();
      }
      if (who === 'suspended') expect(screen.queryByRole('button', { name: /subscribe|choose a plan/i })).toBeNull();
      if (who === 'signed out' || who === 'suspended') expect(st.tables).toEqual([]); // suspended: no saving, so no reads
      if ((who === 'trial ended' || who === 'paying') && tool !== 'best-practices') {
        // Before the SQL is applied: the tool keeps working in the browser and says why it can't save to the account.
        expect(await screen.findByTestId('browser-reason')).toHaveTextContent('Saving to your account needs a database update.');
        expect(st.tables).toContain('free_tool_items');
      }
    });
  }

  it('trial ended: the Business Tools list stays open (the free tier), with the Finance Assistant promotion', () => {
    asTrialEnded();
    render(<MemoryRouter initialEntries={['/business-tools']}><Routes><Route path="/business-tools" element={<PaywallGate><BusinessTools /></PaywallGate>} /></Routes></MemoryRouter>);
    expect(screen.queryByText('Your 14-day trial has ended')).toBeNull();
    expect(screen.getByTestId('finance-assistant-promo')).toBeInTheDocument();
  });

  it('suspended: the Business Tools list is not opened (Phase 38 behaviour: only the tools themselves)', () => {
    asSuspended();
    render(<MemoryRouter initialEntries={['/business-tools']}><Routes><Route path="/business-tools" element={<PaywallGate><BusinessTools /></PaywallGate>} /></Routes></MemoryRouter>);
    expect(screen.getByText(/account has been suspended/i)).toBeInTheDocument();
  });

  it('the Business Finance Assistant still asks a signed-out visitor to sign in', () => {
    open('business-finance-assistant');
    expect(screen.getByText('Sign in to use this tool')).toBeInTheDocument();
  });

  it('the Business Finance Assistant is still behind the paywall after a trial ends', () => {
    asTrialEnded();
    open('business-finance-assistant');
    expect(screen.getByText('Your 14-day trial has ended')).toBeInTheDocument();
  });
});
