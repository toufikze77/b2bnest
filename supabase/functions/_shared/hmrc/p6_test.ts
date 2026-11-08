// HMRC P6 Deno tests: hmrc-vat-submit (sandbox only). HMRC and the database are mocked: no network.
import { assert, assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts';
import { b64url, encryptToken, tokenAad } from './crypto.ts';
import type { AuditEvent, ConnectionRow, HmrcStore, ManageRule } from './store.ts';
import {
  buildReturnBody, CONFIRM_SECRET_ENV, DECLARATION, figuresHash, HMRC_SUBMIT_ERRORS, makeConfirmation, readConfirmation, SUBMIT_SCENARIOS, vatSubmit,
  type PreviewResult, type SubmissionRow, type SubmitDeps,
} from './vatSubmit.ts';
import { previewFailure } from './submitStore.ts';
import { computeReturnBoxes, type PreviewRow } from '../vat/returnBoxes.ts';
import { withDemoGuard } from '../demo-guard.ts';

const KEY = new Uint8Array(32).map((_, i) => i + 21);
const KEY_B64 = btoa(String.fromCharCode(...KEY));
const SECRET = 'client-secret-p6';
const CONFIRM = 'p6-confirmation-secret-0123456789abcdef';
const ENV: Record<string, string> = {
  HMRC_CLIENT_ID: 'b2bnest-client', HMRC_CLIENT_SECRET: SECRET, HMRC_TOKEN_KEY: KEY_B64, HMRC_ENV: 'sandbox',
  HMRC_REDIRECT_URI: 'https://www.b2bnest.online/hmrc/callback', [CONFIRM_SECRET_ENV]: CONFIRM,
};
const CO = '0d600000-0000-4000-8000-000000000001';
const OWNER = '0a0a0a0a-0000-4000-8000-0000000000b1';
const MEMBER = '0a0a0a0a-0000-4000-8000-0000000000b2';
const SOLO = '0a0a0a0a-0000-4000-8000-0000000000b3';
const MFA_USER = '0a0a0a0a-0000-4000-8000-0000000000b4';
const DEMO = 'de00de00-0000-4000-8000-000000000006';
const VRN = '123456789';
const BROWSER = { deviceId: 'beec798b-b366-47fa-b1f8-92cede14a1ce', jsUserAgent: 'Mozilla/5.0 (test)', timezone: 'UTC+00:00', webVersion: '1.0.0',
  screens: [{ width: 1920, height: 1080, scalingFactor: 1, colourDepth: 24 }], windowSize: { width: 1200, height: 800 } };
const OPEN = { start: '2026-07-01', end: '2026-09-30', due: '2026-11-07', status: 'O', periodKey: '18A1' };
const FULFILLED = { ...OPEN, status: 'F', received: '2026-11-08' };
// The README's worked example.
const ROWS: PreviewRow[] = [
  { row_kind: 'included', source: 'invoices', treatment: 'standard', reason: null, records: 1, net: 1000, vat: 200, vat_not_reclaimable: 0 },
  { row_kind: 'included', source: 'invoices', treatment: 'reduced', reason: null, records: 1, net: 100, vat: 5, vat_not_reclaimable: 0 },
  { row_kind: 'included', source: 'invoices', treatment: 'zero', reason: null, records: 1, net: 50, vat: 0, vat_not_reclaimable: 0 },
  { row_kind: 'included', source: 'invoices', treatment: 'outside_scope', reason: null, records: 1, net: 300, vat: 0, vat_not_reclaimable: 0 },
  { row_kind: 'included', source: 'expenses', treatment: 'standard', reason: null, records: 2, net: 450, vat: 60, vat_not_reclaimable: 30 },
  { row_kind: 'left_out', source: 'expenses', treatment: null, reason: 'vat_not_reclaimable', records: 1, net: 0, vat: 0, vat_not_reclaimable: 30 },
];
const RECEIPT = { processingDate: '2026-11-08T10:15:00.000Z', paymentIndicator: 'BANK', formBundleNumber: '256660290587', chargeRefNumber: 'aCxFaNx0FZsCvyWF' };

interface Row extends SubmissionRow { company: string; figures: Record<string, unknown>; test_scenario: string | null; error_code?: string | null; http_status?: number | null }
interface World {
  rules: Record<string, ManageRule>;
  factors: Record<string, { id: string; factor_type: string; status: string }[]>;
  connection: (ConnectionRow & { refresh_lock_until?: string | null }) | null;
  rows: PreviewRow[];
  preview?: PreviewResult;
  obligations: Record<string, unknown>[];
  submissions: Row[];
  limitLeft: number;
  audit: { event: AuditEvent; reason?: string | null }[];
  calls: { url: string; method: string; headers: Record<string, string>; body: string | null }[];
  post: () => Promise<Response>;
  logs: string[];
  now: Date;
}
async function world(over: Partial<World> = {}): Promise<World> {
  return {
    rules: { [OWNER]: 'ok', [MEMBER]: 'not_admin', [SOLO]: 'plan_not_included', [MFA_USER]: 'ok', [DEMO]: 'ok' },
    factors: { [MFA_USER]: [{ id: 'f1', factor_type: 'totp', status: 'verified' }] },
    connection: {
      company_id: CO, environment: 'sandbox', status: 'connected', scopes: ['read:vat', 'write:vat', 'hello'],
      access_token_enc: await encryptToken('USER-TOKEN-6', KEY, tokenAad(CO, 'sandbox', 'access')),
      refresh_token_enc: await encryptToken('REFRESH-6', KEY, tokenAad(CO, 'sandbox', 'refresh')),
      expires_at: '2026-11-08T14:00:00.000Z', refresh_lock_until: null,
    },
    rows: ROWS, obligations: [OPEN], submissions: [], limitLeft: 5, audit: [], calls: [], logs: [],
    post: async () => Response.json(RECEIPT, { status: 201, headers: { 'X-CorrelationId': 'c75f40a6-a3df-4429-a697-471eeec46435' } }),
    now: new Date('2026-11-08T10:00:00.000Z'),
    ...over,
  };
}
function store(w: World): HmrcStore {
  return {
    async manageAllowed(_c, u) { return w.rules[u] ?? 'not_member'; },
    async createState() {}, async consumeState() { return null; }, async saveConnection() {},
    async getConnection() { return w.connection ? { ...w.connection } : null; },
    async updateConnection(_c, _e, patch) { if (w.connection) Object.assign(w.connection, patch); },
    async claimRefresh() { return true; },
    async audit(r) { w.audit.push({ event: r.event, reason: r.reason ?? null }); },
    async takeTestSlot() { return true; },
    async takeObligationsSlot() { return true; },
    async vatNumberFor() { return 'GB 123 4567 89'; },
  };
}
let seq = 0;
const deps = (w: World, env = ENV): SubmitDeps => ({
  env: (k: string) => env[k], store: store(w), now: () => w.now, sleep: async () => {},
  log: (e: string, m?: Record<string, unknown>) => w.logs.push(`${e} ${JSON.stringify(m ?? {})}`),
  fetch: async (input: string | URL | Request, init?: RequestInit) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    w.calls.push({ url: String(input), method: init?.method ?? 'GET', headers, body: typeof init?.body === 'string' ? init.body : null });
    if (String(input).endsWith('/oauth/token')) return Response.json({ access_token: 'USER-TOKEN-7', refresh_token: 'REFRESH-7', expires_in: 14400 });
    if (String(input).includes('/obligations')) return Response.json({ obligations: w.obligations });
    return w.post();
  },
  caller: {
    async getUser(t: string) { const sub = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.split('.')[1].length + 3) % 4))).sub; return sub === 'nobody' ? null : { id: sub }; },
    async listFactors(u: string) { return w.factors[u] ?? []; },
  },
  submissions: {
    // Atomic like the SQL function: the check and the insert happen with no await in between.
    async begin(r) {
      if (w.limitLeft <= 0) return { result: 'limit', id: null };
      if (w.submissions.some((s) => s.company === r.company_id && s.period_key === r.period_key && s.status !== 'rejected')) return { result: 'already_live', id: null };
      w.limitLeft--;
      const id = `sub-${++seq}`;
      w.submissions.push({ id, company: r.company_id, status: 'submitting', period_key: r.period_key, period_start: r.period_start, period_end: r.period_end,
        figures_hash: r.figures_hash, figures: r.figures, test_scenario: r.test_scenario });
      w.audit.push({ event: 'vat_submit_start', reason: 'submitting' });
      return { result: 'ok', id };
    },
    async finish(id, patch) { Object.assign(w.submissions.find((s) => s.id === id)!, patch); },
    async live(c, _e, k) { return [...w.submissions].reverse().find((s) => s.company === c && s.period_key === k && s.status !== 'rejected') ?? null; },
    async displayName() { return 'Ann Owner'; },
  },
  async preview() { return w.preview ?? { ok: true, rows: w.rows }; },
  newId: () => crypto.randomUUID(),
});
const jwt = (sub: string, aal = 'aal1') => `x.${b64url(new TextEncoder().encode(JSON.stringify({ sub, role: 'authenticated', aal, amr: [{ method: 'password', timestamp: 1762500000 }] })))}.y`;
const call = (w: World, user: string | null, body: Record<string, unknown>, env = ENV, aal = 'aal1') =>
  vatSubmit({ authHeader: user ? `Bearer ${jwt(user, aal)}` : null, headers: new Headers({ 'x-forwarded-for': '198.51.100.7' }), body: { company_id: CO, period_key: '18A1', fraud: BROWSER, ...body } }, deps(w, env));
