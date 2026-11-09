// HMRC P8 Deno tests: hmrc-vat-return-view, hmrc-vat-liabilities, hmrc-vat-payments, hmrc-vat-penalties (read only,
// sandbox only). HMRC is mocked: no network. Fictional companies, people and VAT numbers only.
import { assert, assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts';
import { b64url, encryptToken, tokenAad } from './crypto.ts';
import type { AuditEvent, ConnectionRow, HmrcStore, ManageRule } from './store.ts';
import {
  compareBoxes, LIABILITY_SCENARIOS, normaliseLiabilities, normalisePayments, normalisePenalties, PENALTIES_NOTE, PENALTY_SCENARIOS, type ReadDeps,
  type ReadKind, readPeriod, readRange, type StoredReturn, vatLiabilities, vatPayments, vatPenalties, vatReturnView,
} from './vatReads.ts';
import { withDemoGuard } from '../demo-guard.ts';

const KEY = new Uint8Array(32).map((_, i) => i + 21);
const KEY_B64 = btoa(String.fromCharCode(...KEY));
const SECRET = 'client-secret-p8';
const ENV: Record<string, string> = {
  HMRC_CLIENT_ID: 'b2bnest-client', HMRC_CLIENT_SECRET: SECRET, HMRC_TOKEN_KEY: KEY_B64, HMRC_ENV: 'sandbox',
  HMRC_REDIRECT_URI: 'https://www.b2bnest.online/hmrc/callback',
};
const CO = '0d800000-0000-4000-8000-000000000001';
const OWNER = '0a0a0a0a-0000-4000-8000-0000000008a1';
const MEMBER = '0a0a0a0a-0000-4000-8000-0000000008a2';
const SOLO = '0a0a0a0a-0000-4000-8000-0000000008a3';
const OUTSIDER = '0a0a0a0a-0000-4000-8000-0000000008a4';
const ENDED = '0a0a0a0a-0000-4000-8000-0000000008a5';
const SUSPENDED = '0a0a0a0a-0000-4000-8000-0000000008a6';
const DEMO = 'de00de00-0000-4000-8000-000000000008';
const VRN = '123456789';
const BROWSER = { deviceId: 'beec798b-b366-47fa-b1f8-92cede14a1ce', jsUserAgent: 'Mozilla/5.0 (test)', timezone: 'UTC+00:00', webVersion: '1.0.0',
  screens: [{ width: 1920, height: 1080, scalingFactor: 1, colourDepth: 24 }], windowSize: { width: 1200, height: 800 } };
const TODAY = new Date('2026-11-08T10:00:00.000Z');
// The figures exactly as hmrc-vat-submit stored them (buildReturnBody).
const OURS = { periodKey: '18A1', vatDueSales: 1000.5, vatDueAcquisitions: 0, totalVatDue: 1000.5, vatReclaimedCurrPeriod: 200.25, netVatDue: 800.25,
  totalValueSalesExVAT: 5002, totalValuePurchasesExVAT: 1001, totalValueGoodsSuppliedExVAT: 0, totalAcquisitionsExVAT: 0, finalised: true };
const STORED: StoredReturn = { period_key: '18A1', period_start: '2017-01-01', period_end: '2017-03-31', figures: OURS, form_bundle_number: '256660290587' };
// HMRC's examples (VAT (MTD) 1.0 OpenAPI file, 8 Nov 2026).
const HMRC_RETURN = { periodKey: '18A1', vatDueSales: 1000.5, vatDueAcquisitions: 0, totalVatDue: 1000.5, vatReclaimedCurrPeriod: 200.25, netVatDue: 800.25,
  totalValueSalesExVAT: 5002, totalValuePurchasesExVAT: 1001, totalValueGoodsSuppliedExVAT: 0, totalAcquisitionsExVAT: 0 };
const HMRC_LIABILITIES = { liabilities: [
  { taxPeriod: { from: '2017-01-01', to: '2017-02-01' }, type: 'VAT Return Debit Charge', originalAmount: 463872, outstandingAmount: 463872, due: '2017-05-12' },
  { type: 'VAT CA Charge', originalAmount: 8493.38, outstandingAmount: 7493.38, due: '2017-03-08', secret: 'nope' },
] };
const HMRC_PAYMENTS = { payments: [{ amount: 5, received: '2017-02-11' }, { amount: 50, received: '2017-03-11' }] };
const HMRC_PENALTIES = {
  totalisations: { lateSubmissionPenaltyTotalValue: 200, penalisedPrincipalTotal: 2000, latePaymentPenaltyPostedTotal: 50, latePaymentPenaltyEstimateTotal: 10 },
  lateSubmissionPenalty: {
    summary: { activePenaltyPoints: 1, inactivePenaltyPoints: 0, regimeThreshold: 4, penaltyChargeAmount: 200 },
    details: [{ penaltyNumber: '123456789', penaltyOrder: '01', penaltyCategory: 'P', penaltyStatus: 'ACTIVE', penaltyCreationDate: '2022-10-30', chargeAmount: 200,
      lateSubmissions: [{ taxPeriodStartDate: '2022-01-01' }], freeText: 'a long sentence <script>that must not pass</script>' }],
  },
  latePaymentPenalty: { details: [{ principalChargeReference: 'XM002610011594', penaltyCategory: 'LPP1', penaltyStatus: 'P', penaltyAmountPosted: 50,
    penaltyChargeDueDate: '2022-10-30', LPPDetailsMetaData: { x: 1 } }] },
  extra: { notes: 'dropped' },
};

interface World {
  rules: Record<string, ManageRule>;
  vat: string | null;
  connection: (ConnectionRow & { refresh_lock_until?: string | null }) | null;
  audit: { event: AuditEvent | string; reason?: string | null }[];
  slots: Record<string, number>;
  slotMissing: boolean;
  stored: StoredReturn | null;
  storedAsked: string[];
  calls: { url: string; method: string; headers: Record<string, string>; body: unknown }[];
  api: (url: string) => Response;
  logs: string[];
}
async function world(over: Partial<World> = {}): Promise<World> {
  return {
    rules: { [OWNER]: 'ok', [MEMBER]: 'not_admin', [SOLO]: 'plan_not_included', [OUTSIDER]: 'not_member', [ENDED]: 'trial_ended', [SUSPENDED]: 'suspended', [DEMO]: 'ok' },
    vat: 'GB 123 4567 89',
    connection: {
      company_id: CO, environment: 'sandbox', status: 'connected', scopes: ['read:vat', 'write:vat', 'hello'],
      access_token_enc: await encryptToken('USER-TOKEN-8', KEY, tokenAad(CO, 'sandbox', 'access')),
      refresh_token_enc: await encryptToken('REFRESH-8', KEY, tokenAad(CO, 'sandbox', 'refresh')),
      expires_at: '2026-11-08T14:00:00.000Z', refresh_lock_until: null,
    },
    audit: [], slots: { vat_return_view: 10, vat_liabilities: 10, vat_payments: 10, vat_penalties: 10 }, slotMissing: false,
    stored: STORED, storedAsked: [], calls: [], logs: [],
    api: (url) => Response.json(url.includes('/returns/') ? HMRC_RETURN : url.includes('/liabilities') ? HMRC_LIABILITIES : url.includes('/payments') ? HMRC_PAYMENTS : HMRC_PENALTIES,
      { headers: { 'X-CorrelationId': 'c75f40a6-a3df-4429-a697-471eeec46435' } }),
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
    async takeObligationsSlot() { throw new Error('the reads must not use the obligations bucket'); },
    async vatNumberFor() { return w.vat; },
  };
}
const deps = (w: World, env = ENV): ReadDeps => ({
  env: (k: string) => env[k], store: store(w), now: () => TODAY, sleep: async () => {},
  log: (e: string, m?: Record<string, unknown>) => w.logs.push(`${e} ${JSON.stringify(m ?? {})}`),
  fetch: async (input: string | URL | Request, init?: RequestInit) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    w.calls.push({ url: String(input), method: init?.method ?? 'GET', headers, body: init?.body });
    if (String(input).endsWith('/oauth/token')) return Response.json({ access_token: 'USER-TOKEN-9', refresh_token: 'REFRESH-9', expires_in: 14400 });
    return w.api(String(input));
  },
  caller: {
    async getUser(t: string) { const sub = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.split('.')[1].length + 3) % 4))).sub; return sub === 'nobody' ? null : { id: sub }; },
    async listFactors(u: string) { return u === 'two-step-person' ? [{ id: 'f1', factor_type: 'totp', status: 'verified' }] : []; },
  },
  reads: {
    async takeReadSlot(_c, _u, _e, kind: ReadKind) {
      if (w.slotMissing) return 'not_available';
      if (w.slots[kind] <= 0) return 'limit';
      w.slots[kind]--; w.audit.push({ event: `${kind}_call`, reason: 'read' }); return 'ok';
    },
    async storedReturn(_c, _e, pk) { w.storedAsked.push(pk); return w.stored && w.stored.period_key === pk ? w.stored : null; },
  },
});
const jwt = (sub: string) => `x.${b64url(new TextEncoder().encode(JSON.stringify({ sub, role: 'authenticated', aal: 'aal1', amr: [{ method: 'password', timestamp: 1762500000 }] })))}.y`;
type Fn = typeof vatLiabilities;
const READS: [string, Fn, Record<string, unknown>, ReadKind][] = [
  ['return view', vatReturnView, { period_key: '18A1' }, 'vat_return_view'],
  ['liabilities', vatLiabilities, { from: '2026-01-01', to: '2026-11-08' }, 'vat_liabilities'],
  ['payments', vatPayments, { from: '2026-01-01', to: '2026-11-08' }, 'vat_payments'],
  ['penalties', vatPenalties, {}, 'vat_penalties'],
];
const run = (fn: Fn, w: World, user: string | null, body: Record<string, unknown> = {}, env = ENV) =>
  fn({ authHeader: user ? `Bearer ${jwt(user)}` : null, headers: new Headers({ 'x-forwarded-for': '198.51.100.7' }), body: { company_id: CO, fraud: BROWSER, ...body } }, deps(w, env));
