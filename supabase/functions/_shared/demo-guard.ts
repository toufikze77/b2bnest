// Demo read-only (docs/demo-readonly/README.md). Edge Functions use the service role, so the database guard (the
// a0_demo_readonly_guard trigger) cannot see the person. Every function that writes, sends, spends credits or connects
// something for a signed-in person checks here, with the service role, whether that person is in
// public.demo_readonly_users, and refuses with HTTP 403 and the same message as the database.
//
// - withDemoGuard(handler): wraps a whole function. It reads the person from the request's own JWT (the `sub` of an
//   `authenticated` token). The JWT is not verified here: that only decides whether to refuse. A demo person cannot
//   change the `sub` without breaking the signature, which the function (and the gateway's verify_jwt) still checks.
// - demoRefusal(userId): for functions that learn the person another way (OAuth callbacks: the signed state).
// Nothing here logs a token, an id or a body.
import { corsHeaders } from './cors.ts';

export const DEMO_READONLY_MESSAGE = 'This is a demo account. It is view only.';
export const DEMO_READONLY_CODE = 'demo_readonly';

export interface DemoGuardDeps {
  env: (key: string) => string | undefined;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
}
const realDeps: DemoGuardDeps = { env: (k) => Deno.env.get(k), fetch: (i, init) => fetch(i, init) };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The person's id from `Authorization: Bearer <jwt>`, only for a signed-in person's token (role authenticated). */
export function signedInSubject(authHeader: string | null): string | null {
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return null;
  const parts = authHeader.replace(/^Bearer\s+/i, '').trim().split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(b64 + '==='.slice((b64.length + 3) % 4)));
    if (!claims || claims.role !== 'authenticated' || typeof claims.sub !== 'string' || !UUID.test(claims.sub)) return null;
    return claims.sub.toLowerCase();
  } catch {
    return null;
  }
}

export class DemoCheckError extends Error {
  constructor() { super('demo check failed'); this.name = 'DemoCheckError'; }
}

/**
 * True when the person is listed in public.demo_readonly_users. Read with the service role.
 * Before docs/demo-readonly/proposal.sql is applied the table does not exist: nobody is view only, so false.
 * Any other failure throws DemoCheckError, so callers refuse rather than let a demo person through.
 */
export async function isDemoReadonly(userId: string, deps: DemoGuardDeps = realDeps): Promise<boolean> {
  if (!UUID.test(userId)) return false;
  const url = deps.env('SUPABASE_URL');
  const key = deps.env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new DemoCheckError();
  let res: Response;
  try {
    res = await deps.fetch(`${url.replace(/\/$/, '')}/rest/v1/demo_readonly_users?select=user_id&user_id=eq.${userId.toLowerCase()}&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
  } catch {
    throw new DemoCheckError();
  }
  if (res.ok) {
    const rows = await res.json().catch(() => null);
    if (!Array.isArray(rows)) throw new DemoCheckError();
    return rows.length > 0;
  }
  const body = await res.json().catch(() => null) as { code?: string } | null;
  // PostgREST: the table is not there yet (PGRST205; 42P01 from older versions).
  if (body?.code === 'PGRST205' || body?.code === '42P01') return false;
  throw new DemoCheckError();
}

const jsonResponse = (status: number, body: Record<string, unknown>, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

/** The 403 every refused function answers. */
export function demoReadonlyResponse(headers: Record<string, string> = corsHeaders): Response {
  return jsonResponse(403, { ok: false, code: DEMO_READONLY_CODE, error: DEMO_READONLY_MESSAGE, message: DEMO_READONLY_MESSAGE }, headers);
}

/** null when the person may go on; otherwise the response to return (403 demo, or 503 when the check failed). */
export async function demoRefusal(userId: string | null, headers: Record<string, string> = corsHeaders, deps: DemoGuardDeps = realDeps): Promise<Response | null> {
  if (!userId) return null;
  try {
    return (await isDemoReadonly(userId, deps)) ? demoReadonlyResponse(headers) : null;
  } catch {
    console.error('[demo-guard] check failed');
    return jsonResponse(503, { ok: false, code: 'demo_check_failed', error: 'Please try again in a moment.', message: 'Please try again in a moment.' }, headers);
  }
}

// Any request handler: std's serve passes a second argument (connection info), Deno.serve may too.
type AnyHandler = (req: Request, ...rest: never[]) => Response | Promise<Response>;

/** Wraps a function's handler: a demo person's request is refused before the handler runs. CORS preflight passes. */
// HMRC P7d: headersFor gives the refusal the same narrowed CORS headers as the function (corsFor); without it the
// refusal keeps the old headers, so functions not yet migrated behave exactly as before.
export interface DemoGuardOpts { headers?: Record<string, string>; headersFor?: (req: Request) => Record<string, string>; deps?: DemoGuardDeps }
export function withDemoGuard<H extends AnyHandler>(handler: H, opts: DemoGuardOpts = {}): H {
  const guarded = async (req: Request, ...rest: never[]) => {
    if (req.method === 'OPTIONS') return await handler(req, ...rest);
    const headers = opts.headersFor ? opts.headersFor(req) : opts.headers ?? corsHeaders;
    const refusal = await demoRefusal(signedInSubject(req.headers.get('authorization')), headers, opts.deps ?? realDeps);
    return refusal ?? await handler(req, ...rest);
  };
  return guarded as unknown as H;
}

/** For functions using std's serve: `const serve = guardedServe(stdServe);` */
export function guardedServe<S extends (handler: never, ...rest: never[]) => unknown>(serveFn: S, opts: Omit<DemoGuardOpts, 'deps'> = {}): S {
  return ((handler: AnyHandler, ...rest: never[]) => serveFn(withDemoGuard(handler, opts) as never, ...rest)) as unknown as S;
}

/** For functions using Deno.serve(handler). */
export function guardedDenoServe(handler: AnyHandler, opts: Omit<DemoGuardOpts, 'deps'> = {}) {
  return Deno.serve(withDemoGuard(handler, opts) as unknown as Deno.ServeHandler);
}
