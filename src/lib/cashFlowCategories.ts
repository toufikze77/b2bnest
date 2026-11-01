// Phase 29: fuller UK small-business categories for the Cash Flow Tracker, grouped so a long list stays usable on a
// phone, plus your own categories (saved in this browser). Every name from the old short lists is kept, so entries saved
// before still match; an entry whose category is in no list keeps it and still shows and edits.

export type FlowType = 'income' | 'expense';
export interface CategoryGroup { label: string; items: string[] }

export const INCOME_GROUPS: CategoryGroup[] = [
  { label: 'Sales', items: ['Sales Revenue', 'Service Revenue', 'Consulting / Fees', 'Subscriptions / Retainers', 'Commission'] },
  { label: 'Funding', items: ['Investment', 'Loan', 'Grant'] },
  { label: 'Other income', items: ['Rental Income', 'Interest', 'Refund Received', 'Other Income'] },
];

export const EXPENSE_GROUPS: CategoryGroup[] = [
  { label: 'Premises and running costs', items: ['Office Rent', 'Utilities', 'Telephone & Internet', 'Repairs & Maintenance', 'Office Supplies', 'Insurance'] },
  { label: 'People', items: ['Salaries', 'Employer NI & Pension', 'Subcontractors', 'Training'] },
  { label: 'Tax (HMRC)', items: ['HMRC: VAT', 'HMRC: PAYE / NI', 'HMRC: Corporation Tax'] },
  { label: 'Running the business', items: ['Software/Tools', 'Equipment', 'Stock / Materials', 'Travel', 'Fuel & Vehicle'] },
  { label: 'Sales and marketing', items: ['Marketing', 'Entertainment'] },
  { label: 'Professional and finance', items: ['Legal/Professional', 'Accountancy', 'Bank Charges', 'Loan Repayment'] },
  { label: 'Other', items: ['Refund Given', 'Other Expenses'] },
];

export const groupsFor = (type: FlowType) => (type === 'income' ? INCOME_GROUPS : EXPENSE_GROUPS);
export const standardCategories = (type: FlowType) => groupsFor(type).flatMap((g) => g.items);

export const CUSTOM_KEY = 'cashFlowTracker.customCategories.v1';
export const CUSTOM_MAX = 40;
export const ADD_CUSTOM = '__add_custom__';
export type CustomCategories = Record<FlowType, string[]>;

export function loadCustomCategories(): CustomCategories {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '{}') as Partial<CustomCategories>;
    const clean = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []);
    return { income: clean(raw.income), expense: clean(raw.expense) };
  } catch {
    return { income: [], expense: [] };
  }
}

export function saveCustomCategories(c: CustomCategories) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(c)); } catch { /* not remembered */ }
}

/** Trimmed, at most 40 characters, not already a standard or custom category (ignoring case). */
export function addCustomCategory(type: FlowType, name: string, custom: CustomCategories): { ok: true; custom: CustomCategories; name: string } | { ok: false; error: string } {
  const value = name.trim().replace(/\s+/g, ' ');
  if (!value) return { ok: false, error: 'Enter a name for the category.' };
  if (value.length > CUSTOM_MAX) return { ok: false, error: `Use ${CUSTOM_MAX} characters or fewer.` };
  if (value === ADD_CUSTOM) return { ok: false, error: 'Choose another name.' };
  const existing = [...standardCategories(type), ...custom[type]];
  const same = existing.find((c) => c.toLowerCase() === value.toLowerCase());
  if (same) return { ok: false, error: `"${same}" is already in the list.` };
  return { ok: true, name: value, custom: { ...custom, [type]: [...custom[type], value] } };
}
