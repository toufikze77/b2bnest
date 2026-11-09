// HMRC P8: read what HMRC holds for the company, live from HMRC's sandbox (docs/hmrc-p8/README.md). Four reads, each
// its own Edge Function, all following hmrc-vat-obligations (vatObligations.ts):
//   hmrc-vat-return-view   GET /organisations/vat/{vrn}/returns/{periodKey}       compares the nine boxes with our copy
//   hmrc-vat-liabilities   GET /organisations/vat/{vrn}/liabilities?from&to
//   hmrc-vat-payments      GET /organisations/vat/{vrn}/payments?from&to
//   hmrc-vat-penalties     GET /organisations/vat/{vrn}/penalties
// VERIFIED 8 Nov 2026 against HMRC's published VAT (MTD) API 1.0 definition (OpenAPI 3.0.3,
// https://raw.githubusercontent.com/hmrc/vat-api/main/resources/public/api/conf/1.0/application.yaml): every one is
// user-restricted with scope read:vat (already granted at connect: no new scope).
//
// Rules: GET only. Sandbox only (readConfig refuses production). Owners and admins (trial, Business or Scale, not
// suspended; aal2 when enrolled; demo refused by the guard). One audit row before the call (<kind>_call, written by
// hmrc_take_read_slot, which also enforces 10 an hour per company for each kind) and one after (<kind>_result: a code).
// The call has a 20 s timeout and is never retried (except the shared one-off token refresh on a 401, as for
// obligations). Nothing HMRC returns is stored. Never logged or returned: a token, an HMRC response body, or the VAT
// number beyond its last 3 digits. Only whitelisted, well-formed fields are passed on.
import { readConfig, type HmrcEnvironment } from './config.ts';
import { canManage, identify, isUuid } from './caller.ts';
import { busy, done, fail, type HandlerResult } from './errors.ts';
import { buildFraudHeaders, clientIpFrom, publicIp, readBrowserFraudData } from './fraudHeaders.ts';
import { sha256Hex } from './crypto.ts';
import { callHmrc, type CallResult } from './api.ts';
import { cleanVrn, dayOf, OBLIGATIONS_TIMEOUT_MS, type VatDeps, vrnLast3 } from './vatObligations.ts';

export type ReadKind = 'vat_return_view' | 'vat_liabilities' | 'vat_payments' | 'vat_penalties';
export const READ_KINDS: readonly ReadKind[] = ['vat_return_view', 'vat_liabilities', 'vat_payments', 'vat_penalties'];
export const READS_TIMEOUT_MS = OBLIGATIONS_TIMEOUT_MS;
/** HMRC: "The maximum date range is 365 days" (liabilities, payments). */
export const MAX_READ_RANGE_DAYS = 365;

/** Our stored copy of an accepted submission (hmrc_vat_submissions), for the comparison. */
export interface StoredReturn { period_key: string; period_start: string; period_end: string; figures: Record<string, unknown>; form_bundle_number: string | null }
export interface ReadStore {
  /** hmrc_take_read_slot: 'not_available' when the HMRC P8 database update isn't applied yet. */
  takeReadSlot(companyId: string, userId: string, environment: HmrcEnvironment, kind: ReadKind): Promise<'ok' | 'limit' | 'not_available'>;
  /** The newest ACCEPTED submission for the period, or null. */
  storedReturn(companyId: string, environment: HmrcEnvironment, periodKey: string): Promise<StoredReturn | null>;
}
export interface ReadDeps extends VatDeps { reads: ReadStore }

// --- the documented sandbox scenarios (Gov-Test-Scenario), allow-listed ------------------------------------------
export const RETURN_VIEW_SCENARIOS = ['DATE_RANGE_TOO_LARGE', 'INSOLVENT_TRADER'] as const;
export const LIABILITY_SCENARIOS = ['SINGLE_LIABILITY', 'MULTIPLE_LIABILITIES', 'SINGLE_LIABILITY_2018_19', 'MULTIPLE_LIABILITIES_2018_19', 'INSOLVENT_TRADER'] as const;
export const PAYMENT_SCENARIOS = ['SINGLE_PAYMENT', 'MULTIPLE_PAYMENTS', 'SINGLE_PAYMENT_2018_19', 'MULTIPLE_PAYMENTS_2018_19', 'INSOLVENT_TRADER'] as const;
export const PENALTY_SCENARIOS = ['DEFAULT', 'NO_PENALTIES', 'LATE_SUBMISSION', 'LATE_PAYMENT', 'MULTIPLE_PENALTIES', 'MULTIPLE_LATE_PAYMENT_PENALTIES',
  'MULTIPLE_LATE_SUBMISSION_PENALTIES', 'MULTIPLE_INACTIVE_LATE_SUBMISSION_PENALTIES', 'THRESHOLD_LATE_SUBMISSION_PENALTIES', 'CHARGE_LATE_SUBMISSION_PENALTIES'] as const;

