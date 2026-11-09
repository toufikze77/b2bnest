// HMRC P0: who is calling. The Edge Functions use the service role, which skips every database rule (RLS and the
// Phase 25 MFA guard), so each check is made here: a valid Supabase session; two-step sign-in completed (aal2) when the
// person has a verified authenticator; and the company rule (owner or admin, trial or paid, not suspended).
import type { HmrcErrorCode } from './errors.ts';
import type { HmrcStore } from './store.ts';
import type { HmrcAccess } from './access.ts';

export interface CallerDeps {
  /** Verifies the access token with Supabase Auth; null when it is not a valid session. */
  getUser(jwt: string): Promise<{ id: string } | null>;
  /** The person's MFA factors (Supabase Auth admin API). */
  listFactors(userId: string): Promise<{ id?: string; factor_type: string; status: string; created_at?: string }[]>;
  /**
   * HMRC hide switch: 'hidden' refuses the person before anything else happens. The real functions always provide it
   * (serve.ts realDeps, read with the service role by access.ts, which fails closed). Left out only by older unit tests,
   * which then keep today's behaviour.
   */
  hmrcAccess?(userId: string): Promise<HmrcAccess>;
}
/** totpAt: when this session's authenticator code was entered (from the verified session token), if it was. */
export interface Caller { userId: string; aal: string | null; totpAt: Date | null; totpFactorIds: string[] }

export function jwtFrom(authHeader: string | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(authHeader ?? '');
  return m ? m[1] : null;
}
function claims(jwt: string): Record<string, unknown> | null {
  try {
    const part = jwt.split('.')[1];
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4)));
  } catch {
    return null;
  }
}
/** Reads the aal claim. Only called after getUser has verified the same token. */
export function aalOf(jwt: string): string | null {
  const c = claims(jwt);
  return typeof c?.aal === 'string' ? c.aal : null;
}
/** Supabase's amr claim: [{ method, timestamp (seconds) }]. The time of the TOTP step, if this session had one. */
export function totpTimeOf(jwt: string): Date | null {
  const amr = claims(jwt)?.amr;
  if (!Array.isArray(amr)) return null;
  const t = amr.find((e) => e && typeof e === 'object' && (e as { method?: unknown }).method === 'totp') as { timestamp?: unknown } | undefined;
  return typeof t?.timestamp === 'number' && t.timestamp > 0 ? new Date(t.timestamp * 1000) : null;
}

/**
 * opts.allowWhenHidden: only hmrc-disconnect passes it, so anyone already connected can always remove their HMRC tokens,
 * even while the HMRC features are hidden from customers.
 */
export async function identify(authHeader: string | null, deps: CallerDeps, opts: { allowWhenHidden?: boolean } = {}): Promise<Caller | HmrcErrorCode> {
  const jwt = jwtFrom(authHeader);
  if (!jwt) return 'unauthorized';
  const user = await deps.getUser(jwt).catch(() => null);
  if (!user?.id) return 'unauthorized';
  // HMRC hide switch: before any HMRC call, token read, state or audit row. A failed read counts as hidden.
  if (!opts.allowWhenHidden && deps.hmrcAccess) {
    const access = await deps.hmrcAccess(user.id).catch(() => 'hidden' as const);
    if (access === 'hidden') return 'hmrc_unavailable_for_now';
  }
  const aal = aalOf(jwt);
  const factors = await deps.listFactors(user.id);
  const verified = factors.filter((f) => f.factor_type === 'totp' && f.status === 'verified');
  if (verified.length && aal !== 'aal2') return 'two_step_required';
  return { userId: user.id, aal, totpAt: aal === 'aal2' ? totpTimeOf(jwt) : null, totpFactorIds: verified.map((f) => f.id ?? '').filter(Boolean).sort() };
}

export async function canManage(store: HmrcStore, companyId: string, userId: string): Promise<'ok' | HmrcErrorCode> {
  const rule = await store.manageAllowed(companyId, userId);
  if (rule === 'ok') return 'ok';
  if (rule === 'not_signed_in') return 'unauthorized';
  return rule;
}

export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
