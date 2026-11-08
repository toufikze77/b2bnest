// HMRC P5: the nine VAT return boxes from public.vat_company_return_preview (docs/hmrc-p5/proposal.sql). Pure
// functions, integer pence inside. The rules come from ./returnRules (all NOT VERIFIED against HMRC). Nothing here
// sends, stores or submits anything: it is a preview.
import { toPence } from './money';
import { VAT_TREATMENTS, VAT_TREATMENT_SHORT, isVatTreatment, type VatTreatment } from './treatments';
import { UNSUPPORTED_BOXES, VALUE_BOX_TREATMENTS, VAT_BOX_TREATMENTS, WHOLE_POUND_ROUNDING } from './returnRules';

/** One row of public.vat_company_return_preview. Money arrives as numeric (a JSON number or text). */
export interface PreviewRow {
  row_kind: 'included' | 'left_out' | string;
  source: 'invoices' | 'expenses' | 'bills' | string;
  treatment: string | null;
  reason: string | null;
  records: number | string;
  net: number | string | null;
  vat: number | string | null;
  vat_not_reclaimable: number | string | null;
}

export type Side = 'sales' | 'purchases';
export interface TreatmentTotal { treatment: VatTreatment; records: number; net: number; vat: number; vatNotReclaimable: number }
export type LeftOutReason = 'not_recorded' | 'no_company' | 'not_gbp' | 'draft' | 'archived' | 'cancelled' | 'outside_period' | 'vat_not_reclaimable';
export interface LeftOut { reason: LeftOutReason; source: 'invoices' | 'expenses' | 'bills'; records: number; vat: number }

export interface ReturnBoxes {
  /** Boxes 1 to 5 in pence; boxes 6 to 9 in whole pounds. */
  box1: number; box2: number; box3: number; box4: number; box5: number; box6: number; box7: number; box8: number; box9: number;
  /** Box 5 is shown as a positive figure: to pay (3 > 4), to reclaim (4 > 3) or nothing (equal). */
  netDirection: 'to_pay' | 'to_reclaim' | 'nil';
  sales: TreatmentTotal[];
  purchases: TreatmentTotal[];
  leftOut: LeftOut[];
  /** Records counted in the boxes. */
  included: { sales: number; purchases: number };
}

const SIDE: Record<string, Side> = { invoices: 'sales', expenses: 'purchases', bills: 'purchases' };
const count = (v: number | string | null | undefined) => Math.max(0, Math.trunc(Number(v) || 0));
const pence = (v: number | string | null | undefined) => { const p = toPence(v ?? 0); return Number.isFinite(p) ? p : 0; };

/** Pence to whole pounds for boxes 6 to 9 (pence dropped). */
export function wholePounds(p: number): number {
  // WHOLE_POUND_ROUNDING is 'down' (not verified): the pence are dropped.
  return WHOLE_POUND_ROUNDING === 'down' ? Math.floor(p / 100) : Math.round(p / 100);
}

function totalsFor(rows: PreviewRow[], side: Side): TreatmentTotal[] {
  const by = new Map<VatTreatment, TreatmentTotal>();
  for (const r of rows) {
    if (r.row_kind !== 'included' || SIDE[r.source] !== side || !isVatTreatment(r.treatment)) continue;
    const t = by.get(r.treatment) ?? { treatment: r.treatment, records: 0, net: 0, vat: 0, vatNotReclaimable: 0 };
    t.records += count(r.records); t.net += pence(r.net); t.vat += pence(r.vat); t.vatNotReclaimable += pence(r.vat_not_reclaimable);
    by.set(r.treatment, t);
  }
  return VAT_TREATMENTS.filter((t) => by.has(t)).map((t) => by.get(t)!);
}

const sum = (list: TreatmentTotal[], keep: readonly VatTreatment[], key: 'net' | 'vat') =>
  list.filter((t) => keep.includes(t.treatment)).reduce((n, t) => n + t[key], 0);

export function computeReturnBoxes(rows: PreviewRow[]): ReturnBoxes {
  const sales = totalsFor(rows, 'sales');
  const purchases = totalsFor(rows, 'purchases');
  const box1 = sum(sales, VAT_BOX_TREATMENTS, 'vat');
  const box2 = 0; // EU / NI acquisitions: not supported yet
  const box3 = box1 + box2;
  const box4 = sum(purchases, VAT_BOX_TREATMENTS, 'vat'); // reclaimable VAT only (the function leaves the rest out)
  const diff = box3 - box4;
  const leftOut: LeftOut[] = rows
    .filter((r) => r.row_kind === 'left_out' && r.reason)
    .map((r) => ({ reason: r.reason as LeftOutReason, source: r.source as LeftOut['source'], records: count(r.records), vat: pence(r.vat_not_reclaimable) }))
    .filter((l) => l.records > 0);
  return {
    box1, box2, box3, box4, box5: Math.abs(diff),
    box6: wholePounds(sum(sales, VALUE_BOX_TREATMENTS, 'net')),
    box7: wholePounds(sum(purchases, VALUE_BOX_TREATMENTS, 'net')),
    box8: 0, box9: 0,
    netDirection: diff > 0 ? 'to_pay' : diff < 0 ? 'to_reclaim' : 'nil',
    sales, purchases, leftOut,
    included: { sales: sales.reduce((n, t) => n + t.records, 0), purchases: purchases.reduce((n, t) => n + t.records, 0) },
  };
}

