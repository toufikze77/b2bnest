import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { AssuranceContext, signedOutAssurance } from '@/hooks/useAssurance';
import { describe, expect, it, vi } from 'vitest';
import type { LedgerAccount } from '@/lib/ledger';
import type { JournalEntry, LedgerApi, LedgerStatus } from '@/lib/ledgerApi';
import { LedgerTab } from './LedgerTab';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const ORG = 'org-1';
const status = (o: Partial<LedgerStatus> = {}): LedgerStatus => ({
  access: 'ok', can_post: true, set_up: true, start_date: '2026-04-01', opening_mode: 'fresh', locked_through: null, base_currency: 'GBP', ...o,
});
const accounts: LedgerAccount[] = [
  { id: 'a-bank', code: '1200', name: 'Bank', type: 'asset', is_system: true, system_key: 'bank', is_active: true },
  { id: 'a-share', code: '3000', name: 'Share capital', type: 'equity', is_system: true, system_key: 'share_capital', is_active: true },
  { id: 'a-rent', code: '7100', name: 'Rent and rates', type: 'expense', is_system: false, system_key: null, is_active: true },
  { id: 'a-old', code: '7150', name: 'Old costs', type: 'expense', is_system: false, system_key: null, is_active: false },
];
const journals: JournalEntry[] = [
  { id: 'j1', entry_date: '2026-04-01', memo: 'Opening balances', reason: 'Opening balances at the start date', source_type: 'opening_balance', reverses_entry_id: null, posted_by_name: 'Ann', posted_at: '2026-04-01T10:00:00Z' },
  { id: 'j2', entry_date: '2026-05-01', memo: 'Rent accrual', reason: 'Month end', source_type: 'manual', reverses_entry_id: null, posted_by_name: 'Ann', posted_at: '2026-05-01T10:00:00Z' },
];
const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });

