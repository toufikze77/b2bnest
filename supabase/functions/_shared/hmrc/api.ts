// HMRC P1: callHmrc, the one way the Edge Functions call an HMRC API. VERIFIED (4 Nov 2026) on HMRC's Developer Hub:
//   * Accept: application/vnd.hmrc.<version>+json (Reference guide → "Using the Accept header for versioning").
//   * Bearer tokens: none (unrestricted), an application token (client credentials) or a user token (Authorisation).
//   * 401 INVALID_CREDENTIALS when an access token has expired; 429 MESSAGE_THROTTLED_OUT at the rate limit (standard
//     3 requests a second per application; "stop making additional API requests for a short period"); 5xx server
//     errors (Reference guide → Errors, Rate limiting).
// Retries: a 401 on a user token refreshes once and retries once, then marks the connection needs_reconnect. 429 and
// 5xx are never retried. Logs carry the path, status and HMRC's error code only: never a token, an Authorization
// header, a response body or personal data. HMRC P3: the VAT (MTD) API documents an X-CorrelationId response header
// (36 characters); when it looks like one it is logged, since HMRC support asks for it. A request whose path holds a
// VAT number passes logPath, so the number never reaches a log.
import { HMRC_ENDPOINTS, readConfig } from './config.ts';
import { applicationToken } from './oauth.ts';
import type { HmrcStore } from './store.ts';
import { getFreshHmrcToken, HmrcTokenError } from './token.ts';

export type TokenKind = 'none' | 'application' | 'user';
export interface CallRequest {
  companyId: string;
  userId?: string | null;
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  tokenKind: TokenKind;
  /** The API version for the Accept header, e.g. '1.0'. */
  version: string;
  /** Fraud prevention headers (fraudHeaders.ts), sent as they are. */
  fraudHeaders?: Record<string, string>;
  /** What the logs show instead of the path (for a path that holds a VAT number). */
  logPath?: string;
  /** HMRC P3: sandbox only, and only Gov-Test-Scenario (HMRC's test scenarios). Dropped outside the sandbox. */
  testScenario?: string;
  /** HMRC P6: never send the request twice (a VAT return): a 401 is not refreshed-and-retried. */
  noRetry?: boolean;
  /** HMRC P6: give up waiting after this long (the outcome is then unknown to the caller). */
  timeoutMs?: number;
}
export type CallReason = 'not_configured' | 'not_connected' | 'needs_reconnect' | 'plan_not_included' | 'not_allowed'
  | 'hmrc_unauthorised' | 'hmrc_rate_limited' | 'hmrc_unavailable' | 'hmrc_error' | 'network';
export interface CallResult {
  ok: boolean;
  status: number;
  /** HMRC's short error code (letters, digits and _ only), when it sent one. */
  hmrcCode?: string;
  reason?: CallReason;
  /** The parsed JSON body, only for a successful call. */
  body?: unknown;
  /** HMRC P7a: seconds from a Retry-After header on 429 / 503 (1 to 3600), when HMRC sent one. */
  retryAfter?: number;
}
export interface CallDeps {
  env: (k: string) => string | undefined;
  store: HmrcStore;
  fetch: typeof fetch;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  log: (event: string, meta?: Record<string, string | number | boolean | null>) => void;
}

const safeCode = (v: unknown) => (typeof v === 'string' && /^[A-Z0-9_]{1,60}$/.test(v) ? v : undefined);
/** Retry-After as seconds (a number of seconds or an HTTP date), kept between 1 and 3600; undefined otherwise. */
export function retryAfterSeconds(v: string | null, now: Date): number | undefined {
  if (!v) return undefined;
  const t = v.trim();
  const secs = /^\d{1,6}$/.test(t) ? Number(t) : (() => { const d = Date.parse(t); return Number.isNaN(d) ? NaN : Math.ceil((d - now.getTime()) / 1000); })();
  return Number.isFinite(secs) && secs >= 1 ? Math.min(secs, 3600) : undefined;
}