const hmrcCalls = (w: World) => w.calls.filter((c) => c.url.includes('/organisations/vat/'));
const noSecrets = (w: World, extra = '') => {
  const text = w.logs.join('\n') + JSON.stringify(w.audit) + extra;
  for (const s of [SECRET, 'USER-TOKEN', 'REFRESH-', 'Bearer', KEY_B64, VRN, 'details that must not leak', '463872', '8493.38', 'XM002610011594']) assert(!text.includes(s), `leaked ${s}`);
};

// ------------------------------------------------------------------ input
Deno.test('P8 input: dates are real, ordered, up to today and at most 365 days; scenarios and period keys from the allow-list', () => {
  assertEquals(readRange({ from: '2026-01-01', to: '2026-11-08' }, LIABILITY_SCENARIOS, TODAY), { from: '2026-01-01', to: '2026-11-08' });
  assertEquals(readRange({ from: '2025-11-09', to: '2026-11-08' }, LIABILITY_SCENARIOS, TODAY)?.from, '2025-11-09', '365 days is allowed');
  for (const bad of [
    { from: '2025-11-08', to: '2026-11-08' }, // 366 days
    { from: '2026-11-01', to: '2026-11-09' }, // after today
    { from: '2026-02-01', to: '2026-01-01' }, // to before from
    { from: '2026-02-30', to: '2026-03-01' }, // not a real date
    { from: '2026-01-01' }, { to: '2026-01-01' }, {}, { from: 20260101, to: 20260201 },
    { from: '2026-01-01', to: '2026-02-01', scenario: 'DROP TABLE' },
    { from: '2026-01-01', to: '2026-02-01', scenario: 'SINGLE_PAYMENT' }, // a payments scenario, not a liabilities one
  ]) assertEquals(readRange(bad, LIABILITY_SCENARIOS, TODAY), null, JSON.stringify(bad));
  assertEquals(readRange({ from: '2017-01-02', to: '2017-02-02', scenario: 'SINGLE_LIABILITY' }, LIABILITY_SCENARIOS, TODAY)?.scenario, 'SINGLE_LIABILITY',
    "HMRC's sandbox scenario dates are allowed (HMRC itself judges its earliest date)");
  assertEquals(readPeriod({ period_key: '18A1' }), { periodKey: '18A1' });
  assertEquals(readPeriod({ period_key: '#001' }), { periodKey: '#001' });
  for (const bad of ['18A', '18A12', '18-1', '', null, 1801]) assertEquals(readPeriod({ period_key: bad }), null, String(bad));
  assertEquals(readPeriod({ period_key: '18A1', scenario: 'INSOLVENT_TRADER' })?.scenario, 'INSOLVENT_TRADER');
  assertEquals(readPeriod({ period_key: '18A1', scenario: 'NOT_A_SCENARIO' }), null);
  assert(PENALTY_SCENARIOS.includes('NO_PENALTIES'));
});