const posts = (w: World) => w.calls.filter((c) => c.method === 'POST' && c.url.includes('/returns'));
const prepare = async (w: World, user = OWNER) => {
  const r = await call(w, user, { action: 'prepare' });
  assertEquals(r.status, 200, JSON.stringify(r.body));
  return r.body as Record<string, unknown> & { confirmation_token: string };
};
const submit = (w: World, token: string, extra: Record<string, unknown> = {}, user = OWNER) => call(w, user, { action: 'submit', confirmation_token: token, declaration: true, ...extra });
const noSecrets = (w: World, extra = '') => {
  const text = w.logs.join('\n') + JSON.stringify(w.audit) + JSON.stringify(w.submissions.map(({ figures: _f, ...r }) => r)) + extra;
  for (const s of [SECRET, 'USER-TOKEN', 'REFRESH-', 'Bearer', KEY_B64, VRN, CONFIRM, 'own@']) assert(!text.includes(s), `leaked ${s}`);
};

// ------------------------------------------------------------------ the body
Deno.test('the body: HMRC field names, 2 decimals for boxes 1-5, whole pounds for 6-9, netVatDue never negative, finalised true', async () => {
  const b = buildReturnBody('18A1', computeReturnBoxes(ROWS));
  assertEquals(b, {
    periodKey: '18A1', vatDueSales: 205, vatDueAcquisitions: 0, totalVatDue: 205, vatReclaimedCurrPeriod: 60, netVatDue: 145,
    totalValueSalesExVAT: 1150, totalValuePurchasesExVAT: 450, totalValueGoodsSuppliedExVAT: 0, totalAcquisitionsExVAT: 0, finalised: true,
  });
  const reclaim = buildReturnBody('#001', computeReturnBoxes([
    { row_kind: 'included', source: 'invoices', treatment: 'standard', reason: null, records: 1, net: '10.05', vat: '2.01', vat_not_reclaimable: 0 },
    { row_kind: 'included', source: 'bills', treatment: 'standard', reason: null, records: 1, net: '500.99', vat: '100.20', vat_not_reclaimable: 0 },
  ]));
  assertEquals(reclaim.netVatDue, 98.19, 'a reclaim: |2.01 - 100.20|, positive');
  assertEquals(reclaim.vatDueSales, 2.01);
  assertEquals(reclaim.totalValueSalesExVAT, 10, 'pence dropped');
  assertEquals(reclaim.totalValuePurchasesExVAT, 500);
  for (const v of [reclaim.vatDueSales, reclaim.netVatDue, reclaim.vatReclaimedCurrPeriod]) assertEquals(Math.round(v * 100) / 100, v);
  assertEquals((await figuresHash(b)).length, 64);
  assert((await figuresHash(b)) !== (await figuresHash(reclaim)));
});

