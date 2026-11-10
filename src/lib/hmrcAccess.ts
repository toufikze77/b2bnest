// HMRC hide switch (docs/hmrc-hide/README.md): should this person see the HMRC test-environment features?
// The server decides for real (every HMRC Edge Function refuses with hmrc_unavailable_for_now); this only decides what
// the screen shows, from the same facts: the person's own platform role (public.user_roles, readable for their own
// rows) and the platform setting hmrc_customer_access (readable by every signed-in person once docs/hmrc-hide is
// applied). Anything missing, unreadable or unexpected counts as hidden.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const HMRC_ACCESS_KEY = 'hmrc_customer_access';
export const TESTER_ROLES = ['super_admin', 'admin'] as const;
/** Shown where the HMRC pieces were, while they are hidden from customers. No dates, no promises. */
export const HMRC_COMING_SOON = 'Sending VAT returns to HMRC straight from B2BNEST is coming soon. You can still prepare your figures and download them.';

export type HmrcSwitch = 'visible' | 'hidden';
export interface HmrcCustomerAccess { loading: boolean; state: HmrcSwitch; tester: boolean; canUse: boolean }

type Res = PromiseLike<{ data: unknown; error: unknown }>;
type Q = Res & { [k: string]: (...a: unknown[]) => Q };
const db = () => supabase as unknown as { from: (t: string) => Q };

export async function fetchHmrcCustomerAccess(userId: string | null | undefined): Promise<Omit<HmrcCustomerAccess, 'loading'>> {
  const none = { state: 'hidden' as const, tester: false, canUse: false };
  if (!userId) return none;
  try {
    const [roles, setting] = await Promise.all([
      db().from('user_roles').select('role').eq('user_id', userId).in('role', [...TESTER_ROLES]),
      db().from('platform_settings').select('value').eq('key', HMRC_ACCESS_KEY).maybeSingle(),
    ]);
    const tester = !roles.error && Array.isArray(roles.data) && roles.data.length > 0;
    const state: HmrcSwitch = !setting.error && (setting.data as { value?: unknown } | null)?.value === 'visible' ? 'visible' : 'hidden';
    return { state, tester, canUse: tester || state === 'visible' };
  } catch {
    return none;
  }
}

/**
 * While loading, canUse is false: nothing HMRC-related flashes up for a customer. enabled = false skips the read
 * (hidden), for screens that only need it in some states.
 */
export function useHmrcCustomerAccess(enabled = true): HmrcCustomerAccess {
  const { user, loading: authLoading } = useAuth();
  const [s, setS] = useState<HmrcCustomerAccess>({ loading: enabled, state: 'hidden', tester: false, canUse: false });
  useEffect(() => {
    let live = true;
    if (!enabled) { setS({ loading: false, state: 'hidden', tester: false, canUse: false }); return () => { live = false; }; }
    if (authLoading) return () => { live = false; };
    void fetchHmrcCustomerAccess(user?.id).then((r) => { if (live) setS({ loading: false, ...r }); });
    return () => { live = false; };
  }, [user?.id, authLoading, enabled]);
  return s;
}

// --- the owner's control (super admins only; the database checks again) ----------------------------------------------
export interface HmrcAccessStatus { state: HmrcSwitch; updated_at: string | null; updated_by_email: string | null }
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
const rpc = () => supabase.rpc as unknown as Rpc;
const missing = (e: { code?: string; message?: string }) => e.code === 'PGRST202' || e.code === '42883' || /could not find the function/i.test(e.message ?? '');

export async function fetchHmrcAccessStatus(): Promise<HmrcAccessStatus | 'not_set_up' | 'error'> {
  try {
    const { data, error } = await rpc()('hmrc_customer_access_status');
    if (error) return missing(error) ? 'not_set_up' : 'error';
    const row = (Array.isArray(data) ? data[0] : data) as HmrcAccessStatus | null;
    return { state: row?.state === 'visible' ? 'visible' : 'hidden', updated_at: row?.updated_at ?? null, updated_by_email: row?.updated_by_email ?? null };
  } catch {
    return 'error';
  }
}
export async function setHmrcCustomerAccess(state: HmrcSwitch): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { error } = await rpc()('hmrc_set_customer_access', { p_state: state });
    if (!error) return { ok: true };
    if (missing(error)) return { ok: false, message: 'The switch arrives with a database update (docs/hmrc-hide).' };
    if (/MFA_REQUIRED/.test(error.message ?? '')) return { ok: false, message: 'Sign in with your authenticator code first.' };
    return { ok: false, message: 'Only a super admin can change this.' };
  } catch {
    return { ok: false, message: 'Something went wrong. Please try again.' };
  }
}

// --- wording guard ------------------------------------------------------------------------------------------------------
/**
 * The switch's states are 'visible' and 'hidden'; a real production state only exists once HMRC approves production.
 * Until this is true, src/test/hmrcHideClaims.test.ts (which keeps the one list of banned claims) fails on any customer-
 * facing claim about filing, Making Tax Digital or HMRC approval.
 */
export const HMRC_PRODUCTION_APPROVED = false;
