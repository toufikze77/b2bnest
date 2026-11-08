// HMRC P3: hmrc-vat-obligations. Owners and admins (trial, Business or Scale, not suspended; aal2 when they have an
// authenticator) read their company's VAT obligations live from HMRC's sandbox. Read only: nothing is sent to HMRC
// except this GET, and nothing about obligations is stored. Production stays refused (readConfig).
//
// From HMRC's VAT (MTD) 1.0 OpenAPI file (Developer Hub, downloaded 4 Nov 2026; see docs/hmrc-p3/README.md):
//   GET /organisations/vat/{vrn}/obligations ? from, to (YYYY-MM-DD; "Mandatory unless the status is O"), status (O | F)
//   user-restricted, scope read:vat; 200 { obligations: [{ start, end, due, status, periodKey, received? }] }
//   400 VRN_INVALID / INVALID_DATE_FROM / INVALID_DATE_TO / INVALID_DATE_RANGE ("must be 366 days or less") / INVALID_STATUS
//   403 CLIENT_OR_AGENT_NOT_AUTHORISED / RULE_INSOLVENT_TRADER; 404 NOT_FOUND; sandbox Gov-Test-Scenario header.
// One audit row before the call (obligations_call: open / fulfilled / all) and one after (obligations_result: a code).
// 10 calls an hour per company (hmrc_take_obligations_slot). Fraud prevention headers exactly as hmrc-test-call.
// Never logged or returned: a token, an HMRC response body, or the VAT number beyond its last 3 digits.
import { readConfig } from './config.ts';
import { canManage, type CallerDeps, identify, isUuid } from './caller.ts';
import { busy, done, fail, type HandlerResult } from './errors.ts';
import { buildFraudHeaders, clientIpFrom, publicIp, readBrowserFraudData } from './fraudHeaders.ts';
import { sha256Hex } from './crypto.ts';
import { callHmrc, type CallDeps } from './api.ts';

/** HMRC's endpoint, in one place, so it is easy to change if the sandbox differs. */
export const OBLIGATIONS_API = { version: '1.0', path: (vrn: string) => `/organisations/vat/${vrn}/obligations`, logPath: '/organisations/vat/{vrn}/obligations' } as const;
/** A small allow-list of HMRC's documented sandbox scenarios (Gov-Test-Scenario), for the owner's test picker. */
export const OBLIGATION_SCENARIOS = [
  'QUARTERLY_NONE_MET', 'QUARTERLY_ONE_MET', 'QUARTERLY_TWO_MET', 'QUARTERLY_THREE_MET', 'QUARTERLY_FOUR_MET',
  'MONTHLY_NONE_MET', 'MONTHLY_ONE_MET', 'NOT_FOUND',
] as const;
export const MAX_RANGE_DAYS = 366;
/** HMRC P7a: a read that hangs is given up after this long (then "HMRC couldn't be reached"). */
export const OBLIGATIONS_TIMEOUT_MS = 20_000;

export interface Obligation { periodKey: string; start: string; end: string; due: string; status: 'O' | 'F'; received: string | null }
export interface VatDeps extends CallDeps { caller: CallerDeps }

/** 9 digits; spaces and an optional GB prefix are removed. Null when it isn't a VAT number. */
export function cleanVrn(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.toUpperCase().replace(/\s+/g, '').replace(/^GB/, '');
  return /^\d{9}$/.test(v) ? v : null;
}
export const vrnLast3 = (vrn: string) => vrn.slice(-3);

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
/** A real calendar date in YYYY-MM-DD, as a UTC day number; null otherwise. */
export function dayOf(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = ISO.exec(v);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
  return t / 86_400_000;
}

export type ObligationQuery = { status?: 'O' | 'F'; from?: string; to?: string; scenario?: string; kind: 'open' | 'fulfilled' | 'all' };
/** Strict input check. Without anything: open obligations (no dates needed). */
export function readQuery(body: Record<string, unknown>): ObligationQuery | null {
  const { status, from, to, scenario } = body;
  if (status !== undefined && status !== null && status !== 'O' && status !== 'F') return null;
  if (scenario !== undefined && scenario !== null && !(OBLIGATION_SCENARIOS as readonly string[]).includes(scenario as string)) return null;
  const hasFrom = from !== undefined && from !== null && from !== '';
  const hasTo = to !== undefined && to !== null && to !== '';
  if (hasFrom !== hasTo) return null;
  const st = (status ?? undefined) as 'O' | 'F' | undefined;
  if (!hasFrom && st !== 'O' && st !== undefined) return null; // fulfilled needs a date range
  const q: ObligationQuery = { kind: st === 'O' ? 'open' : st === 'F' ? 'fulfilled' : 'all', ...(scenario ? { scenario: scenario as string } : {}) };
  if (st) q.status = st;
  if (!hasFrom) {
    if (!st) { q.status = 'O'; q.kind = 'open'; }
    return q;
  }
  const a = dayOf(from), b = dayOf(to);
  if (a === null || b === null || b < a || b - a + 1 > MAX_RANGE_DAYS) return null;
  q.from = from as string; q.to = to as string;
  return q;
}