Deno.test('the confirmation token: signed, bound to company, period, figures and person, expires after 10 minutes', async () => {
  const now = Date.parse('2026-11-08T10:00:00Z');
  const t = await makeConfirmation(CONFIRM, { company: CO, periodKey: '18A1', hash: 'a'.repeat(64), user: OWNER, expiresAt: now + 600_000 });
  assertEquals(await readConfirmation(CONFIRM, t, { company: CO, periodKey: '18A1', user: OWNER, now }), { ok: true, hash: 'a'.repeat(64) });
  assertEquals((await readConfirmation(CONFIRM, t, { company: CO, periodKey: '18A2', user: OWNER, now })).ok, false, 'another period');
  assertEquals((await readConfirmation(CONFIRM, t, { company: CO, periodKey: '18A1', user: MEMBER, now })).ok, false, 'another person');
  assertEquals((await readConfirmation('another-secret-0123456789abcdef0123', t, { company: CO, periodKey: '18A1', user: OWNER, now })).ok, false, 'another secret');
  assertEquals(await readConfirmation(CONFIRM, t, { company: CO, periodKey: '18A1', user: OWNER, now: now + 600_001 }), { ok: false, code: 'confirmation_expired' });
  assertEquals(await readConfirmation(CONFIRM, t.replace(/a{64}/, 'b'.repeat(64)), { company: CO, periodKey: '18A1', user: OWNER, now }), { ok: false, code: 'confirmation_invalid' }, 'other figures');
  assertEquals(await readConfirmation(CONFIRM, 'garbage', { company: CO, periodKey: '18A1', user: OWNER, now }), { ok: false, code: 'confirmation_invalid' });
});

