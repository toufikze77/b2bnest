// HMRC P3 Deno tests: hmrc-vat-obligations (read only, sandbox only). HMRC is mocked: no network.
import { assert, assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts';
import { b64url, encryptToken, tokenAad } from './crypto.ts';
import { pickVatNumber, type AuditEvent, type ConnectionRow, type HmrcStore, type ManageRule, type VatRow } from './store.ts';
import { cleanVrn, dayOf, normalise, OBLIGATION_SCENARIOS, readQuery, vatObligations } from './vatObligations.ts';
import { withDemoGuard } from '../demo-guard.ts';

const KEY = new Uint8Array(32).map((_, i) => i + 11);
const KEY_B64 = btoa(String.fromCharCode(...KEY));
const SECRET = 'client-secret-p3';
const ENV: Record<string, string> = {
  HMRC_CLIENT_ID: 'b2bnest-client', HMRC_CLIENT_SECRET: SECRET, HMRC_TOKEN_KEY: KEY_B64, HMRC_ENV: 'sandbox',
  HMRC_REDIRECT_URI: 'https://www.b2bnest.online/hmrc/callback',
};
const CO = '0d300000-0000-4000-8000-000000000001';
const OWNER = '0a0a0a0a-0000-4000-8000-0000000000a1';
const MEMBER = '0a0a0a0a-0000-4000-8000-0000000000a2';
const SOLO = '0a0a0a0a-0000-4000-8000-0000000000a3';
const OUTSIDER = '0a0a0a0a-0000-4000-8000-0000000000a4';
const DEMO = 'de00de00-0000-4000-8000-000000000001';
const VRN = '123456789';
const BROWSER = { deviceId: 'beec798b-b366-47fa-b1f8-92cede14a1ce', jsUserAgent: 'Mozilla/5.0 (test)', timezone: 'UTC+00:00', webVersion: '1.0.0',
  screens: [{ width: 1920, height: 1080, scalingFactor: 1, colourDepth: 24 }], windowSize: { width: 1200, height: 800 } };
// HMRC's own example (VAT (MTD) 1.0 OpenAPI file: "Quarterly obligations; one fulfilled").
const HMRC_EXAMPLE = { obligations: [
  { start: '2017-01-01', end: '2017-03-31', due: '2017-05-07', status: 'F', periodKey: '18A1', received: '2017-05-06' },
  { start: '2017-04-01', end: '2017-06-30', due: '2017-08-07', status: 'O', periodKey: '18A2' },
] };

interface World {
  rules: Record<string, ManageRule>;
  vat: string | null;
  connection: (ConnectionRow & { refresh_lock_until?: string | null }) | null;
  audit: { event: AuditEvent; reason?: string | null }[];
  slots: number;
  calls: { url: string; headers: Record<string, string> }[];
  api: (url: string) => Response;
  logs: string[];
}
async function world(over: Partial<World> = {}): Promise<World> {
  return {
    rules: { [OWNER]: 'ok', [MEMBER]: 'not_admin', [SOLO]: 'plan_not_included', [OUTSIDER]: 'not_member', [DEMO]: 'ok' },
    vat: 'GB 123 4567 89',
    connection: {
      company_id: CO, environment: 'sandbox', status: 'connected', scopes: ['read:vat', 'write:vat', 'hello'],
      access_token_enc: await encryptToken('USER-TOKEN-3', KEY, tokenAad(CO, 'sandbox', 'access')),
      refresh_token_enc: await encryptToken('REFRESH-3', KEY, tokenAad(CO, 'sandbox', 'refresh')),
      expires_at: '2026-11-06T14:00:00.000Z', refresh_lock_until: null,
    },
    audit: [], slots: 10, calls: [], logs: [],
    api: () => Response.json(HMRC_EXAMPLE, { headers: { 'X-CorrelationId': 'c75f40a6-a3df-4429-a697-471eeec46435' } }),
    ...over,
  };
}
function store(w: World): HmrcStore {
  return {
    async manageAllowed(_c, u) { return w.rules[u] ?? 'not_member'; },
    async createState() {}, async consumeState() { return null; }, async saveConnection() {},
    async getConnection() { return w.connection ? { ...w.connection } : null; },
    async updateConnection(_c, _e, patch) { if (w.connection) Object.assign(w.connection, patch); },
    async claimRefresh() { return !!w.connection && w.connection.status === 'connected'; },
    async audit(r) { w.audit.push({ event: r.event, reason: r.reason ?? null }); },
    async takeTestSlot() { return true; },
    async takeObligationsSlot(_c, _u, _e, kind) { if (w.slots <= 0) return false; w.slots--; w.audit.push({ event: 'obligations_call', reason: kind }); return true; },
    async vatNumberFor() { return w.vat; },
  };
}
const deps = (w: World, env = ENV) => ({
  env: (k: string) => env[k], store: store(w), now: () => new Date('2026-11-06T10:00:00.000Z'), sleep: async () => {},
  log: (e: string, m?: Record<string, unknown>) => w.logs.push(`${e} ${JSON.stringify(m ?? {})}`),
  fetch: async (input: string | URL | Request, init?: RequestInit) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    w.calls.push({ url: String(input), headers });
    if (String(input).endsWith('/oauth/token')) return Response.json({ access_token: 'USER-TOKEN-4', refresh_token: 'REFRESH-4', expires_in: 14400 });
    return w.api(String(input));
  },
  caller: {
    async getUser(t: string) { const sub = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.split('.')[1].length + 3) % 4))).sub; return sub === 'nobody' ? null : { id: sub }; },
    async listFactors() { return []; },
  },
});
const jwt = (sub: string) => `x.${b64url(new TextEncoder().encode(JSON.stringify({ sub, role: 'authenticated', aal: 'aal1', amr: [{ method: 'password', timestamp: 1762400000 }] })))}.y`;
const run = (w: World, user: string | null, body: Record<string, unknown> = {}, env = ENV) =>
  vatObligations({ authHeader: user ? `Bearer ${jwt(user)}` : null, headers: new Headers({ 'x-forwarded-for': '198.51.100.7' }), body: { company_id: CO, fraud: BROWSER, ...body } }, deps(w, env));
