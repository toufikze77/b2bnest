// Finance phase 3c-1: the Bank section of the Ledger tab.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { LedgerApi } from '@/lib/ledgerApi';
import type { BankOverview } from '@/lib/ledgerBank';
import { BANK_NEVER_POSTS } from '@/lib/ledgerBank';
import { LEDGER_DISCLAIMER } from '@/lib/ledger';
import { LedgerBank } from './LedgerBank';
import { LedgerTab } from './LedgerTab';

const ORG = 'org-1';
const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });
const fail = (code: string) => Promise.resolve({ ok: false as const, code });

const overview = (o: Partial<BankOverview> = {}): BankOverview => ({
  access: 'ok', can_manage: true, set_up: true, bank_account_id: 'ba1', as_at: '2026-03-31',
  accounts: [{ id: 'ba1', name: 'Main', last4: '1234', is_active: true, unmatched: 2, lines: 5 }],
  counts: { unmatched: 2, matched: 1, ignored: 1, needs_attention: 1 },
  unmatched: [
    { id: 'l1', line_date: '2026-03-11', description: 'CLIENT X', amount_pence: 5000, suggestions: [
      { posting_id: 'p2', kind: 'invoice_paid', source_label: 'A-2', entry_date: '2026-03-10', amount_pence: 5000, days_apart: 1 },
      { posting_id: 'p3', kind: 'invoice_paid', source_label: 'A-3', entry_date: '2026-03-12', amount_pence: 5000, days_apart: 1 }] },
    { id: 'l2', line_date: '2026-03-25', description: 'BANK FEE', amount_pence: -500, suggestions: [] },
  ],
  matched: [{ id: 'l3', line_date: '2026-03-06', description: 'ACME LTD', amount_pence: 12000, match_kind: 'auto', posting_id: 'p1', kind: 'invoice_paid', source_label: 'A-1', entry_date: '2026-03-05' }],
  ignored: [{ id: 'l4', line_date: '2026-03-28', description: 'TRANSFER', amount_pence: -10000, ignore_reason: 'not_business' }],
  needs_attention: [{ id: 'l5', line_date: '2026-03-20', description: 'LATE PAYER', amount_pence: 7500, reason: 'match_broken', posting_id: 'p4', kind: 'invoice_paid', source_label: 'A-4', entry_date: '2026-03-01' }],
  unmatched_payments: [{ posting_id: 'p9', kind: 'bill_paid', source_label: 'B-7', entry_date: '2026-03-14', amount_pence: -1999 }],
  covered_from: '2026-03-01', covered_to: '2026-03-28',
  reconciliation: { as_at: '2026-03-31', ledger_balance_pence: 1249900, statement_balance_pence: 1200012, statement_balance_date: '2026-03-28', difference_pence: -49888, shared_ledger_account: false },
  ...o,
});
function bankApi(o: Partial<Record<keyof LedgerApi, unknown>> = {}) {
  return {
    bankOverview: vi.fn(() => ok(overview())),
    bankAccountSave: vi.fn(() => ok({ result: 'created', id: 'ba2' })),
    bankImport: vi.fn(() => ok({ result: 'ok', imported: 3, skipped_duplicates: 0, rejected: 0, problems: [], imported_before: false, matched: 1 })),
    bankMatchRun: vi.fn(() => ok({ matched: 1, unlinked: 1 })),
    bankMatch: vi.fn(() => ok({ result: 'matched' })),
    bankUnmatch: vi.fn(() => ok({ result: 'unmatched' })),
    bankIgnore: vi.fn(() => ok({ result: 'ignored' })),
    bankUnignore: vi.fn(() => ok({ result: 'unmatched' })),
    accounts: vi.fn(() => ok([])),
    ...o,
  } as unknown as LedgerApi & Record<string, ReturnType<typeof vi.fn>>;
}
const show = (api: LedgerApi) => render(<LedgerBank api={api} organizationId={ORG} />);
const tab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });

