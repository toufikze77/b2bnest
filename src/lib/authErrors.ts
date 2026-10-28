// Phase 12c: a suspended account is banned in Supabase Auth (admin-set-user-ban), so signing in fails. Supabase Auth
// reports this as error code 'user_banned' (in the auth-js error-code list; message "User is banned"). The code is
// the primary check; the message is a fallback for older servers that send no code.
export const BANNED_MESSAGE = 'This account has been suspended. Contact us.';

export function isBannedAuthError(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null;
  if (!e) return false;
  if (e.code === 'user_banned') return true;
  return typeof e.message === 'string' && /\buser is banned\b|\bbanned\b/i.test(e.message);
}