const hmrcCalls = (w: World) => w.calls.filter((c) => c.url.includes('/organisations/vat/'));
const noSecrets = (w: World, extra = '') => {
  const text = w.logs.join('\n') + JSON.stringify(w.audit) + extra;
  for (const s of [SECRET, 'USER-TOKEN', 'REFRESH-', 'Bearer', KEY_B64, VRN, 'own@']) assert(!text.includes(s), `leaked ${s}`);
};

// ------------------------------------------------------------------ input
Deno.test('VRN cleaning: 9 digits, spaces and a GB prefix removed; anything else refused', () => {
  assertEquals(cleanVrn('123456789'), VRN);
  assertEquals(cleanVrn('GB 123 4567 89'), VRN);
  assertEquals(cleanVrn('gb123456789'), VRN);
  for (const bad of ['12345678', '1234567890', 'GB12345678X', 'XI123456789', '', null, 123456789]) assertEquals(cleanVrn(bad), null, String(bad));
});

Deno.test('dates: real calendar dates only; ranges ordered and at most 366 days', () => {
  assert(dayOf('2024-02-29') !== null);
  for (const bad of ['2023-02-29', '2025-13-01', '2025-1-01', '25-01-01', '2025-01-32', 20250101]) assertEquals(dayOf(bad), null, String(bad));
  assertEquals(readQuery({}), { kind: 'open', status: 'O' });
  assertEquals(readQuery({ status: 'O' }), { kind: 'open', status: 'O' });
  assertEquals(readQuery({ status: 'F', from: '2025-01-01', to: '2025-12-31' }), { kind: 'fulfilled', status: 'F', from: '2025-01-01', to: '2025-12-31' });
  assertEquals(readQuery({ from: '2024-01-01', to: '2024-12-31' })?.kind, 'all', 'a leap year: 366 days is allowed');
  assertEquals(readQuery({ from: '2025-01-01', to: '2026-01-02' }), null, '367 days is refused');
  assertEquals(readQuery({ status: 'F' }), null, 'fulfilled needs dates');
  assertEquals(readQuery({ from: '2025-01-01' }), null, 'both dates or neither');
  assertEquals(readQuery({ from: '2025-02-01', to: '2025-01-01' }), null, 'to before from');
  assertEquals(readQuery({ status: 'X' }), null);
  assertEquals(readQuery({ scenario: 'QUARTERLY_ONE_MET' })?.scenario, 'QUARTERLY_ONE_MET');
  assertEquals(readQuery({ scenario: 'DROP TABLE' }), null, 'scenario only from the allow-list');
  assert(OBLIGATION_SCENARIOS.length <= 8);
});

