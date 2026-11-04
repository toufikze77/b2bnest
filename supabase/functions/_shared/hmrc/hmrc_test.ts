// HMRC P0 Deno tests. HMRC is mocked (no network); the store is in memory and follows the SQL rules (single-use
// 10-minute states, per-company refresh lock, append-only audit).
import { assert, assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts';
import { decodeKey, HMRC_SCOPES, readConfig } from './config.ts';
import { b64url, decryptToken, encryptToken, keyId, keyringFrom, sha256Hex, TokenDecryptError, tokenAad } from './crypto.ts';
import { connectComplete, connectStart, disconnect, type HandlerDeps } from './handlers.ts';
import { getFreshHmrcToken, HmrcTokenError } from './token.ts';
import type { AuditEvent, ConnectionRow, HmrcStore, ManageRule } from './store.ts';

const KEY = new Uint8Array(32).map((_, i) => i + 1);
const KEY_B64 = btoa(String.fromCharCode(...KEY));
const SECRET = 'client-secret-value-xyz';
const ENV: Record<string, string> = {
  HMRC_CLIENT_ID: 'b2bnest-client-id', HMRC_CLIENT_SECRET: SECRET, HMRC_TOKEN_KEY: KEY_B64, HMRC_ENV: 'sandbox',
  HMRC_REDIRECT_URI: 'https://www.b2bnest.online/hmrc/callback',
};
const CO = '0d100000-0000-4000-8000-000000000001';
const CO_B = '0d100000-0000-4000-8000-000000000002';
// A fake JWT (the payload only matters for the aal claim; getUser is mocked).
const jwt = (sub: string, aal = 'aal1') => `x.${b64url(new TextEncoder().encode(JSON.stringify({ sub, aal })))}.y`;
const auth = (sub: string, aal?: string) => `Bearer ${jwt(sub, aal)}`;
const DB_FORMAT = /^v1\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/; // hc_access_format in proposal.sql

interface World {
  rules: Record<string, ManageRule>; // `${company}:${user}`
  factors: Record<string, { factor_type: string; status: string }[]>;
  states: { state_hash: string; user_id: string; company_id: string; environment: 'sandbox'; expires_at: string; used_at: string | null }[];
  connections: (ConnectionRow & { connected_by?: string | null; connected_at?: string | null; refresh_lock_until?: string | null })[];
  audit: { company_id: string; user_id: string | null; event: AuditEvent; reason?: string | null }[];
  calls: { url: string; body: URLSearchParams }[];
  hmrc: (body: URLSearchParams) => Promise<Response>;
  logs: string[];
  now: Date;
}
function world(over: Partial<World> = {}): World {
  return {
    rules: { [`${CO}:owner`]: 'ok', [`${CO}:admin`]: 'ok', [`${CO}:member`]: 'not_admin', [`${CO}:platform`]: 'not_member', [`${CO}:ended`]: 'trial_ended',
      [`${CO}:suspended`]: 'suspended', [`${CO}:mfa`]: 'ok' },
    factors: { mfa: [{ factor_type: 'totp', status: 'verified' }], owner: [{ factor_type: 'totp', status: 'unverified' }] },
    states: [], connections: [], audit: [], calls: [], logs: [], now: new Date('2026-11-04T10:00:00Z'),
    hmrc: async () => Response.json({ access_token: 'ACCESS-TOKEN-1', refresh_token: 'REFRESH-TOKEN-1', expires_in: 14400, scope: 'read:vat write:vat' }),
    ...over,
  };
}
function store(w: World): HmrcStore {
  return {
    async manageAllowed(c, u) { return w.rules[`${c}:${u}`] ?? 'not_member'; },
    async createState(r) { w.states.push({ ...r, environment: 'sandbox', used_at: null }); },
    async consumeState(h, u) {
      const s = w.states.find((x) => x.state_hash === h && x.user_id === u && !x.used_at && Date.parse(x.expires_at) > w.now.getTime());
      if (!s) return null;
      s.used_at = w.now.toISOString();
      return { company_id: s.company_id, environment: s.environment };
    },
    async saveConnection(r) {
      w.connections = w.connections.filter((c) => !(c.company_id === r.company_id && c.environment === r.environment));
      w.connections.push({ ...r, refresh_lock_until: null });
    },
    async getConnection(c, e) { const r = w.connections.find((x) => x.company_id === c && x.environment === e); return r ? { ...r } : null; },
    async updateConnection(c, e, patch) { const r = w.connections.find((x) => x.company_id === c && x.environment === e); if (r) Object.assign(r, patch); },
    async claimRefresh(c, e, secs) {
      const r = w.connections.find((x) => x.company_id === c && x.environment === e && x.status === 'connected');
      if (!r || (r.refresh_lock_until && Date.parse(r.refresh_lock_until) > w.now.getTime())) return false;
      r.refresh_lock_until = new Date(w.now.getTime() + secs * 1000).toISOString();
      return true;
    },
    async audit(r) { w.audit.push({ ...r }); },
    async takeTestSlot() { return true; },
  };
}
function deps(w: World, env = ENV): HandlerDeps {
  return {
    env: (k) => env[k],
    store: store(w),
    now: () => w.now,
    log: (e, m) => w.logs.push(`${e} ${JSON.stringify(m ?? {})}`),
    fetch: async (url, init) => {
      const body = new URLSearchParams(String((init as RequestInit).body));
      w.calls.push({ url: String(url), body });
      return w.hmrc(body);
    },
    caller: {
      async getUser(token) { const sub = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((token.split('.')[1].length + 3) % 4))).sub; return sub === 'nobody' ? null : { id: sub }; },
      async listFactors(u) { return w.factors[u] ?? []; },
    },
  };
}
const noSecrets = (w: World, extra: string[] = []) => {
  const all = w.logs.join('\n') + JSON.stringify(w.audit);
  for (const s of [SECRET, 'ACCESS-TOKEN', 'REFRESH-TOKEN', 'the-auth-code', KEY_B64, ...extra]) assert(!all.includes(s), `log or audit leaked ${s}`);
};
async function started(w: World, user = 'owner', aal?: string) {
  const r = await connectStart(auth(user, aal), { company_id: CO }, deps(w));
  assertEquals(r.status, 200);
  return new URL(String(r.body.url)).searchParams.get('state')!;
}