export const BOX_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type BoxNumber = typeof BOX_NUMBERS[number];
export const isUnsupportedBox = (n: number) => (UNSUPPORTED_BOXES as readonly number[]).includes(n);
/** Boxes 1 to 5 are money (pounds and pence); 6 to 9 whole pounds. */
export const isWholePoundBox = (n: number) => n >= 6;

export const BOX_TITLES: Record<BoxNumber, string> = {
  1: 'VAT due on sales',
  2: 'VAT due on acquisitions from the EU / Northern Ireland',
  3: 'Total VAT due',
  4: 'VAT reclaimed on purchases',
  5: 'Net VAT',
  6: 'Total value of sales, excluding VAT',
  7: 'Total value of purchases, excluding VAT',
  8: 'Supplies of goods to the EU / Northern Ireland',
  9: 'Acquisitions of goods from the EU / Northern Ireland',
};

/** One plain-English line: what feeds the box. */
export function explainBox(n: BoxNumber): string {
  switch (n) {
    case 1: return 'Box 1 = VAT on standard and reduced sales lines recorded in this period.';
    case 2: return 'Box 2 = 0.00: acquisitions from the EU / Northern Ireland are not supported yet.';
    case 3: return 'Box 3 = box 1 + box 2.';
    case 4: return 'Box 4 = VAT you can reclaim on expenses and bills recorded in this period (VAT marked "not reclaimable" is left out).';
    case 5: return 'Box 5 = the difference between box 3 and box 4, shown as a positive figure, with whether it is to pay or to reclaim.';
    case 6: return 'Box 6 = sales excluding VAT (standard, reduced, zero-rated and exempt lines), in whole pounds; sales outside the scope of VAT are left out.';
    case 7: return 'Box 7 = purchases excluding VAT (standard, reduced, zero-rated and exempt), in whole pounds, including purchases whose VAT is not reclaimable; outside the scope of VAT is left out.';
    case 8: return 'Box 8 = 0: supplies of goods to the EU / Northern Ireland are not supported yet.';
    case 9: return 'Box 9 = 0: acquisitions of goods from the EU / Northern Ireland are not supported yet.';
  }
}

export const boxValue = (b: ReturnBoxes, n: BoxNumber): number => b[`box${n}` as keyof ReturnBoxes] as number;

/** "1,234.56" for boxes 1 to 5 (pence), "1,234" for 6 to 9 (whole pounds). No currency sign: HMRC boxes are GBP. */
export function formatBox(n: BoxNumber, value: number): string {
  if (isWholePoundBox(n)) return value.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  return (value / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const LEFT_OUT_TEXT: Record<LeftOutReason, string> = {
  not_recorded: 'VAT details not recorded',
  no_company: 'Not linked to a company',
  not_gbp: 'Not in GBP',
  draft: 'Draft invoices',
  archived: 'Archived invoices',
  cancelled: 'Cancelled bills',
  outside_period: 'Tax point outside the period',
  vat_not_reclaimable: 'VAT not reclaimable (purchase counted in box 7, VAT not in box 4)',
};

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const money2 = (p: number) => (p / 100).toFixed(2);

/** The preview as CSV: the nine boxes and the totals per treatment. No individual record. */
export function returnPreviewCsv(b: ReturnBoxes, period: { from: string; to: string }): string {
  const lines: string[][] = [
    ['B2BNEST VAT return preview (preview only: nothing is sent to HMRC; standard scheme; rules not verified against HMRC)'],
    ['Period', period.from, period.to],
    [],
    ['Box', 'Description', 'Value'],
    ...BOX_NUMBERS.map((n) => [String(n), BOX_TITLES[n] + (n === 5 ? ` (${b.netDirection === 'to_reclaim' ? 'to reclaim' : b.netDirection === 'to_pay' ? 'to pay' : 'nothing to pay'})` : ''),
      isWholePoundBox(n) ? String(boxValue(b, n)) : money2(boxValue(b, n))]),
    [],
    ['Side', 'Treatment', 'Records', 'Net', 'VAT', 'VAT not reclaimable'],
    ...(['sales', 'purchases'] as Side[]).flatMap((side) => b[side].map((t) => [side, VAT_TREATMENT_SHORT[t.treatment], String(t.records), money2(t.net), money2(t.vat), money2(t.vatNotReclaimable)])),
  ];
  return lines.map((l) => l.map(csvCell).join(',')).join('\n') + '\n';
}
