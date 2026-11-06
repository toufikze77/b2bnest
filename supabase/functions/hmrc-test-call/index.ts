// HMRC P1 + P2 (docs/hmrc-p1-p2/README.md). JWT required (supabase/config.toml); the checks are in
// _shared/hmrc/testCall.ts. Nothing here logs a request body, a header or an HMRC response.
import { corsHeaders } from '../_shared/cors.ts';
import { fail, type HandlerResult } from '../_shared/hmrc/errors.ts';
import { realDeps } from '../_shared/hmrc/serve.ts';
import { testCall } from '../_shared/hmrc/testCall.ts';
import { guardedDenoServe } from '../_shared/demo-guard.ts'; // Demo read-only: demo people get 403 (docs/demo-readonly)

const json = (r: HandlerResult) => new Response(JSON.stringify(r.body), { status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

guardedDenoServe(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ status: 405, body: { ok: false, code: 'bad_request' } });
  try {
    const body = await req.json().catch(() => ({}));
    const deps = { ...realDeps('hmrc-test-call'), sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) };
    return json(await testCall({ authHeader: req.headers.get('Authorization'), headers: req.headers, body: body && typeof body === 'object' ? body : {} }, deps));
  } catch (e) {
    console.error(`[hmrc-test-call] error ${e instanceof Error ? e.name : 'unknown'}`);
    return json(fail('server_error'));
  }
});
