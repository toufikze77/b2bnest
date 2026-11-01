import { supabase } from '@/integrations/supabase/client';

// Phase 25: Admin → Users → Reset two-step sign-in, through the admin-reset-mfa Edge Function (super admins at aal2 only;
// the server checks again, records the reset in audit_logs first, then removes the person's authenticator apps).

export const RESET_REASON_MIN = 5;
export const RESET_REASON_MAX = 500;
export const RESET_EXPLAINER =
  "Removes every authenticator app from this account, so they can sign in with their password only and set up a new app. Only do this after you have checked it is really them (for example by calling them back on a number you already had).";

const MESSAGES: Record<string, string> = {
  mfa_required: 'Enter your own two-step code first: sign out and sign in again with your authenticator app.',
  not_authorized: 'Only a super admin can reset two-step sign-in.',
  own_account: "You can't reset your own two-step sign-in. Ask another platform admin.",
  reason_required: 'Say why, in at least 5 characters (for example how you checked it is them).',
  rate_limited: 'At most 5 resets an hour. Try again later.',
  audit_failed: 'Nothing was changed because the reset could not be recorded. Please try again.',
  delete_failed: 'Some apps could not be removed. Please try again.',
  list_failed: "We couldn't read this account's apps. Nothing was changed.",
  not_available: "The reset service isn't available yet. Nothing was changed.",
};
export const DEFAULT_RESET_ERROR = "Two-step sign-in wasn't reset. Please try again.";

export class ResetTwoStepError extends Error {
  constructor(public readonly code: string) { super(MESSAGES[code] ?? DEFAULT_RESET_ERROR); }
}
export const resetErrorMessage = (e: unknown) => (e instanceof ResetTwoStepError ? e.message : DEFAULT_RESET_ERROR);

/** Returns how many apps were removed. Throws ResetTwoStepError with a plain-language message. */
export async function resetTwoStep(userId: string, reason: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke('admin-reset-mfa', { body: { user_id: userId, reason: reason.trim() } });
  const ok = data as { ok?: boolean; removed?: number } | null;
  if (!error && ok?.ok) return ok.removed ?? 0;
  if (!error) throw new ResetTwoStepError('unexpected');
  const ctx = (error as { context?: { status?: number; json?: () => Promise<{ error?: string }> } }).context;
  const body = ctx?.json ? await ctx.json().catch(() => null) : null;
  if (body?.error) throw new ResetTwoStepError(body.error);
  throw new ResetTwoStepError(ctx?.status === 404 || !ctx ? 'not_available' : 'unexpected');
}
