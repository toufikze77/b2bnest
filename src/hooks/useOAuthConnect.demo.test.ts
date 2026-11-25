// Demo read-only: connecting an integration is not started for a demo person. For anyone else a failure to start
// (for example sign-oauth-state answering 500) shows a message instead of doing nothing.
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

import { OAUTH_START_FAILED, useOAuthConnect } from './useOAuthConnect';
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
  it('normal mode: starts the connection as before; when sign-oauth-state fails it says so (once) instead of doing nothing', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useOAuthConnect());
    await result.current.initiateOAuth({ provider: 'notion' });
    expect(st.invoke).toHaveBeenCalledWith('sign-oauth-state');
    expect(st.toastError).toHaveBeenCalledTimes(1);
    expect(st.toastError).toHaveBeenCalledWith('Could not start the connection. Please try again.');
    expect(OAUTH_START_FAILED).toBe('Could not start the connection. Please try again.');
    expect(logged).toHaveBeenCalledWith('OAuth error:', expect.any(Error));
    expect(st.toastError).not.toHaveBeenCalledWith(DEMO_READONLY_MESSAGE);
  });
  it('normal mode: a thrown error (network) shows the same message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    st.invoke.mockImplementationOnce(async () => { throw new TypeError('Failed to fetch'); });
    const { result } = renderHook(() => useOAuthConnect());
    await result.current.initiateOAuth({ provider: 'google_calendar' });
    expect(st.toastError).toHaveBeenCalledWith(OAUTH_START_FAILED);
  });
});
