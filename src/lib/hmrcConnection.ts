// HMRC P0: the browser side of the company HMRC connection. The browser never sees a token, an HMRC client id or
// secret, or an authorisation code it keeps: status comes from hmrc_connection_status() (docs/hmrc-p0/proposal.sql),
// connect / disconnect go through the hmrc-connect-start / hmrc-connect-complete / hmrc-disconnect Edge Functions.
import { supabase } from '@/integrations/supabase/client';

export const HMRC_NOT_SET_UP = "HMRC connection isn't set up yet.";
export const SANDBOX_LABEL = 'Sandbox (test)';
export const HMRC_COMPANY_KEY = 'b2bnest.hmrc.company';
export const HMRC_PAGE = '/business-tools?tool=hmrc-integration';

export const HMRC_CODE_MESSAGES: Record<string, string> = {
  not_configured: HMRC_NOT_SET_UP,
  unauthorized: 'Please sign in again.',
  two_step_required: 'Two-step sign-in is on for your account. Sign out, sign in again with your 6-digit code, then try again.',
  not_member: "You don't have access to this company's HMRC connection.",
  not_admin: 'Only an owner or admin of this company can connect or disconnect HMRC.',
  trial_ended: 'Your trial has ended. Choose a plan to use HMRC Integration.',
  suspended: 'Your account is suspended.',
  bad_request: 'Something was missing from the request. Please try again.',
  bad_state: 'This HMRC sign-in has expired or was already used. Start again from the HMRC page.',
  hmrc_refused: "HMRC didn't accept the sign-in. Please try connecting again.",
  hmrc_unavailable: "HMRC couldn't be reached. Please try again later.",
  needs_reconnect: 'The HMRC connection has expired. An owner or admin needs to connect again.',
  server_error: 'Something went wrong. Please try again.',
};
export const messageFor = (code: string | undefined) => HMRC_CODE_MESSAGES[code ?? ''] ?? HMRC_CODE_MESSAGES.server_error;

export interface HmrcConnectionInfo {
  environment: 'sandbox' | 'production';
  status: 'connected' | 'needs_reconnect' | 'disconnected';
  connected_by_name: string | null;
  connected_at: string | null;
  expires_at: string | null;
  needs_reconnect: boolean;
  scopes: string[];
}
export type HmrcStatus =
  | { kind: 'not_set_up' }
  | { kind: 'no_access' }
  | { kind: 'two_step' }
  | { kind: 'ended'; reason: 'trial_ended' | 'suspended' }
  | { kind: 'error' }
  | { kind: 'ok'; canManage: boolean; connection: HmrcConnectionInfo | null };

type DbError = { code?: string; message?: string } | null;
const isMissing = (e: DbError) => !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function/i.test(e.message ?? ''));

/** The company's HMRC status. Never contains a token. */
export async function fetchHmrcStatus(companyId: string): Promise<HmrcStatus> {
  try {
    const { data, error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: DbError }>)(
      'hmrc_connection_status', { p_company: companyId });
    if (error) {
      if (isMissing(error)) return { kind: 'not_set_up' };
      if (/MFA_REQUIRED/.test(error.message ?? '')) return { kind: 'two_step' };
      if (/HMRC_NOT_ALLOWED/.test(error.message ?? '') || error.code === '42501') return { kind: 'no_access' };
      return { kind: 'error' };
    }
    const d = data as { access: string; can_manage: boolean; connections: HmrcConnectionInfo[] } | null;
    if (!d) return { kind: 'error' };
    if (d.access === 'trial_ended' || d.access === 'suspended') return { kind: 'ended', reason: d.access };
    const connection = (d.connections ?? []).find((c) => c.environment === 'sandbox') ?? null;
    return { kind: 'ok', canManage: !!d.can_manage, connection };
  } catch {
    return { kind: 'error' };
  }
}

export interface FnResult { ok: boolean; code?: string; message?: string; url?: string; status?: string; company_id?: string }

/** Calls one HMRC Edge Function and returns its JSON, or a not-set-up result when it isn't deployed yet. */
export async function callHmrcFunction(name: 'hmrc-connect-start' | 'hmrc-connect-complete' | 'hmrc-disconnect', body: Record<string, unknown>): Promise<FnResult> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (!error) return (data as FnResult) ?? { ok: false, code: 'server_error' };
    const ctx = (error as { context?: { status?: number; json?: () => Promise<unknown> } }).context;
    if (ctx?.status === 404) return { ok: false, code: 'not_configured', message: HMRC_NOT_SET_UP };
    const parsed = ctx?.json ? await ctx.json().catch(() => null) as FnResult | null : null;
    if (parsed?.code) return { ok: false, code: parsed.code, message: parsed.message ?? messageFor(parsed.code) };
    // Not deployed / unreachable (FunctionsFetchError, FunctionsRelayError): treat as not set up, never a crash.
    return { ok: false, code: 'not_configured', message: HMRC_NOT_SET_UP };
  } catch {
    return { ok: false, code: 'not_configured', message: HMRC_NOT_SET_UP };
  }
}

/** Dates as 2 Nov 2026. */
export const ukDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function rememberCompany(companyId: string) {
  try { sessionStorage.setItem(HMRC_COMPANY_KEY, companyId); } catch { /* storage blocked: the server still checks the company */ }
}
export function rememberedCompany(): string | null {
  try { return sessionStorage.getItem(HMRC_COMPANY_KEY); } catch { return null; }
}
