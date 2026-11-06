// HMRC P1 + P2 Deno tests: fraud prevention headers (against HMRC's WEB_APP_VIA_SERVER specification and its examples),
// callHmrc, and the hmrc-test-call handler. HMRC is mocked: no network.
import { assert, assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts';
import {
  asciiOnly, buildFraudHeaders, clientIpFrom, pct, publicIp, readBrowserFraudData, WEB_APP_VIA_SERVER_HEADERS, type ServerFraudData,
} from './fraudHeaders.ts';
import { callHmrc } from './api.ts';
import { forgetApplicationToken } from './oauth.ts';
import { b64url, encryptToken, tokenAad } from './crypto.ts';
import { summariseValidation, testCall } from './testCall.ts';
import type { AuditEvent, ConnectionRow, HmrcStore, ManageRule } from './store.ts';

const KEY = new Uint8Array(32).map((_, i) => i + 7);
const KEY_B64 = btoa(String.fromCharCode(...KEY));
const SECRET = 'client-secret-p1';
const ENV: Record<string, string> = {
  HMRC_CLIENT_ID: 'b2bnest-client', HMRC_CLIENT_SECRET: SECRET, HMRC_TOKEN_KEY: KEY_B64, HMRC_ENV: 'sandbox',
  HMRC_REDIRECT_URI: 'https://www.b2bnest.online/hmrc/callback', HMRC_VENDOR_PUBLIC_IP: '203.0.113.6',
};
const CO = '0d100000-0000-4000-8000-000000000001';
const USER = '6f9619ff-8b86-4011-b42d-00cf4fc964ff';
const BROWSER = {
  deviceId: 'beec798b-b366-47fa-b1f8-92cede14a1ce',
  jsUserAgent: 'Mozilla/5.0 (iPad; U; CPU OS 3_2_1 like Mac OS X; en-us) AppleWebKit/531.21.10 (KHTML, like Gecko) Mobile/7B405',
  screens: [{ width: 1920, height: 1080, scalingFactor: 1, colourDepth: 16 }, { width: 3000, height: 2000, scalingFactor: 1.25, colourDepth: 16 }],
  windowSize: { width: 1256, height: 803 },
  timezone: 'UTC+01:00',
  webVersion: '1.0.0',
};
const SERVER: ServerFraudData = {
  clientPublicIp: '198.51.100.0', receivedAt: new Date('2020-09-21T14:30:05.123Z'), clientPublicPort: null, vendorPublicIp: '203.0.113.6',
  userId: USER, mfa: null,
};

// ------------------------------------------------------------------ fraud prevention headers
Deno.test('headers: values in the exact formats of HMRC\'s WEB_APP_VIA_SERVER examples', () => {
  const { headers } = buildFraudHeaders(BROWSER, SERVER);
  assertEquals(headers['Gov-Client-Connection-Method'], 'WEB_APP_VIA_SERVER');
  assertEquals(headers['Gov-Client-Browser-JS-User-Agent'], BROWSER.jsUserAgent); // "as reported by the browser"
  assertEquals(headers['Gov-Client-Device-ID'], 'beec798b-b366-47fa-b1f8-92cede14a1ce');
  assertEquals(headers['Gov-Client-Public-IP'], '198.51.100.0');
  assertEquals(headers['Gov-Client-Public-IP-Timestamp'], '2020-09-21T14:30:05.123Z'); // yyyy-MM-ddThh:mm:ss.sssZ
  assertEquals(headers['Gov-Client-Screens'], 'width=1920&height=1080&scaling-factor=1&colour-depth=16,width=3000&height=2000&scaling-factor=1.25&colour-depth=16');
  assertEquals(headers['Gov-Client-Timezone'], 'UTC+01:00');
  assertEquals(headers['Gov-Client-Window-Size'], 'width=1256&height=803');
  assertEquals(headers['Gov-Client-User-IDs'], `b2bnest=${USER}`);
  assertEquals(headers['Gov-Vendor-Public-IP'], '203.0.113.6');
  assertEquals(headers['Gov-Vendor-Forwarded'], 'by=203.0.113.6&for=198.51.100.0'); // the spec's example 1
  assertEquals(headers['Gov-Vendor-Product-Name'], 'B2BNEST');
  assertEquals(headers['Gov-Vendor-Version'], 'b2bnest-web=1.0.0&b2bnest-server=1.0.0'); // client and server
});
Deno.test('headers: percent encoding as the spec\'s examples (keys and values encoded, separators not)', () => {
  assertEquals(pct('Product Name'), 'Product%20Name');
  assertEquals(pct('2021-11-21T13:23Z'), '2021-11-21T13%3A23Z');
  assertEquals(pct('2001:0db8:85a3:0000:0000:8a2e:0370:7334'), '2001%3A0db8%3A85a3%3A0000%3A0000%3A8a2e%3A0370%3A7334'); // example 2
  assertEquals(pct("a!'()*b"), 'a%21%27%28%29%2Ab');
  const v6 = buildFraudHeaders(BROWSER, { ...SERVER, clientPublicIp: '2001:0db8:85a3:0000:0000:8a2e:0370:7334' }).headers;
  assertEquals(v6['Gov-Vendor-Forwarded'], 'by=203.0.113.6&for=2001%3A0db8%3A85a3%3A0000%3A0000%3A8a2e%3A0370%3A7334');
  assertEquals(v6['Gov-Client-Public-IP'], '2001:0db8:85a3:0000:0000:8a2e:0370:7334');
  assertEquals(asciiOnly('Mozilla/5.0 (Ünïcode)'), 'Mozilla/5.0 (%C3%9Cn%C3%AFcode)'); // US-ASCII only
  for (const v of Object.values(buildFraudHeaders(BROWSER, SERVER).headers)) assert(/^[\x20-\x7e]+$/.test(v), v);
});
Deno.test('headers: multi-factor only when this session had the authenticator step, in the spec\'s key-value format', async () => {
  assertEquals(buildFraudHeaders(BROWSER, SERVER).headers['Gov-Client-Multi-Factor'], undefined); // password only: no claim
  const at = new Date('2021-11-21T13:20:00.000Z');
  const ref = '0283da60063abfb3a87f1aed845d17fe2d9ba8c780b478dc4ae048f5ee97a6d5';
  const h = buildFraudHeaders(BROWSER, { ...SERVER, mfa: { type: 'TOTP', at, uniqueReference: ref } }).headers;
  assertEquals(h['Gov-Client-Multi-Factor'], `type=TOTP&timestamp=2021-11-21T13%3A20%3A00.000Z&unique-reference=${ref}`);
  await Promise.resolve();
});
Deno.test('headers: missing values are left out and listed, never a placeholder; no email, name or token anywhere', () => {
  const r = buildFraudHeaders({}, { ...SERVER, clientPublicIp: '10.0.0.5', vendorPublicIp: null });
  assertEquals(r.omitted, ['Gov-Client-Browser-JS-User-Agent', 'Gov-Client-Device-ID', 'Gov-Client-Multi-Factor', 'Gov-Client-Public-IP',
    'Gov-Client-Public-IP-Timestamp', 'Gov-Client-Public-Port', 'Gov-Client-Screens', 'Gov-Client-Timezone', 'Gov-Client-Window-Size',
    'Gov-Vendor-Forwarded', 'Gov-Vendor-License-IDs', 'Gov-Vendor-Public-IP']);
  const text = JSON.stringify(r.headers);
  assert(!/null|undefined|NaN/.test(text), text);
  assertEquals(Object.keys(r.headers).sort(), ['Gov-Client-Connection-Method', 'Gov-Client-User-IDs', 'Gov-Vendor-Product-Name', 'Gov-Vendor-Version']);
  assertEquals(r.headers['Gov-Vendor-Version'], 'b2bnest-server=1.0.0');
  const all = JSON.stringify(buildFraudHeaders(BROWSER, { ...SERVER, userId: 'ada@example.test' }).headers);
  assert(!all.includes('@'), 'an email address is never sent (User-IDs takes the B2BNEST user id only)');
  assertEquals(WEB_APP_VIA_SERVER_HEADERS.length, 16);
});
Deno.test('headers: the browser input is checked field by field; anything off is dropped', () => {
  assertEquals(readBrowserFraudData({
    deviceId: 'not-a-uuid', jsUserAgent: '', screens: [{ width: -1, height: 2, scalingFactor: 1, colourDepth: 24 }, { width: 800, height: 600, scalingFactor: 2, colourDepth: 24 }],
    windowSize: { width: 0, height: 10 }, timezone: 'GMT', webVersion: '1.0.0; rm', email: 'ada@example.test', plugins: ['x'],
  }), { screens: [{ width: 800, height: 600, scalingFactor: 2, colourDepth: 24 }] });
  assertEquals(readBrowserFraudData(BROWSER), BROWSER);
  assertEquals(readBrowserFraudData(null), {});
  assertEquals(readBrowserFraudData({ timezone: 'UTC-01:15' }).timezone, 'UTC-01:15');
});
Deno.test('client IP: public addresses only, from the forwarding headers; private or missing → left out', () => {
  assertEquals(clientIpFrom(new Headers({ 'x-forwarded-for': '198.51.100.7, 10.0.0.1' })), '198.51.100.7');
  assertEquals(clientIpFrom(new Headers({ 'x-forwarded-for': '10.0.0.1', 'cf-connecting-ip': '203.0.113.9' })), '203.0.113.9');
  assertEquals(clientIpFrom(new Headers({ 'x-real-ip': '192.168.1.4' })), null);
  assertEquals(clientIpFrom(new Headers()), null);
  for (const ip of ['127.0.0.1', '169.254.1.1', '172.20.0.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', 'not-an-ip']) assertEquals(publicIp(ip), null, ip);
  assertEquals(publicIp('::ffff:198.51.100.1'), '198.51.100.1');
});

// ------------------------------------------------------------------ an in-memory world
const OWNER = '0a0a0a0a-0000-4000-8000-00000000000a';
const MFA = '0b0b0b0b-0000-4000-8000-00000000000b';
interface World {
  rules: Record<string, ManageRule>;
  factors: Record<string, { id: string; factor_type: string; status: string }[]>;
  connection: (ConnectionRow & { refresh_lock_until?: string | null }) | null;
  audit: { event: AuditEvent; reason?: string | null; user_id: string | null }[];
  slots: number;
  calls: { url: string; headers: Record<string, string>; body: string }[];
  api: (url: string, headers: Record<string, string>) => Response | Promise<Response>;
  logs: string[];
  now: Date;
}
async function world(over: Partial<World> = {}): Promise<World> {
  return {
    rules: { [`${CO}:${OWNER}`]: 'ok', [`${CO}:member`]: 'not_admin', [`${CO}:platform`]: 'not_member', [`${CO}:solo`]: 'plan_not_included',
      [`${CO}:ended`]: 'trial_ended', [`${CO}:suspended`]: 'suspended', [`${CO}:${MFA}`]: 'ok' },
    factors: { [MFA]: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }] },
    connection: {
      company_id: CO, environment: 'sandbox', status: 'connected', scopes: ['read:vat', 'write:vat', 'hello'],
      access_token_enc: await encryptToken('USER-TOKEN-1', KEY, tokenAad(CO, 'sandbox', 'access')),
      refresh_token_enc: await encryptToken('REFRESH-1', KEY, tokenAad(CO, 'sandbox', 'refresh')),
      expires_at: '2026-11-04T14:00:00.000Z', refresh_lock_until: null,
    },
    audit: [], slots: 10, calls: [], logs: [], now: new Date('2026-11-04T10:00:00.000Z'),
    api: (url) => {
      if (url.endsWith('/oauth/token')) return Response.json({ access_token: 'APP-TOKEN-1', token_type: 'bearer', expires_in: 14400 });
      if (url.endsWith('/hello/world')) return Response.json({ message: 'Hello World' });
      if (url.endsWith('/hello/application')) return Response.json({ message: 'Hello Application' });
      if (url.endsWith('/hello/user')) return Response.json({ message: 'Hello User' });
      return Response.json({ specVersion: '3.3', code: 'VALID_HEADERS', message: 'All headers required for your connection method have been supplied and all appear to be valid.' });
    },
    ...over,
  };
}
function store(w: World): HmrcStore {
  return {
    async manageAllowed(c, u) { return w.rules[`${c}:${u}`] ?? 'not_member'; },
    async createState() {}, async consumeState() { return null; }, async saveConnection() {},
    async getConnection() { return w.connection ? { ...w.connection } : null; },
    async updateConnection(_c, _e, patch) { if (w.connection) Object.assign(w.connection, patch); },
    async claimRefresh() { if (!w.connection || w.connection.status !== 'connected') return false; return true; },
    async audit(r) { w.audit.push({ event: r.event, reason: r.reason ?? null, user_id: r.user_id }); },
    async takeTestSlot(_c, u, _e, kind) { if (w.slots <= 0) return false; w.slots--; w.audit.push({ event: 'test_call', reason: kind, user_id: u }); return true; },
    async takeObligationsSlot() { return true; },
    async vatNumberFor() { return null; },
  };
}
const deps = (w: World, env = ENV) => ({
  env: (k: string) => env[k], store: store(w), now: () => w.now, sleep: async () => {},
  log: (e: string, m?: Record<string, unknown>) => w.logs.push(`${e} ${JSON.stringify(m ?? {})}`),
  fetch: async (input: string | URL | Request, init?: RequestInit) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    w.calls.push({ url: String(input), headers, body: String(init?.body ?? '') });
    return await w.api(String(input), headers);
  },
  caller: {
    async getUser(t: string) { const sub = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.split('.')[1].length + 3) % 4))).sub; return sub === 'nobody' ? null : { id: sub }; },
    async listFactors(u: string) { return w.factors[u] ?? []; },
  },
});
const jwt = (sub: string, aal = 'aal1', amr: unknown[] = [{ method: 'password', timestamp: 1730714000 }]) => `x.${b64url(new TextEncoder().encode(JSON.stringify({ sub, aal, amr })))}.y`;
const auth = (sub: string, aal?: string, amr?: unknown[]) => `Bearer ${jwt(sub, aal, amr)}`;
const run = (w: World, user: string | null, body: Record<string, unknown>, extra: { aal?: string; amr?: unknown[]; headers?: Record<string, string> } = {}) =>
  testCall({ authHeader: user ? auth(user, extra.aal, extra.amr) : null, headers: new Headers(extra.headers ?? { 'x-forwarded-for': '198.51.100.7' }), body: { company_id: CO, ...body } }, deps(w));
