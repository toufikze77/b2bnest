import { supabase } from '@/integrations/supabase/client';

// Phase 12c: Admin → Users → Suspend / Reactivate goes through the admin-set-user-ban Edge Function, which changes
// profiles.is_active through admin_set_user_status AS THE CALLER (the database checks who may do it and writes the
// audit row) and keeps the Supabase Auth ban in step. The app never writes is_active itself.

export const SUSPEND_SIGNED_OUT_LINE = 'They will be signed out and cannot sign in until you reactivate them.';

const MESSAGES: Record<string, string> = {
  cannot_suspend_master: "You can't suspend a master account. Switch it off first.",
  cannot_suspend_super_admin: "You can't suspend a super admin.",
  cannot_suspend_admin: "You can't suspend an admin. Remove the admin role first.",
  own_account: "You can't suspend your own account.",
  not_authorized: 'Only a super admin can suspend or reactivate accounts.',
  no_such_user: 'This account no longer exists.',
  ban_failed: 'Sign-in could not be blocked, so nothing was changed. Please try again.',
  unban_failed: 'Sign-in could not be unblocked, so nothing was changed. Please try again.',
  ban_failed_flag_kept: 'The account is marked suspended but sign-in could not be blocked. Try again, or reactivate it.',
  unbanned_flag_kept: 'Sign-in was unblocked but the account is still marked suspended. Try Reactivate again.',
  not_available: "The suspend service isn't available yet. Nothing was changed.",
};
export const DEFAULT_SUSPEND_ERROR = "The account wasn't changed. Please try again.";

export class SuspendError extends Error {
  constructor(public readonly code: string) { super(MESSAGES[code] ?? DEFAULT_SUSPEND_ERROR); }
}
export const suspendErrorMessage = (e: unknown) => (e instanceof SuspendError ? e.message : DEFAULT_SUSPEND_ERROR);

/** Suspend (true) or reactivate (false). Throws SuspendError with a plain-language message. */
export async function setSuspended(userId: string, suspend: boolean): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-set-user-ban', { body: { user_id: userId, suspend } });
  if (!error && (data as { ok?: boolean } | null)?.ok) return;
  if (!error) throw new SuspendError('unexpected');
  const ctx = (error as { context?: { status?: number; json?: () => Promise<{ error?: string }> } }).context;
  const body = ctx?.json ? await ctx.json().catch(() => null) : null;
  if (body?.error) throw new SuspendError(body.error);
  // Not deployed yet, or the network is down: nothing reached the server.
  throw new SuspendError(ctx?.status === 404 || !ctx ? 'not_available' : 'unexpected');
}

/** Why an account can't be suspended (the button is hidden and this is shown instead), or null. */
export function suspendBlockReason(user: { id: string; role?: string | null }, opts: { selfId?: string | null; masterIds: Set<string> }): string | null {
  if (opts.selfId && user.id === opts.selfId) return "You can't suspend your own account.";
  if (user.role === 'super_admin') return "Super admins can't be suspended.";
  if (user.role === 'admin' || user.role === 'owner') return "Admins can't be suspended. Remove the admin role first.";
  if (opts.masterIds.has(user.id)) return "Master accounts can't be suspended. Switch off unlimited access first.";
  return null;
}