function fakeApi(o: Partial<Record<keyof LedgerApi, unknown>> = {}) {
  const api = {
    status: vi.fn(() => ok(status())),
    setup: vi.fn(() => ok({ result: 'ok', accounts: 30, opening_entry_id: null })),
    post: vi.fn(() => ok({ result: 'ok', entry_id: 'j9' })),
    reverse: vi.fn(() => ok({ result: 'ok', entry_id: 'j10' })),
    addAccount: vi.fn(() => ok('a-new')),
    updateAccount: vi.fn(() => ok(null)),
    trialBalance: vi.fn(() => ok([
      { account_id: 'a-bank', code: '1200', name: 'Bank', type: 'asset', is_active: true, debit: 1000, credit: 0 },
      { account_id: 'a-share', code: '3000', name: 'Share capital', type: 'equity', is_active: true, debit: 0, credit: '1000.00' },
    ])),
    accounts: vi.fn(() => ok(accounts)),
    journals: vi.fn(() => ok(journals)),
    lines: vi.fn(() => ok([
      { id: 'l1', entry_id: 'j2', account_id: 'a-rent', line_no: 1, debit: '250.00', credit: '0.00', description: null },
      { id: 'l2', entry_id: 'j2', account_id: 'a-bank', line_no: 2, debit: 0, credit: 250, description: null },
    ])),
    // Finance phase 3a reads: by default as before its SQL is applied (not available), so phase 2 screens must still work.
    postings: vi.fn(() => Promise.resolve({ ok: false as const, code: 'NOT_AVAILABLE' })),
    categoryMap: vi.fn(() => Promise.resolve({ ok: false as const, code: 'NOT_AVAILABLE' })),
    vatRegisteredSet: vi.fn(() => Promise.resolve({ ok: false as const, code: 'NOT_AVAILABLE' })),
    issues: vi.fn(() => Promise.resolve({ ok: false as const, code: 'NOT_AVAILABLE' })),
    autoStatus: vi.fn(() => Promise.resolve({ ok: false as const, code: 'NOT_AVAILABLE' })),
    autoPreview: vi.fn(() => Promise.resolve({ ok: false as const, code: 'NOT_AVAILABLE' })),
    autoSet: vi.fn(() => Promise.resolve({ ok: false as const, code: 'NOT_AVAILABLE' })),
    autoCatchUp: vi.fn(() => Promise.resolve({ ok: false as const, code: 'NOT_AVAILABLE' })),
    autoRun: vi.fn(() => Promise.resolve({ ok: false as const, code: 'NOT_AVAILABLE' })),
    ...o,
  };
  return api as unknown as LedgerApi & Record<string, ReturnType<typeof vi.fn>>;
}
const show = (api: LedgerApi, isDemo = false, org: string | null = ORG) =>
  render(<MemoryRouter><LedgerTab organizationId={org} api={api} isDemo={isDemo} /></MemoryRouter>);
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('Ledger tab: states', () => {
  it('always shows the bookkeeping disclaimer', async () => {
    show(fakeApi());
    expect(screen.getByTestId('ledger-disclaimer')).toHaveTextContent('Bookkeeping tool. Not accounting, tax or legal advice.');
    await screen.findByRole('tab', { name: 'Journals' });
  });

  it('says "not available yet" before the SQL is applied', async () => {
    show(fakeApi({ status: vi.fn(() => Promise.resolve({ ok: false, code: 'NOT_AVAILABLE' })) }));
    expect(await screen.findByTestId('ledger-not-available')).toHaveTextContent('The ledger is not available yet.');
  });

  it('Solo sees the upgrade note with a Pricing link; trial ended too; nothing else is loaded', async () => {
    const api = fakeApi({ status: vi.fn(() => ok(status({ access: 'plan_not_included', can_post: false, set_up: false }))) });
    show(api);
    const note = await screen.findByTestId('ledger-upgrade');
    expect(note).toHaveTextContent('The ledger is included in the Business and Scale plans, and during the 14-day trial.');
    expect(within(note).getByRole('link', { name: 'See plans on the Pricing page' })).toHaveAttribute('href', '/pricing');
    expect(api.accounts).not.toHaveBeenCalled();
    expect(screen.queryByRole('tab', { name: 'Automatic postings' })).toBeNull();
    expect(api.autoStatus).not.toHaveBeenCalled();
  });

  it('trial ended: the upgrade note', async () => {
    show(fakeApi({ status: vi.fn(() => ok(status({ access: 'trial_ended', can_post: false }))) }));
    expect(await screen.findByTestId('ledger-upgrade')).toHaveTextContent('Your trial has ended. Choose a plan to use the ledger.');
  });

  it('demo account: inert, and the database is never asked', () => {
    const api = fakeApi();
    show(api, true);
    expect(screen.getByTestId('ledger-demo')).toHaveTextContent('This is a demo account. It is view only.');
    expect(api.status).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).toBeNull();
    expect(api.autoStatus).not.toHaveBeenCalled();
    expect(api.autoSet).not.toHaveBeenCalled();
  });

  it('a member who is not an owner or admin can read but has no write buttons', async () => {
    show(fakeApi({ status: vi.fn(() => ok(status({ can_post: false }))) }));
    await screen.findByText(/Only an owner or admin can change it/);
    expect(screen.queryByRole('button', { name: 'New journal' })).toBeNull();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Chart of accounts' }));
    await screen.findByTestId('account-7100');
    expect(screen.queryByRole('button', { name: /Rename/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add account' })).toBeNull();
  });

  it('not set up, member only: says an owner or admin can set it up', async () => {
    show(fakeApi({ status: vi.fn(() => ok(status({ set_up: false, can_post: false }))) }));
    expect(await screen.findByText(/An owner or admin of this company can set it up/)).toBeInTheDocument();
  });
});

describe('Ledger tab: setup wizard', () => {
  const notSetUp = () => fakeApi({ status: vi.fn(() => ok(status({ set_up: false }))) });

  it('start fresh: date, preview, set up (no opening balances)', async () => {
    const api = notSetUp();
    show(api);
    await screen.findByText('Set up the ledger');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    type('Start date', '2026-04-01');
    click('Next');
    expect(screen.getByTestId('ledger-preview')).toHaveTextContent('none (starting fresh).');
    expect(screen.queryByText(/cannot be edited or deleted/)).toBeNull();
    await act(async () => { click('Set up the ledger'); });
    expect(api.setup).toHaveBeenCalledWith(ORG, '2026-04-01', 'fresh', null);
    await waitFor(() => expect(api.status).toHaveBeenCalledTimes(2));
  });

  it('import: the grid shows the running difference; preview only when balanced; one warning; lines sent as codes', async () => {
    const api = notSetUp();
    show(api);
    await screen.findByText('Set up the ledger');
    type('Start date', '2026-04-01');
    fireEvent.click(screen.getByLabelText(/Import opening balances/));
    click('Next');
    fireEvent.change(screen.getByLabelText('Line 1 account'), { target: { value: '1200' } });
    type('Line 1 debit', '1,500.25');
    fireEvent.change(screen.getByLabelText('Line 2 account'), { target: { value: '3000' } });
    type('Line 2 credit', '1500');
    expect(screen.getByTestId('opening-difference')).toHaveTextContent('Debits are £0.25 more than credits');
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    type('Line 2 credit', '1500.25');
    expect(screen.getByTestId('opening-difference')).toHaveTextContent('Balanced');
    click('Preview');
    expect(screen.getAllByText('Once posted, a journal cannot be edited or deleted. It can only be reversed.')).toHaveLength(1);
    expect(screen.getByTestId('ledger-preview')).toHaveTextContent('one journal of 2 lines, dated 2026-04-01.');
    await act(async () => { click('Set up the ledger'); });
    expect(api.setup).toHaveBeenCalledWith(ORG, '2026-04-01', 'import', [
      { account_code: '1200', debit: '1500.25', credit: '0.00' }, { account_code: '3000', debit: '0.00', credit: '1500.25' }]);
  });

  it('import: a CSV with mistakes lists them by line and fills the grid', async () => {
    show(notSetUp());
    await screen.findByText('Set up the ledger');
    type('Start date', '2026-04-01');
    fireEvent.click(screen.getByLabelText(/Import opening balances/));
    click('Next');
    const file = new File(['account_code,debit,credit\n1200,100,\nNOPE,,100\n'], 'opening.csv', { type: 'text/csv' });
    await act(async () => { fireEvent.change(screen.getByLabelText('Upload a CSV file'), { target: { files: [file] } }); });
    const list = await screen.findByRole('list', { name: 'CSV problems' });
    expect(list).toHaveTextContent('CSV line 3: Unknown account code NOPE.');
    expect(screen.getByLabelText('Line 1 account')).toHaveValue('1200');
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
  });

  it('shows the database refusal in words', async () => {
    const api = fakeApi({ status: vi.fn(() => ok(status({ set_up: false }))), setup: vi.fn(() => Promise.resolve({ ok: false, code: 'ALREADY_SET_UP' })) });
    show(api);
    await screen.findByText('Set up the ledger');
    type('Start date', '2026-04-01');
    click('Next');
    await act(async () => { click('Set up the ledger'); });
    expect(screen.getByRole('alert')).toHaveTextContent('The ledger is already set up for this company.');
  });
});

describe('Ledger tab: chart of accounts', () => {
  const openChart = async () => {
    await screen.findByRole('tab', { name: 'Chart of accounts' });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Chart of accounts' }));
    return screen.findByTestId('account-7100');
  };

  it('groups by type; system accounts have no rename or deactivate; others do', async () => {
    show(fakeApi());
    await openChart();
    expect(screen.getByRole('list', { name: 'Assets' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Expenses' })).toBeInTheDocument();
    const bank = screen.getByTestId('account-1200');
    expect(within(bank).getByText('System')).toBeInTheDocument();
    expect(within(bank).queryByRole('button')).toBeNull();
    expect(within(screen.getByTestId('account-7150')).getByRole('button', { name: /Make active/ })).toBeInTheDocument();
  });

  it('rename and make inactive call the account RPC', async () => {
    const api = fakeApi();
    show(api);
    const rent = await openChart();
    fireEvent.click(within(rent).getByRole('button', { name: /Rename/ }));
    type('New name for 7100', 'Rent');
    await act(async () => { fireEvent.click(within(screen.getByTestId('account-7100')).getByRole('button', { name: 'Save' })); });
    expect(api.updateAccount).toHaveBeenCalledWith('a-rent', { name: 'Rent' });
    await act(async () => { fireEvent.click(within(await screen.findByTestId('account-7100')).getByRole('button', { name: /Make inactive/ })); });
    expect(api.updateAccount).toHaveBeenCalledWith('a-rent', { is_active: false });
  });

  it('add account: checks the code first, then calls the RPC', async () => {
    const api = fakeApi();
    show(api);
    await openChart();
    click('Add account');
    type('Code', '7100');
    type('Name', 'Insurance');
    click('Save account');
    expect(screen.getByRole('alert')).toHaveTextContent('That code is already used.');
    expect(api.addAccount).not.toHaveBeenCalled();
    type('Code', '7150A');
    await act(async () => { click('Save account'); });
    expect(api.addAccount).toHaveBeenCalledWith(ORG, { code: '7150A', name: 'Insurance', type: 'expense' });
  });
});

describe('Ledger tab: journals', () => {
  it('a new journal needs a reason and must balance; it posts by account id with an idempotency key', async () => {
    const api = fakeApi();
    show(api);
    fireEvent.click(await screen.findByRole('button', { name: 'New journal' }));
    type('Date', '2026-05-31');
    type('Description', 'Rent accrual');
    fireEvent.change(screen.getByLabelText('Line 1 account'), { target: { value: 'a-rent' } });
    type('Line 1 debit', '250');
    fireEvent.change(screen.getByLabelText('Line 2 account'), { target: { value: 'a-bank' } });
    type('Line 2 credit', '200');
    expect(screen.getByTestId('journal-difference')).toHaveTextContent('Debits are £50.00 more than credits');
    type('Line 2 credit', '250');
    expect(screen.getByRole('button', { name: 'Post journal' })).toBeDisabled();
    expect(screen.getByRole('list', { name: 'Before you post' })).toHaveTextContent('Add a reason (at least 3 characters).');
    expect(screen.queryByRole('option', { name: '7150 Old costs' })).toBeNull();
    type('Reason (required)', 'Month end');
    expect(screen.getByText('Once posted, a journal cannot be edited or deleted. It can only be reversed.')).toBeInTheDocument();
    await act(async () => { click('Post journal'); });
    const [org, f] = vi.mocked(api.post).mock.calls[0] as [string, { lines: unknown; key: string; reason: string }];
    expect(org).toBe(ORG);
    expect(f.reason).toBe('Month end');
    expect(f.lines).toEqual([{ account_id: 'a-rent', debit: '250.00', credit: '0.00' }, { account_id: 'a-bank', debit: '0.00', credit: '250.00' }]);
    expect(f.key).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
  });

  it('has no edit or delete; Reverse needs a reason', async () => {
    const api = fakeApi();
    show(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Rent accrual' }));
    await screen.findByRole('table', { name: 'Journal lines' });
    expect(screen.getByRole('table', { name: 'Journal lines' })).toHaveTextContent('£250.00');
    expect(screen.queryByRole('button', { name: /edit|delete/i })).toBeNull();
    click('Reverse');
    expect(screen.getByRole('button', { name: 'Post the reversal' })).toBeDisabled();
    type('Reason for reversing (required)', 'Posted twice');
    await act(async () => { click('Post the reversal'); });
    expect(api.reverse).toHaveBeenCalledWith('j2', 'Posted twice');
  });

  it('a reversed journal, or a reversal, offers no Reverse', async () => {
    const withReversal = [...journals, { id: 'j3', entry_date: '2026-05-02', memo: 'Reversal: Rent accrual', reason: 'Posted twice', source_type: 'reversal' as const, reverses_entry_id: 'j2', posted_by_name: 'Ann', posted_at: '2026-05-02T10:00:00Z' }];
    show(fakeApi({ journals: vi.fn(() => ok(withReversal)) }));
    expect(await screen.findByText('Reversed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rent accrual' }));
    await screen.findByRole('table', { name: 'Journal lines' });
    expect(screen.queryByRole('button', { name: 'Reverse' })).toBeNull();
    click('Back to journals');
    fireEvent.click(screen.getByRole('button', { name: 'Reversal: Rent accrual' }));
    await screen.findByRole('table', { name: 'Journal lines' });
    expect(screen.queryByRole('button', { name: 'Reverse' })).toBeNull();
  });
});

describe('Ledger tab: trial balance', () => {
  it('shows each balance and the totals check, for the chosen date', async () => {
    const api = fakeApi();
    show(api);
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Trial balance' }));
    expect(await screen.findByTestId('tb-check')).toHaveTextContent('Debits and credits agree.');
    expect(screen.getByTestId('tb-debit')).toHaveTextContent('£1,000.00');
    expect(screen.getByTestId('tb-credit')).toHaveTextContent('£1,000.00');
    type('As at', '2026-04-30');
    await waitFor(() => expect(api.trialBalance).toHaveBeenLastCalledWith(ORG, '2026-04-30'));
  });

  it('says so when the totals do not agree', async () => {
    show(fakeApi({ trialBalance: vi.fn(() => ok([{ account_id: 'a-bank', code: '1200', name: 'Bank', type: 'asset', is_active: true, debit: '1.00', credit: 0 }])) }));
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Trial balance' }));
    expect(await screen.findByTestId('tb-check')).toHaveTextContent("Debits and credits don't agree.");
  });
});

describe('Ledger tab: automatic postings (phase 3a)', () => {
  const autoStatus = (o: Record<string, unknown> = {}) => ({ access: 'ok', can_manage: true, set_up: true, invoices_enabled: false, enabled_at: null, waiting: 0, open_issues: 0, ...o });
  const preview = { invoices_to_post: 4, invoices_total: 30600, payments_to_post: 1, payments_total: 5000, to_reverse: 0, already_posted: 0, not_issued: 2,
    skipped: { before_start: 1, currency_not_gbp: 1 } };
  const withAuto = (o: Partial<Record<keyof LedgerApi, unknown>> = {}) => fakeApi({
    autoStatus: vi.fn(() => ok(autoStatus())), autoPreview: vi.fn(() => ok(preview)), issues: vi.fn(() => ok([])),
    autoSet: vi.fn(() => ok(autoStatus({ invoices_enabled: true, enabled_at: '2026-03-03T10:00:00Z' }))),
    autoCatchUp: vi.fn(() => ok({ queued: 9, processed: 9, failed: 0, dropped: 0, remaining: 0 })), ...o });
  const openAuto = async () => { fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Automatic postings' })); };

  it('says "not available yet" when the phase 3a SQL is not applied (and the rest of the ledger still works)', async () => {
    show(fakeApi());
    await openAuto();
    expect(await screen.findByTestId('auto-not-available')).toHaveTextContent('Automatic postings are not available yet.');
  });

  it('off by default: the switch, the plain explanation with the worked example, the VAT scheme note and the preview', async () => {
    show(withAuto());
    await openAuto();
    expect(await screen.findByTestId('auto-state')).toHaveTextContent('Off');
    expect(screen.getByRole('switch', { name: 'Post invoices to the ledger automatically' })).not.toBeChecked();
    expect(screen.getByText(/Dr Debtors £120\.00, Cr Sales £100\.00, Cr VAT control £20\.00/)).toBeInTheDocument();
    expect(screen.getByText(/VAT scheme rules .* are not applied yet/)).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'What would be posted' });
    expect(table).toHaveTextContent('Invoices to post4£306.00');
    expect(table).toHaveTextContent('Payments to post1£50.00');
    expect(table).toHaveTextContent('Skipped: Dated before the ledger start date.1');
    expect(table).toHaveTextContent('Skipped: Not in pounds (GBP). Only GBP invoices are posted.1');
    expect(screen.queryByRole('button', { name: 'Post existing invoices' })).toBeNull();
    expect(screen.getByText('Switch automatic postings on to post existing invoices.')).toBeInTheDocument();
  });

  it('catch-up asks for confirmation with the counts, totals and the reversal-only warning', async () => {
    const api = withAuto({ autoStatus: vi.fn(() => ok(autoStatus({ invoices_enabled: true, enabled_at: '2026-03-03T10:00:00Z' }))) });
    show(api);
    await openAuto();
    fireEvent.click(await screen.findByRole('button', { name: 'Post existing invoices' }));
    const box = screen.getByTestId('auto-confirm');
    expect(box).toHaveTextContent('This posts 4 invoice journals (£306.00) and 1 payment journal (£50.00).');
    expect(box).toHaveTextContent('Once posted, a journal cannot be edited or deleted. It can only be reversed.');
    expect(api.autoCatchUp).not.toHaveBeenCalled();
    fireEvent.click(within(box).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('auto-confirm')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Post existing invoices' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Yes, post them' })); });
    expect(api.autoCatchUp).toHaveBeenCalledWith(ORG);
    expect(await screen.findByRole('status')).toHaveTextContent('Looked at 9 invoices.');
  });

  it('a plain member sees the state and the preview but cannot switch or post', async () => {
    show(withAuto({ autoStatus: vi.fn(() => ok(autoStatus({ can_manage: false, invoices_enabled: true }))) }));
    await openAuto();
    expect(await screen.findByRole('switch')).toBeDisabled();
    expect(screen.getByText('Only an owner or admin of this company can change this.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Post existing invoices' })).toBeNull();
  });

  it('the needs-attention list: plain reasons and a link to the invoices', async () => {
    show(withAuto({ issues: vi.fn(() => ok([
      { id: 'i1', source_id: 'x', source_label: 'INV-0012', kind: 'invoice_issued', reason_code: 'amounts_do_not_add_up', created_at: '2026-03-01' },
      { id: 'i2', source_id: 'y', source_label: 'INV-0013', kind: 'invoice_paid', reason_code: 'paid_date_missing', created_at: '2026-03-01' }])) }));
    await openAuto();
    const list = await screen.findByRole('list', { name: 'Needs attention' });
    expect(list).toHaveTextContent("Invoice INV-0012The subtotal and VAT don't add up to the total.");
    expect(list).toHaveTextContent('Payment INV-0013Marked paid, but with no paid date.');
    expect(within(list).getAllByRole('link')[0]).toHaveAttribute('href', '/business-tools?tool=business-finance-assistant&tab=invoices');
  });

  it('journals show their source, and an automatic journal keeps the usual Reverse', async () => {
    const auto: JournalEntry = { id: 'j5', entry_date: '2026-02-01', memo: 'Invoice INV-0012 issued', reason: 'Automatic posting', source_type: 'auto_invoice',
      reverses_entry_id: null, posted_by_name: 'Automatic posting', posted_at: '2026-02-01T10:00:00Z' };
    const api = fakeApi({ journals: vi.fn(() => ok([...journals, auto])),
      postings: vi.fn(() => ok([{ entry_id: 'j5', reversal_entry_id: null, source_label: 'INV-0012', kind: 'invoice_issued' }])) });
    show(api);
    const table = await screen.findByRole('table', { name: 'Journals' });
    await waitFor(() => expect(table).toHaveTextContent('Automatic: invoiceInvoice INV-0012'));
    fireEvent.click(screen.getByRole('button', { name: 'Invoice INV-0012 issued' }));
    expect(await screen.findByTestId('journal-source')).toHaveTextContent('Source: Invoice INV-0012');
    fireEvent.click(screen.getByRole('button', { name: 'Reverse' }));
    fireEvent.change(screen.getByLabelText('Reason for reversing (required)'), { target: { value: 'Wrong customer' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Post the reversal' })); });
    expect(api.reverse).toHaveBeenCalledWith('j5', 'Wrong customer');
  });
});

// ------------------------------------------------------------------ follow-up: post straight away, URL section, switch
const managerOn = (o: Record<string, unknown> = {}) => ({ access: 'ok', can_manage: true, set_up: true, invoices_enabled: true, enabled_at: '2026-03-03T10:00:00Z', waiting: 0, open_issues: 0, ...o });
const emptyPreview = { invoices_to_post: 0, invoices_total: 0, payments_to_post: 0, payments_total: 0, to_reverse: 0, already_posted: 0, not_issued: 0, skipped: {} };
const autoApi = (status: Record<string, unknown>, o: Partial<Record<keyof LedgerApi, unknown>> = {}) => fakeApi({
  autoStatus: vi.fn(() => ok(status)), autoPreview: vi.fn(() => ok(emptyPreview)), issues: vi.fn(() => ok([])),
  autoRun: vi.fn(() => ok({ processed: 2, failed: 0, dropped: 0, remaining: 0 })), ...o });
function Loc() { const l = useLocation(); return <div data-testid="loc">{l.search}</div>; }
function Back() { const n = useNavigate(); return <button type="button" onClick={() => n(-1)}>Browser back</button>; }
const showAt = (api: LedgerApi, search: string) =>
  render(<MemoryRouter initialEntries={[`/business-tools${search}`]}><LedgerTab organizationId={ORG} api={api} isDemo={false} /><Loc /><Back /></MemoryRouter>);
const selected = (name: string) => screen.getByRole('tab', { name }).getAttribute('aria-selected') === 'true';

describe('Ledger tab: post waiting invoices straight away', () => {
  it('a manager with the switch on and invoices waiting: one run on load, before the journals are read', async () => {
    const api = autoApi(managerOn({ waiting: 2 }));
    show(api);
    await screen.findByRole('table', { name: 'Journals' });
    expect(api.autoRun).toHaveBeenCalledTimes(1);
    expect(api.autoRun).toHaveBeenCalledWith(ORG);
    expect(vi.mocked(api.journals).mock.invocationCallOrder[0]).toBeGreaterThan(vi.mocked(api.autoRun).mock.invocationCallOrder[0]);
  });

  it('at most three runs while invoices remain (each posts up to 200)', async () => {
    const api = autoApi(managerOn({ waiting: 900 }), { autoRun: vi.fn(() => ok({ processed: 200, failed: 0, dropped: 0, remaining: 700 })) });
    show(api);
    await screen.findByRole('table', { name: 'Journals' });
    expect(api.autoRun).toHaveBeenCalledTimes(3);
  });

  it('never for a plain member, with the switch off, with nothing waiting, or before the SQL is applied', async () => {
    for (const api of [autoApi(managerOn({ waiting: 2, can_manage: false })), autoApi(managerOn({ waiting: 2, invoices_enabled: false })),
      autoApi(managerOn({ waiting: 0 })), fakeApi()]) {
      const { unmount } = show(api);
      await screen.findByRole('table', { name: 'Journals' });
      expect(api.autoRun).not.toHaveBeenCalled();
      unmount();
    }
  });

  it('never for the demo account (nothing is asked at all)', () => {
    const api = autoApi(managerOn({ waiting: 2 }));
    show(api, true);
    expect(api.autoStatus).not.toHaveBeenCalled();
    expect(api.autoRun).not.toHaveBeenCalled();
  });

  it('opening Trial balance or Automatic postings runs again and reloads; Chart of accounts does not', async () => {
    const api = autoApi(managerOn({ waiting: 1 }));
    show(api);
    await screen.findByRole('table', { name: 'Journals' });
    expect(api.autoRun).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Chart of accounts' }));
    await screen.findByTestId('account-7100');
    expect(api.autoRun).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Trial balance' }));
    await waitFor(() => expect(api.autoRun).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(api.journals).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(vi.mocked(api.trialBalance).mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});

describe('Ledger tab: the section is kept in the URL', () => {
  it('opens on the section in ?ledger= and keeps the other params', async () => {
    showAt(fakeApi(), '?tool=business-finance-assistant&tab=ledger&ledger=trial-balance');
    await screen.findByTestId('tb-check');
    expect(selected('Trial balance')).toBe(true);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Chart of accounts' }));
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('?tool=business-finance-assistant&tab=ledger&ledger=accounts'));
    expect(selected('Chart of accounts')).toBe(true);
  });

  it('an unknown or missing value falls back to Journals', async () => {
    showAt(fakeApi(), '?tab=ledger&ledger=nonsense');
    await screen.findByRole('table', { name: 'Journals' });
    expect(selected('Journals')).toBe(true);
  });

  it('Back returns to the previous section', async () => {
    showAt(fakeApi(), '?tab=ledger');
    await screen.findByRole('table', { name: 'Journals' });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Trial balance' }));
    await screen.findByTestId('tb-check');
    expect(screen.getByTestId('loc').textContent).toBe('?tab=ledger&ledger=trial-balance');
    fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('?tab=ledger'));
    await waitFor(() => expect(selected('Journals')).toBe(true));
    expect(screen.getByTestId('loc').textContent).toBe('?tab=ledger');
  });
});

describe('Ledger tab: the automatic-postings switch', () => {
  const openAt = async (api: LedgerApi, assurance?: { refresh: () => Promise<void> }) => {
    const ui = <MemoryRouter initialEntries={['/x?ledger=automatic']}><LedgerTab organizationId={ORG} api={api} isDemo={false} /></MemoryRouter>;
    render(assurance ? <AssuranceContext.Provider value={{ ...signedOutAssurance, ...assurance }}>{ui}</AssuranceContext.Provider> : ui);
    return screen.findByRole('switch', { name: 'Post invoices to the ledger automatically' });
  };

  it('one click sends exactly one call; while it runs the switch is busy and further clicks are ignored', async () => {
    let finish: (v: unknown) => void = () => {};
    const api = autoApi(managerOn({ invoices_enabled: false, enabled_at: null }), { autoSet: vi.fn(() => new Promise((r) => { finish = r; })) });
    const sw = await openAt(api);
    fireEvent.click(sw);
    expect(api.autoSet).toHaveBeenCalledTimes(1);
    expect(api.autoSet).toHaveBeenCalledWith(ORG, true);
    await waitFor(() => expect(sw).toBeDisabled());
    expect(sw).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('auto-state')).toHaveTextContent('Saving…');
    fireEvent.click(sw); fireEvent.click(sw);
    expect(api.autoSet).toHaveBeenCalledTimes(1);
    vi.mocked(api.autoStatus).mockImplementation(() => ok(managerOn()));
    await act(async () => { finish({ ok: true, data: managerOn() }); });
    expect(await screen.findByText('Automatic postings are on.')).toBeInTheDocument();
    expect(screen.getByTestId('auto-state')).toHaveTextContent('On since 3 March 2026');
    expect(sw).not.toBeDisabled();
    expect(api.autoSet).toHaveBeenCalledTimes(1);
  });

  it('switching off asks first; "Keep on" sends nothing; "Stop" sends one call', async () => {
    const api = autoApi(managerOn(), { autoSet: vi.fn(() => ok(managerOn({ invoices_enabled: false }))) });
    const sw = await openAt(api);
    fireEvent.click(sw);
    expect(screen.getByTestId('auto-off-confirm')).toHaveTextContent('Stop automatic postings? Existing journals are kept.');
    expect(api.autoSet).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep on' }));
    expect(screen.queryByTestId('auto-off-confirm')).toBeNull();
    expect(api.autoSet).not.toHaveBeenCalled();
    fireEvent.click(sw);
    vi.mocked(api.autoStatus).mockImplementation(() => ok(managerOn({ invoices_enabled: false })));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })); });
    expect(api.autoSet).toHaveBeenCalledTimes(1);
    expect(api.autoSet).toHaveBeenCalledWith(ORG, false);
    expect(await screen.findByText('Automatic postings are off. Existing journals are kept.')).toBeInTheDocument();
  });

  it('MFA_REQUIRED: a plain message, and the app re-checks two-step sign-in (its usual code screen)', async () => {
    const refresh = vi.fn(() => Promise.resolve());
    const api = autoApi(managerOn({ invoices_enabled: false }), { autoSet: vi.fn(() => Promise.resolve({ ok: false as const, code: 'MFA_REQUIRED' })) });
    const sw = await openAt(api, { refresh });
    await act(async () => { fireEvent.click(sw); });
    expect(screen.getByRole('alert')).toHaveTextContent('Confirm with your authenticator app, then try again.');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('other refusals are shown in words', async () => {
    const api = autoApi(managerOn({ invoices_enabled: false }), { autoSet: vi.fn(() => Promise.resolve({ ok: false as const, code: 'NOT_ADMIN' })) });
    const sw = await openAt(api);
    await act(async () => { fireEvent.click(sw); });
    expect(screen.getByRole('alert')).toHaveTextContent('Only an owner or admin of this company can change the ledger.');
  });

  it('"Post now" shows for a manager whenever invoices are waiting, never for a plain member', async () => {
    const api = autoApi(managerOn({ waiting: 3 }), { autoRun: vi.fn(() => ok({ processed: 0, failed: 0, dropped: 0, remaining: 3 })) });
    await openAt(api);
    expect(await screen.findByTestId('auto-waiting')).toHaveTextContent('3 invoices waiting to be posted.');
    expect(screen.getByRole('button', { name: 'Post now' })).toBeInTheDocument();
    cleanup();
    await openAt(autoApi(managerOn({ waiting: 3, can_manage: false })));
    await screen.findByTestId('auto-waiting');
    expect(screen.queryByRole('button', { name: 'Post now' })).toBeNull();
  });
});