Deno.test('normalise keeps HMRC\'s fields only and drops malformed obligations', () => {
  const r = normalise({ obligations: [...HMRC_EXAMPLE.obligations, { start: 'x', end: '2017-01-01', due: '2017-01-01', status: 'O', periodKey: '18A3' },
    { start: '2017-01-01', end: '2017-01-31', due: '2017-03-07', status: 'O', periodKey: '#001', secret: 'nope' }] });
  assertEquals(r.dropped, 1);
  assertEquals(r.obligations, [
    { periodKey: '18A1', start: '2017-01-01', end: '2017-03-31', due: '2017-05-07', status: 'F', received: '2017-05-06' },
    { periodKey: '18A2', start: '2017-04-01', end: '2017-06-30', due: '2017-08-07', status: 'O', received: null },
    { periodKey: '#001', start: '2017-01-01', end: '2017-01-31', due: '2017-03-07', status: 'O', received: null },
  ]);
  assertEquals(normalise({ nope: 1 }), { obligations: [], dropped: 0 });
});

// ------------------------------------------------------------------ the call
Deno.test('owner: one GET to the sandbox URL with the query, Accept, the user token and the fraud headers; a normalised answer', async () => {
  const w = await world();
  const r = await run(w, OWNER, { status: 'F', from: '2017-01-01', to: '2017-12-31', scenario: 'QUARTERLY_ONE_MET' });
  assertEquals(r.status, 200);
  const calls = hmrcCalls(w);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, 'https://test-api.service.hmrc.gov.uk/organisations/vat/123456789/obligations?from=2017-01-01&to=2017-12-31&status=F');
  const h = calls[0].headers;
  assertEquals(h.accept, 'application/vnd.hmrc.1.0+json');
  assertEquals(h.authorization, 'Bearer USER-TOKEN-3');
  assertEquals(h['gov-test-scenario'], 'QUARTERLY_ONE_MET');
  assertEquals(h['gov-client-connection-method'], 'WEB_APP_VIA_SERVER');
  assertEquals(h['gov-client-public-ip'], '198.51.100.7');
  assertEquals(h['gov-client-device-id'], BROWSER.deviceId);
  assertEquals(h['gov-client-user-ids'], `b2bnest=${OWNER}`);
  assertEquals(h['gov-client-public-port'], undefined, 'known gap: omitted, never invented');
  assertEquals(h['gov-vendor-public-ip'], undefined, 'HMRC_VENDOR_PUBLIC_IP unset: omitted');
  assertEquals(h['gov-vendor-forwarded'], undefined);
  const govValues = Object.entries(h).filter(([k]) => k.startsWith('gov-')).map(([, v]) => v).join(' ');
  assert(!/@|USER-TOKEN|Bearer|Owner/i.test(govValues), 'no email, name or token in any Gov header');
  const body = r.body as { obligations: unknown[]; vrn_last3: string; fetched_at: string; omitted: string[] };
  assertEquals(body.obligations.length, 2);
  assertEquals(body.vrn_last3, '789');
  assertEquals(body.fetched_at, '2026-11-06T10:00:00.000Z');
  assert(body.omitted.includes('Gov-Client-Public-Port'));
  assertEquals(w.audit.map((a) => `${a.event}:${a.reason}`), ['obligations_call:fulfilled', 'obligations_result:ok']);
  assert(w.logs.some((l) => l.includes('/organisations/vat/{vrn}/obligations') && l.includes('c75f40a6-a3df-4429-a697-471eeec46435')), 'logs the path pattern and HMRC\'s correlation id');
  noSecrets(w, JSON.stringify(r.body).replace('"vrn_last3":"789"', ''));
});

