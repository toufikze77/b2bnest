// Finance phase 3b follow-up 2: no VAT questions on the expense form for a company that isn't VAT registered.
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moneyOutApi } from '@/lib/moneyOutApi';
import type { VatRegistration, VatRegistrationLookup } from '@/lib/vat';

const st = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('sonner', () => ({ toast: st.toast }));
vi.mock('@/hooks/useUserSettings', () => ({ useUserSettings: () => ({ settings: { currency_code: 'GBP' } }) }));
vi.mock('@/contexts/demoModeState', () => ({ useDemoMode: () => ({ isDemo: false, loading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: async () => ({ data: null, error: { code: 'PGRST202' } }) } }));

import { ExpensesTab } from './ExpensesTab';

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

type Row = { id: string; [k: string]: unknown };
function fakeDb(rows: Row[]) {
  const calls: { op: string; payload: Record<string, unknown> }[] = [];
  const result = (op: string, payload: Record<string, unknown>, apply: () => void) => { calls.push({ op, payload }); apply(); return Promise.resolve({ data: [{ id: 'x' }], error: null }); };
  const client = { from: () => ({
    insert: (r: Row[]) => result('insert', r[0], () => rows.unshift({ id: `n${calls.length}`, ...r[0] })),
    update: (p: Row) => ({ eq: (_a: string, id: string) => ({ eq: () => ({ select: () => result('update', p, () => Object.assign(rows.find((x) => x.id === id)!, p)) }) }) }),
    delete: () => ({ eq: () => ({ eq: () => ({ select: () => result('delete', {}, () => {}) }) }) }),
  }) };
  return { rows, calls, client };
}
const NO: VatRegistration = { vat_registered: false, vat_registered_from: null };
const YES: VatRegistration = { vat_registered: true, vat_registered_from: null };
const lookup = (m: Record<string, VatRegistration | undefined>): VatRegistrationLookup => (id) => m[id];
const COMPANIES = [{ organizationId: 'org-a', name: 'Alpha Ltd' }, { organizationId: 'org-b', name: 'Beta Ltd' }];

function Tab({ db, reg, companies = [], org = 'org-a' }: { db: ReturnType<typeof fakeDb>; reg?: VatRegistrationLookup; companies?: typeof COMPANIES; org?: string }) {
  const [rows, setRows] = useState(() => [...db.rows]);
  const api = moneyOutApi(db.client as never, 'u1', 'expenses');
  return <ExpensesTab rows={rows as never} suppliers={[]} api={api} onChanged={() => setRows([...db.rows])} onDownload={vi.fn()}
    companies={companies as never} organizationId={org} vatRegistration={reg} />;
}
const pickOption = async (dialog: HTMLElement, combo: RegExp, name: string) => {
  fireEvent.pointerDown(within(dialog).getByRole('combobox', { name: combo }), { button: 0, pointerType: 'mouse' });
  fireEvent.click(await screen.findByRole('option', { name }));
};
const addExpense = async (amount: string, date?: string) => {
  fireEvent.click(screen.getAllByRole('button', { name: /Add expense/ })[0]);
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText(/Description/), { target: { value: 'Train' } });
  fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: amount } });
  if (date) fireEvent.change(within(dialog).getByLabelText(/^Date/), { target: { value: date } });
  await pickOption(dialog, /^Category/, 'Office costs');
  return dialog;
};
const vatControls = (dialog: HTMLElement) => ({
  entry: within(dialog).queryByRole('combobox', { name: /The amount entered is/ }),
  treatment: within(dialog).queryByRole('combobox', { name: /VAT treatment/ }),
  override: within(dialog).queryByLabelText(/VAT on the receipt/),
  reclaim: within(dialog).queryByRole('switch', { name: /VAT can be reclaimed/ }),
});
const expectVatShown = (dialog: HTMLElement, shown: boolean) => {
  const c = vatControls(dialog);
  for (const el of Object.values(c)) {
    if (shown) expect(el).not.toBeNull(); else expect(el).toBeNull();
  }
};
const VAT_FREE = { net_amount: 30, vat_amount: 0, vat_treatment: 'outside_scope', vat_rate: 0, vat_status: 'recorded', vat_scheme: 'standard', vat_reclaimable: false };

