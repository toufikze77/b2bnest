/**
 * Two-step sign-in (Phase 25): a 6-digit code from an authenticator app, checked by Supabase Auth (TOTP MFA). Nothing is
 * generated or checked by our own code. "On" means the account has a VERIFIED factor in `mfa.listFactors()`; there is
 * no global on/off flag any more (the old TWO_STEP_ENFORCED constant is gone: whether a code is asked for is decided
 * per account by Supabase, from the session's assurance level, not by us). See docs/phase25/README.md.
 */
import type { Factor } from '@supabase/supabase-js';

/**
 * Who MUST have two-step sign-in. Owner decision (1 Nov 2026): super admins only, for the Admin area. To widen it later
 * (for example to company owners and admins), add 'owner' / 'admin' here: those people are then sent to set it up before
 * they can use the app (see requirementFor).
 */
export type TwoStepRole = 'super_admin' | 'owner' | 'admin';
export const TWO_STEP_REQUIRED_ROLES: readonly TwoStepRole[] = ['super_admin'];
/** Company roles that see the "Protect your account" banner while they have no authenticator app set up. */
export const TWO_STEP_BANNER_ROLES: readonly TwoStepRole[] = ['owner', 'admin'];

export const TWO_STEP_APPS = 'Microsoft Authenticator, Google Authenticator, Authy or 1Password';
export const TWO_STEP_ON = 'On';
export const TWO_STEP_OFF = 'Off';
export const TWO_STEP_EXPLAINER =
  `When it's on, signing in needs your password and a 6-digit code from an authenticator app on your phone (${TWO_STEP_APPS}, all free).`;
export const TWO_STEP_BACKUP_TIP = 'Add a second phone as a backup: if you lose one, you can still sign in with the other.';
export const TWO_STEP_LOST_PHONE =
  "Lost your phone? Use your backup phone if you added one. If not, contact support@b2bnest.online: we'll check it's you and reset two-step sign-in.";

/** Verified authenticator-app factors only. Unverified ones are half-finished set-ups and never count as "on". */
export const verifiedTotp = (factors: readonly Factor[] | null | undefined): Factor[] =>
  (factors ?? []).filter((f) => f.factor_type === 'totp' && f.status === 'verified');

/** The session was opened with the password only, but this account has an app: the code is needed before anything else. */
export const needsCode = (currentLevel: string | null | undefined, nextLevel: string | null | undefined) =>
  currentLevel === 'aal1' && nextLevel === 'aal2';

/** Keeps only the digits of what was typed or pasted ("123 456", "123-456"), at most 6. */
export const cleanCode = (raw: string) => raw.replace(/\D/g, '').slice(0, 6);

/**
 * Where two-step sign-in is required for this person: 'app' (everything), 'admin' (the Admin area only, for super
 * admins) or null (optional).
 */
export function requirementFor(p: { isSuperAdmin: boolean; companyRoles: readonly string[] }): 'app' | 'admin' | null {
  if (p.companyRoles.some((r) => (TWO_STEP_REQUIRED_ROLES as readonly string[]).includes(r))) return 'app';
  if (p.isSuperAdmin && TWO_STEP_REQUIRED_ROLES.includes('super_admin')) return 'admin';
  return null;
}

/** Plain messages for errors from Supabase's verify call. */
export function codeErrorMessage(error: { message?: string; status?: number; code?: string } | null | undefined): string {
  const msg = (error?.message ?? '').toLowerCase();
  const code = error?.code ?? '';
  if (error?.status === 429 || code.includes('rate_limit') || msg.includes('rate limit') || msg.includes('too many')) {
    return 'Too many attempts. Wait a minute, then try again.';
  }
  if (code === 'mfa_verification_failed' || msg.includes('invalid') || msg.includes('verification failed')) {
    return "That code didn't work. Enter the newest 6-digit code from your app (the time on your phone must be set automatically).";
  }
  if (code === 'mfa_challenge_expired' || msg.includes('expired')) return 'That took too long. Enter the newest code and try again.';
  return "We couldn't check the code. Please try again.";
}

// ---- Banner snooze ("Protect your account"), per browser ----
export const BANNER_KEY = 'b2bnest.twoStepBanner.snoozedUntil';
export const BANNER_SNOOZE_DAYS = 7;
export function bannerSnoozed(now = Date.now()): boolean {
  try {
    const until = Number(localStorage.getItem(BANNER_KEY));
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}
export function snoozeBanner(now = Date.now()) {
  try { localStorage.setItem(BANNER_KEY, String(now + BANNER_SNOOZE_DAYS * 24 * 60 * 60 * 1000)); } catch { /* shown again next time */ }
}

// ---- One-time prompt for the two accounts that switched the old email-code setting on ----
export const legacyPromptKey = (userId: string) => `b2bnest.twoStepLegacyPrompt.${userId}`;
export function legacyPromptDone(userId: string): boolean {
  try { return localStorage.getItem(legacyPromptKey(userId)) !== null; } catch { return false; }
}
export function markLegacyPromptDone(userId: string) {
  try { localStorage.setItem(legacyPromptKey(userId), new Date().toISOString()); } catch { /* asked again next time */ }
}
