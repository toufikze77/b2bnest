// HMRC P6: hmrc-vat-submit. An owner or admin (trial, Business or Scale, not suspended; aal2 when they have an
// authenticator) submits a VAT return for an OPEN obligation to HMRC's TEST environment (sandbox) only. Production stays
// refused (readConfig): there is no production path here at all.
//   prepare: read the open obligations live, recompute the nine boxes on the server (the P5 SQL function with the
//            caller's own JWT, then the shared box maths), and return them with a 10-minute signed confirmation token.
//   submit:  check the token and the declaration, recompute (refuse "figures_changed" if anything moved), take the rate
//            limit and write the 'submitting' row in one database call (the unique index stops a second live one),
//            POST once (never retried), record accepted / rejected / unknown.
//   check:   for an 'unknown' outcome, read the obligation live: fulfilled → accepted (no receipt); still open → the
//            person may record "HMRC did not receive it" (→ rejected), which allows one new attempt.
// Never logged or returned: a token, a bearer value, the full VAT number, or an HMRC response body.
import { readConfig } from './config.ts';
import { canManage, type CallerDeps, identify, isUuid, jwtFrom } from './caller.ts';
import { busy, done, fail, type HandlerResult } from './errors.ts';
import { buildFraudHeaders, clientIpFrom, publicIp, readBrowserFraudData } from './fraudHeaders.ts';
import { b64url, sha256Hex } from './crypto.ts';
import { callHmrc, type CallDeps } from './api.ts';
import { cleanVrn, normalise, OBLIGATIONS_API, OBLIGATIONS_TIMEOUT_MS, vrnLast3, type Obligation } from './vatObligations.ts';
import { computeReturnBoxes, type PreviewRow, type ReturnBoxes } from '../vat/returnBoxes.ts';

// ---------------------------------------------------------------------------------------------------------------------
// HMRC facts, from memory, NOT VERIFIED (this environment can't open HMRC's pages). One place, easy to change.
// docs/hmrc-p6/README.md lists each one.
/** POST /organisations/vat/{vrn}/returns, scope write:vat, Accept application/vnd.hmrc.1.0+json. NOT VERIFIED. */
export const VAT_RETURN_API = { version: '1.0', path: (vrn: string) => `/organisations/vat/${vrn}/returns`, logPath: '/organisations/vat/{vrn}/returns', scope: 'write:vat' } as const;
/** Sandbox Gov-Test-Scenario values for this endpoint (owner's test picker). HMRC P7c: verified 8 Nov 2026 against HMRC's
 *  published definition (github.com/hmrc/vat-api, resources/public/api/conf/1.0/application.yaml). */
export const SUBMIT_SCENARIOS = ['INVALID_VRN', 'INVALID_PERIODKEY', 'INVALID_PAYLOAD', 'DUPLICATE_SUBMISSION', 'TAX_PERIOD_NOT_ENDED', 'INSOLVENT_TRADER'] as const;
/**
 * HMRC's error codes for a submission → a stable code of ours and plain words. HMRC P7c: checked 8 Nov 2026 against the
 * same definition (docs/hmrc-p7/error-handling.md). Documented for POST returns: 400 VRN_INVALID, PERIOD_KEY_INVALID,
 * INVALID_REQUEST (with a nested errors list: PERIOD_KEY_INVALID, VAT_TOTAL_VALUE, VAT_NET_VALUE, INVALID_NUMERIC_VALUE,
 * INVALID_MONETARY_AMOUNT, MANDATORY_FIELD_MISSING); 403 NOT_FINALISED, DUPLICATE_SUBMISSION, TAX_PERIOD_NOT_ENDED,
 * CLIENT_OR_AGENT_NOT_AUTHORISED, RULE_INSOLVENT_TRADER. NOT_FOUND, INVALID_SCOPE and MATCHING_RESOURCE_NOT_FOUND are
 * HMRC's general platform errors (the reference guide could not be fetched): kept, marked "memory, not verified".
 */