// ------------------------------------------------------------------ happy path
Deno.test('prepare then submit: one POST to the sandbox returns URL, the body as recomputed, Accept, fraud headers; accepted with the receipt', async () => {
  const w = await world();
  const p = await prepare(w);
  assertEquals(p.blocking, []);
  assertEquals(p.declaration, DECLARATION);
  assertEquals((p.figures as Record<string, unknown>).netVatDue, 145);
  assertEquals(p.vrn_last3, '789');
  assertEquals(posts(w).length, 0, 'prepare sends nothing');
  const r = await submit(w, p.confirmation_token);
  assertEquals(r.status, 200, JSON.stringify(r.body));
  assertEquals(r.body.status, 'accepted');
  assertEquals(r.body.receipt, { processing_date: RECEIPT.processingDate, payment_indicator: 'BANK', form_bundle_number: RECEIPT.formBundleNumber, charge_ref_number: RECEIPT.chargeRefNumber });
  const sent = posts(w);
  assertEquals(sent.length, 1);
  assertEquals(sent[0].url, 'https://test-api.service.hmrc.gov.uk/organisations/vat/123456789/returns');
  assertEquals(JSON.parse(sent[0].body!), buildReturnBody('18A1', computeReturnBoxes(ROWS)));
  const h = sent[0].headers;
  assertEquals(h.accept, 'application/vnd.hmrc.1.0+json');
  assertEquals(h['content-type'], 'application/json');
  assertEquals(h.authorization, 'Bearer USER-TOKEN-6');
  assertEquals(h['gov-client-connection-method'], 'WEB_APP_VIA_SERVER');
  assert(h['gov-client-device-id'] && h['gov-vendor-version']);
  assertEquals(h['gov-client-public-port'], undefined, 'the known gap: no public port');
  assertEquals(h['gov-test-scenario'], undefined);
  const fraudText = Object.entries(h).filter(([k]) => k.startsWith('gov-')).map(([, v]) => v).join(' ');
  assert(!fraudText.includes('USER-TOKEN') && !fraudText.includes('own@') && !fraudText.includes('Ann Owner'), 'no token, email or name in the fraud headers');
  assertEquals(w.submissions[0].status, 'accepted');
  assertEquals(w.submissions[0].figures, buildReturnBody('18A1', computeReturnBoxes(ROWS)));
  assertEquals(w.audit.map((a) => `${a.event}:${a.reason}`), ['vat_submit_start:submitting', 'vat_submit_result:accepted']);
  noSecrets(w, JSON.stringify(r.body) + JSON.stringify(p));
  const again = await submit(w, p.confirmation_token);
  assertEquals(again.body.code, 'already_submitted', 'an accepted period is never sent again');
  assertEquals(posts(w).length, 1);
});

Deno.test('the browser never supplies figures: anything it sends is ignored, the server recomputes', async () => {
  const w = await world();
  const p = await prepare(w);
  await submit(w, p.confirmation_token, { figures: { vatDueSales: 1 }, vatDueSales: 1, netVatDue: 0 });
  assertEquals(JSON.parse(posts(w)[0].body!).vatDueSales, 205);
});

