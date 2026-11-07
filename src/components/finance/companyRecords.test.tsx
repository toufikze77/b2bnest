// HMRC P4b: new records carry the active company; the "Records with no company" review (select, confirm, own companies
// only); the bulk VAT helper (preview, confirm, GBP only, skips counted); demo accounts see no edit controls; the panel.
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moneyOutApi } from '@/lib/moneyOutApi';

const st = vi.hoisted(() => ({
  demo: false,
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  rpcCalls: [] as { fn: string; args?: Record<string, unknown> }[],
  rpc: null as null | ((fn: string, args?: Record<string, unknown>) => { data: unknown; error: unknown }),
}));
vi.mock('sonner', () => ({ toast: st.toast }));
vi.mock('@/hooks/useUserSettings', () => ({ useUserSettings: () => ({ settings: { currency_code: 'GBP' } }) }));
vi.mock('@/contexts/demoModeState', () => ({ useDemoMode: () => ({ isDemo: st.demo, loading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async (fn: string, args?: Record<string, unknown>) => { st.rpcCalls.push({ fn, args }); return st.rpc ? st.rpc(fn, args) : { data: null, error: { code: 'PGRST202' } }; } },
}));

import { ExpensesTab } from './ExpensesTab';
import { CompanyRecordsReview, type ReviewClient } from './CompanyRecordsReview';
import { VatAttentionPanel } from './VatAttentionPanel';

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const X = { organizationId: 'org-x', name: 'Company X' };
const Y = { organizationId: 'org-y', name: 'Company Y' };

beforeEach(() => { st.demo = false; st.rpc = null; st.rpcCalls.length = 0; Object.values(st.toast).forEach((f) => f.mockClear()); });

type Row = { id: string; [k: string]: unknown };
/** A fake table for the expense form (moneyOutApi). `missingColumn`: the database has no organization_id yet. */
function fakeDb(rows: Row[], missingColumn = false) {
  const calls: { op: string; payload: Record<string, unknown> }[] = [];
  const result = (op: string, payload: Record<string, unknown>, apply: () => void) => {
    calls.push({ op, payload });
    if (missingColumn && 'organization_id' in payload) return Promise.resolve({ data: null, error: { code: 'PGRST204', message: "Could not find the 'organization_id' column of 'expenses' in the schema cache" } });
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
function Tab({ db, organizationId = 'org-x' }: { db: ReturnType<typeof fakeDb>; organizationId?: string | null }) {
  const [rows, setRows] = useState(() => [...db.rows]);
  const api = moneyOutApi(db.client as never, 'u1', 'expenses');
  return <ExpensesTab rows={rows as never} suppliers={[]} api={api} onChanged={() => setRows([...db.rows])} onDownload={vi.fn()} companies={[X, Y]} organizationId={organizationId} />;
}
const pickOption = async (dialog: HTMLElement, combo: RegExp, name: string) => {
  fireEvent.pointerDown(within(dialog).getByRole('combobox', { name: combo }), { button: 0, pointerType: 'mouse' });
  fireEvent.click(await screen.findByRole('option', { name }));
};
const addExpense = async () => {
  fireEvent.click(screen.getAllByRole('button', { name: /Add expense/ })[0]);
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText(/Description/), { target: { value: 'Laptop' } });
  fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: '12' } });
  await pickOption(dialog, /^Category/, 'Office costs');
  return dialog;
};