export const HMRC_SUBMIT_ERRORS: Record<string, { code: string; message: string }> = {
  DUPLICATE_SUBMISSION: { code: 'duplicate_submission', message: 'HMRC says a return for this period has already been submitted.' },
  TAX_PERIOD_NOT_ENDED: { code: 'period_not_ended', message: "HMRC says this VAT period hasn't ended yet. Submit it after the period ends." },
  PERIOD_KEY_INVALID: { code: 'invalid_period_key', message: "HMRC didn't recognise this VAT period." },
  RULE_INSOLVENT_TRADER: { code: 'insolvent_trader', message: "HMRC can't accept a VAT return for this business through this service." },
  NOT_FOUND: { code: 'not_found', message: "HMRC couldn't find this VAT registration or period." },
  VRN_INVALID: { code: 'vrn_invalid', message: "HMRC didn't accept this VAT number. Check it in Settings → HMRC." },
  CLIENT_OR_AGENT_NOT_AUTHORISED: { code: 'vat_not_authorised', message: "HMRC says this HMRC sign-in can't send VAT returns for this VAT number." },
  INVALID_SCOPE: { code: 'scope_missing', message: 'Connect to HMRC again: submitting a VAT return needs one more permission (test environment only).' },
  INVALID_REQUEST: { code: 'invalid_return', message: 'HMRC said the return is not in the right form. Nothing was filed.' },
  INVALID_MONETARY_AMOUNT: { code: 'invalid_return', message: 'HMRC said the return is not in the right form. Nothing was filed.' },
  NOT_FINALISED: { code: 'invalid_return', message: 'HMRC said the return is not in the right form. Nothing was filed.' },
  INVALID_NUMERIC_VALUE: { code: 'invalid_return', message: 'HMRC said the return is not in the right form. Nothing was filed.' },
  VAT_TOTAL_VALUE: { code: 'invalid_return', message: 'HMRC said the boxes do not add up. Nothing was filed.' },
  VAT_NET_VALUE: { code: 'invalid_return', message: 'HMRC said the boxes do not add up. Nothing was filed.' },
  MANDATORY_FIELD_MISSING: { code: 'invalid_return', message: 'HMRC said a box was missing from the return. Nothing was filed.' },
  MATCHING_RESOURCE_NOT_FOUND: { code: 'not_found', message: "HMRC couldn't find this VAT registration or period." },
};
/** Nested codes inside INVALID_REQUEST, most useful first ("the boxes do not add up" before a general format error). */
export const NESTED_PRIORITY = ['VAT_TOTAL_VALUE', 'VAT_NET_VALUE', 'PERIOD_KEY_INVALID', 'MANDATORY_FIELD_MISSING', 'INVALID_NUMERIC_VALUE', 'INVALID_MONETARY_AMOUNT'] as const;
// ---------------------------------------------------------------------------------------------------------------------

export const CONFIRM_SECRET_ENV = 'HMRC_VAT_CONFIRM_SECRET';
export const CONFIRM_TTL_MS = 10 * 60 * 1000;
export const SUBMIT_TIMEOUT_MS = 30_000;
export const SUBMIT_LIMIT = 5;
export const DECLARATION = "I confirm that the information in this return is correct and complete to the best of my knowledge. I understand this is a submission to HMRC's test environment.";

/** Our own codes for this function (plain words for the screen). */
export const SUBMIT_MESSAGES: Record<string, string> = {
  submit_not_configured: "VAT submission to HMRC's test environment isn't set up yet.",
  obligation_not_open: "This period isn't an open VAT obligation at HMRC. Get the obligations again and choose an open one.",
  period_not_ended: "This VAT period hasn't ended yet. Submit it after the period ends.",
  records_need_attention: 'Some records dated in this period have no VAT details or no company. Fix them first (see "Left out").',
  preview_not_available: 'The VAT return preview is not available yet.',
  preview_denied: 'Only owners and admins can see and submit the VAT return.',
  confirmation_required: 'Tick the declaration and type the period key to confirm.',
  confirmation_invalid: 'This confirmation is not valid. Prepare the return again.',
  confirmation_expired: 'This confirmation has expired (10 minutes). Prepare the return again.',
  figures_changed: 'Your records changed: review the return again.',
  already_submitting: 'This return is already being submitted. Wait for the result.',
  already_submitted: 'HMRC already accepted a return for this period. It is in the submission history.',
  outcome_unknown: "We don't know if HMRC received the last attempt for this period. Do not submit again: use Check with HMRC.",
  submit_limit: 'You can submit 5 times an hour for this company. Please try again later.',
  nothing_to_check: 'There is no submission with an unknown result for this period.',
  scope_missing: 'Connect to HMRC again: submitting a VAT return needs one more permission (test environment only).',
  hmrc_busy: 'HMRC is busy right now. Nothing was filed. Please try again in a minute.',
  hmrc_unauthorised: 'HMRC refused the sign-in. An owner or admin needs to connect again. Nothing was filed.',
  not_sent: "The return wasn't sent: HMRC couldn't be reached before sending. Nothing was filed. Please try again.",
  invalid_return: 'HMRC said the return is not in the right form. Nothing was filed.',
  hmrc_rejected: "HMRC didn't accept the return. Nothing was filed.",
};
const failS = (code: string, status = 409, extra: Record<string, unknown> = {}): HandlerResult => ({ status, body: { ok: false, code, message: SUBMIT_MESSAGES[code] ?? SUBMIT_MESSAGES.hmrc_rejected, ...extra } });

