// HMRC P4: what makes a record "recorded" (it has a full VAT breakdown) or "VAT not recorded". The same rules as the
// database checks in docs/hmrc-p4/proposal.sql, so the app never offers to save something the database refuses.
// The columns are optional: before the SQL is applied every record reads as not recorded.
import { addToNet, toPence, vatOnNet } from './money';
import { isVatTreatment, SUPPLIER_ROUNDING_TOLERANCE_PENCE, VAT_RATES, VAT_SCHEME, type VatTreatment } from './treatments';

export type VatStatus = 'recorded' | 'not_recorded';
/** The VAT columns on expenses and bills (all optional: absent before the SQL is applied). */
export interface VatColumns {
  net_amount?: number | string | null;
  vat_amount?: number | string | null;
  vat_treatment?: string | null;
  vat_rate?: number | string | null;
  vat_status?: string | null;
  vat_scheme?: string | null;
  tax_point_date?: string | null;
  vat_reclaimable?: boolean | null;
}
/** One invoice line with its VAT (stored in invoices.items). */
export interface InvoiceVatLine {
  description?: string; quantity?: number; rate?: number; amount?: number;
  vat_treatment?: string; vat_rate?: number; net?: number; vat?: number; gross?: number;
}
export interface InvoiceVatColumns {
  items?: unknown; subtotal?: number | string | null; tax_amount?: number | string | null; total_amount?: number | string | null;
  vat_status?: string | null; tax_point_date?: string | null; currency?: string | null;
}

/** A recorded expense or bill: every VAT field present, net + VAT = gross, and VAT matching its treatment. */
export function isRecordedMoneyOut(r: VatColumns & { amount?: number | string | null }): boolean {
  if (r.vat_status !== 'recorded' || !isVatTreatment(r.vat_treatment) || !r.tax_point_date) return false;
  return vatProblem({ treatment: r.vat_treatment, net: toPence(r.net_amount), vat: toPence(r.vat_amount), gross: toPence(r.amount), rate: Number(r.vat_rate) }) === null;
}

/** Why a net / VAT / gross set is not acceptable for a treatment, or null when it is (1p supplier tolerance). */
export function vatProblem(x: { treatment: VatTreatment; net: number; vat: number; gross: number; rate?: number }): string | null {
  if (![x.net, x.vat, x.gross].every(Number.isFinite)) return 'Enter the amounts in pounds and pence.';
  if (x.net + x.vat !== x.gross) return 'Net plus VAT must equal the total.';
  if (x.vat < 0) return 'VAT can’t be negative.';
  const rate = x.rate ?? VAT_RATES[x.treatment];
  if (VAT_RATES[x.treatment] === 0) return x.vat === 0 && rate === 0 ? null : 'This treatment has no VAT.';
  if (Math.abs(x.vat - vatOnNet(x.net, x.treatment)) > SUPPLIER_ROUNDING_TOLERANCE_PENCE) return 'The VAT can differ from the calculated VAT by 1p at most.';
  return rate > 0 ? null : 'This treatment needs its VAT rate.';
}

/** A recorded invoice: a tax point, and every line with a valid treatment whose VAT matches, adding up exactly. */
export function isRecordedInvoice(d: InvoiceVatColumns): boolean {
  if (d.vat_status !== 'recorded' || !d.tax_point_date || !Array.isArray(d.items) || d.items.length === 0) return false;
  let net = 0, vat = 0;
  for (const raw of d.items as InvoiceVatLine[]) {
    if (!isVatTreatment(raw.vat_treatment)) return false;
    const s = addToNet(toPence(raw.net), raw.vat_treatment);
    if (s.vat !== toPence(raw.vat) || s.gross !== toPence(raw.gross)) return false;
    net += s.net; vat += s.vat;
  }
  return net === toPence(d.subtotal) && vat === toPence(d.tax_amount) && net + vat === toPence(d.total_amount);
}

/** Either kind. */
export function isRecorded(r: (VatColumns & { amount?: number | string | null }) | InvoiceVatColumns, kind: 'invoice' | 'expense' | 'bill'): boolean {
  return kind === 'invoice' ? isRecordedInvoice(r as InvoiceVatColumns) : isRecordedMoneyOut(r as VatColumns & { amount?: number | string | null });
}

