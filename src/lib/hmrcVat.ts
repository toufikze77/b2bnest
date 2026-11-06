// HMRC P3: VAT obligations, read live from HMRC's test environment through hmrc-vat-obligations. Read only: nothing is
// sent to HMRC except that read, and nothing is stored. The server checks everything again.
import { callHmrcFunction, type FnResult, type VatObligation } from '@/lib/hmrcConnection';
import { collectHmrcFraudData } from '@/lib/hmrcFraud';

/** The sandbox test scenarios the owner may pick (the same allow-list as supabase/functions/_shared/hmrc/vatObligations.ts). */
export const VAT_TEST_SCENARIOS: { value: string; label: string }[] = [
  { value: 'QUARTERLY_NONE_MET', label: 'Quarterly, none met' },
  { value: 'QUARTERLY_ONE_MET', label: 'Quarterly, one met' },
  { value: 'QUARTERLY_TWO_MET', label: 'Quarterly, two met' },
  { value: 'QUARTERLY_THREE_MET', label: 'Quarterly, three met' },
  { value: 'QUARTERLY_FOUR_MET', label: 'Quarterly, four met' },
  { value: 'MONTHLY_NONE_MET', label: 'Monthly, none met' },
  { value: 'MONTHLY_ONE_MET', label: 'Monthly, one met' },
  { value: 'NOT_FOUND', label: 'No obligations found' },
];

export const TEST_ENV_NOTE = "These VAT obligations come from HMRC's test environment (sandbox), not your real HMRC account.";
export const PRODUCTION_NOT_AVAILABLE = 'Production is not available yet.';

/** A YYYY-MM-DD date from HMRC as 2 Nov 2026, without any time-zone shift. */
export function ukDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export interface ObligationsQuery { status: 'O' | 'F'; from?: string; to?: string; scenario?: string }

export function getVatObligations(companyId: string, q: ObligationsQuery): Promise<FnResult> {
  const body: Record<string, unknown> = { company_id: companyId, status: q.status, fraud: collectHmrcFraudData() };
  if (q.status === 'F' && q.from && q.to) { body.from = q.from; body.to = q.to; }
  if (q.scenario) body.scenario = q.scenario;
  return callHmrcFunction('hmrc-vat-obligations', body);
}

/** YYYY-MM-DD for a local date. */
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** The default range for fulfilled obligations: the last 12 months (HMRC allows at most 366 days). */
export function lastYear(today = new Date()): { from: string; to: string } {
  const from = new Date(today); from.setDate(from.getDate() - 364);
  return { from: isoDay(from), to: isoDay(today) };
}
/** Days between two YYYY-MM-DD dates, inclusive; null for a bad date. */
export function rangeDays(from: string, to: string): number | null {
  const a = Date.parse(`${from}T00:00:00Z`), b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000) + 1;
}

export type ObligationLabel = 'Fulfilled' | 'Open' | 'Open, due date passed';
export function labelFor(o: VatObligation, today = isoDay(new Date())): ObligationLabel {
  if (o.status === 'F') return 'Fulfilled';
  return o.due < today ? 'Open, due date passed' : 'Open';
}
export type { VatObligation };