export async function callHmrc(req: CallRequest, deps: CallDeps): Promise<CallResult> {
  const cfg = readConfig(deps.env);
  if (!cfg.ok) return { ok: false, status: 0, reason: 'not_configured' };
  if (!/^\/[A-Za-z0-9/_.-]*$/.test(req.path) || !/^\d+\.\d+$/.test(req.version)) throw new Error('callHmrc: bad path or version');
  const url = new URL(HMRC_ENDPOINTS[cfg.config.environment].api + req.path);
  const logPath = req.logPath ?? req.path;
  if (req.testScenario !== undefined && !/^[A-Z0-9_]{1,60}$/.test(req.testScenario)) throw new Error('callHmrc: bad test scenario');
  for (const [k, v] of Object.entries(req.query ?? {})) url.searchParams.set(k, v);

  const tokenFor = async (force: boolean): Promise<string | CallResult | null> => {
    if (req.tokenKind === 'none') return null;
    if (req.tokenKind === 'application') {
      const t = await applicationToken(cfg.config, deps.fetch, deps.now);
      return t.ok ? t.tokens.access_token : { ok: false, status: t.status, reason: t.kind === 'rejected' ? 'hmrc_unauthorised' : 'hmrc_unavailable' };
    }
    try {
      return await getFreshHmrcToken(req.companyId, deps, req.userId ?? null, { force });
    } catch (e) {
      if (e instanceof HmrcTokenError) {
        const reason: CallReason = e.code === 'busy' || e.code === 'hmrc_unavailable' ? 'hmrc_unavailable' : e.code;
        return { ok: false, status: 0, reason };
      }
      throw e;
    }
  };

  const send = async (token: string | null) => {
    const headers: Record<string, string> = { Accept: `application/vnd.hmrc.${req.version}+json`, ...(req.fraudHeaders ?? {}) };
    if (req.testScenario && cfg.config.environment === 'sandbox') headers['Gov-Test-Scenario'] = req.testScenario;
    if (token) headers.Authorization = `Bearer ${token}`;
    if (req.body !== undefined) headers['Content-Type'] = 'application/json';
    const signal = req.timeoutMs ? AbortSignal.timeout(req.timeoutMs) : undefined;
    return deps.fetch(url.toString(), { method: req.method, headers, body: req.body === undefined ? undefined : JSON.stringify(req.body), ...(signal ? { signal } : {}) });
  };

  let token = await tokenFor(false);
  if (token && typeof token === 'object') return token;
  let res: Response;
  try { res = await send(token as string | null); } catch { deps.log('hmrc_call_failed', { path: logPath, reason: 'network' }); return { ok: false, status: 0, reason: 'network' }; }

  if (res.status === 401 && req.tokenKind === 'user' && !req.noRetry) {
    await res.body?.cancel().catch(() => {});
    token = await tokenFor(true);
    if (token && typeof token === 'object') return token;
    try { res = await send(token as string); } catch { return { ok: false, status: 0, reason: 'network' }; }
    if (res.status === 401) {
      await res.body?.cancel().catch(() => {});
      await deps.store.updateConnection(req.companyId, cfg.config.environment, { status: 'needs_reconnect', refresh_lock_until: null });
      await deps.store.audit({ company_id: req.companyId, user_id: req.userId ?? null, environment: cfg.config.environment, event: 'refresh_failed', reason: 'hmrc_401_after_refresh' });
      deps.log('hmrc_call', { path: logPath, status: 401, reason: 'needs_reconnect' });
      return { ok: false, status: 401, reason: 'needs_reconnect' };
    }
  }

  const json = await res.json().catch(() => null) as Record<string, unknown> | null;
  const hmrcCode = res.ok ? undefined : safeCode(json?.code);
  const correlation = res.headers.get('x-correlationid');
  deps.log('hmrc_call', { path: logPath, status: res.status, code: hmrcCode ?? null, ...(correlation && /^[0-9a-fA-F-]{36}$/.test(correlation) ? { correlation } : {}) });
  if (res.ok) return { ok: true, status: res.status, body: json ?? undefined };
  const retryAfter = res.status === 429 || res.status === 503 ? retryAfterSeconds(res.headers.get('retry-after'), deps.now()) : undefined;
  if (res.status === 429) return { ok: false, status: 429, hmrcCode, reason: 'hmrc_rate_limited', ...(retryAfter ? { retryAfter } : {}) };
  if (res.status >= 500) return { ok: false, status: res.status, hmrcCode, reason: 'hmrc_unavailable', ...(retryAfter ? { retryAfter } : {}) };
  if (res.status === 401 || res.status === 403) return { ok: false, status: res.status, hmrcCode, reason: 'hmrc_unauthorised' };
  return { ok: false, status: res.status, hmrcCode, reason: 'hmrc_error' };
}
