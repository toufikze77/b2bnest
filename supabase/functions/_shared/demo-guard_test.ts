// Demo read-only: the Edge Function guard, and which functions use it.
// Run: deno test --allow-read --allow-env _shared/demo-guard_test.ts   (from supabase/functions)
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  DEMO_READONLY_MESSAGE, demoRefusal, isDemoReadonly, signedInSubject, withDemoGuard, type DemoGuardDeps,
} from './demo-guard.ts';

const DEMO = 'de00de00-0000-4000-8000-000000000001';
const OTHER = '0a0a0a0a-0000-4000-8000-00000000000a';
const b64url = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const token = (claims: Record<string, unknown>) => `${b64url({ alg: 'HS256' })}.${b64url(claims)}.sig`;
const bearer = (sub: string, role = 'authenticated') => `Bearer ${token({ sub, role })}`;

interface World { listed: Set<string>; mode: 'ok' | 'missing_table' | 'down' | 'throws'; calls: { url: string; headers: Record<string, string> }[] }
const world = (over: Partial<World> = {}): World => ({ listed: new Set([DEMO]), mode: 'ok', calls: [], ...over });
const deps = (w: World, env: Record<string, string> = { SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-key' }): DemoGuardDeps => ({
  env: (k) => env[k],
  fetch: async (url, init) => {
    w.calls.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
    if (w.mode === 'throws') throw new TypeError('network');
    if (w.mode === 'missing_table') return Response.json({ code: 'PGRST205', message: 'Could not find the table' }, { status: 404 });
    if (w.mode === 'down') return Response.json({ message: 'boom' }, { status: 500 });
    const id = new URL(url).searchParams.get('user_id')?.replace('eq.', '') ?? '';
    return Response.json(w.listed.has(id) ? [{ user_id: id }] : []);
  },
});
const req = (auth?: string, method = 'POST') => new Request('https://fn.test/x', { method, headers: auth ? { Authorization: auth } : {} });

Deno.test('signedInSubject: only a signed-in person\'s token gives an id', () => {
  assertEquals(signedInSubject(bearer(DEMO)), DEMO);
  assertEquals(signedInSubject(bearer(DEMO.toUpperCase())), DEMO);
  assertEquals(signedInSubject(bearer(DEMO, 'service_role')), null);
  assertEquals(signedInSubject(bearer(DEMO, 'anon')), null);
  assertEquals(signedInSubject(`Bearer ${token({ role: 'authenticated', sub: 'not-a-uuid' })}`), null);
  assertEquals(signedInSubject('Bearer not.a.jwt'), null);
  assertEquals(signedInSubject('Basic abc'), null);
  assertEquals(signedInSubject(null), null);
});

Deno.test('isDemoReadonly: reads demo_readonly_users with the service role; listed, not listed, not applied yet, failures', async () => {
  const w = world();
  assertEquals(await isDemoReadonly(DEMO, deps(w)), true);
  assertEquals(await isDemoReadonly(OTHER, deps(w)), false);
  assert(w.calls[0].url.startsWith('https://p.supabase.co/rest/v1/demo_readonly_users?select=user_id&user_id=eq.'));
  assertEquals(w.calls[0].headers.apikey, 'service-key');
  assertEquals(w.calls[0].headers.authorization, 'Bearer service-key');
  assertEquals(await isDemoReadonly(DEMO, deps(world({ mode: 'missing_table' }))), false, 'before the SQL is applied nobody is view only');
  for (const mode of ['down', 'throws'] as const) {
    let threw = false;
    try { await isDemoReadonly(DEMO, deps(world({ mode }))); } catch { threw = true; }
    assert(threw, `${mode}: fails closed (throws)`);
  }
  let threw = false;
  try { await isDemoReadonly(DEMO, deps(world(), {})); } catch { threw = true; }
  assert(threw, 'no service role configured: fails closed');
  assertEquals(await isDemoReadonly('nope', deps(world())), false);
});

Deno.test('withDemoGuard: a demo person gets 403 and the message; the function never runs', async () => {
  const w = world(); let ran = 0;
  const h = withDemoGuard((_req: Request) => { ran++; return new Response('done'); }, { deps: deps(w) });
  const r = await h(req(bearer(DEMO)));
  assertEquals(r.status, 403);
  const body = await r.json();
  assertEquals([body.code, body.error, body.message], ['demo_readonly', DEMO_READONLY_MESSAGE, DEMO_READONLY_MESSAGE]);
  assertEquals(DEMO_READONLY_MESSAGE, 'This is a demo account. It is view only.');
  assertEquals(r.headers.get('access-control-allow-origin'), '*');
  assertEquals(ran, 0);
});

Deno.test('withDemoGuard: anyone not on the list, service-role calls, signed-out calls and CORS preflight run as before', async () => {
  const w = world(); let ran = 0;
  const h = withDemoGuard((_req: Request) => { ran++; return new Response('done'); }, { deps: deps(w) });
  assertEquals(await (await h(req(bearer(OTHER)))).text(), 'done');
  assertEquals(await (await h(req(bearer(DEMO, 'service_role')))).text(), 'done');
  assertEquals(await (await h(req())).text(), 'done');
  assertEquals(await (await h(req(bearer(DEMO), 'OPTIONS'))).text(), 'done');
  assertEquals(ran, 4);
  assertEquals(w.calls.length, 1, 'only the signed-in person is looked up');
});

Deno.test('withDemoGuard: if the check itself fails, the request is refused (503), not let through', async () => {
  let ran = 0;
  const h = withDemoGuard((_req: Request) => { ran++; return new Response('done'); }, { deps: deps(world({ mode: 'down' })) });
  const r = await h(req(bearer(OTHER)));
  assertEquals(r.status, 503);
  assertEquals((await r.json()).code, 'demo_check_failed');
  assertEquals(ran, 0);
});