describe('Bank: reading', () => {
  it('says plainly that it never changes the ledger; shows the summary and counts', async () => {
    show(bankApi());
    expect(await screen.findByTestId('bank-never-posts')).toHaveTextContent(BANK_NEVER_POSTS);
    expect(BANK_NEVER_POSTS).toBe('Importing and matching never change your ledger. Posting a line you choose does, and you can undo it.');
    expect(screen.getByTestId('bank-ledger-balance')).toHaveTextContent('£12,499.00');
    expect(screen.getByTestId('bank-statement-balance')).toHaveTextContent('£12,000.12 (2026-03-28)');
    expect(screen.getByTestId('bank-difference')).toHaveTextContent('-£498.88');
    expect(screen.getByTestId('bank-summary')).toHaveTextContent('The difference includes anything not yet imported or not yet in the ledger');
    expect(screen.getByTestId('bank-counts')).toHaveTextContent('2 unmatched, 1 matched, 1 ignored, 1 need attention.');
    expect(screen.getByRole('tab', { name: 'Needs attention (1)' })).toBeInTheDocument();
  });
  it('unmatched lines with their suggestions, signed amounts, and ledger payments not on the statement', async () => {
    show(bankApi());
    const list = await screen.findByTestId('bank-unmatched');
    expect(list).toHaveTextContent('CLIENT X+£50.00');
    expect(list).toHaveTextContent('Invoice payment A-2, 2026-03-10 (1 day apart)');
    expect(list).toHaveTextContent('BANK FEE-£5.00');
    expect(list).toHaveTextContent('No payment in the ledger matches this amount within 31 days.');
    expect(screen.getByTestId('bank-open-payments')).toHaveTextContent('Bill payment B-7, 2026-03-14: -£19.99');
  });
  it('no statement balance: says so, shows no difference', async () => {
    show(bankApi({ bankOverview: vi.fn(() => ok(overview({ reconciliation: { as_at: '2026-03-31', ledger_balance_pence: 100, statement_balance_pence: null,
      statement_balance_date: null, difference_pence: null, shared_ledger_account: true } }))) }));
    expect(await screen.findByTestId('bank-difference')).toHaveTextContent('—');
    expect(screen.getByTestId('bank-summary')).toHaveTextContent('No statement balance on or before this date');
    expect(screen.getByTestId('bank-summary')).toHaveTextContent('Your bank accounts share one Bank account in the ledger');
  });
  it('before its SQL is applied: not available', async () => {
    show(bankApi({ bankOverview: vi.fn(() => fail('NOT_AVAILABLE')) }));
    expect(await screen.findByTestId('bank-not-available')).toHaveTextContent('Bank statement import is not available yet.');
  });
  it('the MFA message when reading needs a step-up', async () => {
    show(bankApi({ bankOverview: vi.fn(() => fail('MFA_REQUIRED')) }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirm with your authenticator app, then try again.');
  });
});

describe('Bank: who can act', () => {
  it('a plain member sees everything but no actions and no import', async () => {
    show(bankApi({ bankOverview: vi.fn(() => ok(overview({ can_manage: false }))) }));
    await screen.findByTestId('bank-unmatched');
    expect(screen.getByText('You can view bank statements. Only an owner or admin can import, match or ignore lines.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Match' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ignore/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Match again' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add bank account' })).toBeNull();
    expect(screen.queryByTestId('bank-import')).toBeNull();
  });
  it('a manager sees the actions and the import', async () => {
    show(bankApi());
    await screen.findByTestId('bank-unmatched');
    expect(screen.getAllByRole('button', { name: 'Match' })).toHaveLength(2);
    expect(screen.getByTestId('bank-import')).toBeInTheDocument();
  });
  it('an inactive account takes no import', async () => {
    show(bankApi({ bankOverview: vi.fn(() => ok(overview({ accounts: [{ id: 'ba1', name: 'Main', last4: null, is_active: false, unmatched: 0, lines: 0 }] }))) }));
    await screen.findByTestId('bank-current');
    expect(screen.queryByTestId('bank-import')).toBeNull();
    expect(screen.getByRole('button', { name: 'Make active' })).toBeInTheDocument();
  });
});

describe('Bank: actions (one call at a time)', () => {
  it('Match sends exactly one call even when pressed twice, then reloads', async () => {
    let finish: (v: unknown) => void = () => {};
    const api = bankApi({ bankMatch: vi.fn(() => new Promise((r) => { finish = r; })) });
    show(api);
    const b = (await screen.findAllByRole('button', { name: 'Match' }))[0];
    fireEvent.click(b); fireEvent.click(b);
    expect(api.bankMatch).toHaveBeenCalledTimes(1);
    expect(api.bankMatch).toHaveBeenCalledWith(ORG, 'l1', 'p2');
    await act(async () => { finish({ ok: true, data: { result: 'matched' } }); });
    expect(await screen.findByTestId('bank-message')).toHaveTextContent('Matched.');
    expect(api.bankOverview).toHaveBeenCalledTimes(2);
  });
  it('Ignore with a reason; Unmatch; Un-ignore; Match again', async () => {
    const api = bankApi();
    show(api);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ignore: handle later' }))[1]);
    await waitFor(() => expect(api.bankIgnore).toHaveBeenCalledWith(ORG, 'l2', 'handle_later'));
    tab(/^Matched/);
    fireEvent.click(await within(await screen.findByTestId('bank-matched')).findByRole('button', { name: 'Unmatch' }));
    await waitFor(() => expect(api.bankUnmatch).toHaveBeenCalledWith(ORG, 'l3'));
    tab(/^Ignored/);
    expect(await screen.findByTestId('bank-ignored')).toHaveTextContent('Ignored: not a business transaction');
    fireEvent.click(within(screen.getByTestId('bank-ignored')).getByRole('button', { name: 'Un-ignore' }));
    await waitFor(() => expect(api.bankUnignore).toHaveBeenCalledWith(ORG, 'l4'));
    fireEvent.click(screen.getByRole('button', { name: 'Match again' }));
    expect(await screen.findByText('Matched 1 line automatically. 1 link to a reversed payment cleared.')).toBeInTheDocument();
  });
  it('Needs attention explains the reversed payment', async () => {
    show(bankApi());
    await screen.findByTestId('bank-unmatched');
    tab(/^Needs attention/);
    const list = await screen.findByTestId('bank-attention');
    expect(list).toHaveTextContent('Was matched to Invoice payment A-4, 2026-03-01 (reversed)');
    expect(screen.getByText(/was reversed in the ledger/)).toBeInTheDocument();
  });
  it('a refused action shows the plain message; MFA_REQUIRED asks for the authenticator', async () => {
    const api = bankApi({ bankMatch: vi.fn(() => fail('BANK_ALREADY_MATCHED')), bankIgnore: vi.fn(() => fail('MFA_REQUIRED')) });
    show(api);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Match' }))[0]);
    expect(await screen.findByTestId('bank-error')).toHaveTextContent('That line or payment is already matched. Unmatch it first.');
    fireEvent.click(screen.getAllByRole('button', { name: 'Ignore: not a business transaction' })[0]);
    await waitFor(() => expect(screen.getByTestId('bank-error')).toHaveTextContent('Confirm with your authenticator app, then try again.'));
  });
  it('adds a bank account with only the last 4 digits', async () => {
    const api = bankApi({ bankOverview: vi.fn(() => ok(overview({ accounts: [], bank_account_id: null, counts: undefined, reconciliation: undefined }))) });
    show(api);
    expect(await screen.findByText(/No bank accounts yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add bank account' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Business current' } });
    fireEvent.change(screen.getByLabelText('Last 4 digits (optional)'), { target: { value: '12a34567' } });
    expect(screen.getByLabelText('Last 4 digits (optional)')).toHaveValue('1234');
    expect(screen.getByText('Never enter the full account number or sort code.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save bank account' }));
    await waitFor(() => expect(api.bankAccountSave).toHaveBeenCalledWith(ORG, { name: 'Business current', last4: '1234' }));
  });
});

