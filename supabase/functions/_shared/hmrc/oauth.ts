// HMRC P0: the two calls to HMRC's token endpoint (authorisation code, refresh). Endpoint URLs, grant names and the
// response fields are NOT VERIFIED against HMRC's pages (unreachable from the build environment); they follow the
// standard OAuth 2.0 authorisation-code flow the repo already used. HMRC response bodies are never logged or returned.
import { HMRC_ENDPOINTS, type HmrcConfig } from './config.ts';

export interface TokenSet { access_token: string; refresh_token: string | null; expires_in: number | null; scope: string | null }
export type TokenResult = { ok: true; tokens: TokenSet } | { ok: false; kind: 'rejected' | 'unavailable'; status: number };

async function post(config: HmrcConfig, form: Record<string, string>, fetchFn: typeof fetch): Promise<TokenResult> {
  let res: Response;
  try {
    res = await fetchFn(HMRC_ENDPOINTS[config.environment].token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ ...form, client_id: config.clientId, client_secret: config.clientSecret }),
    });
  } catch {
    return { ok: false, kind: 'unavailable', status: 0 };
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return { ok: false, kind: res.status >= 400 && res.status < 500 ? 'rejected' : 'unavailable', status: res.status };
  }
  const data = await res.json().catch(() => null) as Record<string, unknown> | null;
  if (!data || typeof data.access_token !== 'string' || !data.access_token) return { ok: false, kind: 'unavailable', status: res.status };
  return {
    ok: true,
    tokens: {
      access_token: data.access_token,
      refresh_token: typeof data.refresh_token === 'string' && data.refresh_token ? data.refresh_token : null,
      expires_in: typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : null,
      scope: typeof data.scope === 'string' ? data.scope : null,
    },
  };
}

export const exchangeCode = (config: HmrcConfig, code: string, fetchFn: typeof fetch) =>
  post(config, { grant_type: 'authorization_code', code, redirect_uri: config.redirectUri }, fetchFn);
export const refreshTokens = (config: HmrcConfig, refreshToken: string, fetchFn: typeof fetch) =>
  post(config, { grant_type: 'refresh_token', refresh_token: refreshToken }, fetchFn);
