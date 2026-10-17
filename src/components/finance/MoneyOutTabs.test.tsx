import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moneyOutApi, MoneyOutTable } from '@/lib/moneyOutApi';
import type { DbError } from '@/lib/moneyOut';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/hooks/useUserSettings', () => ({ useUserSettings: () => ({ settings: { currency_code: 'GBP' } }) }));

import { ExpensesTab } from './ExpensesTab';
import { OutgoingsTab } from './OutgoingsTab';
import { ProductsTab } from './ProductsTab';
import { SuppliersTab } from './SuppliersTab';

type Row = { id: string; [k: string]: unknown };
type Call = { table: string; op: string; payload?: unknown; filters: [string, string][] };

/** In-memory tables behind the narrow client moneyOutApi uses; records every write and its filters. */
function fakeDb(tables: Record<string, Row[]>, fail: { op?: 'update' | 'delete' | 'insert'; error?: DbError } = {}) {
  const calls: Call[] = [];
  const result = (call: Call, apply: () => void) => {
    calls.push(call);
    if (fail.op === call.op) return Promise.resolve({ error: fail.error ?? { message: 'Simulated network error' } });
    apply();
    return Promise.resolve({ error: null });
  };
  const filtered = (table: string, op: string, payload: unknown, apply: (id: string) => void) => ({
    eq: (c1: string, v1: string) => ({
      eq: (c2: string, v2: string) => result({ table, op, payload, filters: [[c1, v1], [c2, v2]] }, () => apply(v1)),
    }),
  });
  const client = {
    from: (table: string) => ({
      insert: (rows: Row[]) => result({ table, op: 'insert', payload: rows[0], filters: [] }, () => { tables[table].unshift({ id: `new${calls.length}`, ...rows[0] }); }),
      update: (row: Row) => filtered(table, 'update', row, (id) => { Object.assign(tables[table].find((r) => r.id === id)!, row); }),
      delete: () => filtered(table, 'delete', undefined, (id) => { tables[table] = tables[table].filter((r) => r.id !== id); }),
    }),
  };
  return { tables, calls, client };
}

/** Parent stand-in: owns the rows and reloads them from the fake table after a successful write. */
function Parent({ db, table, view }: {
  db: ReturnType<typeof fakeDb>;
  table: MoneyOutTable;
  view: (p: { rows: Row[]; api: ReturnType<typeof moneyOutApi>; onChanged: () => void; onDownload: () => void }) => JSX.Element;
}) {
  const [rows, setRows] = useState(() => [...db.tables[table]]);
  const api = moneyOutApi(db.client as unknown as Parameters<typeof moneyOutApi>[0], 'u1', table);
  return view({ rows, api, onChanged: () => setRows([...db.tables[table]]), onDownload: vi.fn() });
}

const openMenu = (name: RegExp) => fireEvent.pointerDown(screen.getAllByRole('button', { name })[0], { button: 0, pointerType: 'mouse' });
const pick = async (item: string) => fireEvent.click(await screen.findByRole('menuitem', { name: item }));
// `hidden: true`: an open dialog marks the page behind it aria-hidden, but the rows are still there.
const tableRows = () => within(screen.getByRole('table', { hidden: true })).getAllByRole('row', { hidden: true }).slice(1).map((r) => r.textContent);

// Radix Switch measures itself with ResizeObserver, which jsdom lacks.
// Radix Select needs these in jsdom to open and scroll its list.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

beforeEach(() => { Object.values(toast).forEach((f) => f.mockClear()); });

const supplierRows = () => [
  { id: 's1', name: 'Northern Rail', contact_person: null, email: 'rail@example.com', phone: null, website: null, payment_terms: 'Net 30', address: null, is_active: true },
  { id: 's2', name: 'Paper & Co', contact_person: 'Ann', email: null, phone: null, website: null, payment_terms: 'Net 14', address: null, is_active: true },
];
const expenseRows = () => [
  { id: 'e1', description: 'Train to Leeds', category: 'transport', amount: 64.5, date: '2026-10-15', supplier_id: 's1', status: 'paid' },
  { id: 'e2', description: 'Printer paper', category: 'office', amount: 23.99, date: '2026-10-05', supplier_id: null, status: 'pending' },
];

