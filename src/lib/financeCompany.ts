// HMRC P4b: which company an invoice, expense or bill belongs to (organization_id), and the owner-confirmed tools that
// set it. Pure functions, no I/O. The column is optional: before docs/hmrc-p4b/proposal.sql is applied it doesn't exist,
// rows carry no organization_id key, and every save is sent again without it.
import {
  DEFAULT_TREATMENT, fromPence, isGbp, isRecordedInvoice, isRecordedMoneyOut, lineNetPence, moneyOutVatPayload, splitFromGross, addToNet, sumLines,
  toPence, VAT_RATES, VAT_SCHEME, type InvoiceVatColumns, type VatColumns, type VatEntry, type VatTreatment,
} from '@/lib/vat';

export const COMPANY_KEY = 'organization_id';
export type FinanceKind = 'invoice' | 'expense' | 'bill';
export const KIND_TABLE: Record<FinanceKind, 'invoices' | 'expenses' | 'bills'> = { invoice: 'invoices', expense: 'expenses', bill: 'bills' };
export const KIND_NOUN: Record<FinanceKind, [string, string]> = { invoice: ['invoice', 'invoices'], expense: ['expense', 'expenses'], bill: ['bill', 'bills'] };

export interface CompanyColumn { organization_id?: string | null }

/** True once the database has the column: a row read with select('*') then carries the key (null or a company). */
export const hasCompanyColumn = (rows: object[]) => rows.some((r) => COMPANY_KEY in r);
/** A record with no company yet. Before the SQL is applied every record counts as having none. */
export const hasNoCompany = (r: CompanyColumn) => !r.organization_id;

/** "3 invoices, 2 expenses and 1 bill". */
export function countText(counts: Partial<Record<FinanceKind, number>>): string {
  const parts = (['invoice', 'expense', 'bill'] as FinanceKind[]).filter((k) => (counts[k] ?? 0) > 0)
    .map((k) => `${counts[k]} ${KIND_NOUN[k][counts[k] === 1 ? 0 : 1]}`);
  if (!parts.length) return 'no records';
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
}

/** PostgREST / Postgres "column organization_id does not exist": the P4b SQL isn't applied yet. */
export const isMissingCompanyColumn = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === 'PGRST204' || e.code === '42703') && /organization_id/.test(e.message ?? '');

/** The database's company rules (docs/hmrc-p4b/proposal.sql) in plain words; null for any other error. */
export function companyErrorMessage(e: { message?: string } | null | undefined): string | null {
  const m = e?.message ?? '';
  if (m.includes('FINANCE_COMPANY_REQUIRED')) return 'This record needs a company before its VAT can be recorded. Choose the company, then save again.';
  if (m.includes('FINANCE_COMPANY_NOT_MEMBER')) return 'You can only link a record to a company you are an active member of.';
  return null;
}

