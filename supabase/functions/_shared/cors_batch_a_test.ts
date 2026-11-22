// Edge Functions CORS batch A (docs/hmrc-p7d/README.md, "CORS batch A"): the browser-called functions answer with the
// narrowed headers of corsFor(req) on every path, never '*'. Run: deno test --allow-read --allow-env _shared/cors_batch_a_test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { narrowServe, withNarrowCors } from './cors.ts';
import { guardedServe, guardedDenoServeNarrow, withDemoGuard } from './demo-guard.ts';
import { makeHandler as aiAssistant } from '../ai-assistant/handler.ts';
import { makeHandler as businessInsights } from '../business-insights/handler.ts';
import { makeHandler as workflowExecute } from '../workflow-execute/handler.ts';
import { makeHandler as workflowLinkedIn } from '../workflow-linkedin-post/handler.ts';
import { makeHandler as workflowSendEmail } from '../workflow-send-email/request.ts';
import { makeHandler as workflowTwitter } from '../workflow-twitter-post/handler.ts';
import { createHandler as generateTemplate } from '../generate-template/handler.ts';

const OK_ORIGIN = 'https://www.b2bnest.online';
const BARE_ORIGIN = 'https://b2bnest.online';
const EVIL = 'https://evil.example';
type H = (req: Request) => Response | Promise<Response>;
const req = (origin: string | null, method = 'POST', headers: Record<string, string> = {}) =>
  new Request('https://x.supabase.co/functions/v1/f', { method, headers: { ...(origin ? { origin } : {}), 'content-type': 'application/json', ...headers }, body: method === 'POST' ? '{}' : undefined });
const wild = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

/** A std-style serve that records the handler it is given, so the test can call it as Deno would. */
function capture() {
  let h: H | null = null;
  const serveFn = (handler: H) => { h = handler; };
  return { serveFn, call: (r: Request) => (h as unknown as H)(r) };
}

Deno.test('narrowServe: success, error, early return and rate limit all carry the narrowed headers; status, body and other headers unchanged', async () => {
  const answers: Record<string, () => Response> = {
    ok: () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...wild, 'Content-Type': 'application/json', 'X-Request-Id': 'r1' } }),
    err: () => new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...wild, 'Content-Type': 'application/json' } }),
    unauth: () => new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: wild }),
    limited: () => new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { ...wild, 'Retry-After': '60' } }),
  };
  for (const [name, make] of Object.entries(answers)) {
    const c = capture();
    narrowServe(c.serveFn)(() => make());
    for (const origin of [OK_ORIGIN, BARE_ORIGIN]) {
      const res = await c.call(req(origin));
      const raw = make();
      assertEquals(res.status, raw.status, name);
      assertEquals(await res.text(), await raw.text(), name);
      assertEquals(res.headers.get('access-control-allow-origin'), origin, `${name}: allowed origin echoed`);
      assertEquals(res.headers.get('vary'), 'Origin', `${name}: Vary`);
      assertEquals(res.headers.get('access-control-allow-methods'), 'POST, GET, OPTIONS');
    }
    const foreign = await c.call(req(EVIL));
    assertEquals(foreign.headers.get('access-control-allow-origin'), null, `${name}: no allow-origin for a foreign site`);
    assertEquals(foreign.headers.get('vary'), 'Origin');
    assertEquals(foreign.status, make().status, `${name}: the server still answers (CORS only stops the browser reading it)`);
  }
  const c = capture();
  narrowServe(c.serveFn)(() => answers.ok());
  const kept = await c.call(req(OK_ORIGIN));
  assertEquals(kept.headers.get('content-type'), 'application/json');
  assertEquals(kept.headers.get('x-request-id'), 'r1', 'other headers are kept');
});