export interface SubmissionRow {
  id: string; status: 'submitting' | 'accepted' | 'rejected' | 'unknown'; period_key: string; period_start: string; period_end: string; figures_hash: string;
  form_bundle_number?: string | null; processing_date?: string | null;
}
export interface SubmitStore {
  begin(row: { company_id: string; user_id: string; environment: 'sandbox'; period_key: string; period_start: string; period_end: string; figures: Record<string, unknown>;
    figures_hash: string; request_id: string; vrn_last3: string; test_scenario: string | null; user_name: string | null; limit: number }): Promise<{ result: 'ok' | 'limit' | 'already_live' | 'bad_request'; id: string | null }>;
  finish(id: string, patch: Record<string, unknown>): Promise<void>;
  /** The live row (submitting, unknown or accepted) for the period, if any. */
  live(companyId: string, environment: 'sandbox', periodKey: string): Promise<SubmissionRow | null>;
  displayName(userId: string): Promise<string | null>;
}
export type PreviewResult = { ok: true; rows: PreviewRow[] } | { ok: false; code: 'preview_not_available' | 'preview_denied' | 'two_step_required' | 'plan_not_included' | 'server_error' };
export interface SubmitDeps extends CallDeps {
  caller: CallerDeps;
  submissions: SubmitStore;
  /** public.vat_company_return_preview with the CALLER's JWT (their own access rules apply). */
  preview(jwt: string, companyId: string, from: string, to: string): Promise<PreviewResult>;
  newId(): string;
}

/** The body HMRC receives: boxes 1-5 in pounds with at most 2 decimals, 6-9 whole pounds, finalised true. */
export function buildReturnBody(periodKey: string, b: ReturnBoxes) {
  const pounds = (pence: number) => Math.round(pence) / 100;
  return {
    periodKey,
    vatDueSales: pounds(b.box1),
    vatDueAcquisitions: pounds(b.box2),
    totalVatDue: pounds(b.box3),
    vatReclaimedCurrPeriod: pounds(b.box4),
    netVatDue: pounds(Math.abs(b.box5)),
    totalValueSalesExVAT: Math.trunc(b.box6),
    totalValuePurchasesExVAT: Math.trunc(b.box7),
    totalValueGoodsSuppliedExVAT: Math.trunc(b.box8),
    totalAcquisitionsExVAT: Math.trunc(b.box9),
    finalised: true as const,
  };
}
export type ReturnBody = ReturnType<typeof buildReturnBody>;
const BODY_KEYS = ['periodKey', 'vatDueSales', 'vatDueAcquisitions', 'totalVatDue', 'vatReclaimedCurrPeriod', 'netVatDue',
  'totalValueSalesExVAT', 'totalValuePurchasesExVAT', 'totalValueGoodsSuppliedExVAT', 'totalAcquisitionsExVAT', 'finalised'] as const;
/** SHA-256 of the body in a fixed key order. */
export const figuresHash = (body: ReturnBody) => sha256Hex(JSON.stringify(BODY_KEYS.map((k) => [k, body[k]])));

