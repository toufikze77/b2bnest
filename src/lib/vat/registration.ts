// Is the expense's company VAT registered on the expense's date? (Finance phase 3b follow-up 2, the expense form.)
// The same rule as the SQL helper _ledger_auto_vat_registered(org, date): registered = vat_registered AND
// (vat_registered_from IS NULL OR date >= vat_registered_from). Pure functions, no I/O.
import type { FormValues } from '@/lib/moneyOut';
import { isVatTreatment, type VatTreatment } from './treatments';

/** What ledger_auto_status says about the company. undefined = unknown (still loading, failed, or not available). */
export interface VatRegistration { vat_registered: boolean; vat_registered_from: string | null }
export type VatRegistrationLookup = (organizationId: string) => VatRegistration | undefined;

/** The registration from a ledger_auto_status result; undefined when the result doesn't carry the key (SQL not applied). */
export function registrationFromStatus(s: { vat_registered?: boolean | null; vat_registered_from?: string | null } | null | undefined): VatRegistration | undefined {
  if (!s || typeof s.vat_registered !== 'boolean') return undefined;
  return { vat_registered: s.vat_registered, vat_registered_from: s.vat_registered_from ?? null };
}

/** Registered on this date? A missing date counts as registered when the company is (as in the SQL helper). */
export function vatRegisteredOn(r: VatRegistration, date: string | null | undefined): boolean {
  if (!r.vat_registered) return false;
  if (!r.vat_registered_from || !date) return true;
  return date >= r.vat_registered_from;
}

/**
 * Which expense form to show:
 * - 'full': today's form (registered, or the status is unknown: never hide VAT because of a failed lookup);
 * - 'none': no VAT questions, saved VAT-free (not registered on the date);
 * - 'recorded': not registered, but the expense being edited already has VAT recorded: the full form, with a note.
 */
export type ExpenseVatMode = 'full' | 'none' | 'recorded';
export function expenseVatMode(reg: VatRegistration | undefined, date: string | null | undefined,
  editing?: { vat_status?: string | null; vat_amount?: number | string | null } | null): ExpenseVatMode {
  if (!reg || vatRegisteredOn(reg, date)) return 'full';
  return editing?.vat_status === 'recorded' && Number(editing.vat_amount) > 0 ? 'recorded' : 'none';
}
export const EXPENSE_VAT_RECORDED_NOTE = 'This expense has VAT recorded. Change it to Outside the scope of VAT if the company is not VAT registered.';

/**
 * The form values for a VAT-free save: exactly what choosing "Outside the scope of VAT" with the amount "including VAT"
 * gives today, with VAT not reclaimable. An expense already recorded with no VAT keeps its own treatment (zero rate,
 * exempt or outside the scope), so nothing recorded is changed silently.
 */
export function vatFreeExpenseValues(v: FormValues, editing?: { vat_status?: string | null; vat_treatment?: string | null } | null): FormValues {
  const kept: VatTreatment = editing?.vat_status === 'recorded' && isVatTreatment(editing.vat_treatment) && editing.vat_treatment !== 'standard' && editing.vat_treatment !== 'reduced'
    ? editing.vat_treatment : 'outside_scope';
  return { ...v, vat_entry: 'including', vat_treatment: kept, vat_override: '', vat_reclaimable: false };
}