export const PENALTIES_NOTE = 'This is what HMRC shows. Check your HMRC account for the final position.';

const scenarioOk = (list: readonly string[], v: unknown) => v === undefined || v === null || v === '' || list.includes(v as string);
const scenarioOf = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const PERIOD_KEY = /^[A-Za-z0-9#]{4}$/;

// --- input ---------------------------------------------------------------------------------------------------------
export type RangeQuery = { from: string; to: string; scenario?: string };
/** from and to both required, real dates, from ≤ to ≤ today, at most 365 days. */
export function readRange(body: Record<string, unknown>, scenarios: readonly string[], today: Date): RangeQuery | null {
  const { from, to, scenario } = body;
  if (!scenarioOk(scenarios, scenario)) return null;
  const a = dayOf(from), b = dayOf(to);
  const t = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / 86_400_000);
  if (a === null || b === null || b < a || b > t || b - a + 1 > MAX_READ_RANGE_DAYS) return null;
  const s = scenarioOf(scenario);
  return { from: from as string, to: to as string, ...(s ? { scenario: s } : {}) };
}
export function readPeriod(body: Record<string, unknown>): { periodKey: string; scenario?: string } | null {
  const { period_key: pk, scenario } = body;
  if (typeof pk !== 'string' || !PERIOD_KEY.test(pk) || !scenarioOk(RETURN_VIEW_SCENARIOS, scenario)) return null;
  const s = scenarioOf(scenario);
  return { periodKey: pk, ...(s ? { scenario: s } : {}) };
}

