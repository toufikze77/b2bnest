// CORS for Edge Functions called from the browser.
//
// HMRC P7d (docs/hmrc-p7d/README.md): corsFor(req) echoes the request's Origin only when it is on the allow-list and
// otherwise sends no Access-Control-Allow-Origin header, so another site's page can't read the answer. It always sends
// `Vary: Origin` (the answer depends on the Origin). This is defence in depth: every migrated function still needs a
// signed-in Supabase JWT (verify_jwt = true), and CORS does not apply to server-to-server callers at all.
//
// Allow-list:
//   * https://www.b2bnest.online and https://b2bnest.online;
//   * any origins in the optional env CORS_ALLOWED_ORIGINS (comma separated, exact "scheme://host[:port]");
//   * http://localhost:<port> and http://127.0.0.1:<port>, only when the env CORS_ALLOW_LOCALHOST=1.

/**
 * @deprecated HMRC P7d: allows every origin. Kept so the functions not yet migrated keep working; new code uses
 * corsFor(req). See docs/hmrc-p7d/README.md for which functions still use it and why.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const CORS_ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';
export const PRODUCTION_ORIGINS = ['https://www.b2bnest.online', 'https://b2bnest.online'] as const;

type Env = (k: string) => string | undefined;
const realEnv: Env = (k) => {
  try { return Deno.env.get(k); } catch { return undefined; } // no env permission: treat as unset
};

/** "https://host[:port]" exactly (no path, no trailing slash); null otherwise. */
function cleanOrigin(v: string): string | null {
  const t = v.trim();
  return /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i.test(t) ? t.toLowerCase() : null;
}

/** The request's Origin when it is allowed, else null. */
export function allowedOrigin(origin: string | null, env: Env = realEnv): string | null {
  if (!origin) return null;
  const o = cleanOrigin(origin);
  if (!o) return null;
  if ((PRODUCTION_ORIGINS as readonly string[]).includes(o)) return o;
  const extra = (env('CORS_ALLOWED_ORIGINS') ?? '').split(',').map(cleanOrigin).filter((x): x is string => !!x);
  if (extra.includes(o)) return o;
  if (env('CORS_ALLOW_LOCALHOST') === '1' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(o)) return o;
  return null;
}

/** CORS headers for this request (see the top of this file). */
export function corsFor(req: Request, opts: { methods?: string; env?: Env } = {}): Record<string, string> {
  const h: Record<string, string> = {
    'Access-Control-Allow-Headers': CORS_ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': opts.methods ?? 'POST, GET, OPTIONS',
    Vary: 'Origin',
  };
  const o = allowedOrigin(req.headers.get('origin'), opts.env ?? realEnv);
  if (o) h['Access-Control-Allow-Origin'] = o;
  return h;
}

/** The answer to a browser preflight (OPTIONS): 200 as before; the browser blocks it when no allow-origin is sent. */
export const preflight = (req: Request, opts: { methods?: string; env?: Env } = {}) => new Response(null, { status: 200, headers: corsFor(req, opts) });

/**
 * HMRC P7d: wraps a handler that still builds its answers with the old headers. A preflight is answered by
 * `preflight(req)`; every other answer has its CORS headers replaced by corsFor(req) (body and status unchanged).
 */
export function withNarrowCors(handler: (req: Request) => Promise<Response>, opts: { methods?: string; env?: Env } = {}) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return preflight(req, opts);
    const res = await handler(req);
    const headers = new Headers(res.headers);
    for (const k of ['access-control-allow-origin', 'access-control-allow-headers', 'access-control-allow-methods']) headers.delete(k);
    for (const [k, v] of Object.entries(corsFor(req, opts))) headers.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}