const noSecrets = (w: World) => {
  const text = w.logs.join('\n') + JSON.stringify(w.audit);
  for (const s of [SECRET, 'USER-TOKEN', 'REFRESH-', 'APP-TOKEN', 'Bearer', 'Hello User', 'VALID_HEADERS', KEY_B64]) assert(!text.includes(s), `leaked ${s}`);
};

// ------------------------------------------------------------------ callHmrc
Deno.test('callHmrc: the three token kinds and the Accept header', async () => {
  forgetApplicationToken();
  const w = await world();
  const d = deps(w);
  assertEquals((await callHmrc({ companyId: CO, method: 'GET', path: '/hello/world', version: '1.0', tokenKind: 'none' }, d)).body, { message: 'Hello World' });
  assertEquals(w.calls[0].headers.accept, 'application/vnd.hmrc.1.0+json');
  assertEquals(w.calls[0].headers.authorization, undefined);
  assertEquals(w.calls[0].url, 'https://test-api.service.hmrc.gov.uk/hello/world');
  await callHmrc({ companyId: CO, method: 'GET', path: '/hello/application', version: '1.0', tokenKind: 'application' }, d);
  assertEquals(new URLSearchParams(w.calls[1].body).get('grant_type'), 'client_credentials');
  assertEquals(w.calls[2].headers.authorization, 'Bearer APP-TOKEN-1');
  await callHmrc({ companyId: CO, method: 'GET', path: '/hello/application', version: '1.0', tokenKind: 'application' }, d);
  assertEquals(w.calls.length, 4, 'the application token is reused until it runs out');
  await callHmrc({ companyId: CO, userId: OWNER, method: 'GET', path: '/hello/user', version: '1.0', tokenKind: 'user' }, d);
  assertEquals(w.calls.at(-1)?.headers.authorization, 'Bearer USER-TOKEN-1');
  noSecrets(w);
});
Deno.test('callHmrc: a 401 refreshes once and retries once; a second 401 marks needs_reconnect', async () => {
  let w = await world();
  let userCalls = 0;
  w.api = (url) => {
    if (url.endsWith('/oauth/token')) return Response.json({ access_token: 'USER-TOKEN-2', refresh_token: 'REFRESH-2', expires_in: 14400 });
    userCalls++;
    return userCalls === 1 ? Response.json({ code: 'INVALID_CREDENTIALS', message: 'x' }, { status: 401 }) : Response.json({ message: 'Hello User' });
  };
  let r = await callHmrc({ companyId: CO, userId: OWNER, method: 'GET', path: '/hello/user', version: '1.0', tokenKind: 'user' }, deps(w));
  assert(r.ok);
  assertEquals(w.calls.map((c) => c.url.split('.gov.uk')[1]), ['/hello/user', '/oauth/token', '/hello/user']);
  assertEquals(new URLSearchParams(w.calls[1].body).get('grant_type'), 'refresh_token');
  assertEquals(w.calls[2].headers.authorization, 'Bearer USER-TOKEN-2');
  w = await world();
  w.api = (url) => url.endsWith('/oauth/token') ? Response.json({ access_token: 'USER-TOKEN-3', refresh_token: 'REFRESH-3', expires_in: 14400 })
    : Response.json({ code: 'INVALID_CREDENTIALS' }, { status: 401 });
  r = await callHmrc({ companyId: CO, userId: OWNER, method: 'GET', path: '/hello/user', version: '1.0', tokenKind: 'user' }, deps(w));
  assertEquals([r.ok, r.reason], [false, 'needs_reconnect']);
  assertEquals(w.calls.filter((c) => c.url.endsWith('/hello/user')).length, 2, 'retried once only');
  assertEquals(w.connection?.status, 'needs_reconnect');
  assert(w.audit.some((a) => a.event === 'refresh_failed' && a.reason === 'hmrc_401_after_refresh'));
  noSecrets(w);
});
Deno.test('callHmrc: 429 and 5xx are never retried; HMRC\'s error code is kept, the body is not', async () => {
  forgetApplicationToken();
  for (const [status, code, reason] of [[429, 'MESSAGE_THROTTLED_OUT', 'hmrc_rate_limited'], [503, 'SERVER_ERROR', 'hmrc_unavailable'], [500, 'INTERNAL_SERVER_ERROR', 'hmrc_unavailable']] as const) {
    const w = await world({ api: () => Response.json({ code, message: 'secret detail ada@example.test' }, { status }) });
    const r = await callHmrc({ companyId: CO, method: 'GET', path: '/hello/world', version: '1.0', tokenKind: 'none' }, deps(w));
    assertEquals([r.ok, r.status, r.hmrcCode, r.reason, r.body], [false, status, code, reason, undefined]);
    assertEquals(w.calls.length, 1);
    assert(!w.logs.join('').includes('ada@example.test'));
  }
  const w = await world({ api: () => { throw new TypeError('down'); } });
  assertEquals((await callHmrc({ companyId: CO, method: 'GET', path: '/hello/world', version: '1.0', tokenKind: 'none' }, deps(w))).reason, 'network');
});
Deno.test('callHmrc: not connected / needs reconnect / not configured never call HMRC', async () => {
  let w = await world({ connection: null });
  assertEquals((await callHmrc({ companyId: CO, userId: OWNER, method: 'GET', path: '/hello/user', version: '1.0', tokenKind: 'user' }, deps(w))).reason, 'not_connected');
  w = await world();
  w.connection!.status = 'needs_reconnect';
  assertEquals((await callHmrc({ companyId: CO, userId: OWNER, method: 'GET', path: '/hello/user', version: '1.0', tokenKind: 'user' }, deps(w))).reason, 'needs_reconnect');
  assertEquals((await callHmrc({ companyId: CO, method: 'GET', path: '/hello/world', version: '1.0', tokenKind: 'none' }, deps(w, { ...ENV, HMRC_CLIENT_SECRET: '' }))).reason, 'not_configured');
  assertEquals(w.calls.length, 0);
});