// ---------------------------------------------------------------- encryption
Deno.test('encryption: round trip, random IV, key id, the database format', async () => {
  const aad = tokenAad(CO, 'sandbox', 'access');
  const a = await encryptToken('secret-token', KEY, aad);
  const b = await encryptToken('secret-token', KEY, aad);
  assert(a !== b, 'a new IV each time');
  assert(DB_FORMAT.test(a), a);
  assertEquals(a.split('.')[1], await keyId(KEY));
  assert(!a.includes('secret-token'));
  assertEquals(await decryptToken(a, await keyringFrom(KEY), aad), 'secret-token');
});
Deno.test('encryption: tampering, the wrong company or field, and an unknown key are all refused', async () => {
  const ring = await keyringFrom(KEY);
  const aad = tokenAad(CO, 'sandbox', 'access');
  const ct = await encryptToken('secret-token', KEY, aad);
  const parts = ct.split('.');
  const flipped = parts[3][0] === 'A' ? 'B' + parts[3].slice(1) : 'A' + parts[3].slice(1);
  const expect = async (p: Promise<unknown>, reason: string) => {
    try { await p; throw new Error('no error'); } catch (e) { assert(e instanceof TokenDecryptError && e.reason === reason, String(e)); }
  };
  await expect(decryptToken([parts[0], parts[1], parts[2], flipped].join('.'), ring, aad), 'tampered');
  await expect(decryptToken(ct, ring, tokenAad(CO_B, 'sandbox', 'access')), 'tampered'); // copied to another company
  await expect(decryptToken(ct, ring, tokenAad(CO, 'sandbox', 'refresh')), 'tampered'); // swapped field
  await expect(decryptToken(ct, await keyringFrom(new Uint8Array(32).fill(9)), aad), 'unknown_key');
  await expect(decryptToken('ENC:c2VjcmV0', ring, aad), 'format'); // the old base64 "encryption"
  const rotated = await keyringFrom(new Uint8Array(32).fill(9), KEY); // a later rotation keeps the old key by id
  assertEquals(await decryptToken(ct, rotated, aad), 'secret-token');
});

