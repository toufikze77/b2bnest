// HMRC P0: server configuration. Every value comes from an Edge Function secret; none is ever sent to a browser.
//
// VERIFIED (HMRC P1 + P2, 4 Nov 2026) on HMRC's Developer Hub:
//   * authorise https://test-www.tax.service.gov.uk/oauth/authorize (production https://www.tax.service.gov.uk) and
//     token https://test-api.service.hmrc.gov.uk/oauth/token: "User-restricted endpoints" (Authorisation).
//   * API base URLs: the Hello World and Test Fraud Prevention Headers API pages (sandbox test-api.service.hmrc.gov.uk).
//   * Scopes: read:vat and write:vat (VAT (MTD) 1.0 OpenAPI file); hello for "Say hello user" (Hello World 1.0 OpenAPI).
//   * Access tokens last 4 hours; refresh tokens are single use, a new one comes back on each refresh, and they stop
//     working after 18 months ("User-restricted endpoints").
export const HMRC_VAT_SCOPES = ['read:vat', 'write:vat'] as const;
/** Sandbox only: "hello" lets the Hello World user test run (docs/hmrc-p1-p2). Never requested in production. */
export const HMRC_SANDBOX_TEST_SCOPES = ['hello'] as const;
export const HMRC_SCOPES = HMRC_VAT_SCOPES;
export const scopesFor = (env: 'sandbox' | 'production'): string[] => env === 'sandbox' ? [...HMRC_VAT_SCOPES, ...HMRC_SANDBOX_TEST_SCOPES] : [...HMRC_VAT_SCOPES];
export const HMRC_ENDPOINTS = {
  sandbox: {
    authorize: 'https://test-www.tax.service.gov.uk/oauth/authorize',
    token: 'https://test-api.service.hmrc.gov.uk/oauth/token',
    api: 'https://test-api.service.hmrc.gov.uk',
  },
  production: {
    authorize: 'https://www.tax.service.gov.uk/oauth/authorize',
    token: 'https://api.service.hmrc.gov.uk/oauth/token',
    api: 'https://api.service.hmrc.gov.uk',
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
