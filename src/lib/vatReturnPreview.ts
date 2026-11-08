// HMRC P5: reading the VAT return preview (public.vat_company_return_preview, docs/hmrc-p5/proposal.sql). Read only:
// there is no write, submit or store call here or anywhere else.
import { supabase } from '@/integrations/supabase/client';
import { isoDay } from '@/lib/hmrcVat';
import type { PreviewRow } from '@/lib/vat';

export const ONLY_ADMINS = 'Only owners and admins can see the VAT return.';
export const NOT_AVAILABLE_YET = 'The VAT return preview is not available yet.';

export type PreviewFailure = 'not_available' | 'denied' | 'plan' | 'two_step' | 'demo' | 'invalid' | 'error';
export type PreviewResult = { ok: true; rows: PreviewRow[] } | { ok: false; kind: PreviewFailure };

type DbError = { code?: string; message?: string } | null;

export function previewFailureOf(e: DbError): PreviewFailure {
  const m = e?.message ?? '';
  if (e?.code === 'PGRST202' || e?.code === '42883' || /could not find the function/i.test(m)) return 'not_available';
  if (/VAT_PREVIEW_PLAN/.test(m)) return 'plan';
  if (/authenticator code|MFA_REQUIRED/i.test(m)) return 'two_step';
  if (/demo account/i.test(m)) return 'demo';
  if (/VAT_PREVIEW_INVALID/.test(m)) return 'invalid';
  if (/VAT_PREVIEW_DENIED/.test(m) || e?.code === '42501') return 'denied';
  return 'error';
}

export async function fetchReturnPreview(companyId: string, from: string, to: string): Promise<PreviewResult> {
  try {
    const { data, error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: DbError }>)(
      'vat_company_return_preview', { p_organization_id: companyId, p_from: from, p_to: to });
    if (error) return { ok: false, kind: previewFailureOf(error) };
    return { ok: true, rows: Array.isArray(data) ? (data as PreviewRow[]) : [] };
  } catch {
    return { ok: false, kind: 'error' };
  }
}

/** The last full calendar quarter before today (a sensible first period when no HMRC obligation is chosen). */
export function previousQuarter(today = new Date()): { from: string; to: string } {
  const q = Math.floor(today.getMonth() / 3);
  const startMonth = q * 3 - 3;
  const from = new Date(today.getFullYear(), startMonth, 1);
  const to = new Date(from.getFullYear(), from.getMonth() + 3, 0);
  return { from: isoDay(from), to: isoDay(to) };
}
