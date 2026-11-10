// HMRC hide switch Deno tests (docs/hmrc-hide/README.md). No network, no database: the store and fetch record every
// call so a refusal can be shown to touch nothing.
import { assert, assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts';
import { b64url } from './crypto.ts';
import { readHmrcAccess, type HmrcAccess } from './access.ts';
import type { HmrcStore } from './store.ts';
import { connectComplete, connectStart, disconnect } from './handlers.ts';
import { testCall } from './testCall.ts';
import { vatObligations } from './vatObligations.ts';
import { vatSubmit } from './vatSubmit.ts';
import { vatLiabilities, vatPayments, vatPenalties, vatReturnView } from './vatReads.ts';
import { HMRC_MESSAGES, HMRC_STATUS } from './errors.ts';

const ENV: Record<string, string> = {
  HMRC_CLIENT_ID: 'b2bnest-client', HMRC_CLIENT_SECRET: 'client-secret-hide', HMRC_TOKEN_KEY: btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i + 3))),
  HMRC_ENV: 'sandbox', HMRC_REDIRECT_URI: 'https://www.b2bnest.online/hmrc/callback', HMRC_VAT_CONFIRM_SECRET: 'x'.repeat(40),
};
const CO = '0d0d0000-0000-4000-8000-0000000000e1';
const OWNER = 'aaaa0000-0000-4000-8000-0000000000e1'; // an ordinary company owner
const CO_ADMIN = 'aaaa0000-0000-4000-8000-0000000000e2'; // an ordinary company admin
const SUPER = 'aaaa0000-0000-4000-8000-0000000000e3'; // platform super_admin
const PLATFORM_ADMIN = 'aaaa0000-0000-4000-8000-0000000000e4'; // platform admin (the owner's testing account)
const jwt = (sub: string) => `x.${b64url(new TextEncoder().encode(JSON.stringify({ sub, role: 'authenticated', aal: 'aal1' })))}.y`;

interface World { access: Record<string, HmrcAccess>; storeCalls: string[]; fetches: string[]; audit: string[]; connection: Record<string, unknown> | null }
const world = (access: HmrcAccess | 'missing' | 'throws' = 'hidden'): World => ({
  access: Object.fromEntries([OWNER, CO_ADMIN].map((u) => [u, access as HmrcAccess])).valueOf() as Record<string, HmrcAccess>,
  storeCalls: [], fetches: [], audit: [],
  connection: { company_id: CO, environment: 'sandbox', status: 'connected', access_token_enc: 'v1.k.AAAA.BBBB', refresh_token_enc: 'v1.k.CCCC.DDDD', expires_at: null, scopes: ['read:vat', 'write:vat'] },
});
function store(w: World): HmrcStore {
  const rec = (name: string) => { w.storeCalls.push(name); };
  return {
    async manageAllowed() { rec('manageAllowed'); return 'ok'; },
    async createState() { rec('createState'); }, async consumeState() { rec('consumeState'); return null; },
    async saveConnection() { rec('saveConnection'); },
    async getConnection() { rec('getConnection'); return w.connection as never; },
    async updateConnection(_c, _e, patch) { rec('updateConnection'); if (w.connection) Object.assign(w.connection, patch); },
    async claimRefresh() { rec('claimRefresh'); return false; },
    async audit(r) { rec('audit'); w.audit.push(`${r.event}:${r.reason ?? ''}`); },
    async takeTestSlot() { rec('takeTestSlot'); return true; },
    async takeObligationsSlot() { rec('takeObligationsSlot'); return true; },
    async vatNumberFor() { rec('vatNumberFor'); return null; },
  };
}
const deps = (w: World, accessFor: (u: string) => Promise<HmrcAccess>) => ({
  env: (k: string) => ENV[k], store: store(w), now: () => new Date('2026-11-09T10:00:00Z'), sleep: async () => {}, log: () => {},
  fetch: async (input: string | URL | Request) => { w.fetches.push(String(input)); return Response.json({}); },
  caller: {
    async getUser(t: string) { return { id: JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.split('.')[1].length + 3) % 4))).sub }; },
    async listFactors() { return []; },
    hmrcAccess: accessFor,
  },
  // the extra pieces some functions take; never reached on a refusal
  reads: { async takeReadSlot() { w.storeCalls.push('takeReadSlot'); return 'ok' as const; }, async storedReturn() { w.storeCalls.push('storedReturn'); return null; } },
  submissions: new Proxy({}, { get: (_t, p) => async () => { w.storeCalls.push(`submissions.${String(p)}`); return null; } }),
  preview: async () => { w.storeCalls.push('preview'); return { ok: false as const, code: 'server_error' as const }; },
  newId: () => crypto.randomUUID(),
});
const body = { company_id: CO, period_key: '18A1', action: 'prepare', from: '2026-01-01', to: '2026-02-01', code: 'c', state: 'a'.repeat(32), kind: 'hello_world' };
type Run = (u: string, d: ReturnType<typeof deps>) => Promise<{ status: number; body: Record<string, unknown> }>;
const req = (u: string) => ({ authHeader: `Bearer ${jwt(u)}`, headers: new Headers(), body: { ...body } });
const FUNCTIONS: [string, Run][] = [
  ['hmrc-connect-start', (u, d) => connectStart(`Bearer ${jwt(u)}`, { ...body }, d as never)],
  ['hmrc-connect-complete', (u, d) => connectComplete(`Bearer ${jwt(u)}`, { ...body }, d as never)],
  ['hmrc-test-call', (u, d) => testCall(req(u), d as never)],
  ['hmrc-vat-obligations', (u, d) => vatObligations(req(u), d as never)],
  ['hmrc-vat-submit', (u, d) => vatSubmit(req(u), d as never)],
  ['hmrc-vat-return-view', (u, d) => vatReturnView(req(u), d as never)],
  ['hmrc-vat-liabilities', (u, d) => vatLiabilities(req(u), d as never)],
  ['hmrc-vat-payments', (u, d) => vatPayments(req(u), d as never)],
  ['hmrc-vat-penalties', (u, d) => vatPenalties(req(u), d as never)],
];
const roles: Record<string, HmrcAccess> = { [SUPER]: 'tester', [PLATFORM_ADMIN]: 'tester' };
const switchSays = (state: HmrcAccess | 'missing' | 'throws') => async (u: string): Promise<HmrcAccess> => {
  if (roles[u]) return roles[u];
  if (state === 'throws') throw new Error('database down');
  return state === 'visible' ? 'visible' : 'hidden'; // 'missing' is hidden (access.ts)
};

