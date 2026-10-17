import { toCsv } from '@/lib/crmAnalytics';

/**
 * Money-out tabs (Phase 3): Expenses, Outgoings, Suppliers, Products & services.
 * Pure helpers for building write payloads, totals and delete messages. No sending here.
 *
 * Payload rule: required text is trimmed and must not be empty; optional text that is emptied
 * is sent as null (so clearing a field really clears it); numbers are parsed and must be finite.
 * On edit only fields that changed are sent, so an untouched field is never overwritten.
 */

export type FieldKind = 'text' | 'optionalText' | 'number' | 'optionalNumber' | 'date' | 'boolean' | 'id';
export type FieldSpec = Record<string, { kind: FieldKind; label: string }>;
export type FormValues = Record<string, string | boolean | null | undefined>;
export type Payload = Record<string, string | number | boolean | null>;

export const EXPENSE_FIELDS: FieldSpec = {
  description: { kind: 'text', label: 'Description' },
  category: { kind: 'text', label: 'Category' },
  amount: { kind: 'number', label: 'Amount' },
  date: { kind: 'date', label: 'Date' },
  supplier_id: { kind: 'id', label: 'Supplier' },
  status: { kind: 'text', label: 'Status' },
};

export const OUTGOING_FIELDS: FieldSpec = {
  name: { kind: 'text', label: 'Name' },
  category: { kind: 'text', label: 'Category' },
  amount: { kind: 'number', label: 'Amount' },
  frequency: { kind: 'text', label: 'Frequency' },
  next_payment_date: { kind: 'date', label: 'Next payment date' },
  supplier_id: { kind: 'id', label: 'Supplier' },
  is_active: { kind: 'boolean', label: 'Active' },
};

export const SUPPLIER_FIELDS: FieldSpec = {
  name: { kind: 'text', label: 'Company name' },
  contact_person: { kind: 'optionalText', label: 'Contact person' },
  email: { kind: 'optionalText', label: 'Email' },
  phone: { kind: 'optionalText', label: 'Phone' },
  website: { kind: 'optionalText', label: 'Website' },
  payment_terms: { kind: 'optionalText', label: 'Payment terms' },
  address: { kind: 'optionalText', label: 'Address' },
  is_active: { kind: 'boolean', label: 'Active' },
};

export const PRODUCT_FIELDS: FieldSpec = {
  name: { kind: 'text', label: 'Name' },
  category: { kind: 'text', label: 'Category' },
  price: { kind: 'number', label: 'Price' },
  cost: { kind: 'optionalNumber', label: 'Cost' },
  stock_quantity: { kind: 'optionalNumber', label: 'Stock quantity' },
  description: { kind: 'optionalText', label: 'Description' },
  is_active: { kind: 'boolean', label: 'Active' },
};

/** Turns form values into a full, typed payload, or returns the problems to show. */
export function buildPayload(spec: FieldSpec, form: FormValues): { payload: Payload; errors: string[] } {
  const payload: Payload = {};
  const errors: string[] = [];
  for (const [key, { kind, label }] of Object.entries(spec)) {
    const raw = form[key];
    const text = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw);
    switch (kind) {
      case 'text':
      case 'date':
        if (!text) errors.push(`${label} is required.`);
        else if (kind === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(text)) errors.push(`${label} must be a date.`);
        payload[key] = text;
        break;
      case 'optionalText':
      case 'id':
        payload[key] = text || null;
        break;
      case 'number':
      case 'optionalNumber': {
        if (!text) {
          if (kind === 'number') errors.push(`${label} is required.`);
          payload[key] = null;
          break;
        }
        const n = Number(text);
        if (!Number.isFinite(n)) errors.push(`${label} must be a number.`);
        else if (n < 0) errors.push(`${label} can't be negative.`);
        payload[key] = Number.isFinite(n) ? n : null;
        break;
      }
      case 'boolean':
        payload[key] = raw === true || raw === 'true';
        break;
    }
  }
  return { payload, errors };
}

const same = (a: unknown, b: unknown) => {
  const norm = (v: unknown) => (v === undefined || v === '' ? null : v);
  const x = norm(a), y = norm(b);
  if (x === null || y === null) return x === y;
  // Stored numerics can arrive as strings; compare them as numbers.
  if (typeof x === 'number' || typeof y === 'number') return Number(x) === Number(y);
  return x === y;
};

/** Only the fields that differ from the stored row (null, '' and missing count as the same "empty"). */
export function changedFields(original: Record<string, unknown>, next: Payload): Payload {
  const out: Payload = {};
  for (const [k, v] of Object.entries(next)) if (!same(original[k], v)) out[k] = v;
  return out;
}