// ------------------------------------------------------------------ normalisers
Deno.test('P8 normalisers keep well-formed, whitelisted fields only', () => {
  const l = normaliseLiabilities({ liabilities: [...HMRC_LIABILITIES.liabilities, { type: 'x' }, { originalAmount: 1 }, { type: 'ok', originalAmount: 'nope' }] });
  assertEquals(l.dropped, 3);
  assertEquals(l.liabilities, [
    { taxPeriod: { from: '2017-01-01', to: '2017-02-01' }, type: 'VAT Return Debit Charge', originalAmount: 463872, outstandingAmount: 463872, due: '2017-05-12' },
    { taxPeriod: null, type: 'VAT CA Charge', originalAmount: 8493.38, outstandingAmount: 7493.38, due: '2017-03-08' },
  ]);
  assertEquals(normaliseLiabilities({ nope: 1 }), { liabilities: [], dropped: 0 });
  const p = normalisePayments({ payments: [...HMRC_PAYMENTS.payments, { amount: 'x' }, { amount: 1, received: 'yesterday' }] });
  assertEquals(p.payments, [{ amount: 5, received: '2017-02-11' }, { amount: 50, received: '2017-03-11' }, { amount: 1, received: null }]);
  assertEquals(p.dropped, 1);
  const pen = normalisePenalties(HMRC_PENALTIES);
  assertEquals(pen.totalisations, HMRC_PENALTIES.totalisations);
  assertEquals(pen.lateSubmission.summary, { activePenaltyPoints: 1, inactivePenaltyPoints: 0, regimeThreshold: 4, penaltyChargeAmount: 200 });
  assertEquals(pen.lateSubmission.details, [{ penaltyNumber: '123456789', penaltyOrder: '01', penaltyCategory: 'P', penaltyStatus: 'ACTIVE', penaltyCreationDate: '2022-10-30', chargeAmount: 200 }]);
  assertEquals(pen.latePayment.details, [{ principalChargeReference: 'XM002610011594', penaltyCategory: 'LPP1', penaltyStatus: 'P', penaltyAmountPosted: 50, penaltyChargeDueDate: '2022-10-30' }]);
  assert(!JSON.stringify(pen).includes('script') && !JSON.stringify(pen).includes('dropped') && !JSON.stringify(pen).includes('lateSubmissions'));
  assertEquals(normalisePenalties(null), { totalisations: {}, lateSubmission: { summary: {}, details: [] }, latePayment: { details: [] } });
});

