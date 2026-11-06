// Demo read-only: the banner and the hidden controls show only in demo mode; normal mode is unchanged.
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({
  demo: { data: false as unknown, error: null as unknown },
  user: { id: 'u1' } as { id: string } | null,
  calls: [] as string[],
  signOut: vi.fn(async (_o?: unknown) => ({ error: null })),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async (fn: string) => { st.calls.push(fn); return fn === 'is_demo_readonly' ? st.demo : { data: null, error: null }; },
    auth: { signOut: (o?: unknown) => st.signOut(o) },
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'order', 'limit']) q[m] = () => q;
      q.then = (ok: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(ok);
      return q;
    },
  },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: st.user, loading: false }) }));
// The banner is switched off by default (SHOW_DEMO_BANNER); these tests check it as it would show when switched on.
// vi.mock is hoisted to the whole file; the Security tests below do not depend on the flag.
vi.mock('@/lib/demoMode', async (orig) => ({ ...(await orig<typeof import('@/lib/demoMode')>()), SHOW_DEMO_BANNER: true }));
vi.mock('@/components/twoStep/TwoStepSetup', () => ({ default: () => <div data-testid="two-step-setup">Two-step setup</div> }));

import { DemoModeProvider } from '@/contexts/DemoModeContext';
import DemoBanner from './DemoBanner';
import AccountSecurity from '@/components/settings/AccountSecurity';
import { isDemoNow, resetDemoMode } from '@/lib/demoMode';

const show = (el: React.ReactElement) => render(<MemoryRouter><DemoModeProvider>{el}</DemoModeProvider></MemoryRouter>);

beforeEach(() => { st.calls = []; st.user = { id: 'u1' }; st.demo = { data: false, error: null }; st.signOut.mockClear(); resetDemoMode(); });

describe('demo banner', () => {
  it('demo mode: a calm status banner with a Sign up action', async () => {
    st.demo = { data: true, error: null };
    show(<DemoBanner />);
    const banner = await screen.findByTestId('demo-banner');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveTextContent('Demo account: view only. Sign up free to try it with your own data.');
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
    expect(isDemoNow()).toBe(true);
    expect(st.calls.filter((c) => c === 'is_demo_readonly')).toHaveLength(1);
  });
  it('Sign up signs out this device only (the demo login is shared)', async () => {
    st.demo = { data: true, error: null };
    show(<DemoBanner />);
    (await screen.findByRole('button', { name: 'Sign up' })).click();
    await waitFor(() => expect(st.signOut).toHaveBeenCalledWith({ scope: 'local' }));
  });
  it('normal mode, an error, or signed out: no banner', async () => {
    for (const demo of [{ data: false, error: null }, { data: null, error: { code: 'PGRST202' } }]) {
      st.demo = demo;
      const { unmount } = show(<DemoBanner />);
      await waitFor(() => expect(st.calls).toContain('is_demo_readonly'));
      expect(screen.queryByTestId('demo-banner')).toBeNull();
      expect(isDemoNow()).toBe(false);
      unmount(); st.calls = [];
    }
    st.user = null;
    show(<DemoBanner />);
    expect(screen.queryByTestId('demo-banner')).toBeNull();
    expect(st.calls).toEqual([]);
  });
});

describe('Settings → Security in demo mode', () => {
  it('demo: two-step setup and "sign out other devices" are replaced by the view-only note', async () => {
    st.demo = { data: true, error: null };
    show(<AccountSecurity />);
    await waitFor(() => expect(screen.getAllByTestId('demo-readonly-note')).toHaveLength(2));
    expect(screen.queryByTestId('two-step-setup')).toBeNull();
    expect(screen.queryByRole('button', { name: /Sign out other devices/ })).toBeNull();
    expect(screen.getAllByTestId('demo-readonly-note')[0]).toHaveTextContent('This is a demo account. It is view only.');
  });
  it('normal mode: unchanged', async () => {
    show(<AccountSecurity />);
    await waitFor(() => expect(st.calls).toContain('is_demo_readonly'));
    expect(screen.getByTestId('two-step-setup')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign out other devices/ })).toBeInTheDocument();
    expect(screen.queryByTestId('demo-readonly-note')).toBeNull();
  });
});