Deno.test('hide: the refusal is a plain 403 hmrc_unavailable_for_now', () => {
  assertEquals(HMRC_STATUS.hmrc_unavailable_for_now, 403);
  assertEquals(HMRC_MESSAGES.hmrc_unavailable_for_now, "HMRC filing isn't available yet.");
});

Deno.test('hide: hidden, missing or unreadable → every HMRC function refuses a company owner and a company admin, touching nothing', async () => {
  for (const state of ['hidden', 'missing', 'throws'] as const) {
    for (const [name, run] of FUNCTIONS) {
      for (const user of [OWNER, CO_ADMIN]) {
        const w = world();
        const r = await run(user, deps(w, switchSays(state)));
        assertEquals([r.status, r.body.code, r.body.message], [403, 'hmrc_unavailable_for_now', "HMRC filing isn't available yet."], `${state} ${name} ${user}`);
        assertEquals(w.storeCalls, [], `${name}: no token read, no state, no slot, no audit row`);
        assertEquals(w.fetches, [], `${name}: no HMRC call`);
      }
    }
  }
});

Deno.test('hide: hidden → a platform super_admin and a platform admin go past the switch (the usual checks then apply)', async () => {
  for (const [name, run] of FUNCTIONS) {
    for (const user of [SUPER, PLATFORM_ADMIN]) {
      const w = world();
      const r = await run(user, deps(w, switchSays('hidden')));
      assert(r.body.code !== 'hmrc_unavailable_for_now', `${name} ${user}: not refused by the switch (got ${r.body.code})`);
      assert(w.storeCalls.length > 0 || r.body.code === 'bad_request' || r.body.code === 'bad_state', `${name}: the normal checks ran`);
    }
  }
});

Deno.test('hide: visible → a company owner goes past the switch exactly as today', async () => {
  for (const [name, run] of FUNCTIONS) {
    const w = world();
    const r = await run(OWNER, deps(w, switchSays('visible')));
    assert(r.body.code !== 'hmrc_unavailable_for_now', name);
  }
});

Deno.test('hide: hmrc-disconnect still works for a connected customer while hidden (tokens deleted, audited)', async () => {
  for (const state of ['hidden', 'missing', 'throws'] as const) {
    const w = world();
    const r = await disconnect(`Bearer ${jwt(OWNER)}`, { company_id: CO }, deps(w, switchSays(state)) as never);
    assertEquals([r.status, r.body.status], [200, 'disconnected'], state);
    assertEquals([w.connection!.access_token_enc, w.connection!.refresh_token_enc, w.connection!.status], [null, null, 'disconnected']);
    assertEquals(w.audit, ['disconnected:']);
    assertEquals(w.fetches, []);
  }
});