Deno.test('P8 compare: same to the penny matches; each differing or missing box is listed', () => {
  assertEquals(compareBoxes(OURS, HMRC_RETURN), { matches: true, differences: [] });
  assertEquals(compareBoxes(OURS, { ...HMRC_RETURN, vatDueSales: 1000.5000001 }).matches, true, 'float noise is not a difference');
  const d = compareBoxes(OURS, { ...HMRC_RETURN, netVatDue: 800.26, totalValueSalesExVAT: undefined });
  assertEquals(d.matches, false);
  assertEquals(d.differences, [{ box: 5, field: 'netVatDue', ours: 800.25, hmrc: 800.26 }, { box: 6, field: 'totalValueSalesExVAT', ours: 5002, hmrc: null }]);
  assertEquals(compareBoxes({}, HMRC_RETURN).differences.length, 9);
});

// ------------------------------------------------------------------ the calls
Deno.test('P8 return view: one GET for the period, compared with our stored copy; nothing written but the audit', async () => {
  const w = await world();
  const r = await run(vatReturnView, w, OWNER, { period_key: '18A1', scenario: 'INSOLVENT_TRADER' });
  assertEquals(r.status, 200);
  const calls = hmrcCalls(w);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].method, 'GET');
  assertEquals(calls[0].body, undefined, 'no body is ever sent');
  assertEquals(calls[0].url, 'https://test-api.service.hmrc.gov.uk/organisations/vat/123456789/returns/18A1');
  assertEquals(calls[0].headers.accept, 'application/vnd.hmrc.1.0+json');
  assertEquals(calls[0].headers['gov-test-scenario'], 'INSOLVENT_TRADER');
  const b = r.body as Record<string, unknown>;
  assertEquals([b.matches, b.differences, b.period_key, b.form_bundle_number, b.vrn_last3], [true, [], '18A1', '256660290587', '789']);
  assertEquals(w.audit.map((a) => `${a.event}:${a.reason}`), ['vat_return_view_call:read', 'vat_return_view_result:matches']);
  assert(w.logs.some((l) => l.includes('/organisations/vat/{vrn}/returns/{periodKey}')), 'logs the path pattern, never the VAT number');
  noSecrets(w, JSON.stringify(r.body).replace('"vrn_last3":"789"', ''));

  const diff = await world({ api: () => Response.json({ ...HMRC_RETURN, vatDueSales: 999 }) });
  const d = await run(vatReturnView, diff, OWNER, { period_key: '18A1' });
  assertEquals([(d.body as { matches: boolean }).matches, (d.body as { differences: unknown[] }).differences], [false, [{ box: 1, field: 'vatDueSales', ours: 1000.5, hmrc: 999 }]]);
  assertEquals(diff.audit.at(-1)?.reason, 'differs');
});

