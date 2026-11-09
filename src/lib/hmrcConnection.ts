// HMRC P0: the browser side of the company HMRC connection. The browser never sees a token, an HMRC client id or
// secret, or an authorisation code it keeps: status comes from hmrc_connection_status() (docs/hmrc-p0/proposal.sql),
// connect / disconnect go through the hmrc-connect-start / hmrc-connect-complete / hmrc-disconnect Edge Functions.
import { supabase } from '@/integrations/supabase/client';

export const HMRC_NOT_SET_UP = "HMRC connection isn't set up yet.";
/** docs/hmrc-plan: HMRC tools are a Business and Scale feature (and on the 14-day trial), like Workflow Studio. */
export const HMRC_PLAN_MESSAGE = 'HMRC tools are included in the Business and Scale plans.';
export const HMRC_INCLUDED_TEXT = 'Included in Business and Scale, and during the 14-day trial.';
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
  plan_not_included: HMRC_PLAN_MESSAGE,
  bad_request: 'Something was missing from the request. Please try again.',
  bad_state: 'This HMRC sign-in has expired or was already used. Start again from the HMRC page.',
  hmrc_refused: "HMRC didn't accept the sign-in. Please try connecting again.",
  hmrc_unavailable: "HMRC couldn't be reached. Please try again later.",
  needs_reconnect: 'The HMRC connection has expired. An owner or admin needs to connect again.',
  server_error: 'Something went wrong. Please try again.',
  // HMRC P1 + P2: the test calls
  not_connected: 'Connect this company to HMRC first, then test the connection.',
  test_limit: 'You can run 10 HMRC tests an hour for this company. Please try again later.',
  hmrc_busy: 'HMRC is busy right now. Please try again in a minute.',
  scope_missing: 'Connect to HMRC again to run this test: the test needs one more permission from HMRC (test environment only).',
  // HMRC P3: VAT obligations (same wording as supabase/functions/_shared/hmrc/errors.ts).
  vrn_missing: 'Add your VAT number in Settings → HMRC first.',
  obligations_limit: 'You can get VAT obligations 10 times an hour for this company. Please try again later.',
  vrn_invalid: "HMRC didn't accept this VAT number. Check it in Settings → HMRC.",
  vat_not_authorised: "HMRC says this HMRC sign-in can't see VAT for this VAT number. Check the VAT number, or connect again with the HMRC account that owns it.",
  vat_insolvent: "HMRC can't show VAT obligations for this business through this service.",
  // HMRC P7a (same wording as supabase/functions/_shared/hmrc/errors.ts).
  // HMRC P8: reading what HMRC holds (same wording as supabase/functions/_shared/hmrc/errors.ts).
  not_available: "This isn't available yet.",
  read_limit: 'You can do this 10 times an hour for this company. Please try again later.',
  not_submitted: "There's no accepted return for this period sent through B2BNEST, so there's nothing to compare.",
  return_not_found: 'HMRC has no return for this period.',
  dates_invalid: "HMRC didn't accept these dates. Choose dates up to today, at most 365 days apart.",
  // HMRC hide switch (docs/hmrc-hide/README.md).
  hmrc_unavailable_for_now: "HMRC filing isn't available yet.",
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
  | { kind: 'ended'; reason: 'trial_ended' | 'suspended' | 'plan_not_included' }
  | { kind: 'error' }
  | { kind: 'ok'; canManage: boolean; connection: HmrcConnectionInfo | null; production?: boolean };

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
    if (d.access === 'trial_ended' || d.access === 'suspended' || d.access === 'plan_not_included') return { kind: 'ended', reason: d.access };
    const connection = (d.connections ?? []).find((c) => c.environment === 'sandbox') ?? null;
    // HMRC P3: a production connection can't exist yet (production is refused); if one ever does, say so.
    const production = (d.connections ?? []).some((c) => c.environment === 'production' && c.status !== 'disconnected');
    return { kind: 'ok', canManage: !!d.can_manage, connection, production };
  } catch {
    return { kind: 'error' };
  }
}

export interface HmrcHeaderFeedback { code: string; message: string; headers: string[] }
export interface HmrcHeaderCheck { code: string; message: string; errors: HmrcHeaderFeedback[]; warnings: HmrcHeaderFeedback[] }
export interface FnResult {
  ok: boolean; code?: string; message?: string | null; url?: string; status?: string; company_id?: string;
  /** hmrc-test-call */
  kind?: string; result?: HmrcHeaderCheck; omitted?: string[]; sent?: string[]; hmrc_code?: string | null;
  /** hmrc-vat-obligations */
  obligations?: VatObligation[]; fetched_at?: string; vrn_last3?: string;
}
export interface VatObligation { periodKey: string; start: string; end: string; due: string; status: 'O' | 'F'; received: string | null }

/** Calls one HMRC Edge Function and returns its JSON, or a not-set-up result when it isn't deployed yet. */
export async function callHmrcFunction(name: 'hmrc-connect-start' | 'hmrc-connect-complete' | 'hmrc-disconnect' | 'hmrc-test-call' | 'hmrc-vat-obligations' | 'hmrc-vat-submit', body: Record<string, unknown>): Promise<FnResult> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (!error) return (data as FnResult) ?? { ok: false, code: 'server_error' };
    const ctx = (error as { context?: { status?: number; json?: () => Promise<unknown> } }).context;
    if (ctx?.status === 404) return { ok: false, code: 'not_configured', message: HMRC_NOT_SET_UP };
    const parsed = ctx?.json ? await ctx.json().catch(() => null) as FnResult | null : null;
    if (parsed?.code) return { ok: false, code: parsed.code, message: parsed.message ?? messageFor(parsed.code), hmrc_code: parsed.hmrc_code ?? null };
    // Not deployed / unreachable (FunctionsFetchError, FunctionsRelayError): treat as not set up, never a crash.
    return { ok: false, code: 'not_configured', message: HMRC_NOT_SET_UP };
  } catch {
    return { ok: false, code: 'not_configured', message: HMRC_NOT_SET_UP };
  }
}

/** HMRC P1: the last test call for this company, from hmrc_audit_events (owners and admins only; null otherwise). */
export interface HmrcLastTest { at: string; kind: string; passed: boolean }
export async function fetchLastHmrcTest(companyId: string): Promise<HmrcLastTest | null> {
  try {
    const { data, error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: DbError }>)(
      'hmrc_audit_events', { p_company: companyId, p_limit: 50 });
    if (error || !Array.isArray(data)) return null;
    const row = (data as { event?: string; reason?: string | null; created_at?: string }[])
      .find((r) => r.event === 'test_result' && typeof r.reason === 'string' && typeof r.created_at === 'string');
    if (!row) return null;
    const m = /^(hello_world|hello_application|hello_user|fraud_headers_validate)_(.+)$/.exec(row.reason as string);
    if (!m) return null;
    return { at: row.created_at as string, kind: m[1], passed: m[2] === '200' };
  } catch {
    return null;
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