// ---------------------------------------------------------------- configuration
Deno.test('configuration fails closed: any missing secret, a short key, or production', async () => {
  for (const k of Object.keys(ENV).filter((x) => x !== 'HMRC_ENV')) {
    const env = { ...ENV }; delete env[k];
    assertEquals(readConfig((x) => env[x]), { ok: false, code: 'not_configured' }, k);
  }
  assertEquals(readConfig((x) => ({ ...ENV, HMRC_TOKEN_KEY: btoa('short') })[x]).ok, false);
  assertEquals(readConfig((x) => ({ ...ENV, HMRC_ENV: 'production' })[x]), { ok: false, code: 'production_not_enabled' });
  assertEquals(readConfig((x) => ({ ...ENV, HMRC_ENV: undefined as unknown as string })[x]).ok, true); // sandbox by default
  assertEquals(decodeKey(KEY_B64)?.length, 32);
  const w = world();
  const r = await connectStart(auth('owner'), { company_id: CO }, deps(w, { ...ENV, HMRC_CLIENT_SECRET: '' }));
  assertEquals([r.status, r.body.code, r.body.message], [503, 'not_configured', "HMRC connection isn't set up yet."]);
});

// ---------------------------------------------------------------- start
Deno.test('start: owner gets the HMRC sign-in address; only a hash of the state is kept; audited', async () => {
  const w = world();
  const r = await connectStart(auth('owner'), { company_id: CO }, deps(w));
  assertEquals(r.status, 200);
  const url = new URL(String(r.body.url));
  assertEquals(url.origin + url.pathname, 'https://test-www.tax.service.gov.uk/oauth/authorize');
  assertEquals(url.searchParams.get('client_id'), 'b2bnest-client-id');
  assertEquals(url.searchParams.get('scope'), 'read:vat write:vat hello'); // sandbox adds the Hello World test scope (P1)
  assertEquals(url.searchParams.get('redirect_uri'), 'https://www.b2bnest.online/hmrc/callback');
  assertEquals(HMRC_SCOPES.join(' '), 'read:vat write:vat');
  const state = url.searchParams.get('state')!;
  assertEquals(w.states.length, 1);
  assertEquals(w.states[0].state_hash, await sha256Hex(state));
  assert(!JSON.stringify(w.states).includes(state));
  assertEquals(Date.parse(w.states[0].expires_at) - w.now.getTime(), 10 * 60 * 1000);
  assert(!JSON.stringify(r.body).includes(SECRET), 'the client secret never reaches the browser');
  assertEquals(w.audit.map((a) => a.event), ['connect_started']);
  noSecrets(w, [state]);
});
Deno.test('start: the role matrix (member, platform admin not in the company, trial ended, suspended, signed out, bad input)', async () => {
  const cases: [string, string | null, number, string][] = [
    ['member', 'member', 403, 'not_admin'], ['platform admin who is not a member', 'platform', 403, 'not_member'],
    ['another company', 'stranger', 403, 'not_member'], ['trial ended', 'ended', 403, 'trial_ended'], ['suspended', 'suspended', 403, 'suspended'],
    ['admin', 'admin', 200, ''], ['signed out', null, 401, 'unauthorized'], ['invalid session', 'nobody', 401, 'unauthorized'],
  ];
  for (const [label, user, status, code] of cases) {
    const w = world();
    const r = await connectStart(user ? auth(user) : null, { company_id: CO }, deps(w));
    assertEquals(r.status, status, label);
    if (code) assertEquals(r.body.code, code, label);
    if (status === 403) assertEquals(w.audit.map((a) => [a.event, a.reason]), [['refused', code]], label);
    if (status !== 200) assertEquals(w.states.length, 0, label);
  }
  const w = world();
  assertEquals((await connectStart(auth('owner'), { company_id: 'not-a-uuid' }, deps(w))).body.code, 'bad_request');
});
Deno.test('two-step rule: a verified authenticator at aal1 is refused with a message; aal2 works; an unverified factor does not count', async () => {
  const w = world();
  const r = await connectStart(auth('mfa', 'aal1'), { company_id: CO }, deps(w));
  assertEquals([r.status, r.body.code], [403, 'two_step_required']);
  assert(String(r.body.message).includes('6-digit code'));
  assertEquals((await connectStart(auth('mfa', 'aal2'), { company_id: CO }, deps(w))).status, 200);
  assertEquals((await connectStart(auth('owner', 'aal1'), { company_id: CO }, deps(w))).status, 200); // owner's factor is unverified
  assertEquals((await disconnect(auth('mfa', 'aal1'), { company_id: CO }, deps(w))).body.code, 'two_step_required');
});