Deno.test('P8 return view: a period key with # is sent encoded; a period we never sent is refused before HMRC is asked', async () => {
  const w = await world({ stored: { ...STORED, period_key: '#001' } });
  const r = await run(vatReturnView, w, OWNER, { period_key: '#001' });
  assertEquals(r.status, 200);
  assertEquals(hmrcCalls(w)[0].url, 'https://test-api.service.hmrc.gov.uk/organisations/vat/123456789/returns/%23001');
  const none = await world({ stored: null });
  const n = await run(vatReturnView, none, OWNER, { period_key: '18A1' });
  assertEquals([n.status, n.body.code], [409, 'not_submitted']);
  assertEquals(hmrcCalls(none).length, 0);
  assertEquals(none.audit.length, 0, 'no slot used');
  const nf = await world({ api: () => Response.json({ code: 'NOT_FOUND', message: 'details that must not leak' }, { status: 404 }) });
  const f = await run(vatReturnView, nf, OWNER, { period_key: '18A1' });
  assertEquals([f.status, f.body.code, f.body.message], [409, 'return_not_found', 'HMRC has no return for this period.']);
  assertEquals(nf.audit.at(-1)?.reason, 'not_found');
  noSecrets(nf, JSON.stringify(f.body));
});

Deno.test('P8 liabilities and payments: one GET with from and to; amounts passed on in GBP as HMRC gives them; 404 means none', async () => {
  const w = await world();
  const r = await run(vatLiabilities, w, OWNER, { from: '2017-01-02', to: '2017-02-02', scenario: 'SINGLE_LIABILITY' });
  assertEquals(r.status, 200);
  assertEquals(hmrcCalls(w)[0].url, 'https://test-api.service.hmrc.gov.uk/organisations/vat/123456789/liabilities?from=2017-01-02&to=2017-02-02');
  assertEquals(hmrcCalls(w)[0].headers['gov-test-scenario'], 'SINGLE_LIABILITY');
  assertEquals((r.body as { liabilities: unknown[] }).liabilities.length, 2);
  assertEquals(w.audit.map((a) => `${a.event}:${a.reason}`), ['vat_liabilities_call:read', 'vat_liabilities_result:ok']);
  noSecrets(w);

  const p = await world();
  const pr = await run(vatPayments, p, OWNER, { from: '2026-01-01', to: '2026-11-08' });
  assertEquals(hmrcCalls(p)[0].url, 'https://test-api.service.hmrc.gov.uk/organisations/vat/123456789/payments?from=2026-01-01&to=2026-11-08');
  assertEquals(hmrcCalls(p)[0].headers['gov-test-scenario'], undefined, 'no scenario unless asked');
  assertEquals((pr.body as { payments: unknown[] }).payments, HMRC_PAYMENTS.payments);
  assertEquals(p.audit.map((a) => a.event), ['vat_payments_call', 'vat_payments_result']);

  for (const fn of [vatLiabilities, vatPayments]) {
    const nf = await world({ api: () => Response.json({ code: 'NOT_FOUND' }, { status: 404 }) });
    const n = await run(fn, nf, OWNER, { from: '2026-01-01', to: '2026-02-01' });
    assertEquals(n.status, 200);
    assert(Array.isArray((n.body as Record<string, unknown>).liabilities ?? (n.body as Record<string, unknown>).payments));
    assertEquals(nf.audit.at(-1)?.reason, 'not_found');
  }
});