describe('new records carry the company', () => {
  it('a new expense is saved with the active company (shown in the form)', async () => {
    const db = fakeDb([]);
    render(<Tab db={db} />);
    const dialog = await addExpense();
    expect(within(dialog).getByRole('combobox', { name: /^Company/ })).toHaveTextContent('Company X');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0].payload).toMatchObject({ organization_id: 'org-x', vat_status: 'recorded', amount: 12 });
  });
  it('before the database update the expense is saved again without the company', async () => {
    const db = fakeDb([], true);
    render(<Tab db={db} />);
    const dialog = await addExpense();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(db.calls).toHaveLength(2));
    expect(db.calls[1].payload).not.toHaveProperty('organization_id');
    expect(db.calls[1].payload).toMatchObject({ vat_status: 'recorded', amount: 12 });
  });
  it('no active company (several companies, none chosen): the person must choose one; only their own companies are offered', async () => {
    const db = fakeDb([]);
    render(<Tab db={db} organizationId={null} />);
    const dialog = await addExpense();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    expect(await within(dialog).findByText('Choose the company this expense belongs to.')).toBeInTheDocument();
    expect(db.calls).toHaveLength(0);
    fireEvent.pointerDown(within(dialog).getByRole('combobox', { name: /^Company/ }), { button: 0, pointerType: 'mouse' });
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['Choose…', 'Company X', 'Company Y']);
    fireEvent.click(screen.getByRole('option', { name: 'Company Y' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0].payload).toMatchObject({ organization_id: 'org-y' });
  });
  it('an older expense with no company: the company must be chosen before its VAT is saved; a linked one is not asked', async () => {
    const old = { id: 'e1', description: 'Old train', category: 'transport', amount: 12, date: '2026-10-15', supplier_id: null, status: 'paid', organization_id: null };
    const linked = { id: 'e2', description: 'Paper', category: 'office', amount: 12, date: '2026-11-01', supplier_id: null, status: 'paid', organization_id: 'org-x' };
    const db = fakeDb([old, linked]);
    render(<Tab db={db} />);
    expect(screen.getAllByText('No company').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Paper' })[0]);
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('combobox', { name: /^Company/ })).toBeNull();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getAllByRole('button', { name: 'Old train' })[0]);
    dialog = await screen.findByRole('dialog');
    await pickOption(dialog, /^VAT treatment/, 'Standard rate (20%)');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByText('Choose the company this expense belongs to.')).toBeInTheDocument();
    expect(db.calls).toHaveLength(0); // never assigned for the person
    await pickOption(dialog, /^Company/, 'Company X');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0].payload).toMatchObject({ organization_id: 'org-x', vat_status: 'recorded', net_amount: 10, vat_amount: 2 });
  });
});

/** A fake client for the review screen: reads return `tables`; every update is recorded with its filters. */
function reviewClient(tables: Record<string, Row[]>) {
  const writes: { table: string; payload: Record<string, unknown>; filters: unknown[][] }[] = [];
  const client = {
    from: (table: string) => ({
      select: () => ({ eq: async () => ({ data: tables[table] ?? [], error: null }) }),
      update: (payload: Record<string, unknown>) => {
        const filters: unknown[][] = [];
        const done = async () => {
          writes.push({ table, payload, filters });
          const inIds = (filters.find((f) => f[0] === 'in')?.[2] as string[] | undefined) ?? [filters.find((f) => f[0] === 'eq' && f[1] === 'id')?.[2] as string];
          const hit = (tables[table] ?? []).filter((r) => inIds.includes(r.id) && (!filters.some((f) => f[0] === 'is') || !r.organization_id));
          hit.forEach((r) => Object.assign(r, payload));
          return { data: hit.map((r) => ({ id: r.id })), error: null };
        };
        const chain = {
          in: (c: string, v: string[]) => { filters.push(['in', c, v]); return chain; },
          eq: (c: string, v: string) => { filters.push(['eq', c, v]); return chain; },
          is: (c: string, v: null) => { filters.push(['is', c, v]); return chain; },
          select: () => done(),
        };
        return chain;
      },
    }),
  };
  return { client: client as unknown as ReviewClient, writes };
}
const invoice = (id: string, extra: Record<string, unknown> = {}) => ({
  id, invoice_number: `INV-${id}`, status: 'sent', currency: 'GBP', created_at: '2026-10-02T09:00:00Z', organization_id: null as string | null,
  items: [{ description: 'Work', quantity: 1, rate: 100, amount: 100 }], subtotal: 100, tax_rate: 0, tax_amount: 0, total_amount: 100, ...extra,
});
const expense = (id: string, extra: Record<string, unknown> = {}) => ({ id, description: `Expense ${id}`, amount: 12, date: '2026-10-15', organization_id: null as string | null, ...extra });

function Review({ tables, client, organizationId = 'org-x', onChanged = vi.fn() }: { tables: Record<string, Row[]>; client: ReviewClient; organizationId?: string | null; onChanged?: () => void }) {
  return <CompanyRecordsReview client={client} userId="u1" invoices={tables.invoices as never} expenses={tables.expenses as never} companies={[X, Y]}
    organizationId={organizationId} accountCurrency="GBP" onChanged={onChanged} />;
}