Deno.test('hide: older wiring without hmrcAccess keeps today\'s behaviour; the real functions always wire it', async () => {
  const w = world();
  const d = deps(w, switchSays('hidden'));
  delete (d.caller as { hmrcAccess?: unknown }).hmrcAccess;
  const r = await vatObligations(req(OWNER), d as never);
  assert(r.body.code !== 'hmrc_unavailable_for_now');
  const serve = await Deno.readTextFile(new URL('./serve.ts', import.meta.url));
  assert(/hmrcAccess: \(userId\) => readHmrcAccess\(admin/.test(serve), 'realDeps wires the switch for every HMRC function');
  for (const f of ['readServe.ts']) assert(/realDeps\(name\)/.test(await Deno.readTextFile(new URL(`./${f}`, import.meta.url))), f);
  for (const n of ['hmrc-test-call', 'hmrc-vat-obligations', 'hmrc-vat-submit']) {
    assert(/realDeps\('hmrc-/.test(await Deno.readTextFile(new URL(`../../${n}/index.ts`, import.meta.url))), `${n} uses realDeps`);
  }
});

// ------------------------------------------------------------------ the reader (service role)
function fakeAdmin(o: { roles?: unknown[]; rolesError?: boolean; setting?: unknown; settingError?: boolean; throws?: boolean }) {
  const calls: string[] = [];
  const q = (table: string) => {
    const chain: Record<string, unknown> = {};
    const result = () => {
      if (o.throws) throw new Error('boom');
      if (table === 'user_roles') return { data: o.rolesError ? null : (o.roles ?? []), error: o.rolesError ? { code: 'x' } : null };
      return { data: o.setting === undefined ? null : { value: o.setting }, error: o.settingError ? { code: 'x' } : null };
    };
    for (const m of ['select', 'eq', 'in']) chain[m] = (...a: unknown[]) => { calls.push(`${table}.${m}(${JSON.stringify(a)})`); return chain; };
    chain.maybeSingle = () => Promise.resolve(result());
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => { try { return Promise.resolve(result()).then(res, rej); } catch (e) { return Promise.reject(e).then(res, rej); } };
    return chain;
  };
  return { admin: { from: q } as never, calls };
}
Deno.test('hide: the reader — super_admin or admin role is a tester; only exactly "visible" opens it; anything else is hidden', async () => {
  assertEquals(await readHmrcAccess(fakeAdmin({ roles: [{ role: 'admin' }] }).admin, OWNER), 'tester');
  assertEquals(await readHmrcAccess(fakeAdmin({ roles: [{ role: 'super_admin' }], setting: 'hidden' }).admin, OWNER), 'tester');
  assertEquals(await readHmrcAccess(fakeAdmin({ setting: 'visible' }).admin, OWNER), 'visible');
  assertEquals(await readHmrcAccess(fakeAdmin({ setting: 'hidden' }).admin, OWNER), 'hidden');
  assertEquals(await readHmrcAccess(fakeAdmin({}).admin, OWNER), 'hidden', 'missing row: hidden');
  for (const odd of ['Visible', 'yes', true, { state: 'visible' }, null]) assertEquals(await readHmrcAccess(fakeAdmin({ setting: odd }).admin, OWNER), 'hidden', JSON.stringify(odd));
  assertEquals(await readHmrcAccess(fakeAdmin({ setting: 'visible', settingError: true }).admin, OWNER), 'hidden', 'unreadable: hidden');
  assertEquals(await readHmrcAccess(fakeAdmin({ rolesError: true, setting: 'visible' }).admin, OWNER), 'visible', 'a failed role read is no tester, the setting still applies');
  assertEquals(await readHmrcAccess(fakeAdmin({ throws: true }).admin, OWNER), 'hidden', 'a thrown error: hidden');
  const { admin, calls } = fakeAdmin({ setting: 'hidden' });
  await readHmrcAccess(admin, OWNER);
  assert(calls.some((c) => c.includes('user_roles.in') && c.includes('super_admin') && c.includes('"admin"')), 'only super_admin and admin count');
  assert(calls.some((c) => c.includes('platform_settings.eq') && c.includes('hmrc_customer_access')));
});