// --- normalisers: well-formed, whitelisted fields only ------------------------------------------------------------
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e13 ? v : null);
const day = (v: unknown): string | null => (dayOf(v) !== null ? (v as string) : null);
const text = (v: unknown, max = 60): string | null => (typeof v === 'string' && v.length <= max && /^[\w .,'()&/:#+-]*$/.test(v) ? v : null);

export interface Liability { taxPeriod: { from: string; to: string } | null; type: string; originalAmount: number; outstandingAmount: number | null; due: string | null }
export function normaliseLiabilities(body: unknown): { liabilities: Liability[]; dropped: number } {
  const list = body && typeof body === 'object' ? (body as { liabilities?: unknown }).liabilities : null;
  if (!Array.isArray(list)) return { liabilities: [], dropped: 0 };
  const out: Liability[] = [];
  for (const x of list.slice(0, 500)) {
    const o = (x ?? {}) as Record<string, unknown>;
    const type = text(o.type, 80), original = num(o.originalAmount);
    if (!type || original === null) continue;
    const tp = (o.taxPeriod ?? null) as Record<string, unknown> | null;
    const from = tp ? day(tp.from) : null, to = tp ? day(tp.to) : null;
    out.push({ taxPeriod: from && to ? { from, to } : null, type, originalAmount: original, outstandingAmount: num(o.outstandingAmount), due: day(o.due) });
  }
  return { liabilities: out, dropped: Math.min(list.length, 500) - out.length };
}

export interface Payment { amount: number; received: string | null }
export function normalisePayments(body: unknown): { payments: Payment[]; dropped: number } {
  const list = body && typeof body === 'object' ? (body as { payments?: unknown }).payments : null;
  if (!Array.isArray(list)) return { payments: [], dropped: 0 };
  const out: Payment[] = [];
  for (const x of list.slice(0, 500)) {
    const o = (x ?? {}) as Record<string, unknown>;
    const amount = num(o.amount);
    if (amount === null) continue;
    out.push({ amount, received: day(o.received) });
  }
  return { payments: out, dropped: Math.min(list.length, 500) - out.length };
}

// HMRC's penalties schema and its own example disagree on some detail fields (docs/hmrc-p8/README.md), so both sets
// are whitelisted; anything else is dropped. Strings are short codes, references and dates; numbers are amounts.
const TOTALS = ['lateSubmissionPenaltyTotalValue', 'penalisedPrincipalTotal', 'latePaymentPenaltyPostedTotal', 'latePaymentPenaltyEstimateTotal'] as const;
const LSP_SUMMARY = ['activePenaltyPoints', 'inactivePenaltyPoints', 'periodOfComplianceAchievement', 'regimeThreshold', 'penaltyChargeAmount'] as const;
const LSP_DETAIL = ['penaltyNumber', 'penaltyOrder', 'penaltyCategory', 'penaltyStatus', 'penaltyCreationDate', 'penaltyExpiryDate', 'expiryReason',
  'communicationsDate', 'chargeReference', 'chargeAmount', 'chargeOutstandingAmount', 'chargeDueDate',
  'lateSubmissionID', 'taxReturnStatus', 'taxPeriodStartDate', 'taxPeriodEndDate', 'taxPeriodDueDate', 'returnReceiptDate'] as const;
const LPP_DETAIL = ['principalChargeReference', 'penaltyCategory', 'penaltyStatus', 'penaltyAmountAccruing', 'penaltyAmountPosted', 'penaltyAmountPaid',
  'penaltyAmountOutstanding', 'penaltyChargeReference', 'penaltyChargeDueDate', 'principalChargeBillingFrom', 'principalChargeBillingTo',
  'principalChargeDueDate', 'communicationsDate', 'penaltyChargeCreationDate', 'principalChargeLatestClearing', 'timeToPay'] as const;
type Flat = Record<string, string | number | boolean>;
function pick(o: unknown, keys: readonly string[]): Flat {
  const src = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
  const out: Flat = {};
  for (const k of keys) {
    const v = src[k];
    if (typeof v === 'boolean') out[k] = v;
    else if (num(v) !== null) out[k] = v as number;
    else if (text(v) !== null) out[k] = v as string;
  }
  return out;
}
const details = (o: unknown, keys: readonly string[]) => {
  const d = o && typeof o === 'object' ? (o as { details?: unknown }).details : null;
  return Array.isArray(d) ? d.slice(0, 100).map((x) => pick(x, keys)).filter((x) => Object.keys(x).length > 0) : [];
};
export interface Penalties { totalisations: Flat; lateSubmission: { summary: Flat; details: Flat[] }; latePayment: { details: Flat[] } }
export function normalisePenalties(body: unknown): Penalties {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const lsp = (b.lateSubmissionPenalty ?? {}) as Record<string, unknown>;
  return {
    totalisations: pick(b.totalisations, TOTALS),
    lateSubmission: { summary: pick(lsp.summary, LSP_SUMMARY), details: details(lsp, LSP_DETAIL) },
    latePayment: { details: details(b.latePaymentPenalty, LPP_DETAIL) },
  };
}

// --- the nine boxes: HMRC's copy against ours ----------------------------------------------------------------------
export const BOX_FIELDS = ['vatDueSales', 'vatDueAcquisitions', 'totalVatDue', 'vatReclaimedCurrPeriod', 'netVatDue',
  'totalValueSalesExVAT', 'totalValuePurchasesExVAT', 'totalValueGoodsSuppliedExVAT', 'totalAcquisitionsExVAT'] as const;
export interface BoxDifference { box: number; field: string; ours: number | null; hmrc: number | null }
/** Same to the penny counts as matching. A box missing on either side is a difference. */
export function compareBoxes(ours: Record<string, unknown>, hmrc: unknown): { matches: boolean; differences: BoxDifference[] } {
  const h = (hmrc && typeof hmrc === 'object' ? hmrc : {}) as Record<string, unknown>;
  const differences: BoxDifference[] = [];
  BOX_FIELDS.forEach((field, i) => {
    const a = num(ours[field]), b = num(h[field]);
    if (a === null || b === null || Math.round(a * 100) !== Math.round(b * 100)) differences.push({ box: i + 1, field, ours: a, hmrc: b });
  });
  return { matches: differences.length === 0, differences };
}

// --- the shared flow -----------------------------------------------------------------------------------------------
const lowerCode = (c: string | undefined) => (c ? c.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 60) : '');
type Req = { authHeader: string | null; headers: Headers; body: Record<string, unknown> };
interface Spec<Q> {
  kind: ReadKind;
  parse(body: Record<string, unknown>, today: Date): Q | null;
  /** Runs after the access checks and before the slot (for example: we never sent this period). */
  precheck?(ctx: { companyId: string; env: HmrcEnvironment; q: Q }): Promise<HandlerResult | Record<string, unknown> | null>;
  path(vrn: string, q: Q): string;
  logPath: string;
  query?(q: Q): Record<string, string>;
  scenario(q: Q): string | undefined;
  /** HMRC's 404: what it means for this read (null: a refusal). */
  notFound?(q: Q, base: Record<string, unknown>): { result: HandlerResult; outcome: string };
  /** HMRC's codes for this read beyond the shared ones. */
  codes?: Record<string, Parameters<typeof fail>[0]>;
  ok(body: unknown, q: Q, ctx: Record<string, unknown>, base: Record<string, unknown>, deps: ReadDeps): { result: HandlerResult; outcome: string };
}

function mapFailure(r: CallResult, codes: Record<string, Parameters<typeof fail>[0]>): HandlerResult {
  if (r.reason === 'not_configured') return fail('not_configured');
  if (r.reason === 'needs_reconnect') return fail('needs_reconnect');
  if (r.reason === 'not_connected') return fail('not_connected');
  if (r.reason === 'plan_not_included') return fail('plan_not_included');
  if (r.reason === 'hmrc_rate_limited') return busy(r.retryAfter);
  if (r.reason === 'hmrc_unavailable' || r.reason === 'network') return fail('hmrc_unavailable');
  const code = r.hmrcCode ?? '';
  if (code === 'INVALID_SCOPE') return fail('scope_missing');
  if (code === 'CLIENT_OR_AGENT_NOT_AUTHORISED') return fail('vat_not_authorised');
  if (code === 'RULE_INSOLVENT_TRADER') return fail('vat_insolvent');
  if (code === 'VRN_INVALID') return fail('vrn_invalid');
  if (codes[code]) return fail(codes[code]);
  // HMRC P7c: a 400 may carry its real codes in a nested errors array.
  const nested = (r.hmrcErrors ?? []).find((c) => codes[c] || c === 'VRN_INVALID');
  if (nested) return fail(nested === 'VRN_INVALID' ? 'vrn_invalid' : codes[nested]);
  if (r.status === 400) return fail('bad_request');
  return { status: 502, body: { ok: false, code: 'hmrc_refused', message: "HMRC didn't accept the request.", hmrc_code: r.hmrcCode ?? null, http_status: r.status } };
}

export async function vatRead<Q>(spec: Spec<Q>, req: Req, deps: ReadDeps): Promise<HandlerResult> {
  const cfg = readConfig(deps.env);
  if (!cfg.ok || cfg.config.environment !== 'sandbox') return fail('not_configured'); // production stays refused
  const env = cfg.config.environment;
  const who = await identify(req.authHeader, deps.caller);
  if (typeof who === 'string') return fail(who);
  const companyId = req.body.company_id;
  if (!isUuid(companyId)) return fail('bad_request');
  const q = spec.parse(req.body, deps.now());
  if (!q) return fail('bad_request');
  const rule = await canManage(deps.store, companyId, who.userId);
  if (rule !== 'ok') {
    await deps.store.audit({ company_id: companyId, user_id: who.userId, environment: env, event: 'refused', reason: rule }).catch(() => deps.log('audit_failed'));
    return fail(rule);
  }
  const c = await deps.store.getConnection(companyId, env);
  if (!c || c.status === 'disconnected' || !c.access_token_enc) return fail('not_connected');
  if (c.status === 'needs_reconnect') return fail('needs_reconnect');
  if (!c.scopes.includes('read:vat')) return fail('scope_missing');
  const vrn = cleanVrn(await deps.store.vatNumberFor(companyId, who.userId));
  if (!vrn) return fail('vrn_missing');
  let ctx: Record<string, unknown> = {};
  if (spec.precheck) {
    const pre = await spec.precheck({ companyId, env, q });
    if (pre && 'status' in pre && typeof pre.status === 'number' && 'body' in pre) return pre as HandlerResult;
    ctx = (pre ?? {}) as Record<string, unknown>;
  }
  const slot = await deps.reads.takeReadSlot(companyId, who.userId, env, spec.kind);
  if (slot === 'not_available') return fail('not_available');
  if (slot === 'limit') return fail('read_limit');

  const fraud = buildFraudHeaders(readBrowserFraudData(req.body.fraud), {
    clientPublicIp: clientIpFrom(req.headers),
    receivedAt: deps.now(),
    clientPublicPort: null, // not available to Supabase Edge Functions (docs/hmrc-p1-p2)
    vendorPublicIp: publicIp(deps.env('HMRC_VENDOR_PUBLIC_IP')),
    userId: who.userId,
    mfa: who.totpAt && who.totpFactorIds.length
      ? { type: 'TOTP', at: who.totpAt, uniqueReference: await sha256Hex(`b2bnest-mfa:${who.totpFactorIds.join(',')}`) }
      : null,
  });
  const r = await callHmrc({
    companyId, userId: who.userId, method: 'GET', path: spec.path(vrn, q), logPath: spec.logPath, query: spec.query?.(q) ?? {},
    version: '1.0', tokenKind: 'user', fraudHeaders: fraud.headers, testScenario: spec.scenario(q), timeoutMs: READS_TIMEOUT_MS,
  }, deps);

  const base = { environment: env, vrn_last3: vrnLast3(vrn), scenario: spec.scenario(q) ?? null, omitted: fraud.omitted, fetched_at: deps.now().toISOString() };
  let result: HandlerResult, outcome: string;
  if (r.ok) ({ result, outcome } = spec.ok(r.body, q, ctx, base, deps));
  else if (r.status === 404 && (r.hmrcCode === 'NOT_FOUND' || !r.hmrcCode) && spec.notFound) ({ result, outcome } = spec.notFound(q, base));
  else { result = mapFailure(r, spec.codes ?? {}); outcome = lowerCode(r.hmrcCode) || r.reason || String(r.status); }
  await deps.store.audit({ company_id: companyId, user_id: who.userId, environment: env, event: `${spec.kind}_result`, reason: outcome.slice(0, 60) })
    .catch(() => deps.log('audit_failed'));
  return result;
}

// --- the four reads -------------------------------------------------------------------------------------------------
export const RETURN_VIEW_API = { path: (vrn: string, pk: string) => `/organisations/vat/${vrn}/returns/${encodeURIComponent(pk)}`, logPath: '/organisations/vat/{vrn}/returns/{periodKey}' };
export const LIABILITIES_API = { path: (vrn: string) => `/organisations/vat/${vrn}/liabilities`, logPath: '/organisations/vat/{vrn}/liabilities' };
export const PAYMENTS_API = { path: (vrn: string) => `/organisations/vat/${vrn}/payments`, logPath: '/organisations/vat/{vrn}/payments' };
export const PENALTIES_API = { path: (vrn: string) => `/organisations/vat/${vrn}/penalties`, logPath: '/organisations/vat/{vrn}/penalties' };
const DATE_CODES = { DATE_FROM_INVALID: 'dates_invalid', DATE_TO_INVALID: 'dates_invalid', DATE_RANGE_INVALID: 'dates_invalid' } as const;

/** hmrc-vat-return-view: what HMRC holds for a period we sent, against our stored copy. Writes nothing but the audit. */
export const vatReturnView = (req: Req, deps: ReadDeps) => vatRead<{ periodKey: string; scenario?: string }>({
  kind: 'vat_return_view',
  parse: (b) => readPeriod(b),
  async precheck({ companyId, env, q }) {
    const stored = await deps.reads.storedReturn(companyId, env, q.periodKey);
    return stored ? { stored } : fail('not_submitted');
  },
  path: (vrn, q) => RETURN_VIEW_API.path(vrn, q.periodKey), logPath: RETURN_VIEW_API.logPath, scenario: (q) => q.scenario,
  notFound: () => ({ result: fail('return_not_found'), outcome: 'not_found' }),
  codes: { PERIOD_KEY_INVALID: 'bad_request', DATE_RANGE_TOO_LARGE: 'bad_request' },
  ok(body, q, ctx, base) {
    const stored = ctx.stored as StoredReturn;
    const cmp = compareBoxes(stored.figures ?? {}, body);
    return {
      result: done({ ...base, period_key: q.periodKey, period_start: stored.period_start, period_end: stored.period_end, form_bundle_number: stored.form_bundle_number, ...cmp }),
      outcome: cmp.matches ? 'matches' : 'differs',
    };
  },
}, req, deps);

export const vatLiabilities = (req: Req, deps: ReadDeps) => vatRead<RangeQuery>({
  kind: 'vat_liabilities',
  parse: (b, today) => readRange(b, LIABILITY_SCENARIOS, today),
  path: (vrn) => LIABILITIES_API.path(vrn), logPath: LIABILITIES_API.logPath, query: (q) => ({ from: q.from, to: q.to }), scenario: (q) => q.scenario,
  notFound: (q, base) => ({ result: done({ ...base, from: q.from, to: q.to, liabilities: [] }), outcome: 'not_found' }),
  codes: DATE_CODES,
  ok(body, q, _ctx, base, deps) {
    const { liabilities, dropped } = normaliseLiabilities(body);
    if (dropped) deps.log('liabilities_dropped', { count: dropped });
    return { result: done({ ...base, from: q.from, to: q.to, liabilities }), outcome: 'ok' };
  },
}, req, deps);

export const vatPayments = (req: Req, deps: ReadDeps) => vatRead<RangeQuery>({
  kind: 'vat_payments',
  parse: (b, today) => readRange(b, PAYMENT_SCENARIOS, today),
  path: (vrn) => PAYMENTS_API.path(vrn), logPath: PAYMENTS_API.logPath, query: (q) => ({ from: q.from, to: q.to }), scenario: (q) => q.scenario,
  notFound: (q, base) => ({ result: done({ ...base, from: q.from, to: q.to, payments: [] }), outcome: 'not_found' }),
  codes: DATE_CODES,
  ok(body, q, _ctx, base, deps) {
    const { payments, dropped } = normalisePayments(body);
    if (dropped) deps.log('payments_dropped', { count: dropped });
    return { result: done({ ...base, from: q.from, to: q.to, payments }), outcome: 'ok' };
  },
}, req, deps);

export const vatPenalties = (req: Req, deps: ReadDeps) => vatRead<{ scenario?: string }>({
  kind: 'vat_penalties',
  parse: (b) => (scenarioOk(PENALTY_SCENARIOS, b.scenario) ? (scenarioOf(b.scenario) ? { scenario: b.scenario as string } : {}) : null),
  path: (vrn) => PENALTIES_API.path(vrn), logPath: PENALTIES_API.logPath, scenario: (q) => q.scenario,
  ok(body, _q, _ctx, base) {
    return { result: done({ ...base, penalties: normalisePenalties(body), note: PENALTIES_NOTE }), outcome: 'ok' };
  },
}, req, deps);

// --- the database side (service role) -------------------------------------------------------------------------------
type Result = PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
type Query = Result & { [k: string]: (...a: unknown[]) => Query };
type Sb = { rpc: (fn: string, args: Record<string, unknown>) => Result; from: (t: string) => Query };
const missing = (e: { code?: string; message?: string }) => e.code === 'PGRST202' || e.code === '42883' || /could not find the function/i.test(e.message ?? '');

export function supabaseReadStore(admin: Sb): ReadStore {
  return {
    async takeReadSlot(companyId, userId, environment, kind) {
      const { data, error } = await admin.rpc('hmrc_take_read_slot', { p_company: companyId, p_user: userId, p_environment: environment, p_kind: kind });
      if (error) {
        if (missing(error)) return 'not_available';
        throw new Error(`hmrc_take_read_slot failed (${error.code ?? 'error'})`);
      }
      return data === true ? 'ok' : 'limit';
    },
    async storedReturn(companyId, environment, periodKey) {
      const { data, error } = await admin.from('hmrc_vat_submissions')
        .select('period_key, period_start, period_end, figures, form_bundle_number')
        .eq('organization_id', companyId).eq('environment', environment).eq('period_key', periodKey).eq('status', 'accepted')
        .order('submitted_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error(`hmrc_vat_submissions select failed (${error.code ?? 'error'})`);
      return (data as StoredReturn | null) ?? null;
    },
  };
}
