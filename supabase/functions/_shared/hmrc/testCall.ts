// HMRC P1 + P2: hmrc-test-call. Owners and admins (trial, Business or Scale, not suspended; aal2 when they have an
// authenticator) run one of HMRC's test calls for their company:
//   hello_world (GET /hello/world, no token), hello_application (GET /hello/application, application token),
//   hello_user (GET /hello/user, the company's user token, scope "hello"), fraud_headers_validate
//   (GET /test/fraud-prevention-headers/validate, application token, sandbox only).
// Endpoints, versions and token types from HMRC's Hello World 1.0 and Test Fraud Prevention Headers 1.0 OpenAPI files
// (read 4 Nov 2026). 10 test calls per company per hour (hmrc_take_test_slot). One audit row before the call
// (test_call) and one after (test_result: kind + status code). Fraud prevention headers go on every call.
import { readConfig } from './config.ts';
import { canManage, type CallerDeps, identify, isUuid } from './caller.ts';
import { busy, done, fail, type HandlerResult } from './errors.ts';
import { buildFraudHeaders, clientIpFrom, publicIp, readBrowserFraudData } from './fraudHeaders.ts';
import { sha256Hex } from './crypto.ts';
import { callHmrc, type CallDeps, type CallResult } from './api.ts';

export const TEST_KINDS = {
  hello_world: { path: '/hello/world', version: '1.0', tokenKind: 'none' },
  hello_application: { path: '/hello/application', version: '1.0', tokenKind: 'application' },
  hello_user: { path: '/hello/user', version: '1.0', tokenKind: 'user' },
  fraud_headers_validate: { path: '/test/fraud-prevention-headers/validate', version: '1.0', tokenKind: 'application' },
} as const;
export type TestKind = keyof typeof TEST_KINDS;
const HELLO_MESSAGES = ['Hello World', 'Hello Application', 'Hello User'];

export interface TestCallDeps extends CallDeps { caller: CallerDeps }
export interface FeedbackItem { code: string; message: string; headers: string[] }

/** Only header names, codes and HMRC's messages about headers: the validate response contains nothing else we keep. */
export function summariseValidation(body: unknown): { code: string; message: string; errors: FeedbackItem[]; warnings: FeedbackItem[] } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const items = (v: unknown): FeedbackItem[] => (Array.isArray(v) ? v : []).slice(0, 40).map((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    return {
      code: typeof o.code === 'string' ? o.code.slice(0, 60) : '',
      message: typeof o.message === 'string' ? o.message.slice(0, 400) : '',
      headers: (Array.isArray(o.headers) ? o.headers : []).filter((h): h is string => typeof h === 'string' && /^gov-[a-z0-9-]+$/i.test(h)).slice(0, 20),
    };
  });
  if (typeof b.code !== 'string') return null;
  return { code: b.code.slice(0, 60), message: typeof b.message === 'string' ? b.message.slice(0, 400) : '', errors: items(b.errors), warnings: items(b.warnings) };
}

export async function testCall(req: { authHeader: string | null; headers: Headers; body: Record<string, unknown> }, deps: TestCallDeps): Promise<HandlerResult> {
  const cfg = readConfig(deps.env);
  if (!cfg.ok) return fail('not_configured');
  const env = cfg.config.environment;
  const who = await identify(req.authHeader, deps.caller);
  if (typeof who === 'string') return fail(who);
  const companyId = req.body.company_id;
  const kind = req.body.kind;
  if (!isUuid(companyId) || typeof kind !== 'string' || !(kind in TEST_KINDS)) return fail('bad_request');
  const spec = TEST_KINDS[kind as TestKind];
  const rule = await canManage(deps.store, companyId, who.userId);
  if (rule !== 'ok') {
    await deps.store.audit({ company_id: companyId, user_id: who.userId, environment: env, event: 'refused', reason: rule }).catch(() => deps.log('audit_failed'));
    return fail(rule);
  }
  if (spec.tokenKind === 'user') {
    const c = await deps.store.getConnection(companyId, env);
    if (!c || c.status === 'disconnected' || !c.access_token_enc) return fail('not_connected');
    if (c.status === 'needs_reconnect') return fail('needs_reconnect');
    if (!c.scopes.includes('hello')) return fail('scope_missing');
  }
  if (!(await deps.store.takeTestSlot(companyId, who.userId, env, kind))) return fail('test_limit');

  const receivedAt = deps.now();
  const fraud = buildFraudHeaders(readBrowserFraudData(req.body.fraud), {
    clientPublicIp: clientIpFrom(req.headers),
    receivedAt,
    clientPublicPort: null, // not available to Supabase Edge Functions (README)
    vendorPublicIp: publicIp(deps.env('HMRC_VENDOR_PUBLIC_IP')),
    userId: who.userId,
    mfa: who.totpAt && who.totpFactorIds.length
      ? { type: 'TOTP', at: who.totpAt, uniqueReference: await sha256Hex(`b2bnest-mfa:${who.totpFactorIds.join(',')}`) }
      : null,
  });

  const r: CallResult = await callHmrc({ companyId, userId: who.userId, method: 'GET', path: spec.path, version: spec.version, tokenKind: spec.tokenKind, fraudHeaders: fraud.headers }, deps);
  const outcome = r.ok ? String(r.status) : (r.reason ?? String(r.status));
  await deps.store.audit({ company_id: companyId, user_id: who.userId, environment: env, event: 'test_result', reason: `${kind}_${outcome}`.slice(0, 60) });

  if (!r.ok) {
    if (r.reason === 'not_configured') return fail('not_configured');
    if (r.reason === 'needs_reconnect') return fail('needs_reconnect');
    if (r.reason === 'not_connected') return fail('not_connected');
    if (r.reason === 'plan_not_included') return fail('plan_not_included');
    if (r.reason === 'hmrc_rate_limited') return busy(r.retryAfter);
    if (r.reason === 'hmrc_unauthorised' && r.hmrcCode === 'INVALID_SCOPE') return fail('scope_missing');
    return { status: 502, body: { ok: false, code: 'hmrc_refused', message: "HMRC didn't accept the test call.", hmrc_code: r.hmrcCode ?? null, http_status: r.status } };
  }
  if (kind === 'fraud_headers_validate') {
    const summary = summariseValidation(r.body);
    if (!summary) return fail('hmrc_unavailable');
    return done({ kind, environment: env, result: summary, omitted: fraud.omitted, sent: Object.keys(fraud.headers) });
  }
  const msg = (r.body as { message?: unknown } | undefined)?.message;
  return done({ kind, environment: env, message: typeof msg === 'string' && HELLO_MESSAGES.includes(msg) ? msg : null, omitted: fraud.omitted });
}