// ------------------------------------------------------------------ refusals before anything is sent
Deno.test('refused: member, Solo, not signed in, two-step not done, production, missing confirmation secret, write:vat missing', async () => {
  for (const [user, code] of [[MEMBER, 'not_admin'], [SOLO, 'plan_not_included'], ['nobody', 'unauthorized'], [MFA_USER, 'two_step_required']] as const) {
    const w = await world();
    const r = await call(w, user, { action: 'prepare' });
    assertEquals(r.body.code, code, user);
    assertEquals(w.calls.length, 0);
  }
  const wMfa = await world();
  assertEquals((await call(wMfa, MFA_USER, { action: 'prepare' }, ENV, 'aal2')).status, 200, 'the same person after the code (aal2) may prepare');
  for (const env of [{ ...ENV, HMRC_ENV: 'production' }, { ...ENV, HMRC_ENV: 'PRODUCTION ' }]) {
    const w = await world();
    const r = await call(w, OWNER, { action: 'prepare' }, env);
    assertEquals(r.body.code, 'not_configured', 'production stays refused');
    assertEquals(w.calls.length, 0);
  }
  const wNoSecret = await world();
  assertEquals((await call(wNoSecret, OWNER, { action: 'prepare' }, { ...ENV, [CONFIRM_SECRET_ENV]: 'short' })).body.code, 'submit_not_configured');
  const wScope = await world();
  wScope.connection!.scopes = ['read:vat', 'hello'];
  const s = await call(wScope, OWNER, { action: 'prepare' });
  assertEquals(s.body.code, 'scope_missing');
  assert(String(s.body.message).includes('Connect to HMRC again'));
});

