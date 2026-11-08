// HMRC P7b: who is asking, and the plain-English answers, shared by data-export, account-delete and company-close.
// The Edge Functions use the service role, which skips RLS and the Phase 25 MFA guard, so the checks are made here:
// a valid session, two-step sign-in completed (aal2) when the person has a verified authenticator, not the demo
// account, and for destructive steps a FRESH sign-in (password, or authenticator code for people who use one) in the
// last 10 minutes. Nothing here logs a token, an email, a password or a body.
import { aalOf, jwtFrom } from '../hmrc/caller.ts';

export const FRESH_SIGN_IN_MINUTES = 10;

export interface DrResult { status: number; body?: Record<string, unknown>; bytes?: Uint8Array; filename?: string }

export type ReadFilter = { eq: [string, string][]; isNull?: string[]; inList?: [string, string[]] };
export interface DrDeps {
  now(): Date;
  log(event: string, meta?: Record<string, unknown>): void;
  /** Supabase Auth: verifies the access token. */
  getUser(jwt: string): Promise<{ id: string; email: string | null } | null>;
  listFactors(userId: string): Promise<{ factor_type: string; status: string }[]>;
  /** public.demo_readonly_users (service role). Throws when it can't tell. */
  isDemo(userId: string): Promise<boolean>;
  /** A SECURITY DEFINER function, service role. */
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
  /** One page of rows. 'caller': the person's own JWT (RLS applies). 'service': the service role. */
  read(as: 'caller' | 'service', jwt: string, table: string, select: string, filter: ReadFilter, from: number, to: number):
    Promise<{ rows: Record<string, unknown>[]; error: { code?: string; message?: string } | null }>;
  storageList(bucket: string, prefix: string): Promise<string[]>;
  storageSign(bucket: string, path: string, seconds: number): Promise<string | null>;
  storageRemove(bucket: string, paths: string[]): Promise<boolean>;
}

export const MESSAGES: Record<string, string> = {
  unauthorized: 'Please sign in again.',
  two_step_required: 'Enter your authenticator code first.',
  demo_readonly: 'This is a demo account. It is view only.',
  not_available: "This isn't available yet. Please try again later, or email info@b2bnest.online.",
  not_admin: 'Only an owner or admin of this company can download its data.',
  not_owner: 'Only an owner of this company can close it.',
  company_closed: 'This company is closed.',
  already_closed: 'This company is already closed.',
  limit: 'You have done this several times in the last hour. Please try again later.',
  bad_request: 'Something was missing from the request. Please try again.',
  confirm_download: 'Tick the box to confirm you have downloaded what you need.',
  email_mismatch: "That email address doesn't match your account.",
  name_mismatch: "That name doesn't match the company's name.",
  reauth_required: 'For your security, confirm it is you again (sign in again, or enter your authenticator code again), then try within 10 minutes.',
  too_large: 'Your data is too large to download here. Please email info@b2bnest.online and we will help.',
  last_owner: 'You are the only owner of {names}, which has other members. Make someone else an owner, or close the company, first.',
  paid_subscription: 'You have an active paid subscription. Cancel it in Settings → Billing first. Deleting your account does not cancel it.',
  billing_user: 'You pay for the plan of {names}. Ask another owner to take over the billing first.',
  server_error: 'Something went wrong. Nothing was changed. Please try again, or email info@b2bnest.online.',
};

export const fail = (status: number, code: string, extra: Record<string, unknown> = {}): DrResult =>
  ({ status, body: { ok: false, code, message: MESSAGES[code] ?? MESSAGES.server_error, ...extra } });
export const done = (body: Record<string, unknown>): DrResult => ({ status: 200, body: { ok: true, ...body } });

export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** PostgREST / Postgres "this function or table isn't there yet" (the SQL is not applied). */
export const isMissing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42883' || e.code === '42P01');

function amrOf(jwt: string): { method: string; at: number }[] {
  try {
    const part = jwt.split('.')[1];
    const c = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4)));
    return Array.isArray(c?.amr)
      ? c.amr.filter((e: unknown) => e && typeof e === 'object').map((e: { method?: unknown; timestamp?: unknown }) =>
          ({ method: String(e.method ?? ''), at: typeof e.timestamp === 'number' ? e.timestamp * 1000 : 0 }))
      : [];
  } catch {
    return [];
  }
}

export interface Who { userId: string; email: string | null; jwt: string; usesTotp: boolean; freshAt: number | null }

/** The caller, or the refusal. freshAt: when this session last proved who it is (TOTP for people who use it). */
export async function whoIsAsking(authHeader: string | null, deps: DrDeps): Promise<Who | DrResult> {
  const jwt = jwtFrom(authHeader);
  if (!jwt) return fail(401, 'unauthorized');
  const user = await deps.getUser(jwt).catch(() => null);
  if (!user?.id) return fail(401, 'unauthorized');
  const factors = await deps.listFactors(user.id);
  const usesTotp = factors.some((f) => f.factor_type === 'totp' && f.status === 'verified');
  if (usesTotp && aalOf(jwt) !== 'aal2') return fail(403, 'two_step_required');
  let demo: boolean;
  try { demo = await deps.isDemo(user.id); } catch { return fail(503, 'server_error'); }
  if (demo) return fail(403, 'demo_readonly');
  const amr = amrOf(jwt);
  const proofs = usesTotp ? amr.filter((a) => a.method === 'totp') : amr.filter((a) => ['password', 'otp', 'oauth', 'totp', 'magiclink'].includes(a.method));
  const freshAt = proofs.length ? Math.max(...proofs.map((a) => a.at)) : null;
  return { userId: user.id, email: user.email, jwt, usesTotp, freshAt };
}

export const isFresh = (who: Who, now: Date) => who.freshAt !== null && now.getTime() - who.freshAt <= FRESH_SIGN_IN_MINUTES * 60_000 && who.freshAt <= now.getTime() + 60_000;

/** A request slot (rate limit + the audit row). */
export async function takeSlot(deps: DrDeps, userId: string, company: string | null, kind: string, limit: number): Promise<string | DrResult> {
  const r = await deps.rpc('data_rights_take_slot', { p_user: userId, p_company: company, p_kind: kind, p_limit: limit });
  if (isMissing(r.error)) return fail(503, 'not_available');
  if (r.error) return fail(500, 'server_error');
  const row = (Array.isArray(r.data) ? r.data[0] : r.data) as { result?: string; request_id?: string } | null;
  if (row?.result === 'limit') return fail(429, 'limit');
  if (row?.result === 'demo') return fail(403, 'demo_readonly');
  if (row?.result !== 'ok' || !isUuid(row.request_id)) return fail(400, 'bad_request');
  return row.request_id;
}

export async function finish(deps: DrDeps, request: string, status: 'done' | 'refused' | 'failed', reason: string) {
  const r = await deps.rpc('data_rights_finish', { p_request: request, p_status: status, p_reason: reason });
  if (r.error) deps.log('finish_failed', { reason });
}

/** Removes everything under `prefix/` in each bucket. Returns false if anything could not be removed. */
export async function removeFiles(deps: DrDeps, buckets: readonly string[], prefix: string): Promise<boolean> {
  let ok = true;
  for (const b of buckets) {
    try {
      const paths = await deps.storageList(b, prefix);
      for (let i = 0; i < paths.length; i += 100) {
        if (!(await deps.storageRemove(b, paths.slice(i, i + 100)))) ok = false;
      }
    } catch {
      ok = false;
    }
  }
  return ok;
}