// --- the confirmation token: HMAC-SHA256 over company, period, figures hash, person and expiry -----------------------
const enc = new TextEncoder();
async function hmac(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text))));
}
const sameText = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};
export async function makeConfirmation(secret: string, p: { company: string; periodKey: string; hash: string; user: string; expiresAt: number }): Promise<string> {
  const sig = await hmac(secret, ['v1', p.company, p.periodKey, p.hash, p.user, String(p.expiresAt)].join('|'));
  return `v1.${p.expiresAt}.${p.hash}.${sig}`;
}
export async function readConfirmation(secret: string, token: unknown, p: { company: string; periodKey: string; user: string; now: number }):
  Promise<{ ok: true; hash: string } | { ok: false; code: 'confirmation_invalid' | 'confirmation_expired' }> {
  if (typeof token !== 'string' || token.length > 300) return { ok: false, code: 'confirmation_invalid' };
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1' || !/^\d{10,16}$/.test(parts[1]) || !/^[0-9a-f]{64}$/.test(parts[2])) return { ok: false, code: 'confirmation_invalid' };
  const expiresAt = Number(parts[1]);
  const expected = await hmac(secret, ['v1', p.company, p.periodKey, parts[2], p.user, parts[1]].join('|'));
  if (!sameText(expected, parts[3])) return { ok: false, code: 'confirmation_invalid' };
  if (expiresAt <= p.now) return { ok: false, code: 'confirmation_expired' };
  return { ok: true, hash: parts[2] };
}
const confirmSecret = (env: (k: string) => string | undefined) => {
  const s = env(CONFIRM_SECRET_ENV)?.trim();
  return s && s.length >= 32 ? s : null;
};

const ukToday = (now: Date) => now.toISOString().slice(0, 10);
const lowerCode = (c: string | undefined) => (c ? c.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 60) : '');

interface Ctx { env: 'sandbox'; userId: string; jwt: string; companyId: string; vrn: string; fraud: Record<string, string>; omitted: string[] }

/** Everything every action needs: sandbox, the caller, the company rule, the connection with write:vat, the VAT number. */
async function context(req: { authHeader: string | null; headers: Headers; body: Record<string, unknown> }, deps: SubmitDeps): Promise<Ctx | HandlerResult> {
  const cfg = readConfig(deps.env);
  if (!cfg.ok || cfg.config.environment !== 'sandbox') return fail('not_configured'); // production stays refused
  const env = 'sandbox' as const;
  const who = await identify(req.authHeader, deps.caller);
  if (typeof who === 'string') return fail(who);
  const companyId = req.body.company_id;
  if (!isUuid(companyId)) return fail('bad_request');
  const rule = await canManage(deps.store, companyId, who.userId);
  if (rule !== 'ok') {
    await deps.store.audit({ company_id: companyId, user_id: who.userId, environment: env, event: 'refused', reason: rule }).catch(() => deps.log('audit_failed'));
    return fail(rule);
  }
  const c = await deps.store.getConnection(companyId, env);
  if (!c || c.status === 'disconnected' || !c.access_token_enc) return fail('not_connected');
  if (c.status === 'needs_reconnect') return fail('needs_reconnect');
  if (!c.scopes.includes('read:vat') || !c.scopes.includes(VAT_RETURN_API.scope)) return failS('scope_missing');
  const vrn = cleanVrn(await deps.store.vatNumberFor(companyId, who.userId));
  if (!vrn) return fail('vrn_missing');
  const fraud = buildFraudHeaders(readBrowserFraudData(req.body.fraud), {
    clientPublicIp: clientIpFrom(req.headers),
    receivedAt: deps.now(),
    clientPublicPort: null, // not available to Supabase Edge Functions (docs/hmrc-p1-p2): the known gap
    vendorPublicIp: publicIp(deps.env('HMRC_VENDOR_PUBLIC_IP')),
    userId: who.userId,
    mfa: who.totpAt && who.totpFactorIds.length
      ? { type: 'TOTP', at: who.totpAt, uniqueReference: await sha256Hex(`b2bnest-mfa:${who.totpFactorIds.join(',')}`) }
      : null,
  });
  return { env, userId: who.userId, jwt: jwtFrom(req.authHeader) as string, companyId, vrn, fraud: fraud.headers, omitted: fraud.omitted };
}

