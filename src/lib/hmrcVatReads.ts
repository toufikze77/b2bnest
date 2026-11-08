// HMRC P8 (docs/hmrc-p8/README.md): the browser side of the four reads of what HMRC holds (TEST ENVIRONMENT only),
// the receipt, the deadline reminder and the pre-submit checks. Nothing HMRC returns is stored: each read is live.
// The server checks everything again (owner or admin, plan, two-step, not demo, connected with read:vat).
import { supabase } from '@/integrations/supabase/client';
import { messageFor, type FnResult, type VatObligation } from '@/lib/hmrcConnection';
import { collectHmrcFraudData } from '@/lib/hmrcFraud';
import { isoDay } from '@/lib/hmrcVat';
import { FIGURE_ROWS, type ReturnFigures, type SubmissionRecord } from '@/lib/hmrcVatSubmit';

export const NOT_AVAILABLE = "This isn't available yet.";
export const SANDBOX_DATA_NOTE = "These figures come from HMRC's test environment (sandbox), so they are test data, not your real HMRC account.";
export const PENALTIES_NOTE = 'This is what HMRC shows. Check your HMRC account for the final position.';
export const CHECK_NOT_ADVICE = 'This is a check, not tax advice.';
export const SENT_VIA = 'Sent via B2BNEST to HMRC';

/** The same allow-lists as supabase/functions/_shared/hmrc/vatReads.ts (sandbox only). */
export const LIABILITY_SCENARIOS = ['SINGLE_LIABILITY', 'MULTIPLE_LIABILITIES', 'SINGLE_LIABILITY_2018_19', 'MULTIPLE_LIABILITIES_2018_19', 'INSOLVENT_TRADER'] as const;
export const PAYMENT_SCENARIOS = ['SINGLE_PAYMENT', 'MULTIPLE_PAYMENTS', 'SINGLE_PAYMENT_2018_19', 'MULTIPLE_PAYMENTS_2018_19', 'INSOLVENT_TRADER'] as const;
export const PENALTY_SCENARIOS = ['DEFAULT', 'NO_PENALTIES', 'LATE_SUBMISSION', 'LATE_PAYMENT', 'MULTIPLE_PENALTIES', 'MULTIPLE_LATE_PAYMENT_PENALTIES',
  'MULTIPLE_LATE_SUBMISSION_PENALTIES', 'MULTIPLE_INACTIVE_LATE_SUBMISSION_PENALTIES', 'THRESHOLD_LATE_SUBMISSION_PENALTIES', 'CHARGE_LATE_SUBMISSION_PENALTIES'] as const;

export interface BoxDifference { box: number; field: string; ours: number | null; hmrc: number | null }
export interface Liability { taxPeriod: { from: string; to: string } | null; type: string; originalAmount: number; outstandingAmount: number | null; due: string | null }
export interface Payment { amount: number; received: string | null }
type Flat = Record<string, string | number | boolean>;
export interface Penalties { totalisations: Flat; lateSubmission: { summary: Flat; details: Flat[] }; latePayment: { details: Flat[] } }
export interface ReadResult extends FnResult {
  matches?: boolean; differences?: BoxDifference[]; period_key?: string; form_bundle_number?: string | null;
  liabilities?: Liability[]; payments?: Payment[]; penalties?: Penalties; note?: string; from?: string; to?: string; retry_after?: number;
}
export type ReadFunction = 'hmrc-vat-return-view' | 'hmrc-vat-liabilities' | 'hmrc-vat-payments' | 'hmrc-vat-penalties';

/** One read. A function that isn't deployed yet (404, unreachable) answers not_available, never a crash. */
export async function callRead(name: ReadFunction, body: Record<string, unknown>): Promise<ReadResult> {
  const notAvailable: ReadResult = { ok: false, code: 'not_available', message: NOT_AVAILABLE };
  try {
    const { data, error } = await supabase.functions.invoke(name, { body: { ...body, fraud: collectHmrcFraudData() } });
    if (!error) return (data as ReadResult) ?? { ok: false, code: 'server_error', message: messageFor('server_error') };
    const ctx = (error as { context?: { status?: number; json?: () => Promise<unknown> } }).context;
    if (ctx?.status === 404) return notAvailable;
    const parsed = ctx?.json ? await ctx.json().catch(() => null) as ReadResult | null : null;
    if (parsed?.code) return { ...parsed, ok: false, message: parsed.message ?? messageFor(parsed.code) };
    return notAvailable;
  } catch {
    return notAvailable;
  }
}
const scen = (s?: string) => (s ? { scenario: s } : {});
export const viewReturn = (companyId: string, periodKey: string) => callRead('hmrc-vat-return-view', { company_id: companyId, period_key: periodKey });
export const getLiabilities = (companyId: string, from: string, to: string, scenario?: string) => callRead('hmrc-vat-liabilities', { company_id: companyId, from, to, ...scen(scenario) });
export const getPayments = (companyId: string, from: string, to: string, scenario?: string) => callRead('hmrc-vat-payments', { company_id: companyId, from, to, ...scen(scenario) });
export const getPenalties = (companyId: string, scenario?: string) => callRead('hmrc-vat-penalties', { company_id: companyId, ...scen(scenario) });