// ---------------------------------------------------------------- complete
Deno.test('complete: exchanges the code with the server secrets, stores encrypted tokens, audits; never returns or logs a token', async () => {
  const w = world();
  const state = await started(w);
  const r = await connectComplete(auth('owner'), { code: 'the-auth-code', state, company_id: CO }, deps(w));
  assertEquals(r.status, 200);
  assertEquals(r.body.status, 'connected');
  assertEquals(w.calls.length, 1);
  assertEquals(w.calls[0].url, 'https://test-api.service.hmrc.gov.uk/oauth/token');
  assertEquals(Object.fromEntries(w.calls[0].body), {
    grant_type: 'authorization_code', code: 'the-auth-code', redirect_uri: 'https://www.b2bnest.online/hmrc/callback', client_id: 'b2bnest-client-id', client_secret: SECRET,
  });
  const c = w.connections[0];
  assert(DB_FORMAT.test(c.access_token_enc!) && DB_FORMAT.test(c.refresh_token_enc!));
  assert(!c.access_token_enc!.includes('ACCESS') && !c.refresh_token_enc!.includes('REFRESH'));
  const ring = await keyringFrom(KEY);
  assertEquals(await decryptToken(c.access_token_enc!, ring, tokenAad(CO, 'sandbox', 'access')), 'ACCESS-TOKEN-1');
  assertEquals(await decryptToken(c.refresh_token_enc!, ring, tokenAad(CO, 'sandbox', 'refresh')), 'REFRESH-TOKEN-1');
  assertEquals(c.scopes, ['read:vat', 'write:vat']);
  assertEquals(c.expires_at, '2026-11-04T14:00:00.000Z');
  assertEquals(c.connected_by, 'owner');
  assertEquals(w.audit.map((a) => a.event), ['connect_started', 'connected']);
  assert(!JSON.stringify(r.body).match(/TOKEN|v1\./));
  noSecrets(w, [state]);
});
Deno.test('complete: the state is single use, the same user, unexpired, and for the same company', async () => {
  let w = world();
  let state = await started(w);
  assertEquals((await connectComplete(auth('admin'), { code: 'the-auth-code', state }, deps(w))).body.code, 'bad_state'); // another user
  assertEquals((await connectComplete(auth('owner'), { code: 'the-auth-code', state }, deps(w))).status, 200);
  assertEquals((await connectComplete(auth('owner'), { code: 'the-auth-code', state }, deps(w))).body.code, 'bad_state'); // reused
  assertEquals(w.calls.length, 1);
  w = world(); state = await started(w);
  w.now = new Date(w.now.getTime() + 10 * 60 * 1000 + 1);
  assertEquals((await connectComplete(auth('owner'), { code: 'the-auth-code', state }, deps(w))).body.code, 'bad_state'); // expired
  w = world(); state = await started(w);
  assertEquals((await connectComplete(auth('owner'), { code: 'the-auth-code', state, company_id: CO_B }, deps(w))).body.code, 'bad_state'); // wrong company
  assertEquals((await connectComplete(auth('owner'), { code: 'the-auth-code', state: 'never-issued-state-value-123' }, deps(w))).body.code, 'bad_state');
  assertEquals((await connectComplete(auth('owner'), { code: '', state }, deps(w))).body.code, 'bad_request');
  assertEquals(w.calls.length, 0);
  assertEquals(w.connections.length, 0);
});
Deno.test('complete: rights are checked again (a member made admin-less meanwhile is refused); HMRC refusals store nothing', async () => {
  let w = world();
  let state = await started(w);
  w.rules[`${CO}:owner`] = 'not_admin';
  assertEquals((await connectComplete(auth('owner'), { code: 'the-auth-code', state }, deps(w))).body.code, 'not_admin');
  assertEquals(w.calls.length, 0);
  w = world({ hmrc: async () => new Response('{"error":"invalid_grant","error_description":"the-auth-code is bad"}', { status: 400 }) });
  state = await started(w);
  const r = await connectComplete(auth('owner'), { code: 'the-auth-code', state }, deps(w));
  assertEquals([r.status, r.body.code], [502, 'hmrc_refused']);
  assert(!JSON.stringify(r.body).includes('invalid_grant'), 'HMRC response bodies are never passed on');
  assertEquals(w.connections.length, 0);
  assertEquals(w.audit.at(-1), { company_id: CO, user_id: 'owner', environment: 'sandbox', event: 'refused', reason: 'hmrc_refused' });
  noSecrets(w, [state, 'invalid_grant']);
  w = world({ hmrc: async () => { throw new TypeError('network down'); } });
  state = await started(w);
  assertEquals((await connectComplete(auth('owner'), { code: 'the-auth-code', state }, deps(w))).body.code, 'hmrc_unavailable');
});

