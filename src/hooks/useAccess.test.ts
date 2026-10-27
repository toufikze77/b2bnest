import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const tables: Record<string, { data: unknown; error: unknown }> = {};
const from = (t: string) => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => tables[t], then: (r: (v: unknown) => void) => r(tables[t]) };
  return q;
};
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (t: string) => from(t) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));

import { fetchAccess } from './useAccess';

describe('fetchAccess', () => {
  beforeEach(() => { rpc.mockReset(); });

  it('reads my_access_state() and maps the row', async () => {
    rpc.mockResolvedValue({ data: [{ state: 'trial_ended', via: 'company', owner_name: 'Bea', days_left: 0, trial_ends_at: null, plan_key: null, subscription_status: null }], error: null });
    const a = await fetchAccess('u1');
    expect(rpc).toHaveBeenCalledWith('my_access_state');
    expect(a).toMatchObject({ state: 'trial_ended', via: 'company', ownerName: 'Bea', hasAccess: false });
  });

  it('before the SQL is applied (PGRST202) it falls back to the same rules on the caller\'s own rows', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.my_access_state' } });
    tables.user_roles = { data: [{ role: 'user' }], error: null };
    tables.profiles = { data: { trial_ends_at: '2020-01-01T00:00:00Z' }, error: null };
    tables.subscribers = { data: null, error: null };
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect((await fetchAccess('u1')).state).toBe('trial_ended');
    tables.subscribers = { data: { subscribed: true, subscription_status: 'active', plan_key: 'starter' }, error: null };
    expect((await fetchAccess('u1')).state).toBe('subscribed');
  });

  it('any other error is "unknown" (no paywall shown on a network error)', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '500', message: 'boom' } });
    expect((await fetchAccess('u1')).state).toBe('unknown');
  });
});
