// HMRC P4: the VAT part of the expense form (and, later, a bills form): pure functions, no I/O.
// "Amount entered is including VAT / excluding VAT", a treatment, and optionally the VAT printed on the receipt
// (a supplier may round differently: at most 1p from the calculated VAT, SUPPLIER_ROUNDING_TOLERANCE_PENCE).
import type { FieldSpec, FormValues } from '@/lib/moneyOut';
import { EXPENSE_FIELDS } from '@/lib/moneyOut';
import { addToNet, splitFromGross, toPence } from './money';
import { moneyOutVatPayload, vatProblem, type VatColumns } from './records';
import { DEFAULT_TREATMENT, isVatTreatment, type VatTreatment } from './treatments';

export type VatEntry = 'including' | 'excluding';
export const VAT_ENTRY_OPTIONS: { value: VatEntry; label: string }[] = [
  { value: 'including', label: 'Including VAT' },
  { value: 'excluding', label: 'Excluding VAT' },
];

/** The stored columns the expense form saves (the P4 VAT columns on top of the usual ones). */
export const EXPENSE_VAT_FIELDS: FieldSpec = {
  ...EXPENSE_FIELDS,
  net_amount: { kind: 'optionalNumber', label: 'Net amount' },
  vat_amount: { kind: 'optionalNumber', label: 'VAT amount' },
  vat_treatment: { kind: 'optionalText', label: 'VAT treatment' },
  vat_rate: { kind: 'optionalNumber', label: 'VAT rate' },
  vat_status: { kind: 'text', label: 'VAT status' },
  vat_scheme: { kind: 'text', label: 'VAT scheme' },
  tax_point_date: { kind: 'date', label: 'Tax point date' },
  vat_reclaimable: { kind: 'boolean', label: 'VAT reclaimable' },
};

/** Every save of an expense records its VAT: an older expense opened without a treatment must have one chosen. */
export const EXPENSE_VAT_CHOOSE = 'Choose how VAT applies to this expense.';

export type VatResult = { ok: true; treatment: VatTreatment; net: number; vat: number; gross: number } | { ok: false; error: string };

/** Net, VAT and gross (pence) from what was typed. */
export function vatFromForm(v: FormValues): VatResult {
  const treatment = v.vat_treatment;
  if (!isVatTreatment(treatment)) return { ok: false, error: EXPENSE_VAT_CHOOSE };
  return vatFor(treatment, v);
}
/** Whether a treatment is chosen (an older expense opened for edit starts without one, and can't be saved until it has one). */
export const vatChosen = (v: FormValues) => isVatTreatment(v.vat_treatment);

function vatFor(treatment: VatTreatment, v: FormValues): VatResult {
  const entered = toPence(typeof v.amount === 'string' ? v.amount : String(v.amount ?? ''));
  if (!Number.isFinite(entered) || String(v.amount ?? '').trim() === '') return { ok: false, error: 'Enter the amount.' };
  if (entered < 0) return { ok: false, error: 'The amount can’t be negative.' };
  const including = v.vat_entry !== 'excluding';
  const calc = including ? splitFromGross(entered, treatment) : addToNet(entered, treatment);
  const override = typeof v.vat_override === 'string' ? v.vat_override.trim() : '';
  let { net, vat, gross } = calc;
  if (override) {
    vat = toPence(override);
    if (!Number.isFinite(vat)) return { ok: false, error: 'Enter the VAT in pounds and pence.' };
    if (including) net = gross - vat; else gross = net + vat;
  }
  const problem = vatProblem({ treatment, net, vat, gross });
  return problem ? { ok: false, error: problem } : { ok: true, treatment, net, vat, gross };
}

/** Before saving: the stored amount is the gross; the VAT columns are filled and the record becomes "recorded". */
export function prepareExpenseVat(v: FormValues): FormValues {
  if (!vatChosen(v)) return v;
  const r = vatFromForm(v);
  if (!r.ok) return v;
  const cols = moneyOutVatPayload({ treatment: r.treatment, net: r.net, vat: r.vat, taxPointDate: String(v.date ?? ''), reclaimable: v.vat_reclaimable !== false });
  return {
    ...v, amount: String(r.gross / 100),
    net_amount: String(cols.net_amount), vat_amount: String(cols.vat_amount), vat_treatment: cols.vat_treatment, vat_rate: String(cols.vat_rate),
    vat_status: cols.vat_status, vat_scheme: cols.vat_scheme, tax_point_date: cols.tax_point_date, vat_reclaimable: cols.vat_reclaimable,
  };
}

/** Form values for editing: the stored amount is the gross. An older record has no treatment: it starts empty (nothing guessed) and one must be chosen. */
export function expenseVatForm(row: VatColumns & { amount?: number | string | null }, base: FormValues): FormValues {
  const treatment = isVatTreatment(row.vat_treatment) ? row.vat_treatment : '';
  let override = '';
  if (treatment && row.vat_status === 'recorded' && row.vat_amount != null) {
    const calc = splitFromGross(toPence(row.amount), treatment);
    if (calc.vat !== toPence(row.vat_amount)) override = String(row.vat_amount);
  }
  return { ...base, vat_entry: 'including', vat_treatment: treatment, vat_override: override, vat_reclaimable: row.vat_reclaimable !== false };
}

/** A new expense: standard rate, amount including VAT, VAT reclaimable. */
export const blankExpenseVat = (): FormValues => ({ vat_entry: 'including', vat_treatment: DEFAULT_TREATMENT, vat_override: '', vat_reclaimable: true });