/** Sends a create once more without organization_id when the database doesn't have the column yet. */
export function withOptionalCompany<A extends { create: (p: P) => Promise<{ error: E | null }>; update: (id: string, p: P) => Promise<{ error: E | null }> },
  P extends Record<string, unknown> = Record<string, unknown>, E extends { code?: string; message?: string } = { code?: string; message?: string }>(api: A): A {
  const strip = (p: P) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== COMPANY_KEY)) as P;
  return {
    ...api,
    create: async (p: P) => {
      const r = await api.create(p);
      return r.error && COMPANY_KEY in p && isMissingCompanyColumn(r.error) ? api.create(strip(p)) : r;
    },
    update: async (id: string, p: P) => {
      const r = await api.update(id, p);
      if (!(r.error && COMPANY_KEY in p && isMissingCompanyColumn(r.error))) return r;
      const rest = strip(p);
      return Object.keys(rest).length ? api.update(id, rest) : { error: null };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Bulk VAT helper: "Set VAT on selected". Invoices and expenses only; GBP only; never without a preview and a confirmation.

export type FinanceInvoice = InvoiceVatColumns & CompanyColumn & { id: string; invoice_number?: string | null; status?: string | null; created_at?: string | null; tax_rate?: number | string | null };
export type FinanceExpense = VatColumns & CompanyColumn & { id: string; description?: string | null; amount?: number | string | null; date?: string | null };
export type FinanceBill = VatColumns & CompanyColumn & { id: string; description?: string | null; amount?: number | string | null; currency?: string | null; issue_date?: string | null };

export interface BulkVatChange { kind: 'invoice' | 'expense'; id: string; payload: Record<string, unknown>; net: number; vat: number; gross: number; totalChanged: boolean }
export interface BulkVatPlan {
  changes: BulkVatChange[];
  /** Pence. */
  totals: { net: number; vat: number; gross: number };
  skipped: { notGbp: number; bills: number; alreadyRecorded: number; unreadable: number };
  /** Selected records that have no company: they are linked to the chosen company in the same save. */
  needCompany: number;
}

type LineIn = { quantity?: number | string; rate?: number | string; amount?: number | string; [k: string]: unknown };

/** The invoice's lines with the chosen treatment on every line (P4 rules: VAT per line, rounded, then summed). */
function invoiceChange(inv: FinanceInvoice, treatment: VatTreatment): BulkVatChange | null {
  const lines = Array.isArray(inv.items) ? (inv.items as LineIn[]) : [];
  if (!lines.length) return null;
  const nets = lines.map((l) => lineNetPence(l.quantity ?? 1, l.rate ?? l.amount ?? 0));
  if (nets.some((n) => !Number.isFinite(n))) return null;
  const totals = sumLines(nets.map((netPence) => ({ treatment, netPence })));
  const items = lines.map((l, i) => {
    const s = totals.lines[i];
    return { ...l, amount: fromPence(s.net), vat_treatment: treatment, vat_rate: VAT_RATES[treatment], net: fromPence(s.net), vat: fromPence(s.vat), gross: fromPence(s.gross) };
  });
  const taxPoint = inv.tax_point_date || (inv.created_at ? inv.created_at.slice(0, 10) : '');
  if (!taxPoint) return null;
  const payload = {
    items, subtotal: fromPence(totals.net), tax_rate: VAT_RATES[treatment], tax_amount: fromPence(totals.vat), total_amount: fromPence(totals.gross),
    tax_point_date: taxPoint, vat_scheme: VAT_SCHEME, vat_status: 'recorded',
  };
  return { kind: 'invoice', id: inv.id, payload, net: totals.net, vat: totals.vat, gross: totals.gross, totalChanged: totals.gross !== toPence(inv.total_amount) };
}

/** An expense: the stored amount is the gross. "Including VAT" keeps the amount; "excluding" adds VAT on top. */
function expenseChange(e: FinanceExpense, treatment: VatTreatment, entry: VatEntry): BulkVatChange | null {
  const entered = toPence(e.amount);
  if (!Number.isFinite(entered) || entered < 0 || !e.date) return null;
  const s = entry === 'excluding' ? addToNet(entered, treatment) : splitFromGross(entered, treatment);
  const cols = moneyOutVatPayload({ treatment, net: s.net, vat: s.vat, taxPointDate: e.date, reclaimable: e.vat_reclaimable !== false });
  return { kind: 'expense', id: e.id, payload: { amount: fromPence(s.gross), ...cols }, net: s.net, vat: s.vat, gross: s.gross, totalChanged: s.gross !== entered };
}

export function planBulkVat(input: {
  invoices: FinanceInvoice[]; expenses: FinanceExpense[]; bills: FinanceBill[];
  treatment?: VatTreatment; entry?: VatEntry; accountCurrency: string;
}): BulkVatPlan {
  const treatment = input.treatment ?? DEFAULT_TREATMENT;
  const entry = input.entry ?? 'including';
  const plan: BulkVatPlan = { changes: [], totals: { net: 0, vat: 0, gross: 0 }, skipped: { notGbp: 0, bills: input.bills.length, alreadyRecorded: 0, unreadable: 0 }, needCompany: 0 };
  const add = (c: BulkVatChange | null, noCompany: boolean) => {
    if (!c) { plan.skipped.unreadable += 1; return; }
    plan.changes.push(c);
    plan.totals.net += c.net; plan.totals.vat += c.vat; plan.totals.gross += c.gross;
    if (noCompany) plan.needCompany += 1;
  };
  for (const inv of input.invoices) {
    if (isRecordedInvoice(inv)) { plan.skipped.alreadyRecorded += 1; continue; }
    if (!isGbp(inv.currency)) { plan.skipped.notGbp += 1; continue; }
    add(invoiceChange(inv, treatment), hasNoCompany(inv));
  }
  // Expenses have no currency of their own: they are in the account currency.
  for (const e of input.expenses) {
    if (isRecordedMoneyOut(e)) { plan.skipped.alreadyRecorded += 1; continue; }
    if (!isGbp(input.accountCurrency)) { plan.skipped.notGbp += 1; continue; }
    add(expenseChange(e, treatment, entry), hasNoCompany(e));
  }
  return plan;
}

export interface CompanyChoice { organizationId: string; name: string }
/** The company's name for a list; "No company" when none; "Another company" for one you are no longer a member of. */
export const companyLabel = (id: string | null | undefined, companies: CompanyChoice[]) =>
  !id ? 'No company' : companies.find((c) => c.organizationId === id)?.name ?? 'Another company';
/** A payload without organization_id (a create sends it only when a company was chosen). */
export const withoutCompany = <P extends Record<string, unknown>>(p: P): P => Object.fromEntries(Object.entries(p).filter(([k]) => k !== COMPANY_KEY)) as P;
