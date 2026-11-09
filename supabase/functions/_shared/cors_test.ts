// HMRC P7d Deno tests: narrowed CORS (docs/hmrc-p7d/README.md). No network: the handlers are driven directly.
import { assert, assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts';
import { allowedOrigin, corsFor, corsHeaders, preflight, withNarrowCors } from './cors.ts';
import { withDemoGuard } from './demo-guard.ts';
import { hmrcHttp } from './hmrc/serve.ts';
import { dataRightsHttp } from './data-rights/serve.ts';
import type { DrDeps } from './data-rights/core.ts';
import { makeHandler as legalHandler } from '../generate-legal-document/handler.ts';
import { makeHandler as docEmailHandler } from '../send-document-email/handler.ts';

const WWW = 'https://www.b2bnest.online';
const APEX = 'https://b2bnest.online';
const EVIL = 'https://evil.example';
const env = (o: Record<string, string> = {}) => (k: string) => o[k];
const req = (origin: string | null, method = 'POST', headers: Record<string, string> = {}) =>
  new Request('https://fn.test/x', { method, headers: { ...(origin ? { Origin: origin } : {}), ...headers }, ...(method === 'POST' ? { body: '{}' } : {}) });
const acao = (r: Response) => r.headers.get('access-control-allow-origin');

// ------------------------------------------------------------------ the allow-list
Deno.test('P7d cors: the two b2bnest.online origins are echoed, with Vary: Origin; any other origin gets no allow-origin', () => {
  for (const o of [WWW, APEX]) {
    const h = corsFor(req(o), { env: env() });
    assertEquals(h['Access-Control-Allow-Origin'], o);
    assertEquals(h.Vary, 'Origin');
    assertEquals(h['Access-Control-Allow-Headers'], 'authorization, x-client-info, apikey, content-type');
    assertEquals(h['Access-Control-Allow-Methods'], 'POST, GET, OPTIONS');
  }
  for (const o of [EVIL, 'https://www.b2bnest.online.evil.example', 'https://b2bnest.online:444', 'http://www.b2bnest.online', 'null', 'https://www.b2bnest.online/',
    'http://localhost:8080', 'https://x.lovable.app']) {
    const h = corsFor(req(o), { env: env() });
    assertEquals(h['Access-Control-Allow-Origin'], undefined, o);
    assertEquals(h.Vary, 'Origin', `${o}: Vary is always sent`);
  }
  assertEquals(corsFor(req(null), { env: env() })['Access-Control-Allow-Origin'], undefined, 'no Origin (a server call): none');
  assertEquals(allowedOrigin('HTTPS://WWW.B2BNEST.ONLINE', env()), WWW, 'case-insensitive host');
});

Deno.test('P7d cors: extra origins only from CORS_ALLOWED_ORIGINS (exact); localhost only with CORS_ALLOW_LOCALHOST=1', () => {
  const e = env({ CORS_ALLOWED_ORIGINS: ' https://preview.example.app , https://id-preview--abc.lovable.app,not a url' });
  assertEquals(allowedOrigin('https://preview.example.app', e), 'https://preview.example.app');
  assertEquals(allowedOrigin('https://id-preview--abc.lovable.app', e), 'https://id-preview--abc.lovable.app');
  assertEquals(allowedOrigin('https://other.lovable.app', e), null, 'no wildcard');
  assertEquals(allowedOrigin('http://localhost:8080', env()), null);
  assertEquals(allowedOrigin('http://localhost:8080', env({ CORS_ALLOW_LOCALHOST: 'true' })), null, 'only the value 1');
  const lh = env({ CORS_ALLOW_LOCALHOST: '1' });
  assertEquals(allowedOrigin('http://localhost:8080', lh), 'http://localhost:8080');
  assertEquals(allowedOrigin('http://127.0.0.1:5173', lh), 'http://127.0.0.1:5173');
  assertEquals(allowedOrigin('https://localhost:8080', lh), null, 'http only');
  assertEquals(allowedOrigin('http://localhost.evil.example', lh), null);
});

Deno.test('P7d cors: preflight is 200 either way; only an allowed origin gets the allow-origin header', async () => {
  const ok = preflight(req(WWW, 'OPTIONS'), { env: env() });
  assertEquals([ok.status, acao(ok), ok.headers.get('vary')], [200, WWW, 'Origin']);
  assertEquals(ok.body, null);
  const no = preflight(req(EVIL, 'OPTIONS'), { env: env() });
  assertEquals([no.status, acao(no)], [200, null]);
  assertEquals(corsHeaders['Access-Control-Allow-Origin'], '*', 'the deprecated export is unchanged for the functions not migrated');
});

// ------------------------------------------------------------------ each migrated family
Deno.test('P7d HMRC family (hmrc-* functions and the P8 reads): preflight, answers and errors carry the narrowed header', async () => {
  let ran = 0;
  const h = hmrcHttp('hmrc-test', async () => { ran++; return { status: 200, body: { ok: true } }; });
  const pre = await h(req(WWW, 'OPTIONS'));
  assertEquals([pre.status, acao(pre), pre.headers.get('vary')], [200, WWW, 'Origin']);
  const okRes = await h(req(APEX));
  assertEquals([okRes.status, acao(okRes)], [200, APEX]);
  const evil = await h(req(EVIL));
  assertEquals(acao(evil), null, 'a disallowed origin gets no allow-origin, so its page cannot read the answer');
  assertEquals((await h(req(WWW, 'GET'))).status, 405);
  assertEquals(acao(await h(req(WWW, 'GET'))), WWW);
  assertEquals(ran, 2, 'OPTIONS and GET never run the handler');
  const boom = hmrcHttp('hmrc-test', async () => { throw new Error('db details'); });
  const orig = console.error; console.error = () => {};
  try {
    const e = await boom(req(WWW));
    assertEquals([e.status, acao(e)], [500, WWW]);
    assert(!(await e.text()).includes('db details'));
  } finally { console.error = orig; }
});

Deno.test('P7d data-rights family (data-export, account-delete, company-close): JSON and the ZIP download carry the narrowed header', async () => {
  const deps = {} as DrDeps;
  const zip = dataRightsHttp('data-export', async () => ({ status: 200, bytes: new Uint8Array([80, 75]), filename: 'b2bnest-data.zip' }), () => deps);
  const z = await zip(req(WWW));
  assertEquals([z.status, acao(z), z.headers.get('vary'), z.headers.get('access-control-expose-headers')], [200, WWW, 'Origin', 'Content-Disposition']);
  assertEquals(acao(await zip(req(EVIL))), null);
  const js = dataRightsHttp('account-delete', async () => ({ status: 403, body: { ok: false, code: 'reauth_required' } }), () => deps);
  const r = await js(req(APEX));
  assertEquals([r.status, acao(r)], [403, APEX]);
  const pre = await js(req(EVIL, 'OPTIONS'));
  assertEquals([pre.status, acao(pre)], [200, null]);
});

Deno.test('P7d handler.ts family (generate-legal-document, send-document-email): every answer is re-headed, body and status kept', async () => {
  const legal = legalHandler({} as Parameters<typeof legalHandler>[0]);
  const pre = await legal(req(WWW, 'OPTIONS'));
  assertEquals([pre.status, acao(pre)], [200, WWW]);
  const unauth = await legal(req(EVIL));
  assertEquals([unauth.status, acao(unauth)], [401, null], 'still 401 without a token, and no allow-origin for another site');
  const doc = docEmailHandler({ env: () => undefined } as unknown as Parameters<typeof docEmailHandler>[0]);
  const d = await doc(req(APEX, 'GET'));
  assertEquals([d.status, acao(d), d.headers.get('access-control-allow-methods')], [401, APEX, 'GET, POST, OPTIONS']);
  const wrapped = withNarrowCors(async () => new Response('x', { status: 418, headers: { ...corsHeaders, 'X-Keep': '1' } }), { env: env() });
  const w = await wrapped(req(EVIL));
  assertEquals([w.status, acao(w), w.headers.get('x-keep'), await w.text()], [418, null, '1', 'x'], 'the old * is removed, everything else kept');
});

Deno.test('P7d demo guard: the refusal carries the narrowed header when the function asks for it, and * otherwise (unchanged)', async () => {
  const demo = 'de00de00-0000-4000-8000-0000000000d7';
  const deps = { env: (k: string) => ({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' } as Record<string, string>)[k], fetch: async () => Response.json([{ user_id: demo }]) };
  const jwt = `x.${btoa(JSON.stringify({ sub: demo, role: 'authenticated' })).replace(/=+$/, '')}.y`;
  const narrowed = withDemoGuard((_r: Request) => new Response('ran'), { headersFor: (r) => corsFor(r, { env: env() }), deps });
  const a = await narrowed(req(WWW, 'POST', { Authorization: `Bearer ${jwt}` }));
  assertEquals([a.status, acao(a)], [403, WWW]);
  const b = await narrowed(req(EVIL, 'POST', { Authorization: `Bearer ${jwt}` }));
  assertEquals([b.status, acao(b)], [403, null]);
  const old = withDemoGuard((_r: Request) => new Response('ran'), { deps });
  assertEquals(acao(await old(req(EVIL, 'POST', { Authorization: `Bearer ${jwt}` }))), '*');
});

// ------------------------------------------------------------------ the std-serve functions (billing, admin, subscription)
const STD_MIGRATED = ['customer-portal', 'create-subscription-checkout', 'create-subscription-invoice', 'create-ai-topup-checkout', 'change-subscription-plan',
  'check-subscription', 'admin-set-user-ban', 'admin-reset-mfa'];
Deno.test('P7d billing and admin family: each answer uses corsFor(req), the preflight uses preflight(req), no * left', async () => {
  for (const f of STD_MIGRATED) {
    const src = await Deno.readTextFile(new URL(`../${f}/index.ts`, import.meta.url));
    assert(/import \{ corsFor, preflight \} from "\.\.\/_shared\/cors\.ts"/.test(src), `${f}: imports corsFor`);
    assert(src.includes('if (req.method === "OPTIONS") return preflight(req);\n  const json = jsonWith(corsFor(req));'), `${f}: per-request headers`);
    assert(!src.includes('corsHeaders') && !/Allow-Origin["']?\s*:\s*["']\*/.test(src), `${f}: no * left`);
    if (src.includes('guardedServe(')) assert(src.includes('guardedServe(stdServe, { headersFor: (req) => corsFor(req) })'), `${f}: the demo refusal is narrowed too`);
    // json is only ever used inside the request handler (where it is bound to this request's headers).
    assert(src.indexOf('json(') > src.indexOf('const json = jsonWith(corsFor(req));'), `${f}: json used before it is bound`);
  }
  for (const f of ['generate-legal-document', 'send-document-email']) {
    const src = await Deno.readTextFile(new URL(`../${f}/index.ts`, import.meta.url));
    assert(src.includes('guardedServe(stdServe, { headersFor: (req) => corsFor(req) })'), f);
  }
});

Deno.test('P7d left alone: webhooks and third-party callbacks still answer as before', async () => {
  for (const f of ['stripe-webhook/index.ts', 'slack-commands/index.ts', 'slack-interactions/index.ts', 'oauth-gmail-callback/index.ts']) {
    const src = await Deno.readTextFile(new URL(`../${f}`, import.meta.url));
    assert(!/corsFor|withNarrowCors/.test(src), `${f} untouched`);
  }
});