describe('ExpensesTab', () => {
  const renderTab = (db: ReturnType<typeof fakeDb>) => render(
    <Parent db={db} table="expenses" view={(p) => <ExpensesTab {...p} rows={p.rows as never} suppliers={supplierRows()} />} />,
  );

  it('shows a running total of the listed rows, labelled with the account currency', () => {
    renderTab(fakeDb({ expenses: expenseRows() }));
    expect(screen.getByText('£88.49', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getAllByText(/in your account currency \(GBP\)/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Pending 1' }));
    expect(screen.getByText('£23.99', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 2 expenses')).toBeInTheDocument();
  });

  it('edit sends only the changed field, filtered by id and user', async () => {
    const db = fakeDb({ expenses: expenseRows() });
    renderTab(db);
    fireEvent.click(screen.getAllByRole('button', { name: 'Train to Leeds' })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Description/)).toHaveValue('Train to Leeds');
    fireEvent.change(within(dialog).getByLabelText(/Amount/), { target: { value: '70' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(db.calls).toEqual([{ table: 'expenses', op: 'update', payload: { amount: 70 }, filters: [['id', 'e1'], ['user_id', 'u1']] }]);
    expect(tableRows()[0]).toContain('£70.00');
    expect(toast.success).toHaveBeenCalledWith('Expense “Train to Leeds” saved');
  });

  it('a failed save shows the error in the dialog and leaves the row as it was', async () => {
    const db = fakeDb({ expenses: expenseRows() }, { op: 'update' });
    renderTab(db);
    fireEvent.click(screen.getAllByRole('button', { name: 'Train to Leeds' })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Amount/), { target: { value: '70' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Your changes weren’t saved. The expense is unchanged.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(db.tables.expenses[0].amount).toBe(64.5);
    expect(toast.error).toHaveBeenCalled();
  });

  it('an empty required field is reported and nothing is sent', async () => {
    const db = fakeDb({ expenses: expenseRows() });
    renderTab(db);
    fireEvent.click(screen.getAllByRole('button', { name: 'Train to Leeds' })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Description/), { target: { value: '  ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Description is required.');
    expect(db.calls).toEqual([]);
  });

  it('delete asks first, names the item, and removes the row only after success', async () => {
    const db = fakeDb({ expenses: expenseRows() });
    renderTab(db);
    openMenu(/Actions for expense Train to Leeds/);
    await pick('Delete');
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete expense “Train to Leeds”?');
    expect(confirm).toHaveTextContent('It can’t be undone.');
    expect(db.calls).toEqual([]);
    expect(tableRows()).toHaveLength(2);
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete expense' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(db.calls).toEqual([{ table: 'expenses', op: 'delete', payload: undefined, filters: [['id', 'e1'], ['user_id', 'u1']] }]);
    expect(tableRows()).toHaveLength(1);
    expect(toast.success).toHaveBeenCalledWith('Expense “Train to Leeds” deleted');
  });

  it('a failed delete shows the error and keeps the row', async () => {
    const db = fakeDb({ expenses: expenseRows() }, { op: 'delete' });
    renderTab(db);
    openMenu(/Actions for expense Train to Leeds/);
    await pick('Delete');
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete expense' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('couldn’t be deleted. Nothing was changed.');
    expect(tableRows()).toHaveLength(2);
  });

  it('"Other (type your own)" saves the typed category and offers it next time', async () => {
    const db = fakeDb({ expenses: expenseRows() });
    renderTab(db);
    fireEvent.click(screen.getAllByRole('button', { name: 'Printer paper' })[0]);
    const dialog = await screen.findByRole('dialog');
    const pickCategory = async (name: string) => {
      fireEvent.pointerDown(within(screen.getByRole('dialog')).getByRole('combobox', { name: /Category/ }), { button: 0, pointerType: 'mouse' });
      fireEvent.click(await screen.findByRole('option', { name }));
    };
    await pickCategory('Other (type your own)');
    const custom = within(dialog).getByLabelText(/New category name/);
    expect(custom).toHaveAttribute('maxLength', '40');
    fireEvent.change(custom, { target: { value: '  Parking  ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0]).toEqual({ table: 'expenses', op: 'update', payload: { category: 'Parking' }, filters: [['id', 'e2'], ['user_id', 'u1']] });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Next time: the typed category is a normal option under "Your categories".
    fireEvent.click(screen.getAllByRole('button', { name: 'Train to Leeds' })[0]);
    await screen.findByRole('dialog');
    fireEvent.pointerDown(within(screen.getByRole('dialog')).getByRole('combobox', { name: /Category/ }), { button: 0, pointerType: 'mouse' });
    expect(await screen.findByRole('option', { name: 'Parking' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Professional fees (accountant, legal)' })).toBeInTheDocument();
  });

  it('typing an existing category name reuses it; an empty name is refused', async () => {
    const db = fakeDb({ expenses: expenseRows() });
    renderTab(db);
    fireEvent.click(screen.getAllByRole('button', { name: 'Printer paper' })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.pointerDown(within(dialog).getByRole('combobox', { name: /Category/ }), { button: 0, pointerType: 'mouse' });
    fireEvent.click(await screen.findByRole('option', { name: 'Other (type your own)' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Type a name for the new category.');
    expect(db.calls).toEqual([]);
    fireEvent.change(within(dialog).getByLabelText(/New category name/), { target: { value: 'office COSTS' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0].payload).toEqual({ category: 'office_costs' });
  });

  it('an empty list shows "No expenses yet" with an Add button', () => {
    renderTab(fakeDb({ expenses: [] }));
    expect(screen.getByText('No expenses yet.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Add expense/ }).length).toBe(2);
  });
});

describe('OutgoingsTab', () => {
  const rows = () => [
    { id: 'o1', name: 'Office rent', category: 'other', amount: 950, frequency: 'monthly', next_payment_date: '2026-10-27', supplier_id: null, is_active: true },
    { id: 'o2', name: 'Insurance', category: 'other', amount: 600, frequency: 'yearly', next_payment_date: '2027-02-01', supplier_id: null, is_active: true },
    { id: 'o3', name: 'Cleaner', category: 'other', amount: 80, frequency: 'weekly', next_payment_date: '2026-10-20', supplier_id: null, is_active: false },
  ];
  const renderTab = (db: ReturnType<typeof fakeDb>) => render(
    <Parent db={db} table="outgoings" view={(p) => <OutgoingsTab {...p} rows={p.rows as never} suppliers={supplierRows()} />} />,
  );

  it('total per month converts known frequencies and leaves paused payments out', () => {
    renderTab(fakeDb({ outgoings: rows() }));
    expect(screen.getByText('£1,000.00', { selector: 'strong' })).toBeInTheDocument();
  });

  it('edit sends the changed fields with the user filter', async () => {
    const db = fakeDb({ outgoings: rows() });
    renderTab(db);
    fireEvent.click(screen.getAllByRole('button', { name: 'Office rent' })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: 'Office rent (new lease)' } });
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Active' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0]).toEqual({ table: 'outgoings', op: 'update', payload: { name: 'Office rent (new lease)', is_active: false }, filters: [['id', 'o1'], ['user_id', 'u1']] });
  });

  it('Pause from the row menu sends is_active false only', async () => {
    const db = fakeDb({ outgoings: rows() });
    renderTab(db);
    openMenu(/Actions for recurring payment Insurance/);
    await pick('Pause');
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0]).toMatchObject({ op: 'update', payload: { is_active: false }, filters: [['id', 'o2'], ['user_id', 'u1']] });
  });

  it('delete removes the row only after the confirmation', async () => {
    const db = fakeDb({ outgoings: rows() });
    renderTab(db);
    openMenu(/Actions for recurring payment Cleaner/);
    await pick('Delete');
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete recurring payment “Cleaner”?');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete recurring payment' }));
    await waitFor(() => expect(tableRows()).toHaveLength(2));
  });
});

describe('SuppliersTab', () => {
  const renderTab = (db: ReturnType<typeof fakeDb>) => render(
    <Parent db={db} table="suppliers" view={(p) => <SuppliersTab {...p} rows={p.rows as never} />} />,
  );

  it('edit clears an emptied optional field (sent as null) with the user filter', async () => {
    const db = fakeDb({ suppliers: supplierRows() });
    renderTab(db);
    fireEvent.click(screen.getAllByRole('button', { name: 'Northern Rail' })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0]).toEqual({ table: 'suppliers', op: 'update', payload: { email: null }, filters: [['id', 's1'], ['user_id', 'u1']] });
  });

  it('a supplier still in use cannot be deleted: the dialog explains and offers "Make inactive"', async () => {
    const fk = { code: '23503', message: 'update or delete on table "suppliers" violates foreign key constraint "expenses_supplier_id_fkey"' };
    const db = fakeDb({ suppliers: supplierRows() }, { op: 'delete', error: fk });
    renderTab(db);
    openMenu(/Actions for supplier Northern Rail/);
    await pick('Delete');
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete supplier' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('can’t be deleted because expenses or recurring payments still use it');
    expect(tableRows()).toHaveLength(2);
    await act(async () => { fireEvent.click(within(confirm).getByRole('button', { name: 'Make inactive' })); });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(db.calls.at(-1)).toEqual({ table: 'suppliers', op: 'update', payload: { is_active: false }, filters: [['id', 's1'], ['user_id', 'u1']] });
    expect(tableRows().find((t) => t?.includes('Northern Rail'))).toContain('Inactive');
  });

  it('an unused supplier is deleted normally', async () => {
    const db = fakeDb({ suppliers: supplierRows() });
    renderTab(db);
    openMenu(/Actions for supplier Paper & Co/);
    await pick('Delete');
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete supplier' }));
    await waitFor(() => expect(tableRows()).toHaveLength(1));
  });
});

describe('ProductsTab', () => {
  const rows = () => [
    { id: 'p1', name: 'Consulting day', category: 'Services', price: 650, cost: null, stock_quantity: null, description: null, is_active: true },
    { id: 'p2', name: 'Branded mug', category: 'Merch', price: 9.5, cost: 3.2, stock_quantity: 140, description: null, is_active: true },
  ];
  const renderTab = (db: ReturnType<typeof fakeDb>) => render(
    <Parent db={db} table="products_services" view={(p) => <ProductsTab {...p} rows={p.rows as never} />} />,
  );

  it('price shows in the account currency and stock only for products', () => {
    renderTab(fakeDb({ products_services: rows() }));
    const [consulting, mug] = [tableRows().find((t) => t?.includes('Consulting')), tableRows().find((t) => t?.includes('mug'))];
    expect(consulting).toContain('£650.00');
    expect(consulting).toContain('Service');
    expect(mug).toContain('140');
  });

  it('edit sends changed price and stock with the user filter; a service form has no stock box', async () => {
    const db = fakeDb({ products_services: rows() });
    renderTab(db);
    fireEvent.click(screen.getAllByRole('button', { name: 'Consulting day' })[0]);
    expect(within(await screen.findByRole('dialog')).queryByLabelText('Stock quantity')).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Branded mug' })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Price/), { target: { value: '10' } });
    fireEvent.change(within(dialog).getByLabelText('Stock quantity'), { target: { value: '120' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0]).toEqual({ table: 'products_services', op: 'update', payload: { price: 10, stock_quantity: 120 }, filters: [['id', 'p2'], ['user_id', 'u1']] });
  });

  it('a failed delete keeps the row and says nothing changed', async () => {
    const db = fakeDb({ products_services: rows() }, { op: 'delete' });
    renderTab(db);
    openMenu(/Actions for item Branded mug/);
    await pick('Delete');
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete item' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('Nothing was changed');
    expect(tableRows()).toHaveLength(2);
  });
});
