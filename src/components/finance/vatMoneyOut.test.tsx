// HMRC P4: VAT on the expense form, the "VAT not recorded" badge and filter, the attention panel, the invoice list tags.
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moneyOutApi } from '@/lib/moneyOutApi';

const st = vi.hoisted(() => ({ demo: false, bills: null as null | number, toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('sonner', () => ({ toast: st.toast }));
vi.mock('@/hooks/useUserSettings', () => ({ useUserSettings: () => ({ settings: { currency_code: 'GBP' } }) }));
vi.mock('@/contexts/demoModeState', () => ({ useDemoMode: () => ({ isDemo: st.demo, loading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async () => (st.bills === null ? { data: null, error: { code: 'PGRST202' } } : { data: [{ record_type: 'invoices', needing: 9 }, { record_type: 'bills', needing: st.bills }], error: null }) },
}));

import { ExpensesTab } from './ExpensesTab';
import { VatAttentionPanel } from './VatAttentionPanel';
import { DocumentsTable } from './DocumentsTable';

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

type Row = { id: string; [k: string]: unknown };
function fakeDb(rows: Row[], missingColumnsOnce = false) {
  const calls: { op: string; payload: Record<string, unknown> }[] = [];
  let failed = !missingColumnsOnce;
  const result = (op: string, payload: Record<string, unknown>, apply: () => void) => {
    calls.push({ op, payload });
    if (!failed && Object.keys(payload).some((k) => k.startsWith('vat_'))) { failed = true; return Promise.resolve({ data: null, error: { code: 'PGRST204', message: "Could not find the 'vat_amount' column of 'expenses' in the schema cache" } }); }
    apply();
    return Promise.resolve({ data: [{ id: 'x' }], error: null });
  };
  const client = { from: () => ({
    insert: (r: Row[]) => result('insert', r[0], () => rows.unshift({ id: `n${calls.length}`, ...r[0] })),
    update: (p: Row) => ({ eq: (_a: string, id: string) => ({ eq: () => ({ select: () => result('update', p, () => Object.assign(rows.find((x) => x.id === id)!, p)) }) }) }),
    delete: () => ({ eq: () => ({ eq: () => ({ select: () => result('delete', {}, () => {}) }) }) }),
  }) };
  return { rows, calls, client };
}
function Tab({ db, initialFilter }: { db: ReturnType<typeof fakeDb>; initialFilter?: string }) {
  const [rows, setRows] = useState(() => [...db.rows]);
  const api = moneyOutApi(db.client as never, 'u1', 'expenses');
  return <ExpensesTab rows={rows as never} suppliers={[]} api={api} onChanged={() => setRows([...db.rows])} onDownload={vi.fn()} initialFilter={initialFilter} />;
}
const oldRow = { id: 'e1', description: 'Old train', category: 'transport', amount: 12, date: '2026-10-15', supplier_id: null, status: 'paid' };
const recordedRow = { id: 'e2', description: 'Paper', category: 'office', amount: 12, date: '2026-11-01', supplier_id: null, status: 'paid',
  net_amount: 10, vat_amount: 2, vat_treatment: 'standard', vat_rate: 20, vat_status: 'recorded', vat_scheme: 'standard', tax_point_date: '2026-11-01', vat_reclaimable: true };

const pickOption = async (dialog: HTMLElement, combo: RegExp, name: string) => {
  fireEvent.pointerDown(within(dialog).getByRole('combobox', { name: combo }), { button: 0, pointerType: 'mouse' });
  fireEvent.click(await screen.findByRole('option', { name }));
};
const addExpense = async (amount: string) => {
  fireEvent.click(screen.getAllByRole('button', { name: /Add expense/ })[0]);
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText(/Description/), { target: { value: 'Laptop' } });
  fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: amount } });
  await pickOption(dialog, /^Category/, 'Office costs');
  return dialog;
};

beforeEach(() => { st.demo = false; st.bills = null; Object.values(st.toast).forEach((f) => f.mockClear()); });

