// The demo account is internal for now: with the default SHOW_DEMO_BANNER (false) no banner shows, but demo mode
// itself (hidden buttons, friendly errors) still works. (Separate file: vi.mock in demoMode.test.tsx turns the banner on.)
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async (fn: string) => (fn === 'is_demo_readonly' ? { data: true, error: null } : { data: null, error: null }),
    auth: { signOut: async () => ({ error: null }) },
  },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, loading: false }) }));

import { DemoModeProvider } from '@/contexts/DemoModeContext';
import DemoBanner from './DemoBanner';
import { isDemoNow, SHOW_DEMO_BANNER } from '@/lib/demoMode';

describe('demo banner switched off (default)', () => {
  it('a demo user sees no banner, while demo mode is still on', async () => {
    expect(SHOW_DEMO_BANNER).toBe(false);
    render(<MemoryRouter><DemoModeProvider><DemoBanner /></DemoModeProvider></MemoryRouter>);
    await waitFor(() => expect(isDemoNow()).toBe(true));
    expect(screen.queryByTestId('demo-banner')).toBeNull();
  });
});