export const isGbp = (currency: string | null | undefined) => (currency ?? '').trim().toUpperCase() === 'GBP';

/** The VAT columns to save for an expense or bill (amounts in pounds). */
export function moneyOutVatPayload(x: { treatment: VatTreatment; net: number; vat: number; taxPointDate: string; reclaimable: boolean }) {
  return {
    net_amount: x.net / 100, vat_amount: x.vat / 100, vat_treatment: x.treatment, vat_rate: VAT_RATES[x.treatment],
    vat_status: 'recorded' as const, vat_scheme: VAT_SCHEME, tax_point_date: x.taxPointDate, vat_reclaimable: x.reclaimable,
  };
}
/** The column names P4 adds (dropped from a save when the database doesn't have them yet). */
export const MONEY_OUT_VAT_KEYS = ['net_amount', 'vat_amount', 'vat_treatment', 'vat_rate', 'vat_status', 'vat_scheme', 'tax_point_date', 'vat_reclaimable'] as const;
export const INVOICE_VAT_KEYS = ['vat_status', 'vat_scheme', 'tax_point_date'] as const;
/** PostgREST / Postgres "column does not exist": the P4 SQL isn't applied yet. */
export const isMissingColumnError = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === 'PGRST204' || e.code === '42703' || /column .* (does not exist|of '.*' in the schema cache)/i.test(e.message ?? ''));

/** An issued invoice (not a draft) without a full VAT breakdown: counted in "needs VAT details", left out of VAT figures. */
export const invoiceNeedsVat = (d: InvoiceVatColumns & { status?: string | null }) => (d.status ?? '') !== 'draft' && !isRecordedInvoice(d);
/** An expense or bill without a full VAT breakdown. */
export const moneyOutNeedsVat = (r: VatColumns & { amount?: number | string | null }) => !isRecordedMoneyOut(r);

/** A recorded invoice's VAT per treatment (pounds), in the fixed order, for the PDF and preview; null otherwise. */
export function vatGroupsOf(d: InvoiceVatColumns): { treatment: VatTreatment; net: number; vat: number; gross: number }[] | null {
  if (!isRecordedInvoice(d)) return null;
  const groups = new Map<VatTreatment, { net: number; vat: number; gross: number }>();
  for (const l of d.items as InvoiceVatLine[]) {
    const t = l.vat_treatment as VatTreatment;
    const g = groups.get(t) ?? { net: 0, vat: 0, gross: 0 };
    g.net += toPence(l.net); g.vat += toPence(l.vat); g.gross += toPence(l.gross);
    groups.set(t, g);
  }
  return VAT_TREATMENTS_ORDER.filter((t) => groups.has(t)).map((t) => ({ treatment: t, net: groups.get(t)!.net / 100, vat: groups.get(t)!.vat / 100, gross: groups.get(t)!.gross / 100 }));
}
const VAT_TREATMENTS_ORDER: VatTreatment[] = ['standard', 'reduced', 'zero', 'exempt', 'outside_scope'];

/**
 * Wraps a money-out API so a save still works before the P4 database update: if the database says a VAT column does
 * not exist, the same save is sent once more without the VAT columns (the record then stays "VAT not recorded").
 */
export function withOptionalVatColumns<A extends { create: (p: P) => Promise<{ error: E | null }>; update: (id: string, p: P) => Promise<{ error: E | null }> },
  P extends Record<string, unknown> = Record<string, unknown>, E extends { code?: string; message?: string } = { code?: string; message?: string }>(
  api: A, keys: readonly string[], onMissing?: () => void,
): A {
  const strip = (p: P) => Object.fromEntries(Object.entries(p).filter(([k]) => !keys.includes(k))) as P;
  const hasVat = (p: P) => Object.keys(p).some((k) => keys.includes(k));
  return {
    ...api,
    create: async (p: P) => {
      const r = await api.create(p);
      if (r.error && hasVat(p) && isMissingColumnError(r.error)) { onMissing?.(); return api.create(strip(p)); }
      return r;
    },
    update: async (id: string, p: P) => {
      const r = await api.update(id, p);
      if (r.error && hasVat(p) && isMissingColumnError(r.error)) {
        onMissing?.();
        const rest = strip(p);
        return Object.keys(rest).length ? api.update(id, rest) : { error: null };
      }
      return r;
    },
  };
}