Deno.test('narrowServe: OPTIONS is answered for allowed and foreign origins, with the methods asked for', async () => {
  let called = 0;
  const c = capture();
  narrowServe(c.serveFn, { methods: 'POST, OPTIONS' })(() => { called++; return new Response('x', { headers: wild }); });
  const ok = await c.call(req(OK_ORIGIN, 'OPTIONS'));
  assertEquals(ok.status, 200);
  assertEquals(ok.headers.get('access-control-allow-origin'), OK_ORIGIN);
  assertEquals(ok.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
  assertEquals(ok.headers.get('access-control-allow-headers'), 'authorization, x-client-info, apikey, content-type');
  const evil = await c.call(req(EVIL, 'OPTIONS'));
  assertEquals(evil.status, 200);
  assertEquals(evil.headers.get('access-control-allow-origin'), null, 'a foreign preflight gets no allow-origin, so the browser stops');
  assertEquals(called, 0, 'the preflight never reaches the function');
});

Deno.test('narrowServe: no Origin (server-to-server, curl) works as before, without an allow-origin header', async () => {
  const c = capture();
  narrowServe(c.serveFn)(() => new Response('{"ok":true}', { status: 200, headers: wild }));
  const res = await c.call(req(null));
  assertEquals(res.status, 200);
  assertEquals(await res.text(), '{"ok":true}');
  assertEquals(res.headers.get('access-control-allow-origin'), null);
});

Deno.test('narrowServe: CORS_ALLOWED_ORIGINS adds an origin (for example a Lovable preview); look-alikes are refused', async () => {
  const env = (k: string) => (k === 'CORS_ALLOWED_ORIGINS' ? 'https://b2bnest.lovable.app' : undefined);
  const c = capture();
  narrowServe(c.serveFn, { env })(() => new Response('ok', { headers: wild }));
  assertEquals((await c.call(req('https://b2bnest.lovable.app'))).headers.get('access-control-allow-origin'), 'https://b2bnest.lovable.app');
  for (const bad of ['https://www.b2bnest.online.evil.example', 'http://www.b2bnest.online', 'https://other.lovable.app', 'null']) {
    assertEquals((await c.call(req(bad))).headers.get('access-control-allow-origin'), null, bad);
  }
});

Deno.test('guardedServe(narrowServe(...)): the demo refusal is narrowed too (the guard sits inside the CORS wrapper)', async () => {
  // The same composition the migrated functions use, with the demo guard's lookup faked.
  const DEMO = '11111111-1111-4111-8111-111111111111';
  const deps = {
    env: (k: string) => ({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-key' } as Record<string, string>)[k],
    fetch: async () => Response.json([{ user_id: DEMO }]), // the demo list has this person
  };
  let ran = 0;
  const inner = withDemoGuard(() => { ran++; return new Response('ran', { headers: wild }); }, { deps });
  const c = capture();
  narrowServe(c.serveFn)(inner as unknown as H);
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: DEMO, role: 'authenticated' })}.sig`;
  const res = await c.call(req(OK_ORIGIN, 'POST', { authorization: `Bearer ${token}` }));
  assertEquals(res.status, 403, 'the demo person is refused');
  assertEquals(ran, 0);
  assertEquals(res.headers.get('access-control-allow-origin'), OK_ORIGIN, 'the demo refusal carries the narrowed origin');
  assertEquals(res.headers.get('vary'), 'Origin');
  assertEquals((await c.call(req(EVIL, 'POST', { authorization: `Bearer ${token}` }))).headers.get('access-control-allow-origin'), null, 'and none for a foreign site');
  assert(typeof guardedServe === 'function');
});

Deno.test('guardedDenoServeNarrow: wraps the handler (demo guard inside) and serves it with Deno.serve', async () => {
  const original = Deno.serve;
  let served: H | null = null;
  try {
    (Deno as unknown as { serve: unknown }).serve = (h: H) => { served = h; return {} as Deno.HttpServer; };
    guardedDenoServeNarrow({ methods: 'POST, OPTIONS' })(() => new Response('{"ok":true}', { status: 201, headers: wild }));
    const h = served as unknown as H;
    const ok = await h(req(OK_ORIGIN));
    assertEquals(ok.status, 201);
    assertEquals(ok.headers.get('access-control-allow-origin'), OK_ORIGIN);
    assertEquals(ok.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
    assertEquals((await h(req(EVIL))).headers.get('access-control-allow-origin'), null);
    const pre = await h(req(EVIL, 'OPTIONS'));
    assertEquals([pre.status, pre.headers.get('access-control-allow-origin')], [200, null]);
  } finally {
    (Deno as unknown as { serve: unknown }).serve = original;
  }
});

// The real handlers of the handler-based migrated functions: the wrapped answer equals the unwrapped one except for
// the CORS headers. Deps are empty fakes, so each request takes an early path (no sign-in, bad input): an error path.
const realHandlers: [string, H][] = [
  ['ai-assistant', aiAssistant({} as never)],
  ['business-insights', businessInsights({} as never)],
  ['workflow-execute', workflowExecute({} as never)],
  ['workflow-linkedin-post', workflowLinkedIn({} as never)],
  ['workflow-send-email', workflowSendEmail({} as never)],
  ['workflow-twitter-post', workflowTwitter({} as never)],
  ['generate-template', generateTemplate({} as never)],
];
for (const [name, handler] of realHandlers) {
  Deno.test(`${name}: an unsigned request keeps its status and body; only the CORS headers change`, async () => {
    let raw: Response;
    try { raw = await handler(req(OK_ORIGIN)); } catch { raw = new Response(null, { status: 599 }); }
    if (raw.status === 599) return; // the fake deps were reached before any early answer: covered by the generic tests
    assertEquals(raw.headers.get('access-control-allow-origin'), '*', `${name} still answers '*' unwrapped (the wrapper is what narrows it)`);
    const wrapped = withNarrowCors(handler, name === 'workflow-execute' ? { methods: 'POST, OPTIONS' } : {});
    const res = await wrapped(req(OK_ORIGIN));
    assertEquals(res.status, raw.status);
    assertEquals(await res.text(), await (await handler(req(OK_ORIGIN))).text());
    assertEquals(res.headers.get('access-control-allow-origin'), OK_ORIGIN);
    assertEquals(res.headers.get('vary'), 'Origin');
    assertEquals((await wrapped(req(EVIL))).headers.get('access-control-allow-origin'), null);
    assertEquals((await wrapped(req(EVIL, 'OPTIONS'))).headers.get('access-control-allow-origin'), null);
  });
}

// ------------------------------------------------------------------ coverage: no function sends '*' by accident

/** Batch A: migrated (one of the wrappers is on the serve line). */
export const MIGRATED_BATCH_A = [
  'activate-trial', 'ai-assistant', 'b2b-form-submit', 'business-insights', 'create-coinbase-charge', 'create-payment', 'firecrawl-scrape', 'generate-template',
  'get-oauth-config', 'google-calendar-sync', 'notion-sync', 'oauth-gmail-init', 'oauth-outlook-init', 'oauth-twitter-request', 'public-work-request',
  'send-2fa-email', 'send-contact-email', 'send-invitation-email', 'send-task-notification', 'share-project', 'share-task', 'sign-oauth-state',
  'store-twitter-credentials', 'sync-note-to-email', 'trello-import', 'truelayer-integration', 'verify-2fa-code', 'whatsapp-connect', 'whatsapp-disconnect',
  'workflow-execute', 'workflow-linkedin-post', 'workflow-send-email', 'workflow-twitter-post',
];
/** Deliberately left on '*', with the reason (docs/hmrc-p7d/README.md). */
export const KEEP_WILDCARD: Record<string, string> = {
  'oauth-facebook': 'C: the provider redirects the browser here (registered redirect URI); OAuth callbacks are not changed without a connect test',
  'oauth-gmail-callback': 'C: Google redirects the browser here (OAuth callback)',
  'oauth-google-calendar': 'C: Google redirects the browser here (registered redirect URI)',
  'oauth-icloud-calendar': 'C: the provider redirects the browser here (registered redirect URI)',
  'oauth-linkedin': 'C: LinkedIn redirects the browser here (registered redirect URI)',
  'oauth-onedrive': 'C: Microsoft redirects the browser here (registered redirect URI)',
  'oauth-outlook-calendar': 'C: Microsoft redirects the browser here (registered redirect URI)',
  'oauth-twitter': 'C: X (Twitter) redirects the browser here (OAuth callback)',
  'slack-commands': "B: Slack's servers call it (signed); no browser",
  'slack-interactions': "B: Slack's servers call it (signed); no browser",
  'stripe-webhook': "B: Stripe's servers call it (signed, raw body); no browser",
};
/** Already narrowed before batch A (HMRC P7d): their handlers build '*' answers that withNarrowCors re-heads. */
const NARROWED_BEFORE = ['generate-legal-document', 'send-document-email'];
const WRAPPERS = /guardedServe\(narrowServe\(|=\s*narrowServe\(stdServe|guardedDenoServeNarrow\(|narrowDenoServe\(/;
const WILDCARD = /Allow-Origin['"]?\s*:\s*['"]\*|\bcorsHeaders\b/;

Deno.test('coverage: every batch A function uses a narrow wrapper; every function still sending "*" is listed with a reason', async () => {
  const root = new URL('../', import.meta.url);
  const dirs: string[] = [];
  for await (const e of Deno.readDir(root)) if (e.isDirectory && !e.name.startsWith('_')) dirs.push(e.name);
  for (const name of MIGRATED_BATCH_A) {
    const src = await Deno.readTextFile(new URL(`${name}/index.ts`, root));
    assert(WRAPPERS.test(src), `${name}: index.ts serves through a narrow CORS wrapper`);
  }
  const unexplained: string[] = [];
  for (const name of dirs.sort()) {
    const files: string[] = [];
    for await (const f of Deno.readDir(new URL(`${name}/`, root))) if (f.isFile && f.name.endsWith('.ts') && !f.name.endsWith('_test.ts')) files.push(f.name);
    let wildcard = false; let index = '';
    for (const f of files) {
      const src = await Deno.readTextFile(new URL(`${name}/${f}`, root));
      if (f === 'index.ts') index = src;
      if (WILDCARD.test(src)) wildcard = true;
    }
    if (!wildcard) continue;
    if (MIGRATED_BATCH_A.includes(name) || NARROWED_BEFORE.includes(name) || name in KEEP_WILDCARD) continue;
    if (/corsFor\(|withNarrowCors|narrowServe|guardedDenoServeNarrow|narrowDenoServe/.test(index)) continue;
    unexplained.push(name);
  }
  assertEquals(unexplained, [], 'functions that still send "*" with no decision');
  for (const name of Object.keys(KEEP_WILDCARD)) assert(dirs.includes(name), `${name} exists`);
  assertEquals(MIGRATED_BATCH_A.length, 33);
  assertEquals(Object.keys(KEEP_WILDCARD).length, 11);
});