/** Form values for editing a stored row: numbers and nulls become strings the inputs can show. */
export function formFromRow(spec: FieldSpec, row: Record<string, unknown>): FormValues {
  const f: FormValues = {};
  for (const [k, { kind }] of Object.entries(spec)) {
    const v = row[k];
    f[k] = kind === 'boolean' ? v !== false : v == null ? '' : String(v);
  }
  return f;
}

/* ---------- Choices ---------- */

export type Option = { value: string; label: string; group?: string };

/**
 * Business expense categories, grouped (UK small-business headings). The stored text is `value`.
 * The original seven values keep working without rewriting data: transport, utilities,
 * entertainment, food and other are reused as the values of their closest new heading, and
 * shopping / health keep their own labels under "Earlier categories" (shown only if used).
 */
export const EXPENSE_CATEGORY_GROUPS: { group: string; options: { value: string; label: string }[] }[] = [
  { group: 'Premises and office', options: [
    { value: 'office_costs', label: 'Office costs' },
    { value: 'rent_rates', label: 'Rent and rates' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'telephone_internet', label: 'Telephone and internet' },
    { value: 'software_subscriptions', label: 'Software and subscriptions' },
    { value: 'repairs_maintenance', label: 'Repairs and maintenance' },
    { value: 'postage_delivery', label: 'Postage and delivery' },
  ] },
  { group: 'Travel', options: [
    { value: 'transport', label: 'Travel and transport' },
    { value: 'vehicle_running', label: 'Vehicle running costs' },
    { value: 'fuel', label: 'Fuel' },
    { value: 'food', label: 'Meals and subsistence' },
  ] },
  { group: 'Sales and marketing', options: [
    { value: 'entertainment', label: 'Client entertainment' },
    { value: 'marketing_advertising', label: 'Marketing and advertising' },
  ] },
  { group: 'People', options: [
    { value: 'wages_salaries', label: 'Wages and salaries' },
    { value: 'subcontractors', label: 'Subcontractors' },
    { value: 'training_courses', label: 'Training and courses' },
  ] },
  { group: 'Stock and equipment', options: [
    { value: 'stock_materials', label: 'Stock and materials' },
    { value: 'equipment_tools', label: 'Equipment and tools' },
  ] },
  { group: 'Finance and legal', options: [
    { value: 'professional_fees', label: 'Professional fees (accountant, legal)' },
    { value: 'bank_finance_charges', label: 'Bank and finance charges' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'licences_memberships', label: 'Licences and memberships' },
    { value: 'taxes_duties', label: 'Taxes and duties' },
  ] },
  { group: 'Other', options: [{ value: 'other', label: 'Other' }] },
];
export const EXPENSE_CATEGORIES: Option[] = EXPENSE_CATEGORY_GROUPS.flatMap((g) => g.options.map((o) => ({ ...o, group: g.group })));
/** Labels for original values with no matching new heading; listed only when a record uses them. */
const LEGACY_CATEGORY_LABELS: Record<string, string> = { shopping: 'Shopping', health: 'Health and medical' };
export const CUSTOM_CATEGORY = '__custom__';
export const CUSTOM_CATEGORY_MAX = 40;

/**
 * The category list for one user: the business headings, then any other category already used on
 * their records (legacy values and ones they typed), so a typed category is offered next time.
 */
export function expenseCategoryOptions(stored: (string | null | undefined)[]): Option[] {
  const extra = withStored([...EXPENSE_CATEGORIES], stored).slice(EXPENSE_CATEGORIES.length);
  return [...EXPENSE_CATEGORIES, ...extra.map((o) => ({ ...o, label: LEGACY_CATEGORY_LABELS[o.value] ?? o.label, group: LEGACY_CATEGORY_LABELS[o.value] ? 'Earlier categories' : 'Your categories' }))];
}

/**
 * "Other (type your own)": trims and caps the text at 40 characters. If it matches an existing
 * category (label or value, ignoring case) that category is reused instead of making a duplicate.
 */
export function resolveCustomCategory(input: string | null | undefined, options: Option[]): { value: string; error?: string } {
  const text = (input ?? '').trim().replace(/\s+/g, ' ').slice(0, CUSTOM_CATEGORY_MAX).trim();
  if (!text) return { value: '', error: 'Type a name for the new category.' };
  const key = text.toLowerCase();
  const existing = options.find((o) => o.value.toLowerCase() === key || o.label.toLowerCase() === key);
  return { value: existing ? existing.value : text };
}

/** The statuses the expenses table was created with ('pending' is the database default). */
export const EXPENSE_STATUSES: Option[] = [{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'paid', label: 'Paid' }];
export const PAYMENT_TERMS: Option[] = [
  { value: 'Net 15', label: 'Net 15' }, { value: 'Net 30', label: 'Net 30' }, { value: 'Net 60', label: 'Net 60' },
  { value: 'Due on Receipt', label: 'Due on Receipt' }, { value: 'COD', label: 'Cash on Delivery' },
];