Deno.test('default: open obligations, no dates; no scenario header unless asked', async () => {
  const w = await world();
  await run(w, OWNER);
  const c = hmrcCalls(w)[0];
  assertEquals(new URL(c.url).search, '?status=O');
  assertEquals(c.headers['gov-test-scenario'], undefined);
});

Deno.test('who may ask: signed out, member, Solo, someone else\'s company, bad input — HMRC never called', async () => {
  const cases: [string | null, Record<string, unknown>, number, string][] = [
    [null, {}, 401, 'unauthorized'], ['nobody', {}, 401, 'unauthorized'],
    [MEMBER, {}, 403, 'not_admin'], [SOLO, {}, 403, 'plan_not_included'], [OUTSIDER, {}, 403, 'not_member'],
    [OWNER, { company_id: 'x' }, 400, 'bad_request'], [OWNER, { status: 'F' }, 400, 'bad_request'], [OWNER, { scenario: 'ANYTHING' }, 400, 'bad_request'],
  ];
  for (const [user, body, status, code] of cases) {
    const w = await world();
    const r = await run(w, user, body);
    assertEquals([r.status, r.body.code], [status, code], `${user} ${JSON.stringify(body)}`);
    assertEquals(hmrcCalls(w).length, 0);
  }
  const w = await world();
  const solo = await run(w, SOLO);
  assertEquals(solo.body.message, 'HMRC tools are included in the Business and Scale plans.');
  assertEquals(w.audit.at(-1)?.reason, 'plan_not_included');
});

Deno.test('production stays refused; not configured', async () => {
  for (const env of [{ ...ENV, HMRC_ENV: 'production' }, { ...ENV, HMRC_CLIENT_SECRET: '' }]) {
    const w = await world();
    const r = await run(w, OWNER, {}, env);
    assertEquals([r.status, r.body.code], [503, 'not_configured']);
    assertEquals(w.calls.length, 0);
  }
});

Deno.test('connection, permission and VAT number checks before any call', async () => {
  let w = await world({ connection: null });
  assertEquals((await run(w, OWNER)).body.code, 'not_connected');
  w = await world(); w.connection!.status = 'needs_reconnect';
  assertEquals((await run(w, OWNER)).body.code, 'needs_reconnect');
  w = await world(); w.connection!.scopes = ['hello'];
  const s = await run(w, OWNER);
  assertEquals([s.status, s.body.code], [409, 'scope_missing']);
  for (const vat of [null, '', '12345', 'GB12345678']) {
    w = await world({ vat });
    const r = await run(w, OWNER);
    assertEquals([r.status, r.body.code, r.body.message], [409, 'vrn_missing', 'Add your VAT number in Settings → HMRC first.']);
    assertEquals(hmrcCalls(w).length, 0);
  }
});

Deno.test('rate limit: 10 an hour per company', async () => {
  const w = await world({ slots: 0 });
  const r = await run(w, OWNER);
  assertEquals([r.status, r.body.code], [429, 'obligations_limit']);
  assertEquals(hmrcCalls(w).length, 0);
});