async function obligations(ctx: Ctx, deps: SubmitDeps, q: Record<string, string>): Promise<{ ok: true; list: Obligation[] } | { ok: false; result: HandlerResult }> {
  const r = await callHmrc({ companyId: ctx.companyId, userId: ctx.userId, method: 'GET', path: OBLIGATIONS_API.path(ctx.vrn), logPath: OBLIGATIONS_API.logPath,
    query: q, version: OBLIGATIONS_API.version, tokenKind: 'user', fraudHeaders: ctx.fraud, timeoutMs: OBLIGATIONS_TIMEOUT_MS }, deps);
  if (r.ok) return { ok: true, list: normalise(r.body).obligations };
  if (r.status === 404 && (!r.hmrcCode || r.hmrcCode === 'NOT_FOUND')) return { ok: true, list: [] };
  if (r.reason === 'needs_reconnect') return { ok: false, result: fail('needs_reconnect') };
  if (r.reason === 'hmrc_rate_limited') return { ok: false, result: busy(r.retryAfter) };
  if (r.hmrcCode === 'INVALID_SCOPE') return { ok: false, result: failS('scope_missing') };
  // HMRC P7c: the obligations codes HMRC documents (as in vatObligations.ts), not "couldn't be reached".
  if (r.hmrcCode === 'CLIENT_OR_AGENT_NOT_AUTHORISED') return { ok: false, result: fail('vat_not_authorised') };
  if (r.hmrcCode === 'RULE_INSOLVENT_TRADER') return { ok: false, result: fail('vat_insolvent') };
  if (r.hmrcCode === 'VRN_INVALID') return { ok: false, result: fail('vrn_invalid') };
  return { ok: false, result: fail('hmrc_unavailable') };
}

/** The open obligation, the recomputed boxes, the body, its hash, the left-out list and what blocks a submission. */
async function work(ctx: Ctx, periodKey: string, deps: SubmitDeps) {
  const open = await obligations(ctx, deps, { status: 'O' });
  if (!open.ok) return { result: open.result };
  const ob = open.list.find((o) => o.periodKey === periodKey && o.status === 'O');
  if (!ob) return { result: failS('obligation_not_open') };
  const p = await deps.preview(ctx.jwt, ctx.companyId, ob.start, ob.end);
  if (!p.ok) {
    if (p.code === 'two_step_required') return { result: fail('two_step_required') };
    if (p.code === 'plan_not_included') return { result: fail('plan_not_included') };
    if (p.code === 'server_error') return { result: fail('server_error') };
    return { result: failS(p.code) };
  }
  const boxes = computeReturnBoxes(p.rows);
  const body = buildReturnBody(ob.periodKey, boxes);
  const hash = await figuresHash(body);
  const count = (reason: string) => boxes.leftOut.filter((l) => l.reason === reason).reduce((n, l) => n + l.records, 0);
  const blocking: string[] = [];
  if (ob.end >= ukToday(deps.now())) blocking.push('period_not_ended');
  if (count('not_recorded') + count('no_company') > 0) blocking.push('records_need_attention');
  const live = await deps.submissions.live(ctx.companyId, ctx.env, ob.periodKey);
  if (live?.status === 'accepted') blocking.push('already_submitted');
  else if (live?.status === 'unknown') blocking.push('outcome_unknown');
  else if (live?.status === 'submitting') blocking.push('already_submitting');
  return { ob, boxes, body, hash, blocking, live };
}

