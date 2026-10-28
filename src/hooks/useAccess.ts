import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { accessFromState, legacyStateRow, UNKNOWN_ACCESS, type Access, type AccessStateRow } from '@/lib/access';

// "Function does not exist yet" (PostgREST PGRST202 / Postgres 42883): docs/phase12/proposal.sql not applied.
const isMissingFunction = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function/i.test(e.message ?? ''));

type Rpc = (fn: string) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;

async function readLegacy(userId: string): Promise<Access> {
  const [roles, profile, sub] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', userId),
    supabase.from('profiles').select('trial_ends_at').eq('id', userId).maybeSingle(),
    supabase.from('subscribers').select('subscribed, subscription_status, plan_key').eq('user_id', userId).maybeSingle(),
  ]);
  if (roles.error || profile.error) return UNKNOWN_ACCESS;
  return accessFromState(legacyStateRow({
    roles: (roles.data ?? []).map((r: { role: string }) => r.role),
    trialEndsAt: (profile.data as { trial_ends_at?: string | null } | null)?.trial_ends_at ?? null,
    subscriber: (sub.data as AccessStateRow & { subscribed?: boolean } | null) ?? null,
  }));
}

export async function fetchAccess(userId: string): Promise<Access> {
  const { data, error } = await (supabase.rpc as unknown as Rpc)('my_access_state');
  if (isMissingFunction(error)) {
    console.warn('my_access_state() is not available yet; using the client fallback (docs/phase12).');
    return readLegacy(userId);
  }
  if (error) return UNKNOWN_ACCESS;
  return accessFromState((Array.isArray(data) ? data[0] : data) as AccessStateRow | null);
}

// One read per signed-in user per page load, shared by every component that asks.
const cache = new Map<string, Promise<Access>>();
export const clearAccessCache = () => cache.clear();

export function useAccess(): Access & { loading: boolean } {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<{ userId: string | null; access: Access } | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let live = true;
    if (!cache.has(userId)) cache.set(userId, fetchAccess(userId).catch(() => UNKNOWN_ACCESS));
    void cache.get(userId)!.then((access) => { if (live) setState({ userId, access }); });
    return () => { live = false; };
  }, [userId]);

  if (!userId) return { ...UNKNOWN_ACCESS, hasAccess: false, loading: authLoading };
  if (!state || state.userId !== userId) return { ...UNKNOWN_ACCESS, loading: true };
  return { ...state.access, loading: false };
}
