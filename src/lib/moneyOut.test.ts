import { describe, expect, it, vi } from 'vitest';
import {
  CUSTOM_CATEGORY_MAX, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_GROUPS, expenseCategoryOptions, expensesCsv, labelOf, resolveCustomCategory,
  buildPayload, changedFields, EXPENSE_FIELDS, filteredTotal, formFromRow, isInUseError, monthlyOutgoings, PRODUCT_FIELDS,
  SUPPLIER_FIELDS, supplierDeleteMessage,
} from './moneyOut';
import { moneyOutApi } from './moneyOutApi';

describe('buildPayload', () => {
  it('trims text, parses numbers, sends emptied optional fields as null', () => {
    const { payload, errors } = buildPayload(EXPENSE_FIELDS, { description: '  Train  ', category: 'transport', amount: '64.50', date: '2026-10-01', supplier_id: '', status: 'paid' });
    expect(errors).toEqual([]);
    expect(payload).toEqual({ description: 'Train', category: 'transport', amount: 64.5, date: '2026-10-01', supplier_id: null, status: 'paid' });
  });

  it('never sends an empty required field: it reports it instead', () => {
    const { errors } = buildPayload(EXPENSE_FIELDS, { description: '   ', category: 'x', amount: '', date: 'yesterday', supplier_id: null, status: 'paid' });
    expect(errors).toEqual(['Description is required.', 'Amount is required.', 'Date must be a date.']);
  });

  it('rejects non-numbers and negative amounts', () => {
    expect(buildPayload(PRODUCT_FIELDS, { name: 'Mug', category: 'Merch', price: 'abc', cost: '-1', stock_quantity: '', description: '', is_active: true }).errors)
      .toEqual(['Price must be a number.', "Cost can't be negative."]);
  });

  it('booleans come through as booleans', () => {
    expect(buildPayload(SUPPLIER_FIELDS, { name: 'A', is_active: false }).payload.is_active).toBe(false);
  });
});

describe('changedFields', () => {
  const row = { id: 's1', name: 'Paper & Co', contact_person: null, email: 'a@b.example', phone: '', website: null, payment_terms: 'Net 30', address: null, is_active: true };

  it('sends only what changed; null, empty and missing count as the same', () => {
    const { payload } = buildPayload(SUPPLIER_FIELDS, { ...formFromRow(SUPPLIER_FIELDS, row), name: 'Paper and Co' });
    expect(changedFields(row, payload)).toEqual({ name: 'Paper and Co' });
  });

  it('clearing an optional field sends null so it is really cleared', () => {
    const { payload } = buildPayload(SUPPLIER_FIELDS, { ...formFromRow(SUPPLIER_FIELDS, row), email: '' });
    expect(changedFields(row, payload)).toEqual({ email: null });
  });

  it('compares stored numeric strings as numbers', () => {
    expect(changedFields({ amount: '64.50' }, { amount: 64.5 })).toEqual({});
    expect(changedFields({ amount: '64.50' }, { amount: 65 })).toEqual({ amount: 65 });
  });

  it('formFromRow treats a missing is_active as active', () => {
    expect(formFromRow(SUPPLIER_FIELDS, { name: 'A', is_active: null }).is_active).toBe(true);
  });
});

describe('totals', () => {
  it('filtered total rounds to pennies', () => {
    expect(filteredTotal([{ amount: 0.1 }, { amount: 0.2 }, { amount: '1.005' }, { amount: null }])).toBe(1.31);
    expect(filteredTotal([])).toBe(0);
  });

  it('monthly outgoings convert known frequencies, skip paused ones, and never guess the rest', () => {
    const r = monthlyOutgoings([
      { amount: 950, frequency: 'monthly', is_active: true },
      { amount: 600, frequency: 'yearly', is_active: true },
      { amount: 300, frequency: 'Quarterly', is_active: null },
      { amount: 12, frequency: 'weekly', is_active: true },
      { amount: 80, frequency: 'weekly', is_active: false },
      { amount: 40, frequency: 'fortnightly', is_active: true },
    ]);
    expect(r.perMonth).toBe(950 + 50 + 100 + 52);
    expect(r.counted).toBe(4);
    expect(r.unknown).toEqual([{ frequency: 'fortnightly', total: 40, count: 1 }]);
  });
});

describe('supplier delete messages', () => {
  it('a foreign-key rejection offers "Make inactive" and says why', () => {
    const fk = { code: '23503', message: 'update or delete on table "suppliers" violates foreign key constraint' };
    expect(isInUseError(fk)).toBe(true);
    const m = supplierDeleteMessage('Paper & Co', fk);
    expect(m.inUse).toBe(true);
    expect(m.message).toMatch(/still use it.*make it inactive/);
  });
  it('any other failure is a plain error with nothing changed', () => {
    expect(supplierDeleteMessage('Paper & Co', { message: 'Failed to fetch' })).toEqual({ inUse: false, message: '“Paper & Co” couldn’t be deleted. Nothing was changed. Please try again.' });
  });
});