// ------------------------------------------------------------------ Finance phase 3b: bills and expenses
describe('Ledger tab: automatic postings for bills and expenses', () => {
  const billsPreview = { bills_to_post: 4, bills_total: 25000, bill_payments_to_post: 1, bill_payments_total: 6000, expenses_to_post: 4, expenses_total: 9600,
    to_reverse: 0, already_posted: 0, not_posted: 3, skipped: { category_not_mapped: 1, vat_details_missing: 1 } };
  const travel = { id: 'a-travel', code: '7400', name: 'Travel', type: 'expense' as const, is_system: false, system_key: null, is_active: true };
  const billsApi = (status: Record<string, unknown>, o: Partial<Record<keyof LedgerApi, unknown>> = {}) => autoApi(status, {
    autoPreview: vi.fn(() => ok({ ...emptyPreview, bills_and_expenses: billsPreview })),
    accounts: vi.fn(() => ok([...accounts, travel])),
    categoryMap: vi.fn(() => ok([{ category_key: 'travel', account_id: 'a-travel', is_default: true }, { category_key: 'utilities', account_id: null, is_default: true }])),
    ...o });
  const openAt = async (api: LedgerApi, assurance?: { refresh: () => Promise<void> }) => {
    const ui = <MemoryRouter initialEntries={['/x?ledger=automatic']}><LedgerTab organizationId={ORG} api={api} isDemo={false} /></MemoryRouter>;
    render(assurance ? <AssuranceContext.Provider value={{ ...signedOutAssurance, ...assurance }}>{ui}</AssuranceContext.Provider> : ui);
    return screen.findByRole('switch', { name: 'Post bills and expenses to the ledger automatically' });
  };

  it('before the 3b SQL is applied: "not available yet", and the invoice switch still works', async () => {
    render(<MemoryRouter initialEntries={['/x?ledger=automatic']}><LedgerTab organizationId={ORG} api={autoApi(managerOn())} isDemo={false} /></MemoryRouter>);
    expect(await screen.findByTestId('auto-bills-not-available')).toHaveTextContent('Automatic postings for bills and expenses are not available yet.');
    expect(screen.getByRole('switch', { name: 'Post invoices to the ledger automatically' })).toBeInTheDocument();
  });

  it('off: the switch, the worked example, the preview rows and the mapping (read only)', async () => {
    const sw = await openAt(billsApi(managerOn({ bills_enabled: false })));
    expect(sw).not.toBeChecked();
    expect(screen.getByTestId('auto-bills-state')).toHaveTextContent('Off');
    expect(screen.getByTestId('auto-bills')).toHaveTextContent('Dr the expense account £100.00, Dr VAT control £20.00, Cr Creditors £120.00');
    const table = screen.getByRole('table', { name: 'Bills and expenses that would be posted' });
    expect(table).toHaveTextContent('Bills to post4£250.00');
    expect(table).toHaveTextContent('Bill payments to post1£60.00');
    expect(table).toHaveTextContent('Expenses to post4£96.00');
    expect(table).toHaveTextContent('Skipped: Its category has no ledger account yet.1');
    expect(table).toHaveTextContent("Skipped: Its VAT isn't recorded and the company is marked VAT registered");
    expect(screen.queryByRole('button', { name: 'Post existing bills and expenses' })).toBeNull();
    const map = await screen.findByRole('table', { name: 'Category mapping' });
    expect(map).toHaveTextContent('Travel (travel)7400 Travel');
    expect(map).toHaveTextContent('Utilities (utilities)Not mapped');
    const unmapped = screen.getByTestId('auto-bills-unmapped');
    expect(unmapped).toHaveTextContent('Deliberately not mapped');
    expect(unmapped).toHaveTextContent('Wages and salaries: payroll comes later. (wages_salaries)');
    expect(unmapped).toHaveTextContent('Equipment and tools: it may be a fixed asset. (equipment_tools)');
    expect(within(map).queryByRole('button')).toBeNull();
  });

  it('one click sends one call naming the bills switch; busy while it runs; then the result', async () => {
    let finish: (v: unknown) => void = () => {};
    const api = billsApi(managerOn({ bills_enabled: false }), { autoSet: vi.fn(() => new Promise((r) => { finish = r; })) });
    const sw = await openAt(api);
    fireEvent.click(sw);
    fireEvent.click(sw);
    expect(api.autoSet).toHaveBeenCalledTimes(1);
    expect(api.autoSet).toHaveBeenCalledWith(ORG, true, 'bills_and_expenses');
    await waitFor(() => expect(sw).toBeDisabled());
    expect(screen.getByTestId('auto-bills-state')).toHaveTextContent('Saving…');
    vi.mocked(api.autoStatus).mockImplementation(() => ok(managerOn({ bills_enabled: true })));
    await act(async () => { finish({ ok: true, data: managerOn({ bills_enabled: true }) }); });
    expect(await screen.findByText('Bills and expenses now post automatically.')).toBeInTheDocument();
    expect(screen.getByTestId('auto-bills-state')).toHaveTextContent('On');
  });

  it('switching off asks first; the catch-up confirms with the numbers', async () => {
    const api = billsApi(managerOn({ bills_enabled: true }), {
      autoSet: vi.fn(() => ok(managerOn({ bills_enabled: false }))),
      autoCatchUp: vi.fn(() => ok({ queued: 16, processed: 16, failed: 0, dropped: 0, remaining: 0 })) });
    const sw = await openAt(api);
    fireEvent.click(screen.getByRole('button', { name: 'Post existing bills and expenses' }));
    const box = screen.getByTestId('auto-bills-confirm');
    expect(box).toHaveTextContent('This posts 4 bill journals (£250.00), 1 bill payment (£60.00) and 4 expense journals (£96.00).');
    expect(box).toHaveTextContent('Once posted, a journal cannot be edited or deleted. It can only be reversed.');
    await act(async () => { fireEvent.click(within(box).getByRole('button', { name: 'Yes, post them' })); });
    expect(api.autoCatchUp).toHaveBeenCalledWith(ORG, 'bills_and_expenses');
    expect(await screen.findByText('Looked at 16 bills and expenses.')).toBeInTheDocument();
    fireEvent.click(sw);
    expect(screen.getByTestId('auto-bills-off-confirm')).toHaveTextContent('Stop posting bills and expenses? Existing journals are kept.');
    expect(api.autoSet).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })); });
    expect(api.autoSet).toHaveBeenCalledWith(ORG, false, 'bills_and_expenses');
  });

  it('a plain member: read only', async () => {
    const sw = await openAt(billsApi(managerOn({ bills_enabled: true, can_manage: false })));
    expect(sw).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Post existing bills and expenses' })).toBeNull();
  });

  it('MFA_REQUIRED on the bills switch: the plain message and the usual two-step check', async () => {
    const refresh = vi.fn(() => Promise.resolve());
    const sw = await openAt(billsApi(managerOn({ bills_enabled: false }), { autoSet: vi.fn(() => Promise.resolve({ ok: false as const, code: 'MFA_REQUIRED' })) }), { refresh });
    await act(async () => { fireEvent.click(sw); });
    expect(within(screen.getByTestId('auto-bills')).getByRole('alert')).toHaveTextContent('Confirm with your authenticator app, then try again.');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('needs attention covers bills and expenses, with a link to where each is fixed', async () => {
    await openAt(billsApi(managerOn({ bills_enabled: true }), { issues: vi.fn(() => ok([
      { id: 'i1', source_table: 'bills', source_id: 'b', source_label: 'BILL-0012', kind: 'bill_received', reason_code: 'category_not_mapped', created_at: '2026-03-01' },
      { id: 'i2', source_table: 'expenses', source_id: 'e', source_label: 'Travel', kind: 'expense', reason_code: 'vat_details_missing', created_at: '2026-03-01' }])) }));
    const list = await screen.findByRole('list', { name: 'Needs attention' });
    expect(list).toHaveTextContent('Bill BILL-0012Its category has no ledger account yet.');
    expect(list).toHaveTextContent("Expense: TravelIts VAT isn't recorded and the company is marked VAT registered");
    const links = within(list).getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/business-tools?tool=business-finance-assistant&tab=company-records');
    expect(links[1]).toHaveAttribute('href', '/business-tools?tool=business-finance-assistant&tab=expenses');
  });

  it('journals show "Bill …" and "Expense: …" as their source', async () => {
    const bill: JournalEntry = { id: 'jb', entry_date: '2026-02-01', memo: 'Bill BILL-0012 from Acme received', reason: 'Automatic posting', source_type: 'auto_bill',
      reverses_entry_id: null, posted_by_name: 'Automatic posting', posted_at: '2026-02-01T10:00:00Z' };
    const exp: JournalEntry = { ...bill, id: 'je', memo: 'Expense: Travel 14 Feb', source_type: 'auto_expense' };
    show(fakeApi({ journals: vi.fn(() => ok([bill, exp])), postings: vi.fn(() => ok([
      { entry_id: 'jb', reversal_entry_id: null, source_label: 'BILL-0012', kind: 'bill_received' },
      { entry_id: 'je', reversal_entry_id: null, source_label: 'Travel', kind: 'expense' }])) }));
    const table = await screen.findByRole('table', { name: 'Journals' });
    await waitFor(() => expect(table).toHaveTextContent('Automatic: billBill BILL-0012'));
    expect(table).toHaveTextContent('Automatic: expenseExpense: Travel');
  });
});

