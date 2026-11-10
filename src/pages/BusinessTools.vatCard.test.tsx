// The Business Tools card for the VAT tool. While HMRC is hidden from a person it is titled "VAT Return"; people with
// HMRC access keep the "HMRC Integration Suite" card.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({ canUse: false }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, loading: false, signOut: vi.fn() }) }));
vi.mock('@/hooks/useAccess', () => ({ useAccess: () => ({ loading: false, trialEnded: false, suspended: false, state: 'subscribed', hasAccess: true, via: 'self', ownerName: null }) }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: true }) }));
vi.mock('@/hooks/useFavoriteTools', () => ({ useFavoriteTools: () => ({ favorites: [], toggleFavorite: vi.fn(), isFavorited: () => false }) }));
vi.mock('@/components/BusinessToolsSEO', () => ({ default: () => null }));
vi.mock('@/components/PricingPlans', () => ({ default: () => null }));
vi.mock('@/lib/hmrcAccess', async (orig) => ({
  ...(await orig<object>()),
  useHmrcCustomerAccess: () => ({ loading: false, state: st.canUse ? 'visible' : 'hidden', tester: false, canUse: st.canUse }),
}));
const chain: Record<string, unknown> = new Proxy({}, { get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => void) => ok({ data: [], error: null }) : () => chain) });
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => chain, rpc: async () => ({ data: null, error: null }) } }));

import BusinessTools from './BusinessTools';

const page = () => render(<MemoryRouter initialEntries={['/business-tools']}><BusinessTools /></MemoryRouter>);

describe('the VAT tool card', () => {
  it('without HMRC access: titled "VAT Return", never "VAT return preview"', () => {
    st.canUse = false;
    page();
    expect(screen.getAllByText('VAT Return', { exact: true }).length).toBeGreaterThan(0);
    expect(screen.queryByText('VAT return preview', { exact: true })).toBeNull();
    expect(screen.queryByText('HMRC Integration Suite', { exact: true })).toBeNull();
  });
  it('with HMRC access: the HMRC Integration Suite card, unchanged', () => {
    st.canUse = true;
    page();
    expect(screen.getAllByText('HMRC Integration Suite', { exact: true }).length).toBeGreaterThan(0);
    expect(screen.queryByText('VAT Return', { exact: true })).toBeNull();
  });
});
