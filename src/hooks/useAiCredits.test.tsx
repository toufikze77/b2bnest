import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real hook (src/test/setup.ts swaps it for a stand-in elsewhere).
vi.unmock('@/hooks/useAiCredits');
const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  row: { data: { user_id: 'u1' } as unknown, error: null as unknown },
  filters: [] as unknown[][],
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => db.rpc(...a),
    from: (t: string) => {
      const chain = {
        select: (c: string) => { db.filters.push(['select', t, c]); return chain; },
        eq: (c: string, v: unknown) => { db.filters.push(['eq', c, v]); return chain; },
        maybeSingle: () => Promise.resolve(db.row),
      };
      return chain;
    },
  },
}));

import { aiCreditsKey, useAiCredits, useAiCreditsUpdater } from '@/hooks/useAiCredits';

const toast = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ toast, useToast: () => ({ toast }) }));

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const INFO = { credits_remaining: 42, credits_limit: 250, reset_date: '2026-12-01T00:00:00Z', subscription_tier: 'Business' };

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  db.rpc.mockReset(); db.filters = []; db.row = { data: { user_id: 'u1' }, error: null };
});

describe('useAiCredits', () => {
  it('loading, then the balance from get_ai_credits_info', async () => {
    let resolve!: (v: unknown) => void;
    db.rpc.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useAiCredits(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.remaining).toBeNull();
    await act(async () => { resolve({ data: INFO, error: null }); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ remaining: 42, limit: 250, resetDate: '2026-12-01T00:00:00Z', tier: 'Business', notStarted: false, error: null });
    expect(db.rpc).toHaveBeenCalledWith('get_ai_credits_info');
    expect(db.filters).toContainEqual(['eq', 'user_id', 'u1']);
    expect(client.getQueryState(aiCreditsKey('u1'))?.status).toBe('success');
  });

  it('error (for example the two-step guard before the code is entered): quiet, no toast, can refetch', async () => {
    db.rpc.mockResolvedValue({ data: null, error: { message: 'MFA required' } });
    const { result } = renderHook(() => useAiCredits(), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.remaining).toBeNull();
    expect(toast).not.toHaveBeenCalled();
    db.rpc.mockResolvedValue({ data: INFO, error: null });
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.remaining).toBe(42));
  });

  it('no subscribers row: notStarted, no reset date', async () => {
    db.row = { data: null, error: null };
    // Before docs/phase35 is applied the RPC still says 10 / 10; the screen shows what the server will create (50).
    db.rpc.mockResolvedValue({ data: { ...INFO, credits_remaining: 10, credits_limit: 10, subscription_tier: 'free' }, error: null });
    const { result } = renderHook(() => useAiCredits(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ remaining: 50, limit: 50, resetDate: null, notStarted: true });
  });

  it('the updater shows the credits_remaining from an AI reply at once', async () => {
    db.rpc.mockResolvedValue({ data: INFO, error: null });
    const { result } = renderHook(() => ({ c: useAiCredits(), update: useAiCreditsUpdater() }), { wrapper });
    await waitFor(() => expect(result.current.c.remaining).toBe(42));
    db.rpc.mockReturnValue(new Promise(() => {})); // the re-read stays pending: the number shown is the reply's
    act(() => result.current.update({ credits_remaining: 40, credits_limit: 250 }));
    await waitFor(() => expect(result.current.c.remaining).toBe(40));
  });
});
