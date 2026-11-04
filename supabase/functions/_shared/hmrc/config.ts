// HMRC P0: server configuration. Every value comes from an Edge Function secret; none is ever sent to a browser.
//
// NOT VERIFIED against HMRC's published pages (developer.service.hmrc.gov.uk could not be reached from the build
// environment): the scope names, the authorisation and token endpoint URLs, token lifetimes and refresh behaviour. The
// URLs below are the ones the repo already used (supabase/functions/oauth-hmrc, src/services/hmrcService.ts). Each is in
// one constant so it can be corrected in one place once checked.
export const HMRC_SCOPES = ['read:vat', 'write:vat'] as const; // not verified
export const HMRC_ENDPOINTS = {
  sandbox: {
    authorize: 'https://test-www.tax.service.gov.uk/oauth/authorize', // not verified
    token: 'https://test-api.service.hmrc.gov.uk/oauth/token', // not verified
  },
  production: {
    authorize: 'https://www.tax.service.gov.uk/oauth/authorize', // not verified
    token: 'https://api.service.hmrc.gov.uk/oauth/token', // not verified
  },
} as const;
/** Refresh this long before the access token runs out. */
export const REFRESH_MARGIN_MS = 2 * 60 * 1000;
export const STATE_TTL_MS = 10 * 60 * 1000;

export type HmrcEnvironment = 'sandbox' | 'production';
export interface HmrcConfig {
  clientId: string;
  clientSecret: string;
  /** 32 raw bytes (AES-256). */
  tokenKey: Uint8Array;
  environment: HmrcEnvironment;
  redirectUri: string;
}
export type ConfigResult = { ok: true; config: HmrcConfig } | { ok: false; code: 'not_configured' | 'production_not_enabled' };

export function decodeKey(b64: string | undefined): Uint8Array | null {
  if (!b64) return null;
  try {
    const bin = atob(b64.trim().replace(/-/g, '+').replace(/_/g, '/'));
    if (bin.length !== 32) return null;
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The environment on its own (disconnect needs it even if a credential is missing). Default: sandbox. */
export function readEnvironment(get: (k: string) => string | undefined): HmrcEnvironment | 'production_not_enabled' {
  const env = (get('HMRC_ENV') ?? 'sandbox').trim().toLowerCase() || 'sandbox';
  if (env === 'sandbox') return 'sandbox';
  // Production is refused until the owner switches it on deliberately in a later phase (HMRC approval first).
  return 'production_not_enabled';
}

/** Fails closed: any missing or malformed secret means "HMRC connection isn't set up yet". */
export function readConfig(get: (k: string) => string | undefined): ConfigResult {
  const environment = readEnvironment(get);
  if (environment === 'production_not_enabled') return { ok: false, code: 'production_not_enabled' };
  const clientId = get('HMRC_CLIENT_ID')?.trim();
  const clientSecret = get('HMRC_CLIENT_SECRET')?.trim();
  const redirectUri = get('HMRC_REDIRECT_URI')?.trim();
  const tokenKey = decodeKey(get('HMRC_TOKEN_KEY'));
  if (!clientId || !clientSecret || !redirectUri || !tokenKey || !/^https:\/\/[^\s]+$/.test(redirectUri)) return { ok: false, code: 'not_configured' };
  return { ok: true, config: { clientId, clientSecret, tokenKey, environment, redirectUri } };
}