Deno.test('P8 penalties: one GET, no query; whitelisted fields; the "check your HMRC account" note', async () => {
  const w = await world();
  const r = await run(vatPenalties, w, OWNER, { scenario: 'MULTIPLE_PENALTIES' });
  assertEquals(r.status, 200);
  assertEquals(hmrcCalls(w)[0].url, 'https://test-api.service.hmrc.gov.uk/organisations/vat/123456789/penalties');
  assertEquals(hmrcCalls(w)[0].headers['gov-test-scenario'], 'MULTIPLE_PENALTIES');
  assertEquals(r.body.note, PENALTIES_NOTE);
  assertEquals(PENALTIES_NOTE, 'This is what HMRC shows. Check your HMRC account for the final position.');
  assert(!JSON.stringify(r.body).includes('script'));
  assertEquals(w.audit.map((a) => `${a.event}:${a.reason}`), ['vat_penalties_call:read', 'vat_penalties_result:ok']);
  assertEquals((await run(vatPenalties, await world(), OWNER, { scenario: 'NOPE' })).body.code, 'bad_request');
});

Deno.test('P8 the fraud prevention headers are the same as for obligations; the public port is left out, never invented', async () => {
  for (const [name, fn, body] of READS) {
    const w = await world();
    await run(fn, w, OWNER, body);
    const h = hmrcCalls(w)[0].headers;
    assertEquals(h.authorization, 'Bearer USER-TOKEN-8', name);
    assertEquals(h['gov-client-connection-method'], 'WEB_APP_VIA_SERVER', name);
    assertEquals(h['gov-client-public-ip'], '198.51.100.7', name);
    assertEquals(h['gov-client-device-id'], BROWSER.deviceId, name);
    assertEquals(h['gov-client-user-ids'], `b2bnest=${OWNER}`, name);
    assertEquals(h['gov-client-public-port'], undefined, name);
    assertEquals(h['gov-vendor-public-ip'], undefined, `${name}: HMRC_VENDOR_PUBLIC_IP unset`);
    const govValues = Object.entries(h).filter(([k]) => k.startsWith('gov-')).map(([, v]) => v).join(' ');
    assert(!/@|USER-TOKEN|Bearer/i.test(govValues), `${name}: no email or token in a Gov header`);
  }
});

// ------------------------------------------------------------------ refusals, before HMRC
Deno.test('P8 refusals: signed out, two-step not done, member, wrong plan, trial ended, suspended, outsider, bad input — HMRC never called', async () => {
  for (const [name, fn, body] of READS) {
    const cases: [string | null, Record<string, unknown>, number, string][] = [
      [null, {}, 401, 'unauthorized'], ['nobody', {}, 401, 'unauthorized'], ['two-step-person', {}, 403, 'two_step_required'],
      [MEMBER, {}, 403, 'not_admin'], [SOLO, {}, 403, 'plan_not_included'], [ENDED, {}, 403, 'trial_ended'], [SUSPENDED, {}, 403, 'suspended'],
      [OUTSIDER, {}, 403, 'not_member'], [OWNER, { company_id: 'x' }, 400, 'bad_request'], [OWNER, { scenario: 'ANYTHING' }, 400, 'bad_request'],
    ];
    for (const [user, extra, status, code] of cases) {
      const w = await world();
      const r = await run(fn, w, user, { ...body, ...extra });
      assertEquals([r.status, r.body.code], [status, code], `${name} ${user} ${JSON.stringify(extra)}`);
      assertEquals(hmrcCalls(w).length, 0);
      assert(!w.audit.some((a) => a.event.endsWith('_call')), 'no slot taken');
    }
  }
  const w = await world();
  await run(vatLiabilities, w, MEMBER, { from: '2026-01-01', to: '2026-02-01' });
  assertEquals(w.audit, [{ event: 'refused', reason: 'not_admin' }]);
});

Deno.test('P8 connection, scope and VAT number are checked before any call', async () => {
  for (const [name, fn, body] of READS) {
    let w = await world({ connection: null });
    assertEquals((await run(fn, w, OWNER, body)).body.code, 'not_connected', name);
    w = await world(); w.connection!.status = 'disconnected';
    assertEquals((await run(fn, w, OWNER, body)).body.code, 'not_connected', name);
    w = await world(); w.connection!.status = 'needs_reconnect';
    assertEquals((await run(fn, w, OWNER, body)).body.code, 'needs_reconnect', name);
    w = await world(); w.connection!.scopes = ['write:vat'];
    assertEquals((await run(fn, w, OWNER, body)).body.code, 'scope_missing', `${name}: read:vat only, no new scope`);
    w = await world({ vat: null });
    assertEquals((await run(fn, w, OWNER, body)).body.code, 'vrn_missing', name);
    assertEquals(hmrcCalls(w).length, 0);
  }
});

