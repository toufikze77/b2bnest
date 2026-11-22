// Finance phase 4: the Reports section of the Ledger tab.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { LedgerAccount } from '@/lib/ledger';
import { LEDGER_DISCLAIMER } from '@/lib/ledger';
import type { LedgerApi } from '@/lib/ledgerApi';
import type { AccountDetail, BsRow, Completeness, PlRow } from '@/lib/ledgerReports';

const downloads = vi.hoisted(() => [] as { name: string; blob: Blob }[]);
vi.mock('@/lib/legalExport', () => ({ downloadBlob: (blob: Blob, name: string) => { downloads.push({ name, blob }); } }));

import { LedgerReports } from './LedgerReports';
import { LedgerTab } from './LedgerTab';

const ORG = 'org-1';
const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });
const fail = (code: string) => Promise.resolve({ ok: false as const, code });
const acc = (id: string, code: string, name: string, type: LedgerAccount['type'], is_active = true): LedgerAccount => ({ id, code, name, type, is_system: false, system_key: null, is_active });
const accounts = [acc('a1200', '1200', 'Bank', 'asset'), acc('a4000', '4000', 'Sales', 'income'), acc('a5000', '5000', 'Cost of sales', 'expense'),
  acc('a7100', '7100', 'Rent and rates', 'expense'), acc('a7500', '7500', 'Office costs', 'expense'), acc('a7150', '7150', 'Old costs', 'expense', false)];
const plRows: PlRow[] = [
  { account_id: 'a4000', code: '4000', name: 'Sales', type: 'income', amount: '1000.00' },
  { account_id: 'a5000', code: '5000', name: 'Cost of sales', type: 'expense', amount: '400.10' },
  { account_id: 'a7100', code: '7100', name: 'Rent and rates', type: 'expense', amount: '700.20' },
];
const bsRows: BsRow[] = [
  { account_id: 'a0010', code: '0010', name: 'Fixed assets', type: 'asset', balance: '5000.00', balanced: true },
  { account_id: 'a1200', code: '1200', name: 'Bank', type: 'asset', balance: '899.70', balanced: true },
  { account_id: 'a2100', code: '2100', name: 'Creditors', type: 'liability', balance: '0.00', balanced: true },
  { account_id: 'a3000', code: '3000', name: 'Share capital', type: 'equity', balance: '6000.00', balanced: true },
  { account_id: null, code: 'PL', name: 'Profit for the period (not yet closed to retained earnings)', type: 'equity', balance: '-100.30', balanced: true },
];
const detail: AccountDetail = {
  account: { id: 'a1200', code: '1200', name: 'Bank', type: 'asset', normal_side: 'debit', is_active: true }, from: '2026-01-01', to: '2026-03-31',
  opening_balance: '0.00', closing_balance: '899.70', total_debit: '1000.00', total_credit: '100.30', line_count: 2, truncated: false,
  rows: [
    { entry_id: 'e1', entry_date: '2026-02-20', source_type: 'auto_invoice_payment', source_label: 'A-1', memo: 'Invoice A-1 paid', description: null, line_no: 1, debit: '1000.00', credit: '0.00', balance: '1000.00' },
    { entry_id: 'e2', entry_date: '2026-03-05', source_type: 'manual', source_label: null, memo: 'Rent', description: null, line_no: 2, debit: '0.00', credit: '100.30', balance: '899.70' },
  ],
};
const allPosted: Completeness = { set_up: true, start_date: '2026-01-01', locked_through: null, invoices_auto_on: true, bills_auto_on: true, waiting: 0, open_issues: 0, last_posting_at: null, bank_unmatched: 0 };
function reportsApi(o: Partial<Record<keyof LedgerApi, unknown>> = {}) {
  return {
    reportProfitLoss: vi.fn(() => ok(plRows)),
    reportBalanceSheet: vi.fn(() => ok(bsRows)),
    reportAccountDetail: vi.fn(() => ok(detail)),
    reportCompleteness: vi.fn(() => ok(allPosted)),
    ...o,
  } as unknown as LedgerApi & Record<string, ReturnType<typeof vi.fn>>;
}
function Loc() { const l = useLocation(); return <div data-testid="loc">{l.search}</div>; }
const show = (api: LedgerApi, search = '?ledger=reports&report=profit-loss&from=2026-01-01&to=2026-03-31') => render(
  <MemoryRouter initialEntries={[`/business-tools${search}`]}><LedgerReports api={api} organizationId={ORG} accounts={accounts} startDate="2026-01-01" /><Loc /></MemoryRouter>,
);
const loc = () => new URLSearchParams(screen.getByTestId('loc').textContent ?? '');

