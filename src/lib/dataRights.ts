/**
 * HMRC P7b: "Your data" in Settings (docs/hmrc-p7b/README.md). Calls the data-export, account-delete and company-close
 * Edge Functions. Safe before they are deployed: any "not found" or "not available" answer becomes NOT_AVAILABLE, never
 * a crash. Re-confirming who you are happens in the browser with Supabase Auth itself (a fresh authenticator code, or
 * signing in again with the password), so no password is ever sent to our own functions.
 */
import { supabase } from '@/integrations/supabase/client';
import { functionErrorStatus, readFunctionError } from '@/lib/billingErrors';
import { codeErrorMessage, verifiedTotp } from '@/lib/twoStep';

export const DATA_CONTACT = 'info@b2bnest.online';
export const NOT_AVAILABLE = `This isn't available yet. Please try again later, or email ${DATA_CONTACT} and we will help.`;
export const ACCOUNT_DELETED = 'Your account is deleted. If you needed your records, you should have downloaded them first.';
export const GENERIC = `Something went wrong. Nothing was changed. Please try again, or email ${DATA_CONTACT}.`;

export type Failure = { ok: false; code: string; message: string; messages?: string[]; confirm_with?: 'authenticator' | 'sign_in' };
type Body = { ok?: boolean; code?: string; message?: string; messages?: string[]; confirm_with?: 'authenticator' | 'sign_in' } & Record<string, unknown>;

async function failureFrom(error: unknown): Promise<Failure> {
  const status = functionErrorStatus(error);
  const body = (await readFunctionError(error)) as Body | null;
  if (status === null || status === 404 || body?.code === 'not_available') return { ok: false, code: 'not_available', message: NOT_AVAILABLE };
  return {
    ok: false, code: body?.code ?? 'server_error', message: typeof body?.message === 'string' && body.message ? body.message : GENERIC,
    ...(Array.isArray(body?.messages) ? { messages: body!.messages as string[] } : {}),
    ...(body?.confirm_with ? { confirm_with: body.confirm_with } : {}),
  };
}

async function call<T extends Body>(fn: string, body: Record<string, unknown>): Promise<({ ok: true } & T) | Failure> {
  try {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) return failureFrom(error);
    return { ...(data as T), ok: true };
  } catch {
    return { ok: false, code: 'not_available', message: NOT_AVAILABLE };
  }
}

/** Downloads the ZIP (account or company). Returns the file name on success. */
export async function downloadData(scope: 'account' | 'company', companyId?: string): Promise<{ ok: true; filename: string } | Failure> {
  try {
    const { data, error } = await supabase.functions.invoke('data-export', { body: { scope, ...(companyId ? { company_id: companyId } : {}) } });
    if (error) return failureFrom(error);
    if (!(data instanceof Blob)) return { ok: false, code: 'server_error', message: GENERIC };
    const day = new Date().toISOString().slice(0, 10);
    const filename = scope === 'account' ? `b2bnest-my-data-${day}.zip` : `b2bnest-company-data-${day}.zip`;
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    return { ok: true, filename };
  } catch {
    return { ok: false, code: 'not_available', message: NOT_AVAILABLE };
  }
}

export type AccountCheck = { companies_closed: string[]; companies_left: string[]; confirm_with: 'authenticator' | 'sign_in' };
export const checkAccountDeletion = () => call<AccountCheck>('account-delete', { action: 'check' });
export const deleteAccount = (email: string) => call<{ message: string }>('account-delete', { action: 'delete', email, downloaded: true });

export type CompanyCheck = { name: string; members: number; hmrc_connected: boolean; hmrc_submissions: number; confirm_with: 'authenticator' | 'sign_in' };
export const checkCompanyClosure = (companyId: string) => call<CompanyCheck>('company-close', { action: 'check', company_id: companyId });
export const closeCompany = (companyId: string, name: string) => call<{ message: string }>('company-close', { action: 'close', company_id: companyId, name, downloaded: true });

/**
 * Proves it is still you, just before a destructive step: a fresh authenticator code for people who use one, otherwise
 * signing in again with the password. Supabase Auth checks it and refreshes this session; the server then sees a sign-in
 * from the last few minutes. Returns null when it worked, or a message.
 */
export async function confirmIdentity(how: 'authenticator' | 'sign_in', p: { code?: string; email?: string | null; password?: string }): Promise<string | null> {
  try {
    if (how === 'authenticator') {
      const { data } = await supabase.auth.mfa.listFactors();
      const factor = verifiedTotp(data?.all)[0];
      if (!factor) return 'No authenticator app is set up on this account.';
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: p.code ?? '' });
      return error ? codeErrorMessage(error) : null;
    }
    if (!p.email || !p.password) return 'Enter your password.';
    const { error } = await supabase.auth.signInWithPassword({ email: p.email, password: p.password });
    return error ? "That password didn't work. If you sign in with Google or Microsoft, sign out and sign in again, then try within 10 minutes." : null;
  } catch {
    return "We couldn't check that. Please try again.";
  }
}