describe('expense form: VAT', () => {
  it('including VAT, standard rate: the amount is the gross; net and VAT are saved and the expense is recorded', async () => {
    const db = fakeDb([]);
    render(<Tab db={db} />);
    const dialog = await addExpense('12');
    expect(within(dialog).getByTestId('expense-vat-summary')).toHaveTextContent('Net £10.00 · VAT £2.00 · Total £12.00');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0].payload).toMatchObject({ amount: 12, net_amount: 10, vat_amount: 2, vat_treatment: 'standard', vat_rate: 20, vat_status: 'recorded', vat_scheme: 'standard', vat_reclaimable: true });
    expect(db.calls[0].payload.tax_point_date).toBe(db.calls[0].payload.date);
  });

  it('excluding VAT: VAT is added on top', async () => {
    const db = fakeDb([]);
    render(<Tab db={db} />);
    const dialog = await addExpense('10');
    await pickOption(dialog, /The amount entered is/, 'Excluding VAT');
    expect(within(dialog).getByTestId('expense-vat-summary')).toHaveTextContent('Net £10.00 · VAT £2.00 · Total £12.00');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0].payload).toMatchObject({ amount: 12, net_amount: 10, vat_amount: 2 });
  });

  it('zero-rated, exempt and outside scope: no VAT, the treatment kept; not reclaimable is saved', async () => {
    const db = fakeDb([]);
    render(<Tab db={db} />);
    const dialog = await addExpense('8');
    await pickOption(dialog, /VAT treatment/, 'Outside the scope of VAT');
    fireEvent.click(within(dialog).getByRole('switch', { name: /VAT can be reclaimed/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0].payload).toMatchObject({ amount: 8, net_amount: 8, vat_amount: 0, vat_treatment: 'outside_scope', vat_rate: 0, vat_reclaimable: false });
  });

  it('the receipt\'s VAT may differ by 1p (supplier rounding), not more', async () => {
    const db = fakeDb([]);
    render(<Tab db={db} />);
    const dialog = await addExpense('12.01');
    fireEvent.change(within(dialog).getByLabelText(/VAT on the receipt/), { target: { value: '2.05' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('1p at most');
    expect(db.calls).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText(/VAT on the receipt/), { target: { value: '2.01' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0].payload).toMatchObject({ amount: 12.01, net_amount: 10, vat_amount: 2.01 });
  });

  it('before the database update the save still works without the VAT columns', async () => {
    const db = fakeDb([], true);
    render(<Tab db={db} />);
    const dialog = await addExpense('12');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(db.calls).toHaveLength(2));
    expect(Object.keys(db.calls[1].payload).some((k) => k.startsWith('vat_') || k === 'net_amount' || k === 'tax_point_date')).toBe(false);
    expect(db.calls[1].payload).toMatchObject({ amount: 12 });
    expect(st.toast.info).toHaveBeenCalled();
  });

  it('old records show "VAT not recorded"; the filter lists only them; nothing is guessed when one is opened', async () => {
    const db = fakeDb([oldRow, recordedRow]);
    render(<Tab db={db} initialFilter="vat_missing" />);
    expect(screen.getByText('Showing 1 of 2 expenses')).toBeInTheDocument();
    expect(screen.getAllByTestId('vat-not-recorded').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Old train' })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('expense-vat-none')).toBeInTheDocument();
  });
});

describe('VAT attention panel', () => {
  const invoices = [
    { status: 'sent', items: [], subtotal: 10, tax_amount: 0, total_amount: 10 },
    { status: 'draft', items: [] },
    { status: 'paid', vat_status: 'recorded', tax_point_date: '2026-11-01', subtotal: 10, tax_amount: 2, total_amount: 12, items: [{ vat_treatment: 'standard', vat_rate: 20, net: 10, vat: 2, gross: 12 }] },
  ];
  it('counts what needs VAT details (drafts left out), with buttons that open the filtered lists', async () => {
    st.bills = 2;
    const openI = vi.fn(), openE = vi.fn();
    render(<VatAttentionPanel invoices={invoices} expenses={[oldRow, recordedRow]} onOpenInvoices={openI} onOpenExpenses={openE} />);
    const panel = await screen.findByTestId('vat-attention');
    await waitFor(() => expect(panel).toHaveTextContent('1 invoice, 1 expense and 2 bills need VAT details.'));
    expect(within(panel).getByTestId('vat-attention-bills')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Add VAT details to invoices' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Add VAT details to expenses' }));
    expect(openI).toHaveBeenCalled();
    expect(openE).toHaveBeenCalled();
  });
  it('before the database update: invoices and expenses still counted, no bills line', async () => {
    render(<VatAttentionPanel invoices={invoices} expenses={[oldRow]} onOpenInvoices={vi.fn()} onOpenExpenses={vi.fn()} />);
    expect(await screen.findByTestId('vat-attention')).toHaveTextContent('1 invoice and 1 expense need VAT details.');
    expect(screen.queryByTestId('vat-attention-bills')).toBeNull();
  });
  it('a demo account sees the counts but no edit controls', async () => {
    st.demo = true;
    render(<VatAttentionPanel invoices={invoices} expenses={[oldRow]} onOpenInvoices={vi.fn()} onOpenExpenses={vi.fn()} />);
    const panel = await screen.findByTestId('vat-attention');
    expect(within(panel).queryByRole('button', { name: /Add VAT details/ })).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Show invoices' })).toBeInTheDocument();
  });
  it('nothing to fix: no panel', () => {
    render(<VatAttentionPanel invoices={[invoices[2]]} expenses={[recordedRow]} onOpenInvoices={vi.fn()} onOpenExpenses={vi.fn()} />);
    expect(screen.queryByTestId('vat-attention')).toBeNull();
  });
});

describe('invoice list', () => {
  it('tags "VAT not recorded" and "Not GBP", and the panel can open the VAT filter', () => {
    const doc = (id: string, status: string, currency: string, extra: Record<string, unknown> = {}) => ({ id, invoice_number: `INV-${id}`, status, total_amount: 12, currency, created_at: '2026-10-01T09:00:00Z', due_date: null, client_name: 'A', ...extra });
    const docs = [doc('1', 'sent', 'GBP'), doc('2', 'sent', 'USD'), doc('3', 'paid', 'GBP', { vat_status: 'recorded', tax_point_date: '2026-11-01', subtotal: 10, tax_amount: 2, items: [{ vat_treatment: 'standard', vat_rate: 20, net: 10, vat: 2, gross: 12 }] })];
    const props = { kind: 'invoice' as const, docs, numberOf: (d: (typeof docs)[number]) => d.invoice_number, onNew: vi.fn(), onView: vi.fn(), onEdit: vi.fn(), onDownload: vi.fn(), onStatus: vi.fn(), onArchive: vi.fn(), onRestore: vi.fn(), onDeleteForever: vi.fn() };
    const view = render(<DocumentsTable {...props} />);
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1).map((r) => r.textContent ?? '');
    expect(rows.find((t) => t.includes('INV-1'))).toContain('VAT not recorded');
    expect(rows.find((t) => t.includes('INV-2'))).toContain('Not GBP (USD)');
    expect(rows.find((t) => t.includes('INV-3'))).not.toContain('VAT not recorded');
    expect(screen.getByRole('button', { name: 'VAT not recorded 2' })).toBeInTheDocument();
    view.rerender(<DocumentsTable {...props} vatFilterRequest={1} />);
    expect(screen.getByText('Showing 2 of 3 invoices')).toBeInTheDocument();
  });
});