Deno.test('HMRC answers mapped: 401 refresh then reconnect, 403, 400, 404, 429, 5xx', async () => {
  const cases: [number, string | null, number, string][] = [
    [403, 'CLIENT_OR_AGENT_NOT_AUTHORISED', 403, 'vat_not_authorised'],
    [403, 'RULE_INSOLVENT_TRADER', 422, 'vat_insolvent'],
    [403, 'INVALID_SCOPE', 409, 'scope_missing'],
    [400, 'VRN_INVALID', 422, 'vrn_invalid'],
    [400, 'INVALID_DATE_RANGE', 400, 'bad_request'],
    [429, 'MESSAGE_THROTTLED_OUT', 503, 'hmrc_busy'],
    [500, 'SERVER_ERROR', 502, 'hmrc_unavailable'],
    [503, null, 502, 'hmrc_unavailable'],
    [406, 'ACCEPT_HEADER_INVALID', 502, 'hmrc_refused'],
  ];
  for (const [status, code, want, wantCode] of cases) {
    const w = await world({ api: () => Response.json(code ? { code, message: 'details that must not leak' } : {}, { status }) });
    const r = await run(w, OWNER);
    assertEquals([r.status, r.body.code], [want, wantCode], `${status} ${code}`);
    assertEquals(hmrcCalls(w).length, 1, 'no retry');
    assert(!JSON.stringify(r.body).includes('details that must not leak'));
    noSecrets(w);
  }
  const nf = await world({ api: () => Response.json({ code: 'NOT_FOUND', message: 'The requested resource could not be found' }, { status: 404 }) });
  const r = await run(nf, OWNER);
  assertEquals([r.status, (r.body as { obligations: unknown[] }).obligations], [200, []], '404 NOT_FOUND: no obligations for these dates');
  assertEquals(nf.audit.at(-1)?.reason, 'not_found');

  let n = 0;
  const w401 = await world({ api: () => (n++ === 0 ? Response.json({ code: 'INVALID_CREDENTIALS' }, { status: 401 }) : Response.json(HMRC_EXAMPLE)) });
  const ok = await run(w401, OWNER);
  assertEquals(ok.status, 200, '401: one refresh, one retry');
  assertEquals(hmrcCalls(w401).length, 2);
  assertEquals(hmrcCalls(w401)[1].headers.authorization, 'Bearer USER-TOKEN-4');
  const wDead = await world({ api: () => Response.json({ code: 'INVALID_CREDENTIALS' }, { status: 401 }) });
  const dead = await run(wDead, OWNER);
  assertEquals(dead.body.code, 'needs_reconnect');
  assertEquals(wDead.connection!.status, 'needs_reconnect');
  noSecrets(wDead);
});

