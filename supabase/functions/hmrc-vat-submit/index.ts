// HMRC P6 (docs/hmrc-p6/README.md). JWT required (supabase/config.toml); the checks are in _shared/hmrc/vatSubmit.ts.
// Sandbox only: production is refused by readConfig and there is no production path. Nothing here logs a request body,
// a header or an HMRC response.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { fail, type HandlerResult } from '../_shared/hmrc/errors.ts';
import { realDeps } from '../_shared/hmrc/serve.ts';
import { previewWithCallerJwt, supabaseSubmitStore } from '../_shared/hmrc/submitStore.ts';
import { vatSubmit } from '../_shared/hmrc/vatSubmit.ts';
import { guardedDenoServe } from '../_shared/demo-guard.ts'; // Demo read-only: demo people get 403 (docs/demo-readonly)

const json = (r: HandlerResult) => new Response(JSON.stringify(r.body), { status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const URL_ = Deno.env.get('SUPABASE_URL') ?? '';

guardedDenoServe(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ status: 405, body: { ok: false, code: 'bad_request' } });
  try {
    const body = await req.json().catch(() => ({}));
    const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false, autoRefreshToken: false } });
    const asCaller = (jwt: string) => createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const deps = {
      ...realDeps('hmrc-vat-submit'),
      sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
      submissions: supabaseSubmitStore(admin as unknown as Parameters<typeof supabaseSubmitStore>[0]),
      preview: previewWithCallerJwt(asCaller as unknown as Parameters<typeof previewWithCallerJwt>[0]),
      newId: () => crypto.randomUUID(),
    };
    return json(await vatSubmit({ authHeader: req.headers.get('Authorization'), headers: req.headers, body: body && typeof body === 'object' ? body : {} }, deps));
  } catch (e) {
    console.error(`[hmrc-vat-submit] error ${e instanceof Error ? e.name : 'unknown'}`);
    return json(fail('server_error'));
  }
});