describe('Reports: profit and loss', () => {
  it('income, cost of sales, gross profit, overheads and a net loss in plain words, with the disclaimer', async () => {
    const api = reportsApi();
    show(api);
    const t = await screen.findByRole('table', { name: 'Profit and loss' });
    expect(api.reportProfitLoss).toHaveBeenCalledWith(ORG, '2026-01-01', '2026-03-31');
    expect(within(t).getByText('4000 Sales')).toBeInTheDocument();
    expect(screen.getByTestId('pl-gross')).toHaveTextContent('Gross profit£599.90');
    expect(screen.getByTestId('pl-net')).toHaveTextContent('Net loss for the period-£100.30');
    expect(screen.getByRole('heading', { name: 'Profit and loss, 01/01/2026 to 31/03/2026' })).toBeInTheDocument();
    expect(screen.getByTestId('reports-disclaimer')).toHaveTextContent(LEDGER_DISCLAIMER);
  });
  it('each account opens its account detail for the same dates (in the URL)', async () => {
    show(reportsApi());
    const link = await screen.findByRole('link', { name: '7100 Rent and rates' });
    const p = new URLSearchParams((link.getAttribute('href') ?? '').split('?')[1]);
    expect(Object.fromEntries(p)).toMatchObject({ ledger: 'reports', report: 'account', account: 'a7100', from: '2026-01-01', to: '2026-03-31' });
    fireEvent.click(link);
    await waitFor(() => expect(loc().get('report')).toBe('account'));
  });
  it('quick choices change the dates in the URL; the books-start warning', async () => {
    show(reportsApi(), '?ledger=reports&report=profit-loss&from=2025-12-01&to=2026-03-31');
    expect(await screen.findByTestId('before-books')).toHaveTextContent('Your books start on 01/01/2026, so earlier figures are not included.');
    fireEvent.click(screen.getByRole('button', { name: 'Since the books started' }));
    await waitFor(() => expect(loc().get('from')).toBe('2026-01-01'));
    expect(loc().get('to')).toBe(new Date().toISOString().slice(0, 10));
  });
  it('empty accounts appear only when asked (active ones)', async () => {
    show(reportsApi());
    await screen.findByRole('table', { name: 'Profit and loss' });
    expect(screen.queryByText('7500 Office costs')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show empty accounts' }));
    expect(screen.getByText('7500 Office costs')).toBeInTheDocument();
    expect(screen.queryByText('7150 Old costs')).toBeNull();
  });
  it('no postings: the empty message; a bad range: the message, no call', async () => {
    const api = reportsApi({ reportProfitLoss: vi.fn(() => ok([])) });
    show(api);
    expect(await screen.findByTestId('reports-empty')).toHaveTextContent('No postings in this period yet.');
    const api2 = reportsApi();
    show(api2, '?ledger=reports&report=profit-loss&from=2026-03-31&to=2026-01-01');
    expect(await screen.findByText('The start date is after the end date.')).toBeInTheDocument();
    expect(api2.reportProfitLoss).not.toHaveBeenCalled();
  });
  it('errors: MFA asks for the authenticator; a refused range says so', async () => {
    show(reportsApi({ reportProfitLoss: vi.fn(() => fail('MFA_REQUIRED')) }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirm with your authenticator app, then try again.');
  });
  it('a database range refusal uses the ledger message', async () => {
    show(reportsApi({ reportProfitLoss: vi.fn(() => fail('BAD_RANGE')) }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a start date on or before the end date, and a period of 5 years or less.');
  });
  it('Download CSV builds the file in the browser from the rows already loaded', async () => {
    downloads.length = 0;
    const api = reportsApi();
    show(api);
    await screen.findByRole('table', { name: 'Profit and loss' });
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(downloads.map((d) => d.name)).toEqual(['profit-and-loss-2026-01-01-to-2026-03-31.csv']);
    const bytes = new Uint8Array(await downloads[0].blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM (Blob.text() would hide it)
    const text = await downloads[0].blob.text();
    expect(text).toContain('Income,4000,Sales,1000.00');
    expect(api.reportProfitLoss).toHaveBeenCalledTimes(1);
  });
  it('Print opens the browser print dialog for the report only', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => { expect(document.body.classList.contains('print-ledger-report')).toBe(true); });
    show(reportsApi());
    await screen.findByRole('table', { name: 'Profit and loss' });
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });
});

describe('Reports: clearer shortcuts and account links', () => {
  const LABELS = ['This month', 'Last month', 'This quarter', 'This tax year', 'Last tax year', 'Since the books started'];
  it('the quick choices are real buttons, labelled, and the one matching the range is pressed', async () => {
    show(reportsApi(), '?ledger=reports&report=profit-loss&from=2026-01-01&to=' + new Date().toISOString().slice(0, 10));
    await screen.findByRole('table', { name: 'Profit and loss' });
    const group = screen.getByRole('group', { name: 'Quick choices' });
    expect(group).toHaveTextContent('Quick choices:');
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(LABELS);
    expect(within(group).getByRole('button', { name: 'Since the books started' })).toHaveAttribute('aria-pressed', 'true');
    expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
  });
  it('"Since the books started" sets From to the start date and To to today, and then shows as pressed', async () => {
    show(reportsApi());
    await screen.findByRole('table', { name: 'Profit and loss' });
    const since = within(screen.getByRole('group', { name: 'Quick choices' })).getByRole('button', { name: 'Since the books started' });
    expect(since).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(since);
    await waitFor(() => expect(loc().get('from')).toBe('2026-01-01'));
    expect(loc().get('to')).toBe(new Date().toISOString().slice(0, 10));
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Quick choices' })).getByRole('button', { name: 'Since the books started' })).toHaveAttribute('aria-pressed', 'true'));
  });
  it('account names in profit and loss are visible links with a title and the range in the href; the help line shows', async () => {
    show(reportsApi());
    const t = await screen.findByRole('table', { name: 'Profit and loss' });
    const link = within(t).getByRole('link', { name: '4000 Sales' });
    expect(link).toHaveAttribute('title', 'See every posting on this account');
    expect(link.className).toContain('underline');
    expect(Object.fromEntries(new URLSearchParams((link.getAttribute('href') ?? '').split('?')[1]))).toMatchObject({ report: 'account', account: 'a4000', from: '2026-01-01', to: '2026-03-31' });
    expect(within(t).getAllByRole('link').every((l) => l.getAttribute('title') === 'See every posting on this account')).toBe(true);
    expect(screen.getByTestId('report-help')).toHaveTextContent('Click an account name to see every posting on it.');
  });
  it('balance sheet: links with the title, the profit line is not a link, the help line shows', async () => {
    show(reportsApi(), '?ledger=reports&report=balance-sheet&as_of=2026-03-31');
    const t = await screen.findByRole('table', { name: 'Balance sheet' });
    expect(within(t).getByRole('link', { name: '1200 Bank' })).toHaveAttribute('title', 'See every posting on this account');
    expect(within(t).queryByRole('link', { name: /Profit for the period/ })).toBeNull();
    expect(screen.getByTestId('report-help')).toHaveTextContent('Click an account name to see every posting on it.');
  });
  it('account detail has no help line', async () => {
    show(reportsApi(), '?ledger=reports&report=account&account=a1200&from=2026-01-01&to=2026-03-31');
    await screen.findByRole('table', { name: 'Account detail' });
    expect(screen.queryByTestId('report-help')).toBeNull();
  });
  it('the CSV has neither the help line nor the chevrons; both are hidden when printing', async () => {
    downloads.length = 0;
    show(reportsApi());
    await screen.findByRole('table', { name: 'Profit and loss' });
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    const text = await downloads[0].blob.text();
    expect(text).not.toContain('Click an account name');
    expect(text).not.toContain('›');
    expect(screen.getByTestId('report-help')).toHaveClass('no-print');
    expect(screen.getByTestId('quick-choices').closest('.no-print')).not.toBeNull();
    expect(screen.getAllByText('›').every((c) => c.classList.contains('no-print') && c.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
});

describe('Reports: balance sheet', () => {
  it('fixed and current assets, liabilities, net assets, equity with the profit line explained, and the check', async () => {
    show(reportsApi(), '?ledger=reports&report=balance-sheet&as_of=2026-03-31');
    const t = await screen.findByRole('table', { name: 'Balance sheet' });
    expect(within(t).getByText('Fixed assets')).toBeInTheDocument();
    expect(screen.getByTestId('bs-net-assets')).toHaveTextContent('Net assets£5,899.70');
    expect(screen.getByTestId('bs-equity')).toHaveTextContent('Total equity£5,899.70');
    expect(within(t).getByText('Profit for the period (not yet closed to retained earnings)')).toBeInTheDocument();
    expect(screen.getByText(/since the last closed year end, or since your books started if no year is closed/)).toBeInTheDocument();
    expect(screen.getByTestId('bs-check')).toHaveTextContent('Assets and liabilities agree.');
    const link = within(t).getByRole('link', { name: '1200 Bank' });
    expect(Object.fromEntries(new URLSearchParams((link.getAttribute('href') ?? '').split('?')[1]))).toMatchObject({ report: 'account', account: 'a1200', from: '2026-01-01', to: '2026-03-31' });
    expect(within(t).queryByRole('link', { name: /Profit for the period/ })).toBeNull();
  });
  it('when the totals do not agree it says so, with where to tell us', async () => {
    show(reportsApi({ reportBalanceSheet: vi.fn(() => ok(bsRows.map((r) => ({ ...r, balanced: false })))) }), '?ledger=reports&report=balance-sheet&as_of=2026-03-31');
    expect(await screen.findByTestId('bs-check')).toHaveTextContent("Assets and liabilities don't agree. Please tell us at info@b2bnest.online.");
  });
});

describe('Reports: account detail', () => {
  it('opening balance, each line with its source, running balance and closing totals; dd/mm/yyyy', async () => {
    const api = reportsApi();
    show(api, '?ledger=reports&report=account&account=a1200&from=2026-01-01&to=2026-03-31');
    const t = await screen.findByRole('table', { name: 'Account detail' });
    expect(api.reportAccountDetail).toHaveBeenCalledWith(ORG, 'a1200', '2026-01-01', '2026-03-31');
    expect(t).toHaveTextContent('20/02/2026Invoice payment A-1Invoice A-1 paid£1,000.00£1,000.00');
    expect(t).toHaveTextContent('05/03/2026Manual journalRent£100.30£899.70');
    expect(screen.getByTestId('detail-closing')).toHaveTextContent('31/03/2026Closing balance£1,000.00£100.30£899.70');
    expect(screen.getByLabelText('Account')).toHaveValue('a1200');
    expect(within(screen.getByLabelText('Account')).getByRole('option', { name: '7150 Old costs (inactive)' })).toBeInTheDocument();
  });
  it('more than 2,000 lines: asks for a shorter period', async () => {
    show(reportsApi({ reportAccountDetail: vi.fn(() => ok({ ...detail, truncated: true, line_count: 2500 })) }), '?ledger=reports&report=account&account=a1200&from=2026-01-01&to=2026-03-31');
    expect(await screen.findByTestId('detail-truncated')).toHaveTextContent('Choose a shorter period');
  });
  it('an account that is not this company\'s: the not-found message', async () => {
    show(reportsApi({ reportAccountDetail: vi.fn(() => fail('NOT_FOUND')) }), '?ledger=reports&report=account&account=other&from=2026-01-01&to=2026-03-31');
    expect(await screen.findByRole('alert')).toHaveTextContent("That wasn't found. Refresh and try again.");
  });
  it('choosing another account changes the URL', async () => {
    show(reportsApi(), '?ledger=reports&report=account&account=a1200&from=2026-01-01&to=2026-03-31');
    await screen.findByRole('table', { name: 'Account detail' });
    fireEvent.change(screen.getByLabelText('Account'), { target: { value: 'a7100' } });
    await waitFor(() => expect(loc().get('account')).toBe('a7100'));
  });
});

describe('Reports: completeness banner', () => {
  it('nothing shown when everything is posted', async () => {
    show(reportsApi());
    await screen.findByRole('table', { name: 'Profit and loss' });
    expect(screen.queryByTestId('reports-completeness')).toBeNull();
  });
  it('plain notes with links to Automatic postings and Bank; never blocks the report', async () => {
    show(reportsApi({ reportCompleteness: vi.fn(() => ok({ ...allPosted, invoices_auto_on: false, open_issues: 2, bank_unmatched: 1 })) }));
    const b = await screen.findByTestId('reports-completeness');
    expect(b).toHaveTextContent('These figures may not be complete yet.');
    expect(b).toHaveTextContent("Invoices are not posted to the ledger automatically for this company, so sales shown here only include what you've posted.");
    expect(b).toHaveTextContent('2 records are held');
    const bank = within(b).getByRole('link', { name: 'Open Bank' });
    expect(new URLSearchParams((bank.getAttribute('href') ?? '').split('?')[1]).get('ledger')).toBe('bank');
    expect(within(b).getAllByRole('link', { name: 'Open Automatic postings' })[0].getAttribute('href')).toContain('ledger=automatic');
    expect(await screen.findByRole('table', { name: 'Profit and loss' })).toBeInTheDocument();
  });
  it('if completeness cannot be read, the report still shows', async () => {
    show(reportsApi({ reportCompleteness: vi.fn(() => fail('NOT_AVAILABLE')) }));
    expect(await screen.findByRole('table', { name: 'Profit and loss' })).toBeInTheDocument();
    expect(screen.queryByTestId('reports-completeness')).toBeNull();
  });
});

describe('Ledger tab: the Reports section', () => {
  const tabApi = (status: Record<string, unknown>) => ({
    ...reportsApi(),
    status: vi.fn(() => ok({ access: 'ok', set_up: true, start_date: '2026-01-01', opening_mode: 'fresh', locked_through: null, base_currency: 'GBP', ...status })),
    accounts: vi.fn(() => ok(accounts)), journals: vi.fn(() => ok([])), postings: vi.fn(() => fail('NOT_AVAILABLE')),
    autoStatus: vi.fn(() => fail('NOT_AVAILABLE')), trialBalance: vi.fn(() => ok([])),
  }) as unknown as LedgerApi;
  it('sits between Trial balance and Year end (then Automatic postings), is kept in the URL, and a member can read it (no write actions here)', async () => {
    const api = tabApi({ can_post: false });
    render(<MemoryRouter initialEntries={['/business-tools?tab=ledger&ledger=reports']}><LedgerTab organizationId={ORG} api={api} isDemo={false} /></MemoryRouter>);
    expect(await screen.findByRole('table', { name: 'Profit and loss' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(expect.arrayContaining(['Trial balance', 'Reports', 'Automatic postings']));
    const names = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(names.indexOf('Reports')).toBe(names.indexOf('Trial balance') + 1);
    expect(names.indexOf('Year end')).toBe(names.indexOf('Reports') + 1);
    expect(names.indexOf('Automatic postings')).toBe(names.indexOf('Year end') + 1);
    expect(screen.getByRole('tab', { name: 'Reports' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('ledger-disclaimer')).toHaveTextContent(LEDGER_DISCLAIMER);
    expect(screen.getByText(/You can view the ledger. Only an owner or admin can change it./)).toBeInTheDocument();
  });
});