// ------------------------------------------------------------------ Finance phase 3b follow-up 2: VAT registered
describe('Ledger tab: is this company VAT registered?', () => {
  const vatPreview = { bills_to_post: 0, bills_total: 0, bill_payments_to_post: 0, bill_payments_total: 0, expenses_to_post: 0, expenses_total: 0,
    to_reverse: 0, already_posted: 0, not_posted: 0, skipped: { vat_details_missing: 3 } };
  const vatApi = (status: Record<string, unknown>, o: Partial<Record<keyof LedgerApi, unknown>> = {}) => autoApi(status, {
    autoPreview: vi.fn(() => ok({ ...emptyPreview, bills_and_expenses: vatPreview })), categoryMap: vi.fn(() => ok([])), ...o });
  const openAt = async (api: LedgerApi) => {
    render(<MemoryRouter initialEntries={['/x?ledger=automatic']}><LedgerTab organizationId={ORG} api={api} isDemo={false} /></MemoryRouter>);
    await screen.findByRole('switch', { name: 'Post bills and expenses to the ledger automatically' });
  };

  it('not shown before its SQL is applied (the status has no vat_registered)', async () => {
    await openAt(vatApi(managerOn({ bills_enabled: true })));
    expect(screen.queryByTestId('vat-registered')).toBeNull();
  });

  it('the label, the help text, and No by default', async () => {
    await openAt(vatApi(managerOn({ bills_enabled: true, vat_registered: false, vat_registered_from: null })));
    const box = screen.getByTestId('vat-registered');
    expect(within(box).getByText('Is this company VAT registered?')).toBeInTheDocument();
    expect(box).toHaveTextContent('If you are not VAT registered, bills and expenses post at their full amount with no VAT. If you are, each one needs its VAT recorded first.');
    expect(within(box).getByRole('radio', { name: 'No' })).toBeChecked();
    expect(within(box).getByRole('radio', { name: 'Yes' })).not.toBeChecked();
    expect(screen.queryByLabelText(/Registered from/)).toBeNull();
  });

  it('Yes: the confirmation, an optional date, then exactly one call', async () => {
    let finish: (v: unknown) => void = () => {};
    const api = vatApi(managerOn({ bills_enabled: true, vat_registered: false }), { vatRegisteredSet: vi.fn(() => new Promise((r) => { finish = r; })) });
    await openAt(api);
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    const box = screen.getByTestId('vat-registered-confirm');
    expect(box).toHaveTextContent('From now on, bills and expenses need their VAT recorded before they post. Nothing already posted is changed.');
    expect(api.vatRegisteredSet).not.toHaveBeenCalled();
    fireEvent.change(within(box).getByLabelText(/Registered from/), { target: { value: '2026-03-01' } });
    fireEvent.click(within(box).getByRole('button', { name: 'Yes, we are VAT registered' }));
    expect(api.vatRegisteredSet).toHaveBeenCalledTimes(1);
    expect(api.vatRegisteredSet).toHaveBeenCalledWith(ORG, true, '2026-03-01');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'No' })).toBeDisabled());
    vi.mocked(api.autoStatus).mockImplementation(() => ok(managerOn({ bills_enabled: true, vat_registered: true, vat_registered_from: '2026-03-01' })));
    await act(async () => { finish({ ok: true, data: managerOn({ bills_enabled: true, vat_registered: true, vat_registered_from: '2026-03-01' }) }); });
    expect(await screen.findByText('Saved: this company is VAT registered.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Yes' })).toBeChecked();
    expect(screen.getByTestId('vat-registered')).toHaveTextContent('Registered from 2026-03-01.');
  });

  it('after saving, the expense form\'s cached answer for this company is read again', async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const api = vatApi(managerOn({ bills_enabled: true, vat_registered: true }), { vatRegisteredSet: vi.fn(() => ok(managerOn({ bills_enabled: true, vat_registered: false }))) });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/x?ledger=automatic']}><LedgerTab organizationId={ORG} api={api} isDemo={false} /></MemoryRouter></QueryClientProvider>);
    await screen.findByRole('switch', { name: 'Post bills and expenses to the ledger automatically' });
    fireEvent.click(screen.getByRole('radio', { name: 'No' }));
    fireEvent.click(within(screen.getByTestId('vat-registered-confirm')).getByRole('button', { name: 'No, we are not VAT registered' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['vat-registration', ORG] }));
  });

  it('No: the confirmation says how many held records will post; Cancel sends nothing', async () => {
    const api = vatApi(managerOn({ bills_enabled: true, vat_registered: true }), { vatRegisteredSet: vi.fn(() => ok(managerOn({ bills_enabled: true, vat_registered: false }))) });
    await openAt(api);
    fireEvent.click(screen.getByRole('radio', { name: 'No' }));
    expect(screen.getByTestId('vat-registered-confirm')).toHaveTextContent('3 records are waiting for VAT details and will post at the full amount, with no VAT, on the next run.');
    expect(screen.queryByLabelText(/Registered from/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.vatRegisteredSet).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: 'No' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'No, we are not VAT registered' })); });
    expect(api.vatRegisteredSet).toHaveBeenCalledWith(ORG, false, null);
  });

  it('a plain member sees the answer but can\'t change it; MFA_REQUIRED gets the plain message', async () => {
    await openAt(vatApi(managerOn({ bills_enabled: true, vat_registered: true, can_manage: false })));
    expect(screen.getByRole('radio', { name: 'Yes' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'No' })).toBeDisabled();
    cleanup();
    await openAt(vatApi(managerOn({ bills_enabled: true, vat_registered: false }), { vatRegisteredSet: vi.fn(() => Promise.resolve({ ok: false as const, code: 'MFA_REQUIRED' })) }));
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Yes, we are VAT registered' })); });
    expect(within(screen.getByTestId('auto-bills')).getByRole('alert')).toHaveTextContent('Confirm with your authenticator app, then try again.');
  });

  it('a registered company still shows the missing-VAT reason under Needs attention', async () => {
    await openAt(vatApi(managerOn({ bills_enabled: true, vat_registered: true }), { issues: vi.fn(() => ok([
      { id: 'i1', source_table: 'bills', source_id: 'b', source_label: 'B-1', kind: 'bill_received', reason_code: 'vat_details_missing', created_at: '2026-03-01' }])) }));
    const list = await screen.findByRole('list', { name: 'Needs attention' });
    expect(list).toHaveTextContent("Bill B-1Its VAT isn't recorded and the company is marked VAT registered. Record the VAT (Company records helps), or mark the company as not VAT registered.");
  });
});