const csvFile = (text: string, name = 'march.csv') => new File([text], name, { type: 'text/csv' });
const upload = (f: File) => fireEvent.change(screen.getByLabelText('Statement file (CSV)'), { target: { files: [f] } });

describe('Bank: import a statement', () => {
  it('auto-detects the columns, previews 10 rows with totals and warnings, imports and reports the counts', async () => {
    const api = bankApi();
    show(api);
    await screen.findByTestId('bank-import');
    const rows = Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(2, '0')}/03/2026,"Payee ${i + 1}, Ltd",${i % 2 ? '(10.00)' : '"£1,000.10"'}`);
    upload(csvFile(['Date,Description,Amount', ...rows, 'rubbish,X,1', '13/03/2026,Info,0.00'].join('\r\n')));
    const mapping = await screen.findByTestId('bank-mapping');
    expect(within(mapping).getByLabelText('Date')).toHaveValue('0');
    expect(within(mapping).getByLabelText('Amount (money out is negative)')).toHaveValue('2');
    const preview = within(mapping).getByTestId('bank-preview');
    expect(within(preview).getAllByRole('row')).toHaveLength(11); // header + 10
    expect(preview).toHaveTextContent('Payee 1, Ltd');
    expect(within(mapping).getByTestId('bank-totals')).toHaveTextContent('12 lines, 2026-03-01 to 2026-03-12. Money in £6,000.60, money out £60.00.');
    const warn = within(mapping).getByTestId('bank-warnings');
    expect(warn).toHaveTextContent('1 line with a zero amount will be left out.');
    expect(warn).toHaveTextContent('Line 14: the date "rubbish" can\'t be read');
    fireEvent.click(within(mapping).getByRole('button', { name: 'Import 12 lines' }));
    await waitFor(() => expect(api.bankImport).toHaveBeenCalledTimes(1));
    const [org, acct, name, sent] = vi.mocked(api.bankImport).mock.calls[0] as unknown as [string, string, string, { amount_pence: number; seq: number }[]];
    expect([org, acct, name]).toEqual([ORG, 'ba1', 'march.csv']);
    expect(sent).toHaveLength(12);
    expect(sent[0]).toEqual({ date: '2026-03-01', description: 'Payee 1, Ltd', amount_pence: 100010, seq: 1 });
    expect(sent[1].amount_pence).toBe(-1000);
    expect(await screen.findByTestId('bank-message')).toHaveTextContent('3 imported, 0 already imported, 0 rejected.');
  });
  it('a large file goes in chunks of 500; counts add up; a re-imported file is flagged', async () => {
    const api = bankApi({ bankImport: vi.fn((_o: string, _a: string, _n: string, rows: unknown[]) => ok({ result: 'ok', imported: rows.length - 1, skipped_duplicates: 1, rejected: 0, problems: [], imported_before: true })) });
    show(api);
    await screen.findByTestId('bank-import');
    const rows = Array.from({ length: 1200 }, (_, i) => `2026-03-${String((i % 28) + 1).padStart(2, '0')},Card ${i},-1.00`);
    upload(csvFile(['Date,Description,Amount', ...rows].join('\n')));
    fireEvent.click(await screen.findByRole('button', { name: 'Import 1200 lines' }));
    await waitFor(() => expect(api.bankImport).toHaveBeenCalledTimes(3));
    expect(vi.mocked(api.bankImport).mock.calls.map((c) => (c as unknown as unknown[][])[3].length)).toEqual([500, 500, 200]);
    const msg = await screen.findByTestId('bank-message');
    expect(msg).toHaveTextContent('1197 imported, 3 already imported, 0 rejected.');
    expect(msg).toHaveTextContent('This file looks like one imported before.');
  });
  it('Money in / Money out columns, a preamble above the header, and a person can change the mapping', async () => {
    const api = bankApi();
    show(api);
    await screen.findByTestId('bank-import');
    upload(csvFile('Account name,Main\n\nDate,Details,Paid out,Paid in,Balance\n01/03/2026,Fee,5.00,,995.00\n02/03/2026,Client,,100.00,"1,095.00"'));
    const mapping = await screen.findByTestId('bank-mapping');
    expect(within(mapping).getByLabelText('Money out')).toHaveValue('2');
    expect(within(mapping).getByTestId('bank-totals')).toHaveTextContent('2 lines, 2026-03-01 to 2026-03-02. Money in £100.00, money out £5.00.');
    fireEvent.change(within(mapping).getByLabelText('Date'), { target: { value: '-1' } });
    expect(within(mapping).getByRole('alert')).toHaveTextContent('Choose the Date, Description and Amount');
    expect(within(mapping).queryByRole('button', { name: /^Import/ })).toBeNull();
  });
  it('a refused chunk lists the rows and why', async () => {
    const api = bankApi({ bankImport: vi.fn(() => ok({ result: 'rejected', imported: 0, skipped_duplicates: 0, rejected: 1, problems: [{ row: 2, reason: 'amount_zero' }] })) });
    show(api);
    await screen.findByTestId('bank-import');
    upload(csvFile('Date,Description,Amount\n2026-03-01,A,1.00\n2026-03-02,B,2.00'));
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 lines' }));
    expect(await screen.findByTestId('bank-rejected')).toHaveTextContent('Row 2: amount zero');
  });
  it('a file that is not a statement', async () => {
    show(bankApi());
    await screen.findByTestId('bank-import');
    upload(csvFile('just one line'));
    expect(await screen.findByText('No statement lines were found in this file.')).toBeInTheDocument();
  });
});

describe('Ledger tab: the Bank section', () => {
  it('is in the URL (?ledger=bank) and keeps the bookkeeping wording', async () => {
    const api = {
      ...bankApi(),
      status: vi.fn(() => ok({ access: 'ok', can_post: true, set_up: true, start_date: '2026-01-01', opening_mode: 'fresh', locked_through: null, base_currency: 'GBP' })),
      accounts: vi.fn(() => ok([])), journals: vi.fn(() => ok([])), postings: vi.fn(() => fail('NOT_AVAILABLE')),
      autoStatus: vi.fn(() => fail('NOT_AVAILABLE')), trialBalance: vi.fn(() => ok([])),
    } as unknown as LedgerApi;
    render(<MemoryRouter initialEntries={['/business-tools?tab=ledger&ledger=bank']}><LedgerTab organizationId={ORG} api={api} isDemo={false} /></MemoryRouter>);
    expect(await screen.findByTestId('ledger-bank')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bank' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('ledger-disclaimer')).toHaveTextContent(LEDGER_DISCLAIMER);
    expect(LEDGER_DISCLAIMER).toContain('Bookkeeping tool. Not accounting, tax or legal advice.');
  });
});