describe('moneyOutApi', () => {
  const fake = () => {
    const calls: unknown[][] = [];
    const end = { eq: (c: string, v: string) => { calls.push(['eq', c, v]); return { eq: (c2: string, v2: string) => { calls.push(['eq', c2, v2]); return Promise.resolve({ error: null }); } }; } };
    const client = {
      from: (t: string) => {
        calls.push(['from', t]);
        return {
          insert: (rows: unknown[]) => { calls.push(['insert', rows]); return Promise.resolve({ error: null }); },
          update: (row: unknown) => { calls.push(['update', row]); return end; },
          delete: () => { calls.push(['delete']); return end; },
        };
      },
    };
    return { client, calls };
  };

  it('update and delete are filtered by id and the signed-in user', async () => {
    const { client, calls } = fake();
    const api = moneyOutApi(client, 'u1', 'expenses');
    await api.update('e1', { amount: 10 });
    await api.remove('e2');
    expect(calls).toEqual([
      ['from', 'expenses'], ['update', { amount: 10 }], ['eq', 'id', 'e1'], ['eq', 'user_id', 'u1'],
      ['from', 'expenses'], ['delete'], ['eq', 'id', 'e2'], ['eq', 'user_id', 'u1'],
    ]);
  });

  it('create stamps the owner and a thrown error becomes a result, not a crash', async () => {
    const { client, calls } = fake();
    await moneyOutApi(client, 'u1', 'suppliers').create({ name: 'A' });
    expect(calls[1]).toEqual(['insert', [{ name: 'A', user_id: 'u1' }]]);
    const broken = { from: vi.fn(() => { throw new Error('offline'); }) } as unknown as Parameters<typeof moneyOutApi>[0];
    await expect(moneyOutApi(broken, 'u1', 'suppliers').remove('x')).resolves.toEqual({ error: { message: 'offline' } });
  });
});

describe('expense categories', () => {
  it('are grouped business headings with unique stored values and labels', () => {
    const values = EXPENSE_CATEGORIES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
    expect(EXPENSE_CATEGORIES.length).toBe(24);
    expect(EXPENSE_CATEGORY_GROUPS.map((g) => g.group)).toEqual(['Premises and office', 'Travel', 'Sales and marketing', 'People', 'Stock and equipment', 'Finance and legal', 'Other']);
    expect(EXPENSE_CATEGORIES.find((c) => c.value === 'professional_fees')).toEqual({ value: 'professional_fees', label: 'Professional fees (accountant, legal)', group: 'Finance and legal' });
    expect(EXPENSE_CATEGORIES.at(-1)).toEqual({ value: 'other', label: 'Other', group: 'Other' });
  });

  it('the original seven stored values still get a label and stay selectable', () => {
    const opts = expenseCategoryOptions(['food', 'transport', 'utilities', 'entertainment', 'shopping', 'health', 'other']);
    const label = (v: string) => labelOf(opts, v);
    expect(['food', 'transport', 'utilities', 'entertainment', 'shopping', 'health', 'other'].map(label))
      .toEqual(['Meals and subsistence', 'Travel and transport', 'Utilities', 'Client entertainment', 'Shopping', 'Health and medical', 'Other']);
    expect(opts.filter((o) => o.group === 'Earlier categories').map((o) => o.value)).toEqual(['health', 'shopping']);
    // Earlier categories appear only when a record uses them.
    expect(expenseCategoryOptions([]).some((o) => o.value === 'shopping')).toBe(false);
  });

  it('a typed category is trimmed, capped at 40 characters, and offered next time', () => {
    expect(resolveCustomCategory('   Parking   fees ', EXPENSE_CATEGORIES)).toEqual({ value: 'Parking fees' });
    const long = 'x'.repeat(60);
    expect(resolveCustomCategory(long, EXPENSE_CATEGORIES).value).toHaveLength(CUSTOM_CATEGORY_MAX);
    const next = expenseCategoryOptions(['Parking fees']);
    expect(next.find((o) => o.value === 'Parking fees')).toEqual({ value: 'Parking fees', label: 'Parking fees', group: 'Your categories' });
  });

  it('duplicates are matched ignoring case and reuse the existing category', () => {
    expect(resolveCustomCategory('FUEL', EXPENSE_CATEGORIES)).toEqual({ value: 'fuel' });
    expect(resolveCustomCategory('rent and rates', EXPENSE_CATEGORIES)).toEqual({ value: 'rent_rates' });
    expect(resolveCustomCategory('parking FEES', expenseCategoryOptions(['Parking fees']))).toEqual({ value: 'Parking fees' });
    expect(resolveCustomCategory('   ', EXPENSE_CATEGORIES)).toEqual({ value: '', error: 'Type a name for the new category.' });
  });

  it('the CSV uses the same labels and keeps a label with a comma in one column', () => {
    const csv = expensesCsv(
      [{ date: '2026-10-01', description: 'Year-end accounts', category: 'professional_fees', amount: 450, supplier_id: 's1', status: 'paid' },
        { date: '2026-10-02', description: 'Lunch', category: 'food', amount: 12.5, supplier_id: null, status: null }],
      [{ id: 's1', name: 'Smith & Co' }],
    );
    expect(csv.split('\r\n')).toEqual([
      'Date,Description,Category,Amount,Supplier,Status',
      '2026-10-01,Year-end accounts,"Professional fees (accountant, legal)",450,Smith & Co,Paid',
      '2026-10-02,Lunch,Meals and subsistence,12.5,,Pending',
    ]);
  });
});