// ------------------------------------------------------------------ hmrc-test-call
Deno.test('test call: the access matrix (session, two-step, member, platform admin, Solo, trial ended, suspended)', async () => {
  const cases: [string | null, string, number, string][] = [
    [null, '', 401, 'unauthorized'], ['nobody', '', 401, 'unauthorized'], [MFA, 'aal1', 403, 'two_step_required'],
    ['member', '', 403, 'not_admin'], ['platform', '', 403, 'not_member'], ['solo', '', 403, 'plan_not_included'],
    ['ended', '', 403, 'trial_ended'], ['suspended', '', 403, 'suspended'],
  ];
  for (const [user, aal, status, code] of cases) {
    const w = await world();
    const r = await run(w, user, { kind: 'hello_world' }, { aal: aal || undefined });
    assertEquals([r.status, r.body.code], [status, code], `${user}`);
    assertEquals(w.calls.length, 0, `${user}: HMRC not called`);
    assert(!w.audit.some((a) => a.event === 'test_call'), `${user}: no test slot used`);
  }
  const w = await world();
  assertEquals((await run(w, OWNER, { kind: 'something_else' })).body.code, 'bad_request');
});
Deno.test('test call: Hello World, Hello Application and Hello User succeed for an owner; audited before and after', async () => {
  forgetApplicationToken();
  const w = await world();
  for (const [kind, msg] of [['hello_world', 'Hello World'], ['hello_application', 'Hello Application'], ['hello_user', 'Hello User']]) {
    const r = await run(w, OWNER, { kind, fraud: BROWSER });
    assertEquals([r.status, r.body.message, r.body.kind], [200, msg, kind]);
  }
  assertEquals(w.audit.map((a) => `${a.event}:${a.reason}`), ['test_call:hello_world', 'test_result:hello_world_200', 'test_call:hello_application',
    'test_result:hello_application_200', 'test_call:hello_user', 'test_result:hello_user_200']);
  const helloUser = w.calls.find((c) => c.url.endsWith('/hello/user'))!;
  assertEquals(helloUser.headers['gov-client-connection-method'], 'WEB_APP_VIA_SERVER');
  assertEquals(helloUser.headers['gov-client-public-ip'], '198.51.100.7');
  assertEquals(helloUser.headers['gov-client-device-id'], BROWSER.deviceId);
  assertEquals(helloUser.headers['gov-client-user-ids'], `b2bnest=${OWNER}`);
  noSecrets(w);
});
Deno.test('test call: Hello User needs a connection with the test permission; rate limit; HMRC busy', async () => {
  let w = await world({ connection: null });
  assertEquals((await run(w, OWNER, { kind: 'hello_user' })).body.code, 'not_connected');
  w = await world();
  w.connection!.status = 'needs_reconnect';
  assertEquals((await run(w, OWNER, { kind: 'hello_user' })).body.code, 'needs_reconnect');
  w = await world();
  w.connection!.scopes = ['read:vat', 'write:vat'];
  const s = await run(w, OWNER, { kind: 'hello_user' });
  assertEquals([s.status, s.body.code], [409, 'scope_missing']);
  assertEquals(w.calls.length, 0);
  w = await world({ slots: 0 });
  const limited = await run(w, OWNER, { kind: 'hello_world' });
  assertEquals([limited.status, limited.body.code], [429, 'test_limit']);
  assertEquals(w.calls.length, 0);
  w = await world({ api: () => Response.json({ code: 'MESSAGE_THROTTLED_OUT' }, { status: 429 }) });
  const busy = await run(w, OWNER, { kind: 'hello_world' });
  assertEquals([busy.status, busy.body.code], [503, 'hmrc_busy']);
  assertEquals(w.audit.at(-1)?.reason, 'hello_world_hmrc_rate_limited');
});
Deno.test('test call: the fraud header check sends the real header set and returns only header feedback', async () => {
  forgetApplicationToken();
  const w = await world({
    api: (url) => url.endsWith('/oauth/token') ? Response.json({ access_token: 'APP-TOKEN-9', expires_in: 14400 }) : Response.json({
      specVersion: '3.3', code: 'INVALID_HEADERS', message: 'At least 1 header is invalid',
      errors: [{ code: 'MISSING_HEADER', message: 'Header required', headers: ['gov-client-public-port'] }],
      warnings: [{ code: 'POTENTIALLY_INVALID_HEADER', message: 'Check the value', headers: ['gov-client-user-ids', 'Authorization'] }],
      secret: 'ignored',
    }),
  });
  const totpAt = 1762250400; // 2025-11-04T10:00:00Z
  const r = await run(w, MFA, { kind: 'fraud_headers_validate', fraud: BROWSER }, { aal: 'aal2', amr: [{ method: 'password', timestamp: totpAt - 60 }, { method: 'totp', timestamp: totpAt }] });
  assertEquals(r.status, 200);
  assertEquals(r.body.result, {
    code: 'INVALID_HEADERS', message: 'At least 1 header is invalid',
    errors: [{ code: 'MISSING_HEADER', message: 'Header required', headers: ['gov-client-public-port'] }],
    warnings: [{ code: 'POTENTIALLY_INVALID_HEADER', message: 'Check the value', headers: ['gov-client-user-ids'] }],
  });
  assert(!JSON.stringify(r.body).includes('ignored'));
  const validate = w.calls.find((c) => c.url.endsWith('/test/fraud-prevention-headers/validate'))!;
  assertEquals(validate.headers.authorization, 'Bearer APP-TOKEN-9');
  assert(/^type=TOTP&timestamp=2025-11-04T10%3A00%3A00\.000Z&unique-reference=[0-9a-f]{64}$/.test(validate.headers['gov-client-multi-factor']),
    'the authenticator step of this session, truthfully');
  assertEquals(r.body.omitted, ['Gov-Client-Public-Port', 'Gov-Vendor-License-IDs']);
  noSecrets(w);
});
Deno.test('test call: no multi-factor claim without the authenticator step; summariseValidation keeps header names only', async () => {
  forgetApplicationToken();
  const w = await world();
  await run(w, OWNER, { kind: 'fraud_headers_validate', fraud: BROWSER });
  const v = w.calls.find((c) => c.url.includes('/validate'))!;
  assertEquals(v.headers['gov-client-multi-factor'], undefined);
  assertEquals(summariseValidation({ nope: 1 }), null);
  assertEquals(summariseValidation({ code: 'VALID_HEADERS', message: 'ok' })?.errors, []);
});