Deno.test('demoRefusal (OAuth callbacks: the person comes from the signed state)', async () => {
  const w = world();
  assertEquals((await demoRefusal(DEMO, { 'X-Test': '1' }, deps(w)))?.status, 403);
  assertEquals((await demoRefusal(DEMO, { 'X-Test': '1' }, deps(w)))?.headers.get('x-test'), '1');
  assertEquals(await demoRefusal(OTHER, undefined, deps(w)), null);
  assertEquals(await demoRefusal(null, undefined, deps(w)), null);
});

Deno.test('nothing secret is logged', async () => {
  const seen: string[] = [];
  const orig = console.error; console.error = (...a: unknown[]) => { seen.push(a.join(' ')); };
  try { await demoRefusal(DEMO, undefined, deps(world({ mode: 'down' }))); } finally { console.error = orig; }
  const text = seen.join('\n');
  assert(!text.includes('service-key') && !text.includes(DEMO), text);
});

// ------------------------------------------------------------------ every function has a decision, and the refused ones use the guard
// The same table is in docs/demo-readonly/README.md.
const REFUSE = [
  'activate-trial', 'ai-assistant', 'business-insights', 'change-subscription-plan', 'create-ai-topup-checkout', 'create-coinbase-charge',
  'create-payment', 'create-subscription-checkout', 'create-subscription-invoice', 'customer-portal', 'firecrawl-scrape',
  'generate-legal-document', 'generate-template', 'google-calendar-sync', 'hmrc-connect-complete', 'hmrc-connect-start', 'hmrc-disconnect',
  'hmrc-test-call', 'hmrc-vat-obligations', 'notion-sync', 'oauth-facebook', 'oauth-gmail-callback', 'oauth-gmail-init', 'oauth-google-calendar',
  'oauth-icloud-calendar', 'oauth-linkedin', 'oauth-onedrive', 'oauth-outlook-calendar', 'oauth-twitter', 'oauth-twitter-request',
  'send-contact-email', 'send-document-email', 'send-invitation-email', 'send-task-notification', 'share-project', 'share-task',
  'sign-oauth-state', 'store-twitter-credentials', 'sync-note-to-email', 'trello-import', 'truelayer-integration', 'whatsapp-connect',
  'whatsapp-disconnect', 'workflow-execute', 'workflow-linkedin-post', 'workflow-send-email', 'workflow-twitter-post',
];
const NOT_REFUSED: Record<string, string> = {
  'check-subscription': 'runs on page load; only syncs the plan row from Stripe (no change the person chooses)',
  'send-2fa-email': 'sign-in path: sends the person their own email sign-in code',
  'verify-2fa-code': 'sign-in path: checks the code',
  'admin-reset-mfa': 'platform super admins only (the demo person is not one)',
  'admin-set-user-ban': 'platform super admins only',
  'get-oauth-config': 'read only',
  'oauth-outlook-init': 'builds a sign-in address only; the callback (oauth-outlook-calendar) refuses',
  'b2b-form-submit': 'public form for signed-out visitors, not a signed-in person',
  'public-work-request': 'public form for signed-out visitors',
  'stripe-webhook': 'called by Stripe (signed), not a person',
  'slack-commands': 'called by Slack (signed); a demo person cannot link Slack because connecting is refused',
  'slack-interactions': 'called by Slack (signed); as above',
  'onboarding-email-sender': 'scheduled sender with the service role; its queue is written only through guarded tables',
  'trial-email-sender': 'scheduled sender with the service role',
  'support-email-sender': 'scheduled sender with the service role; support_* writes are guarded in the database',
};
const GUARD = /\b(guardedServe|guardedDenoServe|demoRefusal)\(/;

Deno.test('every Edge Function has a demo decision', async () => {
  const dirs: string[] = [];
  for await (const e of Deno.readDir(new URL('..', import.meta.url))) {
    if (e.isDirectory && !e.name.startsWith('_') && e.name !== 'shared') dirs.push(e.name);
  }
  const missing = dirs.filter((d) => !REFUSE.includes(d) && !(d in NOT_REFUSED));
  assertEquals(missing, [], 'a new function needs a decision here and in the README');
  assertEquals(REFUSE.filter((d) => d in NOT_REFUSED), []);
});

Deno.test('every refused function calls the demo guard, and has no unguarded serve', async () => {
  const hmrcServe = await Deno.readTextFile(new URL('./hmrc/serve.ts', import.meta.url));
  assert(/guardedDenoServe\(/.test(hmrcServe) && !/\bDeno\.serve\(/.test(hmrcServe), 'hmrc serve wrapper');
  for (const d of REFUSE) {
    const src = await Deno.readTextFile(new URL(`../${d}/index.ts`, import.meta.url));
    const viaHmrc = /serveHmrc\(/.test(src);
    assert(viaHmrc || GUARD.test(src), `${d}: no demo guard`);
    if (/verifyOAuthState\(/.test(src)) {
      // OAuth callbacks arrive from the provider without the person's JWT: the person comes from the signed state.
      const afterState = src.slice(src.indexOf('verifyOAuthState('));
      assert(/demoRefusal\(userId/.test(afterState), `${d}: the OAuth callback must refuse right after reading the state`);
      assert(afterState.indexOf('demoRefusal(userId') < afterState.search(/\.rpc\(|\.insert\(|\.upsert\(|\.update\(/), `${d}: refuse before any write`);
    } else {
      assert(!/\bDeno\.serve\(/.test(src), `${d}: an unguarded Deno.serve`);
      assert(!/import \{ serve \} from/.test(src), `${d}: an unguarded std serve`);
    }
  }
});
