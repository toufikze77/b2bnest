// Password reset links. Supabase's email link goes through /auth/v1/verify and comes back to /reset-password with the
// recovery session in the URL hash (#access_token=…&type=recovery), a ?code= (PKCE flow), or an error
// (#error=access_denied&error_code=otp_expired&error_description=…). supabase-js reads the hash as soon as the client is
// created, clears it and fires PASSWORD_RECOVERY, usually before the (lazy) reset page has mounted. So the facts about
// the link are noted here when the app starts, WITHOUT keeping any token: only whether it was a recovery link, whether
// it carried a session or a code, and any error.

export interface RecoveryLink {
  /** type=recovery was in the link. */
  isRecovery: boolean;
  /** The link carried a session (access_token in the hash); the value itself is never kept. */
  hasTokens: boolean;
  /** A PKCE ?code= was present. */
  hasCode: boolean;
  error: { code: string; description: string } | null;
}

export const NO_LINK: RecoveryLink = { isRecovery: false, hasTokens: false, hasCode: false, error: null };

export function readRecoveryLink(href: string): RecoveryLink {
  let url: URL;
  try { url = new URL(href); } catch { return NO_LINK; }
  const p = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
  url.searchParams.forEach((v, k) => p.set(k, v));
  const error = p.get('error') || p.get('error_code') || p.get('error_description')
    ? { code: p.get('error_code') || p.get('error') || 'unknown', description: p.get('error_description') || '' }
    : null;
  return { isRecovery: p.get('type') === 'recovery', hasTokens: !!p.get('access_token'), hasCode: !!p.get('code'), error };
}

export const mergeLinks = (a: RecoveryLink, b: RecoveryLink): RecoveryLink => ({
  isRecovery: a.isRecovery || b.isRecovery, hasTokens: a.hasTokens || b.hasTokens, hasCode: a.hasCode || b.hasCode, error: a.error ?? b.error,
});

/** The link as it was when the app started (read before the Supabase client clears it). Only on /reset-password. */
export const initialRecoveryLink: RecoveryLink =
  typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/reset-password' ? readRecoveryLink(window.location.href) : NO_LINK;

// "A recovery session is open in this tab" (no token stored): set on PASSWORD_RECOVERY, so a reload of the page keeps
// the form. It expires with the recovery session (Supabase: 1 hour) and is cleared after the password is changed.
const KEY = 'b2bnest.passwordRecovery';
const TTL_MS = 60 * 60 * 1000;
export function markRecovery(now = Date.now()) {
  try { sessionStorage.setItem(KEY, String(now)); } catch { /* storage blocked: the current page still knows */ }
}
export function hasRecoveryMark(now = Date.now()): boolean {
  try { const at = Number(sessionStorage.getItem(KEY)); return Number.isFinite(at) && at > 0 && now - at < TTL_MS; } catch { return false; }
}
export function clearRecoveryMark() {
  try { sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

/** Takes the tokens, code and error out of the address bar (keeps the path). */
export function cleanRecoveryUrl() {
  if (typeof window === 'undefined') return;
  if (!window.location.hash && !window.location.search) return;
  window.history.replaceState(window.history.state, '', window.location.pathname);
}

/** What to tell the person when the password change is refused. */
export function passwordUpdateMessage(e: { message?: string; code?: string; status?: number } | null | undefined):
  { kind: 'two_step' | 'expired' | 'other'; text: string } {
  const code = e?.code ?? '';
  const message = e?.message ?? '';
  if (code === 'insufficient_aal' || /aal2/i.test(message)) {
    return { kind: 'two_step', text: 'You also need your two-step code; use the recovery steps in Help.' };
  }
  if (code === 'session_not_found' || code === 'session_expired' || /auth session missing|session.*expired/i.test(message)) {
    return { kind: 'expired', text: 'This link has expired or was already used. Request a new one.' };
  }
  if (code === 'same_password') return { kind: 'other', text: 'Your new password must be different from your old one.' };
  if (code === 'weak_password') return { kind: 'other', text: message || 'Choose a stronger password.' };
  return { kind: 'other', text: message || 'Your password could not be changed. Please try again.' };
}