Deno.test('P8 rate limit: 10 an hour per company for each read; "not available yet" before the database update', async () => {
  for (const [name, fn, body, kind] of READS) {
    const w = await world();
    w.slots[kind] = 0;
    const r = await run(fn, w, OWNER, body);
    assertEquals([r.status, r.body.code], [429, 'read_limit'], name);
    assertEquals(hmrcCalls(w).length, 0);
    const m = await world({ slotMissing: true });
    const n = await run(fn, m, OWNER, body);
    assertEquals([n.status, n.body.code, n.body.message], [503, 'not_available', "This isn't available yet."], name);
    assertEquals(hmrcCalls(m).length, 0);
  }
});

Deno.test('P8 production stays refused; not configured', async () => {
  for (const [name, fn, body] of READS) {
    for (const env of [{ ...ENV, HMRC_ENV: 'production' }, { ...ENV, HMRC_CLIENT_SECRET: '' }]) {
      const w = await world();
      const r = await run(fn, w, OWNER, body, env);
      assertEquals([r.status, r.body.code], [503, 'not_configured'], name);
      assertEquals(w.calls.length, 0);
    }
  }
});

// ------------------------------------------------------------------ HMRC's answers
Deno.test('P8 HMRC answers mapped, never retried, HMRC text never passed on', async () => {
  const shared: [number, string | null, number, string][] = [
    [403, 'CLIENT_OR_AGENT_NOT_AUTHORISED', 403, 'vat_not_authorised'],
    [403, 'RULE_INSOLVENT_TRADER', 422, 'vat_insolvent'],
    [403, 'INVALID_SCOPE', 409, 'scope_missing'],
    [400, 'VRN_INVALID', 422, 'vrn_invalid'],
    [429, 'MESSAGE_THROTTLED_OUT', 503, 'hmrc_busy'],
    [500, 'SERVER_ERROR', 502, 'hmrc_unavailable'],
    [503, null, 502, 'hmrc_unavailable'],
    [406, 'ACCEPT_HEADER_INVALID', 502, 'hmrc_refused'],
  ];
  for (const [name, fn, body] of READS) {
    for (const [status, code, want, wantCode] of shared) {
      const w = await world({ api: () => Response.json(code ? { code, message: 'details that must not leak' } : {}, { status }) });
      const r = await run(fn, w, OWNER, body);
      assertEquals([r.status, r.body.code], [want, wantCode], `${name} ${status} ${code}`);
      assertEquals(hmrcCalls(w).length, 1, 'no retry');
      noSecrets(w, JSON.stringify(r.body));
      assert(w.audit.at(-1)!.event.endsWith('_result'));
    }
  }
  const own: [Fn, Record<string, unknown>, number, string, number, string][] = [
    [vatReturnView, { period_key: '18A1' }, 400, 'PERIOD_KEY_INVALID', 400, 'bad_request'],
    [vatReturnView, { period_key: '18A1' }, 403, 'DATE_RANGE_TOO_LARGE', 400, 'bad_request'],
    [vatLiabilities, { from: '2026-01-01', to: '2026-02-01' }, 400, 'DATE_FROM_INVALID', 400, 'dates_invalid'],
    [vatLiabilities, { from: '2026-01-01', to: '2026-02-01' }, 400, 'DATE_TO_INVALID', 400, 'dates_invalid'],
    [vatPayments, { from: '2026-01-01', to: '2026-02-01' }, 400, 'DATE_RANGE_INVALID', 400, 'dates_invalid'],
    [vatPenalties, {}, 404, 'NOT_FOUND', 502, 'hmrc_refused'],
  ];
  for (const [fn, body, status, code, want, wantCode] of own) {
    const w = await world({ api: () => Response.json({ code, message: 'details that must not leak' }, { status }) });
    const r = await run(fn, w, OWNER, body);
    assertEquals([r.status, r.body.code], [want, wantCode], `${status} ${code}`);
    assertEquals(w.audit.at(-1)?.reason, code.toLowerCase());
  }
  // HMRC P7c: the real code may be nested in an errors array.
  const nested = await world({ api: () => Response.json({ code: 'INVALID_REQUEST', errors: [{ code: 'DATE_TO_INVALID', message: 'details that must not leak' }] }, { status: 400 }) });
  assertEquals((await run(vatPayments, nested, OWNER, { from: '2026-01-01', to: '2026-02-01' })).body.code, 'dates_invalid');
});

