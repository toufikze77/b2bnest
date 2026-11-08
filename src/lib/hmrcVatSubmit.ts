// HMRC P6: the browser side of hmrc-vat-submit (docs/hmrc-p6/README.md). TEST ENVIRONMENT (sandbox) ONLY. The browser
// never sends figures: the server recomputes them. Submission history is read from public.hmrc_vat_submissions
// (owners and admins of the company, by RLS); the browser can't write it.
import { supabase } from '@/integrations/supabase/client';
import { callHmrcFunction, type FnResult } from '@/lib/hmrcConnection';
import { collectHmrcFraudData } from '@/lib/hmrcFraud';
import type { ReturnBoxes } from '@/lib/vat';

export const TEST_ENV_BANNER = 'TEST ENVIRONMENT. Nothing here is filed with HMRC for real.';
export const DECLARATION = "I confirm that the information in this return is correct and complete to the best of my knowledge. I understand this is a submission to HMRC's test environment.";
/** The same allow-list as the server (supabase/functions/_shared/hmrc/vatSubmit.ts). Sandbox only. */
export const SUBMIT_SCENARIOS = ['DUPLICATE_SUBMISSION', 'TAX_PERIOD_NOT_ENDED', 'INVALID_PERIODKEY', 'INSOLVENT_TRADER', 'NOT_FOUND'] as const;

export interface ReturnFigures {
  periodKey: string; vatDueSales: number; vatDueAcquisitions: number; totalVatDue: number; vatReclaimedCurrPeriod: number; netVatDue: number;
  totalValueSalesExVAT: number; totalValuePurchasesExVAT: number; totalValueGoodsSuppliedExVAT: number; totalAcquisitionsExVAT: number; finalised: boolean;
}
export const FIGURE_ROWS: [keyof ReturnFigures, number, string][] = [
  ['vatDueSales', 1, 'VAT due on sales'], ['vatDueAcquisitions', 2, 'VAT due on acquisitions from the EU / NI'], ['totalVatDue', 3, 'Total VAT due'],
  ['vatReclaimedCurrPeriod', 4, 'VAT reclaimed on purchases'], ['netVatDue', 5, 'Net VAT'], ['totalValueSalesExVAT', 6, 'Total sales excluding VAT'],
  ['totalValuePurchasesExVAT', 7, 'Total purchases excluding VAT'], ['totalValueGoodsSuppliedExVAT', 8, 'Goods supplied to the EU / NI'],
  ['totalAcquisitionsExVAT', 9, 'Acquisitions from the EU / NI'],
];

export interface Prepared extends FnResult {
  obligation?: { periodKey: string; start: string; end: string; due: string };
  figures?: ReturnFigures; boxes?: ReturnBoxes; blocking?: string[]; blocking_messages?: string[];
  confirmation_token?: string | null; expires_at?: string; declaration?: string; live_status?: string | null;
}
export interface Receipt { processing_date: string | null; payment_indicator: 'DD' | 'BANK' | null; form_bundle_number: string | null; charge_ref_number: string | null }
export interface Submitted extends FnResult { submission_id?: string; receipt?: Receipt; receipt_known?: boolean }

const body = (companyId: string, periodKey: string, extra: Record<string, unknown>) => ({ company_id: companyId, period_key: periodKey, fraud: collectHmrcFraudData(), ...extra });
export const prepareReturn = (companyId: string, periodKey: string) => callHmrcFunction('hmrc-vat-submit', body(companyId, periodKey, { action: 'prepare' })) as Promise<Prepared>;
export const submitReturn = (companyId: string, periodKey: string, token: string, scenario: string | null) =>
  callHmrcFunction('hmrc-vat-submit', body(companyId, periodKey, { action: 'submit', confirmation_token: token, declaration: true, ...(scenario ? { scenario } : {}) })) as Promise<Submitted>;
export const checkReturn = (companyId: string, periodKey: string, confirmNotReceived = false) =>
  callHmrcFunction('hmrc-vat-submit', body(companyId, periodKey, { action: 'check', ...(confirmNotReceived ? { confirm_not_received: true } : {}) })) as Promise<Submitted>;

export interface SubmissionRecord {
  id: string; period_key: string; period_start: string; period_end: string; status: 'submitting' | 'accepted' | 'rejected' | 'unknown';
  figures: Partial<ReturnFigures>; submitted_by_name: string | null; submitted_at: string; completed_at: string | null;
  processing_date: string | null; payment_indicator: string | null; form_bundle_number: string | null; charge_ref_number: string | null;
  http_status: number | null; error_code: string | null; error_message: string | null; vrn_last3: string | null; test_scenario: string | null;
}
const COLUMNS = 'id, period_key, period_start, period_end, status, figures, submitted_by_name, submitted_at, completed_at, processing_date, payment_indicator, form_bundle_number, charge_ref_number, http_status, error_code, error_message, vrn_last3, test_scenario';
type DbError = { code?: string; message?: string } | null;

/** The company's submission history (newest first). notAvailable: the database update isn't applied yet. */
export async function fetchSubmissions(companyId: string): Promise<{ rows: SubmissionRecord[]; notAvailable?: boolean; error?: boolean }> {
  try {
    const { data, error } = await (supabase.from as unknown as (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { order: (k: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: unknown; error: DbError }> } } } })(
      'hmrc_vat_submissions').select(COLUMNS).eq('organization_id', companyId).order('submitted_at', { ascending: false }).limit(50);
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message ?? '')) return { rows: [], notAvailable: true };
      return { rows: [], error: true };
    }
    return { rows: Array.isArray(data) ? (data as SubmissionRecord[]) : [] };
  } catch {
    return { rows: [], error: true };
  }
}

const cell = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** One submission as CSV: the period, the nine boxes as sent, HMRC's receipt and the times. No token, no full VAT number. */
export function receiptCsv(r: SubmissionRecord): string {
  const lines: unknown[][] = [
    ['B2BNEST VAT return submission (HMRC TEST ENVIRONMENT: nothing filed for real)'],
    ['Period key', r.period_key], ['Period', r.period_start, r.period_end], ['Status', r.status], ['Submitted at', r.submitted_at], ['Submitted by', r.submitted_by_name ?? ''],
    ['Completed at', r.completed_at ?? ''], ['VAT number ends', r.vrn_last3 ?? ''], ['Test scenario', r.test_scenario ?? ''],
    [],
    ['Box', 'Field', 'Value sent'],
    ...FIGURE_ROWS.map(([k, n]) => [n, k, r.figures?.[k] ?? '']),
    [],
    ['Processing date', r.processing_date ?? ''], ['Form bundle number', r.form_bundle_number ?? ''], ['Payment indicator', r.payment_indicator ?? ''],
    ['Charge reference', r.charge_ref_number ?? ''], ['HTTP status', r.http_status ?? ''], ['Result code', r.error_code ?? ''], ['Result', r.error_message ?? ''],
  ];
  return lines.map((l) => l.map(cell).join(',')).join('\n') + '\n';
}