beforeEach(() => { Object.values(st.toast).forEach((f) => f.mockClear()); });

describe('expense form: company not VAT registered', () => {
  it('asks no VAT questions and saves £30 as Outside the scope of VAT: net 30, VAT 0, gross 30, recorded, not reclaimable', async () => {
    const db = fakeDb([]);
    render(<Tab db={db} reg={lookup({ 'org-a': NO })} />);
    const dialog = await addExpense('30', '2026-11-10');
    expectVatShown(dialog, false);
    expect(within(dialog).queryByTestId('expense-vat-summary')).toBeNull();
    expect(within(dialog).getByTestId('expense-novat-summary')).toHaveTextContent('Amount £30.00. No VAT');
    // still asked: amount, date, category, status, supplier
    for (const l of [/^Amount/, /^Date/]) expect(within(dialog).getByLabelText(l)).toBeInTheDocument();
    for (const c of [/^Category/, /^Status/, /^Supplier/]) expect(within(dialog).getByRole('combobox', { name: c })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0].payload).toMatchObject({ amount: 30, ...VAT_FREE, tax_point_date: '2026-11-10', date: '2026-11-10' });
  });

  it('editing an older expense without recorded VAT: treated as new (no questions, saved VAT-free)', async () => {
    const db = fakeDb([{ id: 'e1', description: 'Old taxi', category: 'office_costs', amount: 30, date: '2026-10-15', supplier_id: null, status: 'paid', organization_id: 'org-a', vat_status: 'not_recorded' }]);
    render(<Tab db={db} reg={lookup({ 'org-a': NO })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Old taxi' })[0]);
    const dialog = await screen.findByRole('dialog');
    expectVatShown(dialog, false);
    expect(within(dialog).queryByTestId('expense-vat-choose')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0].payload).toMatchObject({ ...VAT_FREE, tax_point_date: '2026-10-15' });
  });

  it('editing an expense with recorded VAT £5: the full form with the stored values and the help line; saving keeps the VAT', async () => {
    const db = fakeDb([{ id: 'e2', description: 'Printer ink', category: 'office_costs', amount: 30, date: '2026-11-01', supplier_id: null, status: 'paid', organization_id: 'org-a',
      net_amount: 25, vat_amount: 5, vat_treatment: 'standard', vat_rate: 20, vat_status: 'recorded', vat_scheme: 'standard', tax_point_date: '2026-11-01', vat_reclaimable: true }]);
    render(<Tab db={db} reg={lookup({ 'org-a': NO })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Printer ink' })[0]);
    const dialog = await screen.findByRole('dialog');
    expectVatShown(dialog, true);
    expect(vatControls(dialog).treatment).toHaveTextContent('Standard rate');
    expect(within(dialog).getByTestId('expense-vat-recorded-note')).toHaveTextContent('This expense has VAT recorded. Change it to Outside the scope of VAT if the company is not VAT registered.');
    expect(within(dialog).getByTestId('expense-vat-summary')).toHaveTextContent('Net £25.00 · VAT £5.00 · Total £30.00');
    fireEvent.change(within(dialog).getByLabelText(/Description/), { target: { value: 'Printer ink (black)' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0].payload).toEqual({ description: 'Printer ink (black)' }); // only what changed: the VAT stays
  });

  it('…and changing it to Outside the scope of VAT then saves it VAT-free', async () => {
    const db = fakeDb([{ id: 'e2', description: 'Printer ink', category: 'office_costs', amount: 30, date: '2026-11-01', supplier_id: null, status: 'paid', organization_id: 'org-a',
      net_amount: 25, vat_amount: 5, vat_treatment: 'standard', vat_rate: 20, vat_status: 'recorded', vat_scheme: 'standard', tax_point_date: '2026-11-01', vat_reclaimable: true }]);
    render(<Tab db={db} reg={lookup({ 'org-a': NO })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Printer ink' })[0]);
    const dialog = await screen.findByRole('dialog');
    await pickOption(dialog, /VAT treatment/, 'Outside the scope of VAT');
    fireEvent.click(within(dialog).getByRole('switch', { name: /VAT can be reclaimed/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0].payload).toMatchObject({ net_amount: 30, vat_amount: 0, vat_treatment: 'outside_scope', vat_reclaimable: false });
  });
});

describe('expense form: company VAT registered (unchanged)', () => {
  it('shows every VAT question with the standard-rate default', async () => {
    const db = fakeDb([]);
    render(<Tab db={db} reg={lookup({ 'org-a': YES })} />);
    const dialog = await addExpense('30');
    expectVatShown(dialog, true);
    expect(vatControls(dialog).treatment).toHaveTextContent('Standard rate');
    expect(within(dialog).getByTestId('expense-vat-summary')).toHaveTextContent('Net £25.00 · VAT £5.00 · Total £30.00');
    expect(within(dialog).queryByTestId('expense-vat-recorded-note')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0].payload).toMatchObject({ net_amount: 25, vat_amount: 5, vat_treatment: 'standard', vat_reclaimable: true });
  });

  it('still requires a treatment for an older expense ("Choose how VAT applies")', async () => {
    const db = fakeDb([{ id: 'e1', description: 'Old taxi', category: 'office_costs', amount: 30, date: '2026-10-15', supplier_id: null, status: 'paid', organization_id: 'org-a' }]);
    render(<Tab db={db} reg={lookup({ 'org-a': YES })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Old taxi' })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('expense-vat-choose')).toHaveTextContent('Choose how VAT applies to this expense.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByText('Choose how VAT applies to this expense.', { selector: '[role="alert"], p' })).toBeInTheDocument();
    expect(db.calls).toHaveLength(0);
  });
});

describe('expense form: "registered from" date', () => {
  const FROM: VatRegistration = { vat_registered: true, vat_registered_from: '2026-11-01' };
  it('an expense dated before the date: no VAT questions', async () => {
    render(<Tab db={fakeDb([])} reg={lookup({ 'org-a': FROM })} />);
    const dialog = await addExpense('30', '2026-10-31');
    expectVatShown(dialog, false);
  });
  it('an expense on or after the date: the full form, and changing the date switches it back', async () => {
    render(<Tab db={fakeDb([])} reg={lookup({ 'org-a': FROM })} />);
    const dialog = await addExpense('30', '2026-11-01');
    expectVatShown(dialog, true);
    fireEvent.change(within(dialog).getByLabelText(/^Date/), { target: { value: '2026-10-01' } });
    expectVatShown(dialog, false);
  });
});

describe('expense form: status unknown (loading or failed)', () => {
  it('shows the full form and saves as today', async () => {
    const db = fakeDb([]);
    render(<Tab db={db} reg={lookup({})} />);
    const dialog = await addExpense('12');
    expectVatShown(dialog, true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0].payload).toMatchObject({ net_amount: 10, vat_amount: 2, vat_treatment: 'standard' });
  });
  it('with no lookup at all (the default), the full form', async () => {
    render(<Tab db={fakeDb([])} />);
    expectVatShown(await addExpense('12'), true);
  });
});

describe('expense form: the company chosen in the form decides', () => {
  it('switching from a registered company to one that is not hides the VAT questions, and back', async () => {
    const db = fakeDb([]);
    render(<Tab db={db} companies={COMPANIES} reg={lookup({ 'org-a': YES, 'org-b': NO })} />);
    const dialog = await addExpense('30');
    expectVatShown(dialog, true);
    await pickOption(dialog, /^Company/, 'Beta Ltd');
    expectVatShown(dialog, false);
    await pickOption(dialog, /^Company/, 'Alpha Ltd');
    expectVatShown(dialog, true);
    await pickOption(dialog, /^Company/, 'Beta Ltd');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(db.calls).toHaveLength(1));
    expect(db.calls[0].payload).toMatchObject({ organization_id: 'org-b', ...VAT_FREE });
  });
});