Deno.test('P8 busy says when to try again; a timeout or network error is "couldn\'t be reached"; each GET has a 20 s timeout signal', async () => {
  for (const [name, fn, body] of READS) {
    const b = await run(fn, await world({ api: () => Response.json({ code: 'MESSAGE_THROTTLED_OUT' }, { status: 429, headers: { 'Retry-After': '30' } }) }), OWNER, body);
    assertEquals([b.status, b.body.code, b.body.retry_after, b.body.message], [503, 'hmrc_busy', 30, 'HMRC is busy right now. Please try again in 30 seconds.'], name);
    const w = await world({ api: () => { throw new DOMException('timed out', 'TimeoutError'); } });
    const t = await run(fn, w, OWNER, body);
    assertEquals(t.body.code, 'hmrc_unavailable', name);
    assertEquals(hmrcCalls(w).length, 1, `${name}: a timeout is not retried`);
    noSecrets(w);
    const s = await world();
    const d = deps(s);
    let signal: AbortSignal | undefined;
    const f = d.fetch;
    d.fetch = async (input: string | URL | Request, init?: RequestInit) => { if (String(input).includes('/organisations/vat/')) signal = init?.signal ?? undefined; return f(input, init); };
    await fn({ authHeader: `Bearer ${jwt(OWNER)}`, headers: new Headers(), body: { company_id: CO, ...body } }, d);
    assert(signal instanceof AbortSignal, name);
  }
});

Deno.test('P8 401: one token refresh and one retry of the GET (as for obligations), then "connect again"', async () => {
  let n = 0;
  const w = await world({ api: () => (n++ === 0 ? Response.json({ code: 'INVALID_CREDENTIALS' }, { status: 401 }) : Response.json(HMRC_PAYMENTS)) });
  const ok = await run(vatPayments, w, OWNER, { from: '2026-01-01', to: '2026-02-01' });
  assertEquals(ok.status, 200);
  assertEquals(hmrcCalls(w).length, 2);
  const dead = await world({ api: () => Response.json({ code: 'INVALID_CREDENTIALS' }, { status: 401 }) });
  const r = await run(vatPenalties, dead, OWNER);
  assertEquals(r.body.code, 'needs_reconnect');
  assertEquals(dead.connection!.status, 'needs_reconnect');
  noSecrets(dead);
});

Deno.test('P8 a demo person is refused (403) before anything runs', async () => {
  for (const [name, fn, body] of READS) {
    const w = await world();
    const handler = withDemoGuard((req: Request) => fn({ authHeader: req.headers.get('authorization'), headers: req.headers, body: { company_id: CO, ...body } }, deps(w)).then((r) => Response.json(r.body, { status: r.status })), {
      deps: { env: (k) => ({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' } as Record<string, string>)[k], fetch: async () => Response.json([{ user_id: DEMO }]) },
    });
    const res = await handler(new Request('https://fn.test', { method: 'POST', headers: { Authorization: `Bearer ${jwt(DEMO)}` } }));
    assertEquals(res.status, 403, name);
    assertEquals((await res.json()).code, 'demo_readonly');
    assertEquals(w.calls.length, 0);
    assertEquals(w.audit.length, 0);
  }
});

Deno.test('P8 the four functions: GET only to HMRC, JWT on, sandbox only; nothing stored', async () => {
  const src = await Deno.readTextFile(new URL('./vatReads.ts', import.meta.url));
  assert(!/method: 'POST'/.test(src), 'no POST to HMRC');
  assert(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(src), 'no database write (the audit goes through the store)');
  const toml = await Deno.readTextFile(new URL('../../../config.toml', import.meta.url));
  for (const n of ['hmrc-vat-return-view', 'hmrc-vat-liabilities', 'hmrc-vat-payments', 'hmrc-vat-penalties']) {
    assert(new RegExp(`\\[functions\\.${n}\\]\\nverify_jwt = true`).test(toml), `${n}: verify_jwt = true`);
    const idx = await Deno.readTextFile(new URL(`../../${n}/index.ts`, import.meta.url));
    assert(/serveVatRead\(/.test(idx), `${n}: the guarded wrapper`);
  }
});
