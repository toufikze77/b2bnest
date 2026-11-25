// store-oauth-client: which providers may be saved, and the exact fields each needs. Pure (no Deno or network), so the
// Edge Function and a Vitest share it. The values are the person's own OAuth app details; they are never logged.

export const PROVIDER_FIELDS = {
  google_calendar: ['client_id', 'client_secret'],
  outlook_calendar: ['client_id', 'client_secret'],
  icloud_calendar: ['client_id', 'client_secret'],
  linkedin: ['client_id', 'client_secret'],
  onedrive: ['client_id', 'client_secret'],
  facebook: ['app_id', 'app_secret'],
} as const;
export type OAuthProvider = keyof typeof PROVIDER_FIELDS;
export const MAX_FIELD_LENGTH = 500;

export type Validated =
  | { ok: true; provider: OAuthProvider; metadata: Record<string, string> }
  | { ok: false; error: string };

/** Checks the request body. On success, metadata holds exactly the provider's fields (anything else sent is dropped). */
export function validate(provider: unknown, credentials: unknown): Validated {
  if (typeof provider !== 'string' || !Object.prototype.hasOwnProperty.call(PROVIDER_FIELDS, provider)) {
    return { ok: false, error: 'Unknown provider' };
  }
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
    return { ok: false, error: 'Missing credentials' };
  }
  const p = provider as OAuthProvider;
  const metadata: Record<string, string> = {};
  for (const field of PROVIDER_FIELDS[p]) {
    const v = (credentials as Record<string, unknown>)[field];
    if (typeof v !== 'string' || v.trim() === '') return { ok: false, error: `Missing ${field}` };
    if (v.length > MAX_FIELD_LENGTH) return { ok: false, error: `${field} is too long` };
    metadata[field] = v;
  }
  return { ok: true, provider: p, metadata };
}
