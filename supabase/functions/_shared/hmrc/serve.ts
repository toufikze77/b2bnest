// HMRC P0: the HTTP wrapper shared by the three functions (CORS, JSON, real dependencies). Nothing here logs a request
// body, a header or an HMRC response.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../cors.ts';
import type { HandlerDeps } from './handlers.ts';
import type { HandlerResult } from './errors.ts';
import { fail } from './errors.ts';
import { supabaseStore } from './store.ts';

const json = (r: HandlerResult) => new Response(JSON.stringify(r.body), { status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
    },
  };
}

export function serveHmrc(name: string, handler: (auth: string | null, body: Record<string, unknown>, deps: HandlerDeps) => Promise<HandlerResult>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (req.method !== 'POST') return json({ status: 405, body: { ok: false, code: 'bad_request' } });
    try {
      const body = await req.json().catch(() => ({}));
      return json(await handler(req.headers.get('Authorization'), body && typeof body === 'object' ? body : {}, realDeps(name)));
    } catch (e) {
      // The error name only: messages can carry database details.
      console.error(`[${name}] error ${e instanceof Error ? e.name : 'unknown'}`);
      return json(fail('server_error'));
    }
  });
}