/** HMRC's answer, keeping only well-formed obligations. */
export function normalise(body: unknown): { obligations: Obligation[]; dropped: number } {
  const list = (body && typeof body === 'object' ? (body as { obligations?: unknown }).obligations : null);
  if (!Array.isArray(list)) return { obligations: [], dropped: 0 };
  const out: Obligation[] = [];
  for (const x of list.slice(0, 500)) {
    const o = (x ?? {}) as Record<string, unknown>;
    const ok = dayOf(o.start) !== null && dayOf(o.end) !== null && dayOf(o.due) !== null && (o.status === 'O' || o.status === 'F')
      && typeof o.periodKey === 'string' && /^[A-Za-z0-9#]{4}$/.test(o.periodKey) && (o.received === undefined || o.received === null || dayOf(o.received) !== null);
    if (!ok) continue;
    out.push({ periodKey: o.periodKey as string, start: o.start as string, end: o.end as string, due: o.due as string, status: o.status as 'O' | 'F', received: (o.received as string | undefined) ?? null });
  }
  return { obligations: out, dropped: Math.min(list.length, 500) - out.length };
}

const lowerCode = (c: string | undefined) => (c ? c.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 60) : '');

export async function vatObligations(req: { authHeader: string | null; headers: Headers; body: Record<string, unknown> }, deps: VatDeps): Promise<HandlerResult> {
  const cfg = readConfig(deps.env);
  if (!cfg.ok || cfg.config.environment !== 'sandbox') return fail('not_configured'); // production stays refused
  const env = cfg.config.environment;
  const who = await identify(req.authHeader, deps.caller);
  if (typeof who === 'string') return fail(who);
  const companyId = req.body.company_id;
  if (!isUuid(companyId)) return fail('bad_request');
  const query = readQuery(req.body);
  if (!query) return fail('bad_request');
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
  if (!(await deps.store.takeObligationsSlot(companyId, who.userId, env, query.kind))) return fail('obligations_limit');

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
  const q: Record<string, string> = {};
  if (query.from && query.to) { q.from = query.from; q.to = query.to; }
  if (query.status) q.status = query.status;

  const r = await callHmrc({
    companyId, userId: who.userId, method: 'GET', path: OBLIGATIONS_API.path(vrn), logPath: OBLIGATIONS_API.logPath, query: q,
    version: OBLIGATIONS_API.version, tokenKind: 'user', fraudHeaders: fraud.headers, testScenario: query.scenario, timeoutMs: OBLIGATIONS_TIMEOUT_MS,
  }, deps);
  const notFound = !r.ok && r.status === 404 && (r.hmrcCode === 'NOT_FOUND' || !r.hmrcCode);
  const outcome = r.ok ? 'ok' : notFound ? 'not_found' : (lowerCode(r.hmrcCode) || r.reason || String(r.status));
  await deps.store.audit({ company_id: companyId, user_id: who.userId, environment: env, event: 'obligations_result', reason: outcome.slice(0, 60) });

  const base = { environment: env, vrn_last3: vrnLast3(vrn), status: query.status ?? null, from: query.from ?? null, to: query.to ?? null, scenario: query.scenario ?? null, omitted: fraud.omitted };
  if (notFound) return done({ ...base, obligations: [], fetched_at: deps.now().toISOString() });
  if (!r.ok) {
    if (r.reason === 'not_configured') return fail('not_configured');
    if (r.reason === 'needs_reconnect') return fail('needs_reconnect');
    if (r.reason === 'not_connected') return fail('not_connected');
    if (r.reason === 'plan_not_included') return fail('plan_not_included');
    if (r.reason === 'hmrc_rate_limited') return busy(r.retryAfter);
    if (r.reason === 'hmrc_unavailable' || r.reason === 'network') return fail('hmrc_unavailable');
    if (r.hmrcCode === 'INVALID_SCOPE') return fail('scope_missing');
    if (r.hmrcCode === 'NOT_SIGNED_UP_TO_MTD') return fail('vat_not_signed_up');
    if (r.hmrcCode === 'CLIENT_OR_AGENT_NOT_AUTHORISED') return fail('vat_not_authorised');
    if (r.hmrcCode === 'RULE_INSOLVENT_TRADER') return fail('vat_insolvent');
    if (r.hmrcCode === 'VRN_INVALID') return fail('vrn_invalid');
    if (r.status === 400) return fail('bad_request');
    return { status: 502, body: { ok: false, code: 'hmrc_refused', message: "HMRC didn't accept the request.", hmrc_code: r.hmrcCode ?? null, http_status: r.status } };
  }
  const { obligations, dropped } = normalise(r.body);
  if (dropped) deps.log('obligations_dropped', { count: dropped });
  return done({ ...base, obligations, fetched_at: deps.now().toISOString() });
}