const titleCase = (v: string) => v.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** The fixed choices plus any other value already stored on records, so editing never drops it. */
export function withStored(options: Option[], stored: (string | null | undefined)[]): Option[] {
  const known = new Set(options.map((o) => o.value));
  const extra = [...new Set(stored.filter((v): v is string => !!v && !known.has(v)))].sort().map((v) => ({ value: v, label: titleCase(v) }));
  return [...options, ...extra];
}
export const labelOf = (options: Option[], value: string | null | undefined) => (value ? options.find((o) => o.value === value)?.label ?? LEGACY_CATEGORY_LABELS[value] ?? titleCase(value) : '—');

/** Active suppliers to pick from, plus the one already chosen even if it is now inactive. */
export function supplierOptions(suppliers: { id: string; name: string; is_active: boolean | null }[], current?: string | null): Option[] {
  return suppliers
    .filter((s) => s.is_active !== false || s.id === current)
    .map((s) => ({ value: s.id, label: s.is_active === false ? `${s.name} (inactive)` : s.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/* ---------- CSV ---------- */

/**
 * The expenses report: one row per expense with the category's label (same list as the screen)
 * and the supplier's name. Fields are quoted properly, so labels with commas stay in one column.
 */
export function expensesCsv(
  expenses: { date: string | null; description: string | null; category: string | null; amount: number | string | null; supplier_id: string | null; status: string | null }[],
  suppliers: { id: string; name: string }[],
): string {
  const categories = expenseCategoryOptions(expenses.map((e) => e.category));
  const rows: (string | number)[][] = [['Date', 'Description', 'Category', 'Amount', 'Supplier', 'Status']];
  for (const e of expenses) {
    rows.push([e.date ?? '', e.description ?? '', e.category ? labelOf(categories, e.category) : '', Number(e.amount) || 0,
      e.supplier_id ? suppliers.find((x) => x.id === e.supplier_id)?.name ?? '' : '', labelOf(EXPENSE_STATUSES, e.status || 'pending')]);
  }
  return toCsv(rows);
}

/* ---------- Totals ---------- */

/** Sum of amounts, rounded to pennies (avoids 0.1 + 0.2 drift). */
export function filteredTotal(rows: { amount: number | string | null }[]): number {
  return Math.round(rows.reduce((n, r) => n + (Number(r.amount) || 0), 0) * 100) / 100;
}

/** Monthly factor for the frequencies the Outgoings form offers (and "annually" from the original schema). */
const PER_MONTH: Record<string, number> = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12, annually: 1 / 12 };
export const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

/**
 * Active outgoings as a monthly figure. Known frequencies are converted (weekly × 52 ÷ 12,
 * quarterly ÷ 3, yearly ÷ 12); any other frequency is not guessed and is listed raw.
 */
export function monthlyOutgoings(rows: { amount: number | string | null; frequency: string | null; is_active: boolean | null }[]) {
  let perMonth = 0, counted = 0;
  const other = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    if (r.is_active === false) continue;
    const f = (r.frequency || '').trim().toLowerCase();
    const amount = Number(r.amount) || 0;
    if (f in PER_MONTH) { perMonth += amount * PER_MONTH[f]; counted++; continue; }
    const o = other.get(f) ?? { total: 0, count: 0 };
    o.total += amount; o.count++;
    other.set(f, o);
  }
  return {
    perMonth: Math.round(perMonth * 100) / 100,
    counted,
    unknown: [...other.entries()].map(([frequency, v]) => ({ frequency: frequency || 'not set', total: Math.round(v.total * 100) / 100, count: v.count })),
  };
}

/* ---------- Delete messages ---------- */

export interface DbError { code?: string; message?: string; details?: string }

/** Postgres 23503 = foreign key violation: the supplier is still used by an expense or outgoing. */
export const isInUseError = (e: DbError | null | undefined) => !!e && (e.code === '23503' || /foreign key/i.test(`${e.message ?? ''} ${e.details ?? ''}`));

/** What to tell the user when deleting a supplier fails, and whether "Make inactive" should be offered. */
export function supplierDeleteMessage(name: string, error: DbError | null | undefined): { inUse: boolean; message: string } {
  if (isInUseError(error)) {
    return {
      inUse: true,
      message: `“${name}” can’t be deleted because expenses or recurring payments still use it. You can make it inactive instead: it stays on those records but is hidden from new ones.`,
    };
  }
  return { inUse: false, message: `“${name}” couldn’t be deleted. Nothing was changed. Please try again.` };
}
