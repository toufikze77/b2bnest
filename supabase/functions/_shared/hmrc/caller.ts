// HMRC P0: who is calling. The Edge Functions use the service role, which skips every database rule (RLS and the
// Phase 25 MFA guard), so each check is made here: a valid Supabase session; two-step sign-in completed (aal2) when the
// person has a verified authenticator; and the company rule (owner or admin, trial or paid, not suspended).
import type { HmrcErrorCode } from './errors.ts';
import type { HmrcStore } from './store.ts';

export interface CallerDeps {
  /** Verifies the access token with Supabase Auth; null when it is not a valid session. */
  getUser(jwt: string): Promise<{ id: string } | null>;
  /** The person's MFA factors (Supabase Auth admin API). */
  listFactors(userId: string): Promise<{ factor_type: string; status: string }[]>;
}
export interface Caller { userId: string; aal: string | null }

export function jwtFrom(authHeader: string | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(authHeader ?? '');
  return m ? m[1] : null;
}
/** Reads the aal claim. Only called after getUser has verified the same token. */
export function aalOf(jwt: string): string | null {
  try {
    const part = jwt.split('.')[1];
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4)));
    return typeof json.aal === 'string' ? json.aal : null;
  } catch {
    return null;
  }
}

export async function identify(authHeader: string | null, deps: CallerDeps): Promise<Caller | HmrcErrorCode> {
  const jwt = jwtFrom(authHeader);
  if (!jwt) return 'unauthorized';
  const user = await deps.getUser(jwt).catch(() => null);
  if (!user?.id) return 'unauthorized';
  const aal = aalOf(jwt);
  const factors = await deps.listFactors(user.id);
  const enrolled = factors.some((f) => f.factor_type === 'totp' && f.status === 'verified');
  if (enrolled && aal !== 'aal2') return 'two_step_required';
  return { userId: user.id, aal };
}

export async function canManage(store: HmrcStore, companyId: string, userId: string): Promise<'ok' | HmrcErrorCode> {
  const rule = await store.manageAllowed(companyId, userId);
  if (rule === 'ok') return 'ok';
  if (rule === 'not_signed_in') return 'unauthorized';
  return rule;
}

export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
