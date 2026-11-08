// HMRC P8: the HTTP wrapper for the four read functions (hmrc-vat-return-view, -liabilities, -payments, -penalties).
// JWT required (supabase/config.toml); the demo guard refuses demo people first; POST only. Nothing here logs a
// request body, a header or an HMRC response.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../cors.ts';
import { guardedDenoServe } from '../demo-guard.ts';
import { fail, type HandlerResult } from './errors.ts';
import { realDeps } from './serve.ts';
import { type ReadDeps, supabaseReadStore } from './vatReads.ts';

const json = (r: HandlerResult) => new Response(JSON.stringify(r.body), { status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

export function serveVatRead(name: string, handler: (req: { authHeader: string | null; headers: Headers; body: Record<string, unknown> }, deps: ReadDeps) => Promise<HandlerResult>) {
  guardedDenoServe(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (req.method !== 'POST') return json({ status: 405, body: { ok: false, code: 'bad_request' } });
    try {
      const body = await req.json().catch(() => ({}));
      const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const deps: ReadDeps = {
        ...realDeps(name),
        sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
        reads: supabaseReadStore(admin as unknown as Parameters<typeof supabaseReadStore>[0]),
      };
      return json(await handler({ authHeader: req.headers.get('Authorization'), headers: req.headers, body: body && typeof body === 'object' ? body : {} }, deps));
    } catch (e) {
      console.error(`[${name}] error ${e instanceof Error ? e.name : 'unknown'}`);
      return json(fail('server_error'));
    }
  });
}
