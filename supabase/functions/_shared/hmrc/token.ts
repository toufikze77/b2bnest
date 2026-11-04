// HMRC P0: getFreshHmrcToken, for later phases (VAT obligations, returns). NOT an endpoint. It decrypts the access
// token, or refreshes it shortly before it runs out under a per-company lock (hmrc_claim_refresh), so two requests
// never refresh at once. Whether HMRC rotates refresh tokens is not verified: whatever HMRC returns is stored, and the
// old refresh token is kept only when none comes back. A refusal by HMRC marks the connection needs_reconnect.
import { readConfig, REFRESH_MARGIN_MS } from './config.ts';
import { decryptToken, encryptToken, keyringFrom, tokenAad } from './crypto.ts';
import { refreshTokens } from './oauth.ts';
import type { HmrcStore } from './store.ts';

export class HmrcTokenError extends Error {
  constructor(public readonly code: 'not_configured' | 'not_connected' | 'needs_reconnect' | 'hmrc_unavailable' | 'busy' | 'plan_not_included' | 'not_allowed') {
    super(`hmrc token: ${code}`);
  }
}
export interface TokenDeps {
  env: (k: string) => string | undefined;
  store: HmrcStore;
  fetch: typeof fetch;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  log: (event: string, meta?: Record<string, string | number | boolean | null>) => void;
}

export async function getFreshHmrcToken(companyId: string, deps: TokenDeps, actingUser: string | null = null, opts: { force?: boolean } = {}): Promise<string> {
  const cfg = readConfig(deps.env);
  if (!cfg.ok) throw new HmrcTokenError('not_configured');
  const env = cfg.config.environment;
  // On behalf of a person: the company rule still applies (any member may use a connection; the plan, trial and
  // suspension rules apply to everyone). Without a person (a later scheduled job), the caller has checked already.
  if (actingUser) {
    const rule = await deps.store.manageAllowed(companyId, actingUser);
    if (rule !== 'ok' && rule !== 'not_admin') {
      await deps.store.audit({ company_id: companyId, user_id: actingUser, environment: env, event: 'refused', reason: rule === 'not_signed_in' ? 'unauthorized' : rule });
      deps.log('refused', { reason: rule });
      throw new HmrcTokenError(rule === 'plan_not_included' ? 'plan_not_included' : 'not_allowed');
    }
  }
  const ring = await keyringFrom(cfg.config.tokenKey);
  const usable = (row: { expires_at: string | null }) => !row.expires_at || Date.parse(row.expires_at) - deps.now().getTime() > REFRESH_MARGIN_MS;

  let row = await deps.store.getConnection(companyId, env);
  if (!row || row.status === 'disconnected' || !row.access_token_enc) throw new HmrcTokenError('not_connected');
  if (row.status === 'needs_reconnect') throw new HmrcTokenError('needs_reconnect');
  // force: HMRC said the token is no longer valid (401), so refresh even though it hasn't run out by our clock.
  const prevExpiry = row.expires_at;
  if (!opts.force && usable(row)) return decryptToken(row.access_token_enc, ring, tokenAad(companyId, env, 'access'));

  if (!(await deps.store.claimRefresh(companyId, env, 30))) {
    // Someone else is refreshing: wait for their result rather than refreshing twice.
    for (let i = 0; i < 10; i++) {
      await deps.sleep(300);
      row = await deps.store.getConnection(companyId, env);
      if (row?.status === 'needs_reconnect') throw new HmrcTokenError('needs_reconnect');
      if (row?.status === 'connected' && row.access_token_enc && usable(row) && (!opts.force || row.expires_at !== prevExpiry)) return decryptToken(row.access_token_enc, ring, tokenAad(companyId, env, 'access'));
    }
    throw new HmrcTokenError('busy');
  }

  const fail = async (reason: string, reconnect: boolean) => {
    await deps.store.updateConnection(companyId, env, reconnect ? { status: 'needs_reconnect', refresh_lock_until: null } : { refresh_lock_until: null });
    await deps.store.audit({ company_id: companyId, user_id: actingUser, environment: env, event: 'refresh_failed', reason });
    deps.log('refresh_failed', { reason });
  };
  if (!row.refresh_token_enc) { await fail('no_refresh_token', true); throw new HmrcTokenError('needs_reconnect'); }
  const refresh = await decryptToken(row.refresh_token_enc, ring, tokenAad(companyId, env, 'refresh'));
  const r = await refreshTokens(cfg.config, refresh, deps.fetch);
  if (!r.ok) {
    if (r.kind === 'rejected') { await fail('hmrc_rejected', true); throw new HmrcTokenError('needs_reconnect'); }
    await fail('hmrc_unavailable', false);
    throw new HmrcTokenError('hmrc_unavailable');
  }
  const key = cfg.config.tokenKey;
  await deps.store.updateConnection(companyId, env, {
    status: 'connected',
    access_token_enc: await encryptToken(r.tokens.access_token, key, tokenAad(companyId, env, 'access')),
    refresh_token_enc: r.tokens.refresh_token ? await encryptToken(r.tokens.refresh_token, key, tokenAad(companyId, env, 'refresh')) : row.refresh_token_enc,
    expires_at: r.tokens.expires_in ? new Date(deps.now().getTime() + r.tokens.expires_in * 1000).toISOString() : null,
    refresh_lock_until: null,
  });
  await deps.store.audit({ company_id: companyId, user_id: actingUser, environment: env, event: 'refreshed' });
  deps.log('refreshed');
  return r.tokens.access_token;
}