// ---------------------------------------------------------------- disconnect
Deno.test('disconnect: owners and admins only; tokens deleted; audited', async () => {
  const w = world();
  const state = await started(w);
  await connectComplete(auth('owner'), { code: 'the-auth-code', state }, deps(w));
  assertEquals((await disconnect(auth('member'), { company_id: CO }, deps(w))).body.code, 'not_admin');
  assertEquals((await disconnect(auth('platform'), { company_id: CO }, deps(w))).body.code, 'not_member');
  assertEquals(w.connections[0].status, 'connected');
  const r = await disconnect(auth('admin'), { company_id: CO }, deps(w));
  assertEquals(r.status, 200);
  assertEquals([w.connections[0].status, w.connections[0].access_token_enc, w.connections[0].refresh_token_enc], ['disconnected', null, null]);
  assertEquals(w.audit.at(-1)?.event, 'disconnected');
});

// ---------------------------------------------------------------- getFreshHmrcToken
async function connectedWorld(expiresInMs: number, over: Partial<World> = {}) {
  const w = world(over);
  const aadA = tokenAad(CO, 'sandbox', 'access');
  w.connections.push({
    company_id: CO, environment: 'sandbox', status: 'connected', scopes: ['read:vat'],
    access_token_enc: await encryptToken('OLD-ACCESS-TOKEN', KEY, aadA),
    refresh_token_enc: await encryptToken('OLD-REFRESH-TOKEN', KEY, tokenAad(CO, 'sandbox', 'refresh')),
    expires_at: new Date(w.now.getTime() + expiresInMs).toISOString(), refresh_lock_until: null,
  });
  const d = { ...deps(w), sleep: async (_ms: number) => { await Promise.resolve(); } };
  return { w, d };
}
Deno.test('fresh token: still valid → decrypted, no HMRC call', async () => {
  const { w, d } = await connectedWorld(60 * 60 * 1000);
  assertEquals(await getFreshHmrcToken(CO, d), 'OLD-ACCESS-TOKEN');
  assertEquals(w.calls.length, 0);
});
Deno.test('fresh token: close to expiry → refreshed once, new tokens stored encrypted, audited', async () => {
  const { w, d } = await connectedWorld(60 * 1000, {
    hmrc: async () => Response.json({ access_token: 'ACCESS-TOKEN-2', refresh_token: 'REFRESH-TOKEN-2', expires_in: 14400 }),
  });
  assertEquals(await getFreshHmrcToken(CO, d), 'ACCESS-TOKEN-2');
  assertEquals(Object.fromEntries(w.calls[0].body), { grant_type: 'refresh_token', refresh_token: 'OLD-REFRESH-TOKEN', client_id: 'b2bnest-client-id', client_secret: SECRET });
  const ring = await keyringFrom(KEY);
  assertEquals(await decryptToken(w.connections[0].refresh_token_enc!, ring, tokenAad(CO, 'sandbox', 'refresh')), 'REFRESH-TOKEN-2');
  assertEquals(w.connections[0].refresh_lock_until, null);
  assertEquals(w.audit.map((a) => a.event), ['refreshed']);
  noSecrets(w, ['OLD-REFRESH', 'OLD-ACCESS']);
});
Deno.test('fresh token: no refresh token back from HMRC → the old one is kept (rotation not verified)', async () => {
  const { w, d } = await connectedWorld(0, { hmrc: async () => Response.json({ access_token: 'ACCESS-TOKEN-3', expires_in: 14400 }) });
  assertEquals(await getFreshHmrcToken(CO, d), 'ACCESS-TOKEN-3');
  assertEquals(await decryptToken(w.connections[0].refresh_token_enc!, await keyringFrom(KEY), tokenAad(CO, 'sandbox', 'refresh')), 'OLD-REFRESH-TOKEN');
});
Deno.test('fresh token: two requests at once refresh only once (per-company lock)', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const { w, d } = await connectedWorld(0, {
    hmrc: async () => { await gate; return Response.json({ access_token: 'ACCESS-TOKEN-4', refresh_token: 'REFRESH-TOKEN-4', expires_in: 14400 }); },
  });
  const first = getFreshHmrcToken(CO, d);
  const second = getFreshHmrcToken(CO, { ...d, sleep: async () => { release(); await new Promise((r) => setTimeout(r, 0)); } });
  assertEquals(await Promise.all([first, second]), ['ACCESS-TOKEN-4', 'ACCESS-TOKEN-4']);
  assertEquals(w.calls.length, 1);
});
Deno.test('fresh token: HMRC refuses the refresh → needs_reconnect, audited; HMRC down → stays connected', async () => {
  let { w, d } = await connectedWorld(0, { hmrc: async () => new Response('{"error":"invalid_grant"}', { status: 400 }) });
  try { await getFreshHmrcToken(CO, d); throw new Error('no error'); } catch (e) { assert(e instanceof HmrcTokenError && e.code === 'needs_reconnect'); }
  assertEquals(w.connections[0].status, 'needs_reconnect');
  assertEquals(w.audit.map((a) => [a.event, a.reason]), [['refresh_failed', 'hmrc_rejected']]);
  try { await getFreshHmrcToken(CO, d); throw new Error('no error'); } catch (e) { assert(e instanceof HmrcTokenError && e.code === 'needs_reconnect'); }
  ({ w, d } = await connectedWorld(0, { hmrc: async () => new Response('down', { status: 503 }) }));
  try { await getFreshHmrcToken(CO, d); throw new Error('no error'); } catch (e) { assert(e instanceof HmrcTokenError && e.code === 'hmrc_unavailable'); }
  assertEquals([w.connections[0].status, w.connections[0].refresh_lock_until], ['connected', null]);
  noSecrets(w, ['OLD-REFRESH', 'invalid_grant']);
});
Deno.test('fresh token: not connected, and not configured', async () => {
  const w = world();
  const d = { ...deps(w), sleep: async () => {} };
  try { await getFreshHmrcToken(CO, d); throw new Error('no error'); } catch (e) { assert(e instanceof HmrcTokenError && e.code === 'not_connected'); }
  try { await getFreshHmrcToken(CO, { ...d, env: () => undefined }); throw new Error('no error'); } catch (e) { assert(e instanceof HmrcTokenError && e.code === 'not_configured'); }
});

