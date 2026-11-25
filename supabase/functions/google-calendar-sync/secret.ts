// Google Calendar sync: the server secret for action sync_all (the 15-minute catch-up, docs/google-calendar-sync/
// schedule.sql). Only the x-calendar-sync-secret header opens it, compared in constant time with the Edge Function
// secret CALENDAR_SYNC_CRON_SECRET (at least 32 characters). A person's sign-in never opens it. No Deno imports.

export const CRON_HEADER = 'x-calendar-sync-secret';
export const MIN_SECRET_LENGTH = 32;

/** Constant-time comparison of two strings (no early exit on the first difference, nor on a length difference). */
export function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0 && x.length > 0;
}

/** True only with the configured secret in the header. Not configured (or too short): always false. */
export function cronSecretOk(provided: string | null, expected: string | undefined | null): boolean {
  if (!expected || expected.length < MIN_SECRET_LENGTH || !provided) return false;
  return sameSecret(provided, expected);
}

/** null when the request may run sync_all; otherwise the 401 answer (it says nothing about why). */
export function syncAllRefusal(req: Request, expected: string | undefined | null, headers: Record<string, string> = {}): Response | null {
  if (cronSecretOk(req.headers.get(CRON_HEADER), expected)) return null;
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
}
