import { adminRpc } from '@/lib/adminApi';

// Phase 12b: master accounts. A super admin switches "Unlimited access" on or off in the Admin portal; the server
// (public.set_master_access / public.list_master_access, docs/phase12b) checks the caller, keeps at least one master
// account and writes the audit row. The app only shows the switch and the result.

export interface MasterAccount { user_id: string; email: string | null; display_name: string | null; granted_at: string; note: string | null }

export const MASTER_NOTE_MAX = 300;
export const MASTER_ON_EXPLAINER = 'This person will never see the paywall until you switch it off. It does not give them access to the Admin portal.';
export const MASTER_OFF_EXPLAINER = 'They go back to the normal rules: the 14-day trial, then a paid plan.';
export const LAST_MASTER_MESSAGE = "You can't remove the last master account. Switch someone else on first.";
export const NOT_INSTALLED_MESSAGE = "Master accounts aren't available yet: the database change for them hasn't been applied.";

type RpcError = { code?: string; message?: string };
const isMissing = (e: RpcError) => e.code === 'PGRST202' || e.code === '42883' || /could not find the function/i.test(e.message ?? '');

/** Plain-language message for a failed switch. */
export function masterErrorMessage(e: unknown): string {
  const err = (e ?? {}) as RpcError;
  const msg = err.message ?? '';
  if (/last_master_account/.test(msg)) return LAST_MASTER_MESSAGE;
  if (err.code === '42501' || /only a super admin/i.test(msg)) return 'Only a super admin can change master accounts.';
  if (err.code === 'P0002' || /no such user/i.test(msg)) return 'This account no longer exists.';
  if (err.code === '22001' || /300 characters/.test(msg)) return `The note can be at most ${MASTER_NOTE_MAX} characters.`;
  if (isMissing(err)) return NOT_INSTALLED_MESSAGE;
  return "Unlimited access wasn't changed. Please try again.";
}

/** The master accounts, or `null` when the database change isn't applied yet. Other errors are thrown. */
export async function fetchMasterAccounts(): Promise<MasterAccount[] | null> {
  try {
    return (await adminRpc<MasterAccount[]>('list_master_access')) ?? [];
  } catch (e) {
    if (isMissing(e as RpcError)) return null;
    throw e;
  }
}

export async function setMasterAccess(userId: string, enabled: boolean, note?: string) {
  const clean = note?.trim() ? note.trim().slice(0, MASTER_NOTE_MAX) : null;
  return adminRpc<{ user_id: string; enabled: boolean; changed: boolean }>('set_master_access', { _user_id: userId, _enabled: enabled, _note: clean });
}