describe('records with no company: review', () => {
  it('lists only records with no company; select, a confirmation that says what goes where, then the update (own rows, still unassigned)', async () => {
    const tables = {
      invoices: [invoice('1'), invoice('2', { status: 'draft' }), invoice('3', { organization_id: 'org-x' }), invoice('4', { currency: 'USD' })],
      expenses: [expense('1')], bills: [{ id: 'b1', description: 'Rent', amount: 500, currency: 'GBP', issue_date: '2026-10-01', organization_id: null }],
    };
    const { client, writes } = reviewClient(tables);
    const onChanged = vi.fn();
    render(<Review tables={tables} client={client} onChanged={onChanged} />);
    await waitFor(() => expect(screen.getAllByTestId('company-record-row')).toHaveLength(5)); // INV-3 has a company
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Not GBP (USD)')).toBeInTheDocument();
    // Only the person's companies.
    expect(Array.from((screen.getByLabelText('Company') as HTMLSelectElement).options).map((o) => o.textContent)).toEqual(['Choose a company', 'Company X', 'Company Y']);
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'invoice' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all 3 shown' }));
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'all' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select expense Expense 1' }));
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'org-y' } });
    fireEvent.click(screen.getByRole('button', { name: /Assign to company/ }));
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByTestId('assign-summary')).toHaveTextContent('3 invoices and 1 expense will be assigned to Company Y.');
    expect(writes).toHaveLength(0); // nothing before the confirmation
    fireEvent.click(within(confirm).getByRole('button', { name: 'Assign 4 to Company Y' }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[0]).toEqual({ table: 'invoices', payload: { organization_id: 'org-y' }, filters: [['in', 'id', ['1', '2', '4']], ['eq', 'user_id', 'u1'], ['is', 'organization_id', null]] });
    expect(writes[1]).toMatchObject({ table: 'expenses', payload: { organization_id: 'org-y' } });
    expect(st.toast.success).toHaveBeenCalledWith('4 records assigned to Company Y.');
    expect(onChanged).toHaveBeenCalled();
  });

  it('before the database update: no assigning, a note, and the VAT list still works', async () => {
    const tables = { invoices: [{ ...invoice('1') }].map(({ organization_id: _o, ...r }) => r), expenses: [], bills: [] };
    const { client } = reviewClient(tables);
    render(<Review tables={tables} client={client} />);
    expect(await screen.findByTestId('company-column-missing')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Assign to company/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /VAT not recorded \(1\)/ }));
    expect(screen.getAllByTestId('company-record-row')).toHaveLength(1);
  });

  it('a demo account sees the list but no checkboxes, picker or buttons', async () => {
    st.demo = true;
    const tables = { invoices: [invoice('1')], expenses: [expense('1')], bills: [] };
    const { client } = reviewClient(tables);
    render(<Review tables={tables} client={client} />);
    await waitFor(() => expect(screen.getAllByTestId('company-record-row')).toHaveLength(2));
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByLabelText('Company')).toBeNull();
    expect(screen.queryByRole('button', { name: /Assign to company|Set VAT on selected/ })).toBeNull();
  });
});