// ---------------------------------------------------------------- nothing secret in the console
Deno.test('nothing secret reaches console output on any path', async () => {
  const captured: string[] = [];
  const orig = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = (...a: unknown[]) => { captured.push(a.map(String).join(' ')); };
  try {
    const w = world();
    const d = { ...deps(w), log: (e: string, m?: Record<string, unknown>) => console.log(`[test] ${e} ${JSON.stringify(m ?? {})}`) };
    const r = await connectStart(auth('owner'), { company_id: CO }, d);
    const state = new URL(String(r.body.url)).searchParams.get('state')!;
    await connectComplete(auth('owner'), { code: 'the-auth-code', state }, d);
    await connectStart(auth('member'), { company_id: CO }, d);
    await disconnect(auth('owner'), { company_id: CO }, d);
    const text = captured.join('\n');
    assert(captured.length > 0);
    for (const s of [SECRET, 'ACCESS-TOKEN', 'REFRESH-TOKEN', 'the-auth-code', state, KEY_B64]) assert(!text.includes(s), `console leaked ${s}`);
  } finally {
    Object.assign(console, orig);
  }
});

// ---------------------------------------------------------------- plans (docs/hmrc-plan): Business and Scale only
Deno.test('plan_not_included: start, complete and disconnect refuse with 403, a plain message and an audit row', async () => {
  const w = world();
  w.rules[`${CO}:solo`] = 'plan_not_included';
  const r = await connectStart(auth('solo'), { company_id: CO }, deps(w));
  assertEquals([r.status, r.body.code, r.body.message], [403, 'plan_not_included', 'HMRC tools are included in the Business and Scale plans.']);
  assertEquals(w.states.length, 0);
  assertEquals((await disconnect(auth('solo'), { company_id: CO }, deps(w))).body.code, 'plan_not_included');
  assertEquals(w.audit.map((a) => [a.event, a.reason]), [['refused', 'plan_not_included'], ['refused', 'plan_not_included']]);
  // A plan changed to Solo between start and complete: refused before HMRC is called.
  const w2 = world();
  const state = await started(w2);
  w2.rules[`${CO}:owner`] = 'plan_not_included';
  const c = await connectComplete(auth('owner'), { code: 'the-auth-code', state }, deps(w2));
  assertEquals([c.status, c.body.code], [403, 'plan_not_included']);
  assertEquals(w2.calls.length, 0);
  assertEquals(w2.connections.length, 0);
  assertEquals(w2.audit.at(-1), { company_id: CO, user_id: 'owner', environment: 'sandbox', event: 'refused', reason: 'plan_not_included' });
});
Deno.test('plan_not_included: the token helper refuses on behalf of a person on a plan without HMRC, and audits it', async () => {
  const { w, d } = await connectedWorld(60 * 60 * 1000);
  w.rules[`${CO}:solo`] = 'plan_not_included';
  try { await getFreshHmrcToken(CO, d, 'solo'); throw new Error('no error'); } catch (e) { assert(e instanceof HmrcTokenError && e.code === 'plan_not_included', String(e)); }
  assertEquals(w.audit.map((a) => [a.event, a.reason, a.user_id]), [['refused', 'plan_not_included', 'solo']]);
  assertEquals(w.calls.length, 0);
  assertEquals(await getFreshHmrcToken(CO, d, 'member'), 'OLD-ACCESS-TOKEN'); // a member on Business may use the connection
  try { await getFreshHmrcToken(CO, d, 'ended'); throw new Error('no error'); } catch (e) { assert(e instanceof HmrcTokenError && e.code === 'not_allowed'); }
  noSecrets(w, ['OLD-ACCESS', 'OLD-REFRESH']);
});