Deno.test('a demo person is refused (403) before anything runs', async () => {
  const w = await world();
  const handler = withDemoGuard((req: Request) => vatSubmit({ authHeader: req.headers.get('authorization'), headers: req.headers, body: { company_id: CO, period_key: '18A1', action: 'prepare' } }, deps(w)).then((r) => Response.json(r.body, { status: r.status })), {
    deps: { env: (k) => ({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' } as Record<string, string>)[k], fetch: async () => Response.json([{ user_id: DEMO }]) },
  });
  const res = await handler(new Request('https://fn.test', { method: 'POST', headers: { Authorization: `Bearer ${jwt(DEMO)}` } }));
  assertEquals(res.status, 403);
  assertEquals(w.calls.length, 0);
  assertEquals(w.submissions.length, 0);
});

Deno.test('submit needs the declaration, a valid unexpired token for this person and period, and unchanged figures', async () => {
  const w = await world();
  const p = await prepare(w);
  assertEquals((await call(w, OWNER, { action: 'submit', confirmation_token: p.confirmation_token })).body.code, 'confirmation_required');
  assertEquals((await call(w, OWNER, { action: 'submit', confirmation_token: p.confirmation_token, declaration: 'yes' })).body.code, 'confirmation_required');
  assertEquals((await submit(w, 'v1.123.abc.def')).body.code, 'confirmation_invalid');
  assertEquals((await submit(w, p.confirmation_token, { scenario: 'DROP_TABLE' })).body.code, 'bad_request', 'scenarios from the allow-list only');
  w.now = new Date(w.now.getTime() + 11 * 60 * 1000);
  assertEquals((await submit(w, p.confirmation_token)).body.code, 'confirmation_expired');
  const w2 = await world();
  const p2 = await prepare(w2);
  w2.rows = [...ROWS, { row_kind: 'included', source: 'bills', treatment: 'standard', reason: null, records: 1, net: 10, vat: 2, vat_not_reclaimable: 0 }];
  const changed = await submit(w2, p2.confirmation_token);
  assertEquals(changed.body.code, 'figures_changed');
  assertEquals(changed.body.message, 'Your records changed: review the return again.');
  assertEquals(posts(w).length + posts(w2).length, 0, 'nothing was sent');
  assertEquals(w.submissions.length + w2.submissions.length, 0);
});

Deno.test('blocking issues: not an open obligation, period not ended, records needing attention', async () => {
  const w = await world({ obligations: [FULFILLED] });
  assertEquals((await call(w, OWNER, { action: 'prepare' })).body.code, 'obligation_not_open');
  const w2 = await world({ obligations: [{ ...OPEN, end: '2026-12-31' }] });
  const p2 = await prepare(w2);
  assertEquals(p2.blocking, ['period_not_ended']);
  assertEquals(p2.confirmation_token, null, 'no token while something blocks');
  const w3 = await world({ rows: [...ROWS, { row_kind: 'left_out', source: 'invoices', treatment: null, reason: 'no_company', records: 2, net: 0, vat: 0, vat_not_reclaimable: 0 }] });
  assertEquals((await prepare(w3)).blocking, ['records_need_attention']);
  const w4 = await world({ preview: { ok: false, code: 'preview_not_available' } });
  assertEquals((await call(w4, OWNER, { action: 'prepare' })).body.code, 'preview_not_available');
});

// ------------------------------------------------------------------ HMRC's answers
Deno.test('each HMRC refusal is recorded as rejected with a stable code and plain words; a rejected period may be tried again', async () => {
  for (const [hmrcCode, expected] of Object.entries(HMRC_SUBMIT_ERRORS)) {
    const w = await world({ post: async () => Response.json({ code: hmrcCode, message: 'raw HMRC text with VRN 123456789' }, { status: hmrcCode === 'NOT_FOUND' ? 404 : hmrcCode.startsWith('INVALID_R') || hmrcCode === 'INVALID_MONETARY_AMOUNT' ? 400 : 403 }) });
    const p = await prepare(w);
    const r = await submit(w, p.confirmation_token, { scenario: (SUBMIT_SCENARIOS as readonly string[]).includes(hmrcCode) ? hmrcCode : undefined });
    assertEquals(r.body.status, 'rejected', hmrcCode);
    assertEquals(r.body.code, expected.code, hmrcCode);
    assertEquals(r.body.message, expected.message);
    assertEquals(w.submissions[0].status, 'rejected');
    assertEquals(w.submissions[0].error_code, expected.code);
    assert(!JSON.stringify(r.body).includes('raw HMRC text'), 'HMRC\'s own text is never passed on');
    noSecrets(w, JSON.stringify(r.body));
    assertEquals(posts(w).length, 1);
    if (hmrcCode === 'TAX_PERIOD_NOT_ENDED') {
      assertEquals(posts(w)[0].headers['gov-test-scenario'], 'TAX_PERIOD_NOT_ENDED', 'the sandbox scenario header is sent');
      w.post = async () => Response.json(RECEIPT, { status: 201 });
      const again = await submit(w, (await prepare(w)).confirmation_token);
      assertEquals(again.body.status, 'accepted', 'after a rejection a new attempt is allowed');
      assertEquals(w.submissions.length, 2);
    }
  }
});

Deno.test('401, 429 and 400 are clear refusals; a 401 is NOT refreshed-and-retried (one POST only)', async () => {
  for (const [status, code] of [[401, 'hmrc_unauthorised'], [429, 'hmrc_busy'], [400, 'invalid_return']] as const) {
    const w = await world({ post: async () => Response.json({ code: status === 401 ? 'INVALID_CREDENTIALS' : status === 429 ? 'MESSAGE_THROTTLED_OUT' : 'SOMETHING' }, { status }) });
    const r = await submit(w, (await prepare(w)).confirmation_token);
    assertEquals([r.body.status, r.body.code], ['rejected', code], String(status));
    assertEquals(posts(w).length, 1, `${status}: exactly one POST`);
    assertEquals(w.calls.filter((c) => c.url.endsWith('/oauth/token')).length, 0, 'no token refresh and resend');
  }
});

Deno.test('rate limit: the 6th attempt in an hour is refused before anything is sent', async () => {
  const w = await world({ limitLeft: 0 });
  const r = await submit(w, (await prepare(w)).confirmation_token);
  assertEquals(r.status, 429);
  assertEquals(r.body.code, 'submit_limit');
  assertEquals(posts(w).length, 0);
});

Deno.test('two submits at the same moment: exactly one POST reaches HMRC; the other is told it is already being submitted', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const w = await world({ post: async () => { await gate; return Response.json(RECEIPT, { status: 201 }); } });
  const token = (await prepare(w)).confirmation_token;
  const a = submit(w, token);
  const b = submit(w, token);
  await new Promise((r) => setTimeout(r, 20));
  release();
  const results = (await Promise.all([a, b])).map((r) => r.body.status ?? r.body.code).sort();
  assertEquals(results, ['accepted', 'already_submitting']);
  assertEquals(posts(w).length, 1);
  assertEquals(w.submissions.length, 1);
});

// ------------------------------------------------------------------ the unknown outcome
Deno.test('no clear answer (5xx, network error): recorded as unknown, never retried, no second POST; check settles it', async () => {
  for (const kind of ['503', 'network'] as const) {
    const w = await world({ post: async () => { if (kind === 'network') throw new TypeError('connection reset'); return new Response('', { status: 503 }); } });
    const r = await submit(w, (await prepare(w)).confirmation_token);
    assertEquals(r.body.status, 'unknown', kind);
    assert(String(r.body.message).includes('Do not submit again'));
    assertEquals(posts(w).length, 1, 'never retried');
    assertEquals(w.audit.at(-1)?.event, 'vat_submit_unknown');
    // A new attempt is refused while the outcome is unknown (prepare says so too).
    const p2 = await prepare(w);
    assertEquals(p2.blocking, ['outcome_unknown']);
    w.post = async () => Response.json(RECEIPT, { status: 201 });
    assertEquals((await submit(w, (await prepare(w)).confirmation_token ?? 'x')).body.code, 'confirmation_invalid');
    assertEquals(posts(w).length, 1);
    // Check: still open → may record "not received" → a new attempt is allowed.
    const still = await call(w, OWNER, { action: 'check' });
    assertEquals(still.body.status, 'still_open');
    const notReceived = await call(w, OWNER, { action: 'check', confirm_not_received: true });
    assertEquals(notReceived.body.status, 'rejected');
    assertEquals(w.submissions[0].status, 'rejected');
    const retry = await submit(w, (await prepare(w)).confirmation_token);
    assertEquals(retry.body.status, 'accepted');
    assertEquals(posts(w).length, 2, 'the second POST only after the person recorded it was not received');
    noSecrets(w);
  }
});

Deno.test('check: HMRC shows the period fulfilled → accepted (receipt unknown); nothing to check otherwise', async () => {
  const w = await world({ post: async () => new Response('', { status: 502 }) });
  await submit(w, (await prepare(w)).confirmation_token);
  w.obligations = [FULFILLED];
  const r = await call(w, OWNER, { action: 'check' });
  assertEquals(r.body.status, 'accepted');
  assertEquals(r.body.receipt_known, false);
  assertEquals(w.submissions[0].status, 'accepted');
  assertEquals(w.submissions[0].error_code, 'received_per_obligation');
  assertEquals(w.audit.at(-1), { event: 'vat_submit_check', reason: 'fulfilled' });
  assertEquals((await call(w, OWNER, { action: 'check' })).body.code, 'nothing_to_check');
  const obligationCalls = w.calls.filter((c) => c.url.includes('/obligations'));
  assert(obligationCalls.at(-1)!.url.includes('from=2026-07-01&to=2026-09-30'), 'the check reads the period itself');
});

Deno.test('the P5 function\'s refusals map to our codes', () => {
  assertEquals(previewFailure({ code: 'PGRST202', message: 'Could not find the function' }), 'preview_not_available');
  assertEquals(previewFailure({ code: '42501', message: 'VAT_PREVIEW_PLAN: plan_not_included' }), 'plan_not_included');
  assertEquals(previewFailure({ code: '42501', message: 'VAT_PREVIEW_DENIED: enter your authenticator code first' }), 'two_step_required');
  assertEquals(previewFailure({ code: '42501', message: 'VAT_PREVIEW_DENIED: only an owner or admin' }), 'preview_denied');
  assertEquals(previewFailure({ code: '500', message: 'x' }), 'server_error');
});

Deno.test('bad input: unknown action or a malformed period key', async () => {
  const w = await world();
  assertEquals((await call(w, OWNER, { action: 'delete' })).body.code, 'bad_request');
  assertEquals((await call(w, OWNER, { action: 'prepare', period_key: '18A1; drop' })).body.code, 'bad_request');
  assertEquals((await call(w, OWNER, { action: 'prepare', company_id: 'not-a-uuid' })).body.code, 'bad_request');
  assertEquals(w.calls.length, 0);
});

// ------------------------------------------------------------------ HMRC P7a: error handling gaps closed
import { retryAfterSeconds } from './api.ts';

Deno.test('P7a: Retry-After is read as seconds or an HTTP date, kept between 1 and 3600', () => {
  const now = new Date('2026-11-08T10:00:00Z');
  assertEquals(retryAfterSeconds('30', now), 30);
  assertEquals(retryAfterSeconds('0', now), undefined);
  assertEquals(retryAfterSeconds('999999', now), 3600);
  assertEquals(retryAfterSeconds('Sun, 08 Nov 2026 10:02:00 GMT', now), 120);
  assertEquals(retryAfterSeconds('yesterday', now), undefined);
  assertEquals(retryAfterSeconds(null, now), undefined);
});

Deno.test('P7a: a 429 with Retry-After on submit is a clear rejection that says when to try again; still one POST', async () => {
  const w = await world({ post: async () => Response.json({ code: 'MESSAGE_THROTTLED_OUT' }, { status: 429, headers: { 'Retry-After': '45' } }) });
  const r = await submit(w, (await prepare(w)).confirmation_token);
  assertEquals([r.body.status, r.body.code, r.body.retry_after], ['rejected', 'hmrc_busy', 45]);
  assertEquals(r.body.message, 'HMRC is busy right now. Nothing was filed. Please try again in 45 seconds.');
  assertEquals(posts(w).length, 1);
});

Deno.test('P7a: 403 NOT_SIGNED_UP_TO_MTD and RETURN_ALREADY_RECEIVED get their own plain words; 409 is a clear rejection', async () => {
  for (const [code, status, expected] of [['NOT_SIGNED_UP_TO_MTD', 403, 'vat_not_signed_up'], ['RETURN_ALREADY_RECEIVED', 403, 'duplicate_submission'], ['SOMETHING_NEW', 409, 'something_new']] as const) {
    const w = await world({ post: async () => Response.json({ code }, { status }) });
    const r = await submit(w, (await prepare(w)).confirmation_token);
    assertEquals([r.body.status, r.body.code], ['rejected', expected], code);
    assertEquals(posts(w).length, 1);
  }
  // On the obligations read (before anything is sent):
  const w2 = await world();
  const deps2 = deps(w2);
  const origFetch = deps2.fetch;
  deps2.fetch = async (input, init) => (String(input).includes('/obligations') ? Response.json({ code: 'NOT_SIGNED_UP_TO_MTD' }, { status: 403 }) : origFetch(input, init));
  const r2 = await vatSubmit({ authHeader: `Bearer ${jwt(OWNER)}`, headers: new Headers(), body: { company_id: CO, period_key: '18A1', action: 'prepare' } }, deps2);
  assertEquals(r2.body.code, 'vat_not_signed_up');
});

Deno.test('P7a: a 201 whose body can\'t be read is still accepted, and the person is told the receipt couldn\'t be read', async () => {
  const w = await world({ post: async () => new Response('not json', { status: 201 }) });
  const r = await submit(w, (await prepare(w)).confirmation_token);
  assertEquals(r.body.status, 'accepted');
  assertEquals(r.body.receipt_complete, false);
  assert(String(r.body.message).includes("receipt couldn't be read"));
  assertEquals(w.submissions[0].status, 'accepted');
  assertEquals(w.audit.at(-1), { event: 'vat_submit_result', reason: 'accepted_no_receipt' });
});

Deno.test('P7a: every HMRC call from the submit flow has a timeout (the obligations read and the POST)', async () => {
  const w = await world();
  const signals: (AbortSignal | undefined)[] = [];
  const d = deps(w);
  const f = d.fetch;
  d.fetch = async (input, init) => { if (!String(input).endsWith('/oauth/token')) signals.push((init as { signal?: AbortSignal } | undefined)?.signal ?? undefined); return f(input, init); };
  const p = await vatSubmit({ authHeader: `Bearer ${jwt(OWNER)}`, headers: new Headers(), body: { company_id: CO, period_key: '18A1', action: 'prepare' } }, d);
  await vatSubmit({ authHeader: `Bearer ${jwt(OWNER)}`, headers: new Headers(), body: { company_id: CO, period_key: '18A1', action: 'submit', declaration: true, confirmation_token: p.body.confirmation_token } }, d);
  assert(signals.length >= 3, String(signals.length));
  assert(signals.every((s) => s instanceof AbortSignal), 'each call carries an abort signal');
});