describe('bulk VAT helper', () => {
  it('preview (records, net, VAT, total; skips counted), a confirmation, then recorded with the tax point = each record\'s date', async () => {
    const tables = {
      invoices: [invoice('1'), invoice('2', { currency: 'USD' })],
      expenses: [expense('1'), expense('2', { organization_id: 'org-x' })],
      bills: [{ id: 'b1', description: 'Rent', amount: 500, currency: 'GBP', issue_date: '2026-10-01', organization_id: null }],
    };
    const { client, writes } = reviewClient(tables);
    render(<Review tables={tables} client={client} />);
    await waitFor(() => expect(screen.getAllByTestId('company-record-row')).toHaveLength(4));
    fireEvent.click(screen.getByRole('button', { name: /Either/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all 5 shown' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set VAT on selected' }));
    const dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText('VAT treatment') as HTMLSelectElement).value).toBe('standard');
    const preview = within(dialog).getByTestId('bulk-vat-preview');
    // INV-1 net 100 + VAT 20; two expenses of 12 including VAT: net 10 + VAT 2 each.
    expect(preview).toHaveTextContent('3 records: net £120.00 · VAT £24.00 · total £144.00');
    expect(within(dialog).getByTestId('bulk-vat-skipped')).toHaveTextContent('Left out: 1 not in GBP, 1 bill (no VAT helper for bills yet).');
    expect(preview).toHaveTextContent('2 of them have no company: they will be assigned to Company X.');
    expect(writes).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByTestId('bulk-vat-confirm')).toHaveTextContent('1 invoice and 2 expenses will be saved with Standard rate (20%)');
    expect(writes).toHaveLength(0); // nothing before the confirmation
    fireEvent.click(within(confirm).getByRole('button', { name: 'Save VAT details' }));
    await waitFor(() => expect(writes).toHaveLength(3));
    expect(writes[0]).toMatchObject({ table: 'invoices', payload: { vat_status: 'recorded', tax_point_date: '2026-10-02', subtotal: 100, tax_amount: 20, total_amount: 120, organization_id: 'org-x' },
      filters: [['eq', 'id', '1'], ['eq', 'user_id', 'u1']] });
    expect(writes[1]).toMatchObject({ table: 'expenses', payload: { vat_status: 'recorded', tax_point_date: '2026-10-15', net_amount: 10, vat_amount: 2, organization_id: 'org-x' } });
    expect(writes[2].payload).not.toHaveProperty('organization_id'); // already linked: left as it is
    expect(writes.map((w) => w.table)).not.toContain('bills');
    expect(st.toast.success).toHaveBeenCalledWith('VAT details saved on 3 records.');
  });

  it('records with no company and no company chosen: Continue stays off until one is chosen', async () => {
    const tables = { invoices: [], expenses: [expense('1')], bills: [] };
    const { client } = reviewClient(tables);
    render(<Review tables={tables} client={client} organizationId={null} />);
    await waitFor(() => expect(screen.getAllByTestId('company-record-row')).toHaveLength(1));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select expense Expense 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set VAT on selected' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('bulk-vat-preview')).toHaveTextContent('choose a company above first');
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});

describe('VAT panel with a company', () => {
  const recorded = { net_amount: 10, vat_amount: 2, vat_treatment: 'standard', vat_rate: 20, vat_status: 'recorded', tax_point_date: '2026-11-01', amount: 12 };
  it('counts the active company\'s records and the person\'s unassigned ones separately; other companies are not counted', async () => {
    st.rpc = (_fn, args) => (args ? { data: [
      { record_type: 'invoices', needing: 0, scope: 'company' }, { record_type: 'expenses', needing: 0, scope: 'company' }, { record_type: 'bills', needing: 1, scope: 'company' },
      { record_type: 'invoices', needing: 0, scope: 'unassigned' }, { record_type: 'expenses', needing: 0, scope: 'unassigned' }, { record_type: 'bills', needing: 0, scope: 'unassigned' },
    ], error: null } : { data: [], error: null });
    const open = vi.fn();
    render(<VatAttentionPanel organizationId="org-x" companyName="Company X" onOpenCompanyRecords={open} onOpenInvoices={vi.fn()} onOpenExpenses={vi.fn()}
      invoices={[{ status: 'sent', items: [], organization_id: 'org-x' }, { status: 'sent', items: [], organization_id: null }, { status: 'sent', items: [], organization_id: 'org-y' }]}
      expenses={[{ amount: 5, organization_id: null }, { ...recorded, organization_id: 'org-x' }]} />);
    await waitFor(() => expect(screen.getByTestId('vat-attention-company')).toHaveTextContent('Company X: 1 invoice and 1 bill need VAT details.'));
    expect(screen.getByTestId('vat-attention-unassigned')).toHaveTextContent('With no company yet: 1 invoice and 1 expense need VAT details.');
    expect(st.rpcCalls[0]).toEqual({ fn: 'vat_records_needing_attention', args: { p_organization_id: 'org-x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review records with no company' }));
    expect(open).toHaveBeenCalled();
  });
  it('before the P4b database update the old call is used and the counts are not split', async () => {
    st.rpc = (_fn, args) => (args ? { data: null, error: { code: 'PGRST202' } } : { data: [{ record_type: 'bills', needing: 2 }], error: null });
    render(<VatAttentionPanel organizationId="org-x" companyName="Company X" onOpenInvoices={vi.fn()} onOpenExpenses={vi.fn()} invoices={[{ status: 'sent', items: [] }]} expenses={[]} />);
    await waitFor(() => expect(screen.getByTestId('vat-attention')).toHaveTextContent('1 invoice and 2 bills need VAT details.'));
    expect(screen.queryByTestId('vat-attention-company')).toBeNull();
    expect(st.rpcCalls.map((c) => c.args)).toEqual([{ p_organization_id: 'org-x' }, undefined]);
  });
});
