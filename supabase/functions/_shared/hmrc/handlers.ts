// HMRC P0: hmrc-connect-start, hmrc-connect-complete and hmrc-disconnect, as plain functions (the index.ts files wire
// in Supabase, fetch and Deno.env). Every path checks: valid session → two-step rule → company rule. Logs carry codes
// only: never a token, an authorisation code, a state, a secret or an HMRC response body.
import { HMRC_ENDPOINTS, readConfig, readEnvironment, scopesFor, STATE_TTL_MS } from './config.ts';
import { encryptToken, newState, sha256Hex, tokenAad } from './crypto.ts';
import { canManage, type CallerDeps, identify, isUuid } from './caller.ts';
import { done, fail, type HandlerResult, type HmrcErrorCode } from './errors.ts';
import { exchangeCode } from './oauth.ts';
import type { HmrcStore } from './store.ts';

export interface HandlerDeps {
  env: (k: string) => string | undefined;
  caller: CallerDeps;
  store: HmrcStore;
  fetch: typeof fetch;
  now: () => Date;
  log: (event: string, meta?: Record<string, string | number | boolean | null>) => void;
}
type Body = Record<string, unknown>;

async function refused(deps: HandlerDeps, companyId: string, userId: string, environment: 'sandbox' | 'production' | null, code: HmrcErrorCode) {
  await deps.store.audit({ company_id: companyId, user_id: userId, environment, event: 'refused', reason: code }).catch(() => deps.log('audit_failed'));
  deps.log('refused', { reason: code });
  return fail(code);
}

/** Start: returns the HMRC sign-in address for this company. */
export async function connectStart(authHeader: string | null, body: Body, deps: HandlerDeps): Promise<HandlerResult> {
  const cfg = readConfig(deps.env);
  if (!cfg.ok) return fail('not_configured');
  const who = await identify(authHeader, deps.caller);
  if (typeof who === 'string') return fail(who);
  const companyId = body.company_id;
  if (!isUuid(companyId)) return fail('bad_request');
  const rule = await canManage(deps.store, companyId, who.userId);
  if (rule !== 'ok') return refused(deps, companyId, who.userId, cfg.config.environment, rule);

  const state = newState();
  await deps.store.createState({
    state_hash: await sha256Hex(state), user_id: who.userId, company_id: companyId, environment: cfg.config.environment,
    expires_at: new Date(deps.now().getTime() + STATE_TTL_MS).toISOString(),
  });
  await deps.store.audit({ company_id: companyId, user_id: who.userId, environment: cfg.config.environment, event: 'connect_started' });
  const url = new URL(HMRC_ENDPOINTS[cfg.config.environment].authorize);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', cfg.config.clientId);
  url.searchParams.set('scope', scopesFor(cfg.config.environment).join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', cfg.config.redirectUri);
  deps.log('connect_started');
  return done({ url: url.toString(), environment: cfg.config.environment });
}

/** Complete: the /hmrc/callback page posts code and state; the tokens are exchanged, encrypted and stored. */
export async function connectComplete(authHeader: string | null, body: Body, deps: HandlerDeps): Promise<HandlerResult> {
  const cfg = readConfig(deps.env);
  if (!cfg.ok) return fail('not_configured');
  const who = await identify(authHeader, deps.caller);
  if (typeof who === 'string') return fail(who);
  const { code, state, company_id: expectedCompany } = body;
  if (typeof code !== 'string' || !code || code.length > 2048 || typeof state !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(state)) return fail('bad_request');
  if (expectedCompany !== undefined && expectedCompany !== null && !isUuid(expectedCompany)) return fail('bad_request');

  const used = await deps.store.consumeState(await sha256Hex(state), who.userId);
  if (!used || used.environment !== cfg.config.environment) { deps.log('bad_state'); return fail('bad_state'); }
  if (expectedCompany && expectedCompany !== used.company_id) return refused(deps, used.company_id, who.userId, used.environment, 'bad_state');
  const rule = await canManage(deps.store, used.company_id, who.userId);
  if (rule !== 'ok') return refused(deps, used.company_id, who.userId, used.environment, rule);

  const exchanged = await exchangeCode(cfg.config, code, deps.fetch);
  if (!exchanged.ok) {
    deps.log('token_exchange_failed', { status: exchanged.status });
    return refused(deps, used.company_id, who.userId, used.environment, exchanged.kind === 'rejected' ? 'hmrc_refused' : 'hmrc_unavailable');
  }
  const t = exchanged.tokens;
  const key = cfg.config.tokenKey;
  const now = deps.now();
  await deps.store.saveConnection({
    company_id: used.company_id,
    environment: used.environment,
    status: 'connected',
    access_token_enc: await encryptToken(t.access_token, key, tokenAad(used.company_id, used.environment, 'access')),
    refresh_token_enc: t.refresh_token ? await encryptToken(t.refresh_token, key, tokenAad(used.company_id, used.environment, 'refresh')) : null,
    expires_at: t.expires_in ? new Date(now.getTime() + t.expires_in * 1000).toISOString() : null,
    scopes: (t.scope ?? scopesFor(used.environment).join(' ')).split(/\s+/).filter(Boolean),
    connected_by: who.userId,
    connected_at: now.toISOString(),
  });
  await deps.store.audit({ company_id: used.company_id, user_id: who.userId, environment: used.environment, event: 'connected' });
  deps.log('connected');
  return done({ status: 'connected', environment: used.environment, company_id: used.company_id });
}

/** Disconnect: the stored tokens are deleted and the connection marked disconnected. */
export async function disconnect(authHeader: string | null, body: Body, deps: HandlerDeps): Promise<HandlerResult> {
  const environment = readEnvironment(deps.env);
  if (environment === 'production_not_enabled') return fail('not_configured');
  const who = await identify(authHeader, deps.caller);
  if (typeof who === 'string') return fail(who);
  const companyId = body.company_id;
  if (!isUuid(companyId)) return fail('bad_request');
  const rule = await canManage(deps.store, companyId, who.userId);
  if (rule !== 'ok') return refused(deps, companyId, who.userId, environment, rule);
  // Revoking the grant at HMRC as well is not done: no revoke endpoint could be verified (see the README).
  await deps.store.updateConnection(companyId, environment, {
    status: 'disconnected', access_token_enc: null, refresh_token_enc: null, expires_at: null, refresh_lock_until: null,
  });
  await deps.store.audit({ company_id: companyId, user_id: who.userId, environment, event: 'disconnected' });
  deps.log('disconnected');
  return done({ status: 'disconnected', environment });
}