/** £1,234.50 (HMRC's amounts are pounds). */
export const gbp = (v: number | null | undefined) =>
  (typeof v === 'number' ? `${v < 0 ? '−' : ''}£${Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—');

/** HMRC allows at most 365 days for liabilities and payments, up to today. */
export function last365(today = new Date()): { from: string; to: string } {
  const from = new Date(today); from.setDate(from.getDate() - 364);
  return { from: isoDay(from), to: isoDay(today) };
}
export function rangeProblem(from: string, to: string, today = isoDay(new Date())): string {
  const a = Date.parse(`${from}T00:00:00Z`), b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 'Choose a start date on or before the end date.';
  if (to > today) return 'Choose an end date up to today.';
  if (Math.round((b - a) / 86_400_000) + 1 > 365) return 'HMRC allows at most 365 days at a time.';
  return '';
}

// --- the deadline reminder (no HMRC call: the obligations this page already read) ----------------------------------
export type Reminder = { level: 'overdue' | 'due_1' | 'due_7' | 'due_14'; periodKey: string; due: string; days: number; others: number };
const dayNo = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
/** The most urgent open obligation due within 14 days or overdue; null otherwise. */
export function deadlineReminder(obligations: VatObligation[] | null | undefined, today = isoDay(new Date())): Reminder | null {
  const open = (obligations ?? []).filter((o) => o.status === 'O' && /^\d{4}-\d{2}-\d{2}$/.test(o.due))
    .map((o) => ({ o, days: dayNo(o.due) - dayNo(today) })).filter((x) => x.days <= 14).sort((a, b) => a.days - b.days);
  if (!open.length) return null;
  const { o, days } = open[0];
  const level = days < 0 ? 'overdue' : days <= 1 ? 'due_1' : days <= 7 ? 'due_7' : 'due_14';
  return { level, periodKey: o.periodKey, due: o.due, days, others: open.length - 1 };
}
export function reminderText(r: Reminder, dueText: string): string {
  const more = r.others ? ` ${r.others} more ${r.others === 1 ? 'return is' : 'returns are'} due soon or overdue.` : '';
  if (r.level === 'overdue') return `The VAT return for ${r.periodKey} was due on ${dueText} and HMRC still shows it as open.${more}`;
  if (r.days === 0) return `The VAT return for ${r.periodKey} is due today (${dueText}).${more}`;
  return `The VAT return for ${r.periodKey} is due in ${r.days} ${r.days === 1 ? 'day' : 'days'}, on ${dueText}.${more}`;
}

// --- pre-submit checks ------------------------------------------------------------------------------------------
export interface PreSubmitCheck { rule: 'box3_sum' | 'box5_net' | 'box5_negative' | 'big_change'; block: boolean; message: string }
const pence = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) : null);
/**
 * Checks before submitting. HMRC's VAT API (OpenAPI, verified 8 Nov 2026) rejects box 3 ≠ box 1 + box 2
 * (VAT_TOTAL_VALUE), box 5 ≠ |box 3 − box 4| (VAT_NET_VALUE) and a negative box 5 (minimum 0); those block. Every
 * other box may be negative. A change of more than 50% from the last accepted return only warns.
 */
export function preSubmitChecks(f: Partial<ReturnFigures> | null | undefined, last?: Partial<ReturnFigures> | null): PreSubmitCheck[] {
  if (!f) return [];
  const out: PreSubmitCheck[] = [];
  const [b1, b2, b3, b4, b5] = [f.vatDueSales, f.vatDueAcquisitions, f.totalVatDue, f.vatReclaimedCurrPeriod, f.netVatDue].map(pence);
  if (b1 !== null && b2 !== null && b3 !== null && b3 !== b1 + b2) {
    out.push({ rule: 'box3_sum', block: true, message: 'Box 3 should be box 1 plus box 2. HMRC rejects a return where it isn\'t.' });
  }
  if (b5 !== null && b5 < 0) out.push({ rule: 'box5_negative', block: true, message: 'Box 5 can\'t be negative. HMRC rejects a negative box 5.' });
  else if (b3 !== null && b4 !== null && b5 !== null && b5 !== Math.abs(b3 - b4)) {
    out.push({ rule: 'box5_net', block: true, message: 'Box 5 should be the difference between box 3 and box 4. HMRC rejects a return where it isn\'t.' });
  }
  if (last) {
    for (const [k, n, label] of FIGURE_ROWS) {
      const now = pence(f[k]), before = pence(last[k]);
      if (now === null || before === null || before === 0) continue;
      const change = Math.abs(now - before) / Math.abs(before);
      if (change > 0.5) {
        out.push({ rule: 'big_change', block: false, message: `Box ${n} (${label.toLowerCase()}) is ${Math.round(change * 100)}% ${now > before ? 'higher' : 'lower'} than in your last accepted return. Check it's right.` });
      }
    }
  }
  return out;
}
/** The newest accepted submission for another period (the history is newest first). */
export function lastAccepted(rows: SubmissionRecord[] | null | undefined, periodKey: string): SubmissionRecord | null {
  return (rows ?? []).find((r) => r.status === 'accepted' && r.period_key !== periodKey) ?? null;
}

// --- penalties: labels for the fields HMRC sends ------------------------------------------------------------------
export const PENALTY_LABELS: Record<string, string> = {
  lateSubmissionPenaltyTotalValue: 'Late submission penalties', penalisedPrincipalTotal: 'VAT that late payment penalties are charged on',
  latePaymentPenaltyPostedTotal: 'Late payment penalties charged', latePaymentPenaltyEstimateTotal: 'Late payment penalties building up (estimate)',
  activePenaltyPoints: 'Active penalty points', inactivePenaltyPoints: 'Inactive penalty points', regimeThreshold: 'Points before a penalty is charged',
  periodOfComplianceAchievement: 'Points expire after', penaltyChargeAmount: 'Penalty charge',
};
export const isAmountField = (k: string) => /Amount|Total|Value/.test(k) && !/Points/.test(k);