export async function vatSubmit(req: { authHeader: string | null; headers: Headers; body: Record<string, unknown> }, deps: SubmitDeps): Promise<HandlerResult> {
  const action = req.body.action;
  if (action !== 'prepare' && action !== 'submit' && action !== 'check') return fail('bad_request');
  const periodKey = req.body.period_key;
  if (typeof periodKey !== 'string' || !/^[A-Za-z0-9#]{4}$/.test(periodKey)) return fail('bad_request');
  const secret = confirmSecret(deps.env);
  if (!secret) return failS('submit_not_configured', 503);
  const ctx = await context(req, deps);
  if ('status' in ctx) return ctx;
  const base = { environment: ctx.env, vrn_last3: vrnLast3(ctx.vrn), omitted: ctx.omitted };

  if (action === 'prepare') {
    if (!(await deps.store.takeObligationsSlot(ctx.companyId, ctx.userId, ctx.env, 'submit_prepare'))) return fail('obligations_limit');
    const w = await work(ctx, periodKey, deps);
    if ('result' in w) return w.result as HandlerResult;
    const expiresAt = deps.now().getTime() + CONFIRM_TTL_MS;
    const token = await makeConfirmation(secret, { company: ctx.companyId, periodKey: w.ob.periodKey, hash: w.hash, user: ctx.userId, expiresAt });
    return done({
      ...base, obligation: w.ob, figures: w.body, figures_hash: w.hash, boxes: w.boxes, blocking: w.blocking,
      blocking_messages: w.blocking.map((b) => SUBMIT_MESSAGES[b]), live_status: w.live?.status ?? null,
      confirmation_token: w.blocking.length ? null : token, expires_at: new Date(expiresAt).toISOString(), declaration: DECLARATION, scenarios: SUBMIT_SCENARIOS,
    });
  }

  if (action === 'check') {
    const live = await deps.submissions.live(ctx.companyId, ctx.env, periodKey);
    if (!live || live.status !== 'unknown') return failS('nothing_to_check');
    const res = await obligations(ctx, deps, { from: live.period_start, to: live.period_end });
    if (!res.ok) return res.result;
    const ob = res.list.find((o) => o.periodKey === periodKey);
    if (ob?.status === 'F') {
      await deps.submissions.finish(live.id, { status: 'accepted', error_code: 'received_per_obligation', error_message: 'HMRC shows this period as fulfilled. No receipt was received.' });
      await deps.store.audit({ company_id: ctx.companyId, user_id: ctx.userId, environment: ctx.env, event: 'vat_submit_check', reason: 'fulfilled' });
      return done({ ...base, status: 'accepted', receipt_known: false, message: 'HMRC shows this period as fulfilled, so the return was received. HMRC did not send us a receipt.' });
    }
    if (req.body.confirm_not_received === true) {
      await deps.submissions.finish(live.id, { status: 'rejected', error_code: 'not_received_per_check', error_message: 'Still open at HMRC after a check: recorded as not received.' });
      await deps.store.audit({ company_id: ctx.companyId, user_id: ctx.userId, environment: ctx.env, event: 'vat_submit_check', reason: 'not_received' });
      return done({ ...base, status: 'rejected', message: 'Recorded: HMRC did not receive it. You can prepare and submit this period again.' });
    }
    await deps.store.audit({ company_id: ctx.companyId, user_id: ctx.userId, environment: ctx.env, event: 'vat_submit_check', reason: 'still_open' });
    return done({ ...base, status: 'still_open', message: 'HMRC still shows this period as open. If you are sure HMRC did not receive it, record that, then submit again.' });
  }

  // submit
  if (req.body.declaration !== true) return failS('confirmation_required', 400);
  const scenario = req.body.scenario;
  if (scenario !== undefined && scenario !== null && scenario !== '' && !(SUBMIT_SCENARIOS as readonly string[]).includes(scenario as string)) return fail('bad_request');
  const conf = await readConfirmation(secret, req.body.confirmation_token, { company: ctx.companyId, periodKey, user: ctx.userId, now: deps.now().getTime() });
  if (!conf.ok) return failS(conf.code, 400);
  const w = await work(ctx, periodKey, deps);
  if ('result' in w) return w.result as HandlerResult;
  if (w.hash !== conf.hash) return failS('figures_changed');
  if (w.blocking.length) return failS(w.blocking[0]);

  const begun = await deps.submissions.begin({
    company_id: ctx.companyId, user_id: ctx.userId, environment: ctx.env, period_key: w.ob.periodKey, period_start: w.ob.start, period_end: w.ob.end,
    figures: w.body, figures_hash: w.hash, request_id: deps.newId(), vrn_last3: vrnLast3(ctx.vrn), test_scenario: (scenario as string) || null,
    user_name: await deps.submissions.displayName(ctx.userId).catch(() => null), limit: SUBMIT_LIMIT,
  });
  if (begun.result === 'limit') return failS('submit_limit', 429);
  if (begun.result === 'already_live' || !begun.id) {
    const live = await deps.submissions.live(ctx.companyId, ctx.env, w.ob.periodKey);
    return failS(live?.status === 'accepted' ? 'already_submitted' : live?.status === 'unknown' ? 'outcome_unknown' : 'already_submitting');
  }
  const id = begun.id;

  const r = await callHmrc({
    companyId: ctx.companyId, userId: ctx.userId, method: 'POST', path: VAT_RETURN_API.path(ctx.vrn), logPath: VAT_RETURN_API.logPath, body: w.body,
    version: VAT_RETURN_API.version, tokenKind: 'user', fraudHeaders: ctx.fraud, testScenario: (scenario as string) || undefined, noRetry: true, timeoutMs: SUBMIT_TIMEOUT_MS,
  }, deps);

  if (r.ok) {
    const b = (r.body ?? {}) as Record<string, unknown>;
    const str = (v: unknown, re: RegExp) => (typeof v === 'string' && re.test(v) ? v : null);
    const receipt = {
      processing_date: str(b.processingDate, /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z?$/),
      payment_indicator: b.paymentIndicator === 'DD' || b.paymentIndicator === 'BANK' ? b.paymentIndicator : null,
      form_bundle_number: str(b.formBundleNumber, /^[A-Za-z0-9]{1,40}$/),
      charge_ref_number: str(b.chargeRefNumber, /^[A-Za-z0-9]{1,40}$/),
    };
    await deps.submissions.finish(id, { status: 'accepted', http_status: r.status, ...receipt });
    // A 201 whose body can't be read is still accepted; the person is told the receipt couldn't be read.
    const receiptComplete = !!receipt.processing_date && !!receipt.form_bundle_number;
    await deps.store.audit({ company_id: ctx.companyId, user_id: ctx.userId, environment: ctx.env, event: 'vat_submit_result', reason: receiptComplete ? 'accepted' : 'accepted_no_receipt' });
    return done({ ...base, status: 'accepted', submission_id: id, receipt, receipt_complete: receiptComplete, figures: w.body,
      ...(receiptComplete ? {} : { message: "HMRC's test environment accepted the return, but its receipt couldn't be read. Check the obligation with HMRC." }) });
  }
  // Sent (or maybe sent) but no clear answer: a network error, a timeout or a 5xx. Never retried automatically.
  if (r.reason === 'network' || (r.reason === 'hmrc_unavailable' && r.status >= 500)) {
    const code = r.reason === 'network' ? 'hmrc_no_answer' : `hmrc_${r.status}`;
    await deps.submissions.finish(id, { status: 'unknown', http_status: r.status || null, error_code: code, error_message: "No clear answer from HMRC: we don't know if it was received." });
    await deps.store.audit({ company_id: ctx.companyId, user_id: ctx.userId, environment: ctx.env, event: 'vat_submit_unknown', reason: code });
    return done({ ...base, status: 'unknown', submission_id: id, message: SUBMIT_MESSAGES.outcome_unknown });
  }
  // A clear refusal (or the request never left: a token that couldn't be refreshed).
  // HMRC P7c: INVALID_REQUEST carries the real reasons in a nested list; the most useful one gives the words.
  const nested = r.hmrcCode === 'INVALID_REQUEST' ? NESTED_PRIORITY.find((c) => r.hmrcErrors?.includes(c)) : undefined;
  const mapped = nested ? HMRC_SUBMIT_ERRORS[nested] : r.hmrcCode ? HMRC_SUBMIT_ERRORS[r.hmrcCode] : undefined;
  const code = mapped?.code
    ?? (r.status === 0 ? 'not_sent' : r.status === 429 ? 'hmrc_busy' : r.status === 401 || r.reason === 'needs_reconnect' ? 'hmrc_unauthorised' : r.status === 400 ? 'invalid_return' : (lowerCode(r.hmrcCode) || 'hmrc_rejected'));
  const wait = r.status === 429 && r.retryAfter ? (r.retryAfter < 120 ? `${r.retryAfter} seconds` : `${Math.ceil(r.retryAfter / 60)} minutes`) : null;
  const message = mapped?.message ?? (wait ? `HMRC is busy right now. Nothing was filed. Please try again in ${wait}.` : null) ?? SUBMIT_MESSAGES[code] ?? SUBMIT_MESSAGES.hmrc_rejected;
  await deps.submissions.finish(id, { status: 'rejected', http_status: r.status || null, error_code: code.slice(0, 60), error_message: message.slice(0, 300) });
  await deps.store.audit({ company_id: ctx.companyId, user_id: ctx.userId, environment: ctx.env, event: 'vat_submit_result', reason: code.slice(0, 60) });
  return done({ ...base, status: 'rejected', submission_id: id, code, message, hmrc_code: r.hmrcCode ?? null, http_status: r.status, ...(r.retryAfter ? { retry_after: r.retryAfter } : {}) });
}
