// HMRC P0: the HTTP wrapper shared by the three functions (CORS, JSON, real dependencies). Nothing here logs a request
// body, a header or an HMRC response.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsFor, preflight } from '../cors.ts';
import { guardedDenoServe } from '../demo-guard.ts';
import type { HandlerDeps } from './handlers.ts';
import type { HandlerResult } from './errors.ts';
import { fail } from './errors.ts';
import { supabaseStore } from './store.ts';
import { readHmrcAccess } from './access.ts';

/** HMRC P7d: the answer, with CORS narrowed to the allowed origins (corsFor). */
export const hmrcJson = (req: Request, r: HandlerResult) =>
  new Response(JSON.stringify(r.body), { status: r.status, headers: { ...corsFor(req), 'Content-Type': 'application/json' } });

export function realDeps(name: string): HandlerDeps {
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    env: (k) => Deno.env.get(k),
    store: supabaseStore(admin as unknown as Parameters<typeof supabaseStore>[0]),
    fetch: (input, init) => fetch(input, init),
    now: () => new Date(),
    log: (event, meta) => console.log(`[${name}] ${event}${meta ? ' ' + JSON.stringify(meta) : ''}`),
    caller: {
      async getUser(jwt) {
        const { data, error } = await admin.auth.getUser(jwt);
        return error || !data?.user ? null : { id: data.user.id };
      },
      async listFactors(userId) {
        const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
        if (error) throw new Error('listFactors failed');
        return (data?.factors ?? []) as { factor_type: string; status: string }[];
      },
      // HMRC hide switch: read with the service role every time (no cache), fail closed.
      hmrcAccess: (userId) => readHmrcAccess(admin as unknown as Parameters<typeof readHmrcAccess>[0], userId),
    },
  };
}

/**
 * The request handler every HMRC function shares (HMRC P7d): a preflight from an allowed origin passes, POST only,
 * errors give the error name only. `run` gets the parsed body (an object) and the request.
 */
export function hmrcHttp(name: string, run: (req: Request, body: Record<string, unknown>) => Promise<HandlerResult>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return preflight(req);
    if (req.method !== 'POST') return hmrcJson(req, { status: 405, body: { ok: false, code: 'bad_request' } });
    try {
      const body = await req.json().catch(() => ({}));
      return hmrcJson(req, await run(req, body && typeof body === 'object' ? body : {}));
    } catch (e) {
      // The error name only: messages can carry database details.
      console.error(`[${name}] error ${e instanceof Error ? e.name : 'unknown'}`);
      return hmrcJson(req, fail('server_error'));
    }
  };
}

/** Serves an HMRC function; a demo person is refused (403) before any HMRC check (docs/demo-readonly). */
export function serveHmrcRequest(name: string, run: (req: Request, body: Record<string, unknown>) => Promise<HandlerResult>) {
  guardedDenoServe(hmrcHttp(name, run), { headersFor: (req) => corsFor(req) });
}

export function serveHmrc(name: string, handler: (auth: string | null, body: Record<string, unknown>, deps: HandlerDeps) => Promise<HandlerResult>) {
  serveHmrcRequest(name, (req, body) => handler(req.headers.get('Authorization'), body, realDeps(name)));
}
