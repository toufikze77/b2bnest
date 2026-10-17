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

export type Option = { value: string; label: string };
export const EXPENSE_CATEGORIES: Option[] = [
  { value: 'food', label: 'Food & Dining' }, { value: 'transport', label: 'Transportation' }, { value: 'utilities', label: 'Utilities' },
  { value: 'entertainment', label: 'Entertainment' }, { value: 'shopping', label: 'Shopping' }, { value: 'health', label: 'Health & Medical' },
  { value: 'other', label: 'Other' },
];
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
export const labelOf = (options: Option[], value: string | null | undefined) => (value ? options.find((o) => o.value === value)?.label ?? titleCase(value) : '—');

/** Active suppliers to pick from, plus the one already chosen even if it is now inactive. */
export function supplierOptions(suppliers: { id: string; name: string; is_active: boolean | null }[], current?: string | null): Option[] {
  return suppliers
    .filter((s) => s.is_active !== false || s.id === current)
    .map((s) => ({ value: s.id, label: s.is_active === false ? `${s.name} (inactive)` : s.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
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
