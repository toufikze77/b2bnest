// Demo read-only: connecting an integration is not started for a demo person; for anyone else nothing changes.
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({ invoke: vi.fn(async () => ({ data: null, error: { message: 'stop here' } })), toastError: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    functions: { invoke: st.invoke },
  },
}));
vi.mock('sonner', () => ({ toast: { error: st.toastError } }));

import { useOAuthConnect } from './useOAuthConnect';
import { DEMO_READONLY_MESSAGE, resetDemoMode, setDemoNow } from '@/lib/demoMode';

afterEach(() => { resetDemoMode(); st.invoke.mockClear(); st.toastError.mockClear(); });

describe('useOAuthConnect in demo mode', () => {
  it('demo: no server call, the view-only message instead', async () => {
    setDemoNow(true);
    const { result } = renderHook(() => useOAuthConnect());
    await result.current.initiateOAuth({ provider: 'notion' });
    expect(st.invoke).not.toHaveBeenCalled();
    expect(st.toastError).toHaveBeenCalledWith(DEMO_READONLY_MESSAGE);
  });
  it('normal mode: starts the connection as before', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useOAuthConnect());
    await result.current.initiateOAuth({ provider: 'notion' });
    expect(st.invoke).toHaveBeenCalledWith('sign-oauth-state');
    expect(st.toastError).not.toHaveBeenCalled();
  });
});