Deno.test('a demo person is refused (403) before anything runs', async () => {
  const w = await world();
  const handler = withDemoGuard((req: Request) => vatObligations({ authHeader: req.headers.get('authorization'), headers: req.headers, body: { company_id: CO } }, deps(w)).then((r) => Response.json(r.body, { status: r.status })), {
    deps: { env: (k) => ({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' } as Record<string, string>)[k], fetch: async () => Response.json([{ user_id: DEMO }]) },
  });
  const res = await handler(new Request('https://fn.test', { method: 'POST', headers: { Authorization: `Bearer ${jwt(DEMO)}` } }));
  assertEquals(res.status, 403);
  assertEquals((await res.json()).code, 'demo_readonly');
  assertEquals(w.calls.length, 0);
  assertEquals(w.audit.length, 0);
});

// ------------------------------------------------------------------ whose VAT number (fixed after release, 7 Nov 2026)
Deno.test('VAT number: each company its own; another company\'s row is never used; a no-company row is the only fallback', () => {
  const A = '0d300000-0000-4000-8000-00000000000a', B = '0d300000-0000-4000-8000-00000000000b', C = '0d300000-0000-4000-8000-00000000000c';
  const rows: VatRow[] = [
    { user_id: OWNER, organization_id: A, vat_number: '111111111', updated_at: '2026-11-01' },
    { user_id: OWNER, organization_id: B, vat_number: 'GB 222 2222 22', updated_at: '2026-11-02' },
  ];
  assertEquals(pickVatNumber(A, OWNER, rows, [OWNER]), '111111111');
  assertEquals(pickVatNumber(B, OWNER, rows, [OWNER]), 'GB 222 2222 22');
  assertEquals(pickVatNumber(C, OWNER, rows, [OWNER]), null, 'a row tagged to another company is never used');
  const withLegacy = [...rows, { user_id: OWNER, organization_id: null, vat_number: '999999999' }];
  assertEquals(pickVatNumber(C, OWNER, withLegacy, [OWNER]), '999999999', 'the caller\'s own no-company row is the only fallback');
  assertEquals(pickVatNumber(A, OWNER, withLegacy, [OWNER]), '111111111', 'the company\'s own row comes first');
  assertEquals(pickVatNumber(C, OWNER, [{ user_id: MEMBER, organization_id: null, vat_number: '999999999' }], [OWNER]), null, 'someone else\'s no-company row: never');
  // Another owner or admin of the company saved it: used. A member saved it: never used.
  assertEquals(pickVatNumber(A, OWNER, [{ user_id: SOLO, organization_id: A, vat_number: '333333333' }], [OWNER, SOLO]), '333333333');
  assertEquals(pickVatNumber(A, OWNER, [{ user_id: MEMBER, organization_id: A, vat_number: '444444444' }], [OWNER]), null, 'a member\'s row is not used');
  assertEquals(pickVatNumber(A, OWNER, [{ user_id: OWNER, organization_id: A, vat_number: '  ' }, { user_id: OWNER, organization_id: null, vat_number: '555555555' }], [OWNER]), '555555555', 'an empty company row falls back');
  assertEquals(pickVatNumber(A, OWNER, [
    { user_id: SOLO, organization_id: A, vat_number: '666666666', updated_at: '2026-11-01' },
    { user_id: OUTSIDER, organization_id: A, vat_number: '777777777', updated_at: '2026-11-05' },
  ], [OWNER, SOLO, OUTSIDER]), '777777777', 'the newest admin row');
});

// ------------------------------------------------------------------ HMRC P7a: error handling gaps closed
Deno.test('P7a: obligations: 429 says when to try again (Retry-After), NOT_SIGNED_UP_TO_MTD has its own words, 503 and a timeout are "couldn\'t be reached"', async () => {
  const busyW = await world({ api: () => Response.json({ code: 'MESSAGE_THROTTLED_OUT' }, { status: 429, headers: { 'Retry-After': '300' } }) });
  const b = await run(busyW, OWNER);
  assertEquals([b.status, b.body.code, b.body.retry_after], [503, 'hmrc_busy', 300]);
  assertEquals(b.body.message, 'HMRC is busy right now. Please try again in 5 minutes.');
  const plain = await run(await world({ api: () => Response.json({ code: 'MESSAGE_THROTTLED_OUT' }, { status: 429 }) }), OWNER);
  assertEquals(plain.body.message, 'HMRC is busy right now. Please try again in a minute.', 'no Retry-After: the old wording');
  const signedUp = await run(await world({ api: () => Response.json({ code: 'NOT_SIGNED_UP_TO_MTD' }, { status: 403 }) }), OWNER);
  assertEquals(signedUp.body.code, 'vat_not_signed_up');
  assert(String(signedUp.body.message).includes("isn't signed up for Making Tax Digital for VAT"));
  const down = await run(await world({ api: () => new Response('', { status: 503 }) }), OWNER);
  assertEquals(down.body.code, 'hmrc_unavailable');
  const w = await world({ api: () => { throw new DOMException('timed out', 'TimeoutError'); } });
  const t = await run(w, OWNER);
  assertEquals(t.body.code, 'hmrc_unavailable');
  noSecrets(w);
});

Deno.test('P7a: the obligations GET carries a timeout signal', async () => {
  const w = await world();
  const d = deps(w);
  let signal: AbortSignal | undefined;
  const f = d.fetch;
  d.fetch = async (input: string | URL | Request, init?: RequestInit) => { if (String(input).includes('/obligations')) signal = init?.signal ?? undefined; return f(input, init); };
  await vatObligations({ authHeader: `Bearer ${jwt(OWNER)}`, headers: new Headers(), body: { company_id: CO } }, d);
  assert(signal instanceof AbortSignal);
});
