// Finance phase 3c-2: posting unmatched bank lines from Ledger → Bank.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LedgerAccount } from '@/lib/ledger';
import type { LedgerApi } from '@/lib/ledgerApi';
import type { BankOverview } from '@/lib/ledgerBank';
import { LedgerBank } from './LedgerBank';

const ORG = 'org-1';
const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });
const fail = (code: string) => Promise.resolve({ ok: false as const, code });
const acc = (code: string, name: string, system_key: string | null = null, is_active = true): LedgerAccount =>
  ({ id: `a${code}`, code, name, type: 'expense', is_system: system_key !== null, system_key, is_active });
const chart = [acc('1200', 'Bank', 'bank'), acc('1100', 'Debtors', 'debtors'), acc('2200', 'VAT control', 'vat_control'), acc('4900', 'Other income'),
  acc('7900', 'Bank charges'), acc('8200', 'Other overheads'), acc('2310', "Directors' loan account"), acc('7150', 'Old costs', null, false)];
const overview = (o: Partial<BankOverview> = {}): BankOverview => ({
  access: 'ok', can_manage: true, set_up: true, bank_account_id: 'ba1', as_at: '2026-03-31',
  accounts: [{ id: 'ba1', name: 'Main', last4: null, is_active: true, unmatched: 3, lines: 5 }],
  counts: { unmatched: 3, matched: 0, ignored: 0, posted: 1, needs_attention: 1 },
  unmatched: [
    { id: 'l1', line_date: '2026-03-03', description: 'MONTHLY ACCOUNT FEE', amount_pence: -550, suggestions: [] },
    { id: 'l2', line_date: '2026-03-10', description: 'INTEREST PAID', amount_pence: 12, suggestions: [] },
    { id: 'l3', line_date: '2026-03-15', description: 'TFR FROM DIRECTOR', amount_pence: 50000, suggestions: [] },
  ],
  matched: [], ignored: [],
  posted: [{ id: 'l9', line_date: '2026-02-03', description: 'FEBRUARY FEE', amount_pence: -550, account_id: 'a7900', account_code: '7900', account_name: 'Bank charges', entry_id: 'e9', posted_at: '2026-03-01T10:00:00Z' }],
  needs_attention: [{ id: 'l8', line_date: '2026-01-03', description: 'JANUARY FEE', amount_pence: -550, reason: 'post_broken', entry_id: 'e8', account_code: '7900', account_name: 'Bank charges' }],
  unmatched_payments: [],
  reconciliation: { as_at: '2026-03-31', ledger_balance_pence: 100000, statement_balance_pence: 99450, statement_balance_date: '2026-03-03', difference_pence: -550, shared_ledger_account: false },
  ...o,
});
function api(o: Partial<Record<keyof LedgerApi, unknown>> = {}) {
  return {
    bankOverview: vi.fn(() => ok(overview())), accounts: vi.fn(() => ok(chart)),
    bankPost: vi.fn(() => ok({ result: 'posted', line_id: 'l1', entry_id: 'e1' })),
    bankPostMany: vi.fn((_o: string, _a: string, lines: string[]) => ok({ result: 'ok', posted: lines.length, unchanged: 0, entry_ids: lines })),
    bankUnpost: vi.fn(() => ok({ result: 'unposted', how: 'reversed', reversal_date: '2026-02-03', reversal_dated: 'line_date' })),
    bankMatchRun: vi.fn(() => ok({ matched: 0, unlinked: 0, unposted: 1 })),
    ...o,
  } as unknown as LedgerApi & Record<string, ReturnType<typeof vi.fn>>;
}
const show = (x: LedgerApi) => render(<LedgerBank api={x} organizationId={ORG} />);
const tab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });
const line = (text: string) => screen.getByText(text).closest('li') as HTMLElement;

describe('Bank: post a line to the ledger', () => {
  it('the panel: plain effect, suggested account pre-selected, only allowed accounts, the hints; then Post', async () => {
    const x = api();
    show(x);
    await screen.findByText('MONTHLY ACCOUNT FEE');
    await waitFor(() => expect(x.accounts).toHaveBeenCalled());
    fireEvent.click(within(line('MONTHLY ACCOUNT FEE')).getByRole('button', { name: 'Post to ledger' }));
    const panel = await screen.findByTestId('bank-post-panel');
    expect(within(panel).getByTestId('bank-post-effect')).toHaveTextContent('Money out £5.50: Bank charges (7900) debit, Bank credit');
    expect(within(panel).getByTestId('bank-post-suggested')).toHaveTextContent('Suggested from the description');
    const options = within(within(panel).getByLabelText('Account')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Choose an account', "2310 Directors' loan account", '4900 Other income', '7900 Bank charges', '8200 Other overheads']);
    expect(panel).toHaveTextContent('Expenses and invoices posted there match your bank lines automatically. No VAT is added here.');
    expect(panel).toHaveTextContent('Use a manual journal for this.');
    fireEvent.click(within(panel).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(x.bankPost).toHaveBeenCalledWith(ORG, 'l1', 'a7900'));
    expect(await screen.findByTestId('bank-message')).toHaveTextContent('Posted. Your ledger bank balance now includes this line.');
    expect(x.bankOverview).toHaveBeenCalledTimes(2);
  });
  it('a transfer: no suggestion, so Post waits for a choice; typing filters the accounts', async () => {
    const x = api();
    show(x);
    await screen.findByText('TFR FROM DIRECTOR');
    await waitFor(() => expect(x.accounts).toHaveBeenCalled());
    fireEvent.click(within(line('TFR FROM DIRECTOR')).getByRole('button', { name: 'Post to ledger' }));
    const panel = await screen.findByTestId('bank-post-panel');
    expect(within(panel).queryByTestId('bank-post-suggested')).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Post' })).toBeDisabled();
    expect(within(panel).getByTestId('bank-post-effect')).toHaveTextContent('Money in £500.00: Bank debit, the account you choose credit');
    fireEvent.change(within(panel).getByLabelText('Search accounts'), { target: { value: 'loan' } });
    expect(within(within(panel).getByLabelText('Account')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose an account', "2310 Directors' loan account"]);
    fireEvent.change(within(panel).getByLabelText('Account'), { target: { value: 'a2310' } });
    expect(within(panel).getByTestId('bank-post-effect')).toHaveTextContent("Money in £500.00: Bank debit, Directors' loan account (2310) credit");
    expect(within(panel).getByRole('button', { name: 'Post' })).toBeEnabled();
  });
  it('one call even when Post is pressed twice; a refusal shows the plain message', async () => {
    let finish: (v: unknown) => void = () => {};
    const x = api({ bankPost: vi.fn(() => new Promise((r) => { finish = r; })) });
    show(x);
    await screen.findByText('INTEREST PAID');
    await waitFor(() => expect(x.accounts).toHaveBeenCalled());
    fireEvent.click(within(line('INTEREST PAID')).getByRole('button', { name: 'Post to ledger' }));
    const post = within(await screen.findByTestId('bank-post-panel')).getByRole('button', { name: 'Post' });
    fireEvent.click(post); fireEvent.click(post);
    expect(x.bankPost).toHaveBeenCalledTimes(1);
    expect(x.bankPost).toHaveBeenCalledWith(ORG, 'l2', 'a4900');
    await act(async () => { finish({ ok: false, code: 'PERIOD_LOCKED' }); });
    expect(await screen.findByTestId('bank-error')).toHaveTextContent('That date is in a locked period.');
  });
  it('MFA_REQUIRED asks for the authenticator', async () => {
    const x = api({ bankPost: vi.fn(() => fail('MFA_REQUIRED')) });
    show(x);
    await screen.findByText('MONTHLY ACCOUNT FEE');
    await waitFor(() => expect(x.accounts).toHaveBeenCalled());
    fireEvent.click(within(line('MONTHLY ACCOUNT FEE')).getByRole('button', { name: 'Post to ledger' }));
    fireEvent.click(within(await screen.findByTestId('bank-post-panel')).getByRole('button', { name: 'Post' }));
    expect(await screen.findByTestId('bank-error')).toHaveTextContent('Confirm with your authenticator app, then try again.');
  });
});

describe('Bank: post selected', () => {
  it('tick lines, one account for all, the list and total, one call', async () => {
    const x = api();
    show(x);
    await screen.findByText('MONTHLY ACCOUNT FEE');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select MONTHLY ACCOUNT FEE' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select INTEREST PAID' }));
    expect(screen.getByTestId('bank-selection')).toHaveTextContent('2 selected');
    fireEvent.click(screen.getByRole('button', { name: 'Post selected' }));
    const panel = await screen.findByTestId('bank-bulk-panel');
    expect(panel).toHaveTextContent('Post 2 lines to one account');
    expect(within(panel).getByTestId('bank-bulk-total')).toHaveTextContent('Total -£5.38');
    expect(within(panel).getByRole('button', { name: 'Post 2 lines' })).toBeDisabled();
    fireEvent.change(within(panel).getByLabelText('Account'), { target: { value: 'a8200' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Post 2 lines' }));
    await waitFor(() => expect(x.bankPostMany).toHaveBeenCalledWith(ORG, 'a8200', ['l1', 'l2']));
    expect(await screen.findByTestId('bank-message')).toHaveTextContent('Posted 2 lines. Your ledger bank balance now includes them.');
  });
  it('at most 50 lines can be ticked', async () => {
    const many = Array.from({ length: 52 }, (_, i) => ({ id: `m${i}`, line_date: '2026-03-03', description: `FEE ${i}`, amount_pence: -550, suggestions: [] }));
    show(api({ bankOverview: vi.fn(() => ok(overview({ unmatched: many, counts: { unmatched: 52, matched: 0, ignored: 0, posted: 0, needs_attention: 0 } }))) }));
    await screen.findByText('FEE 0');
    for (let i = 0; i < 52; i++) fireEvent.click(screen.getByRole('checkbox', { name: `Select FEE ${i}` }));
    expect(screen.getByTestId('bank-selection')).toHaveTextContent('50 selected (at most 50)');
    expect(screen.getByRole('checkbox', { name: 'Select FEE 51' })).toBeDisabled();
  });
});

describe('Bank: posted lines and undo', () => {
  it('the Posted tab lists the account; Undo asks first, then reverses', async () => {
    const x = api();
    show(x);
    await screen.findByText('MONTHLY ACCOUNT FEE');
    tab(/^Posted \(1\)/);
    const list = await screen.findByTestId('bank-posted');
    expect(list).toHaveTextContent('FEBRUARY FEE');
    expect(list).toHaveTextContent('Posted to 7900 Bank charges');
    fireEvent.click(within(list).getByRole('button', { name: 'Undo' }));
    expect(screen.getByTestId('bank-undo-confirm')).toHaveTextContent('This reverses the journal. Nothing is deleted.');
    expect(x.bankUnpost).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Undo posting' }));
    await waitFor(() => expect(x.bankUnpost).toHaveBeenCalledWith(ORG, 'l9'));
    expect(await screen.findByTestId('bank-message')).toHaveTextContent('Undone. A reversal journal dated 2026-02-03 was posted, and the line is back in Unmatched.');
  });
  it('an undo dated today says why', async () => {
    const x = api({ bankUnpost: vi.fn(() => ok({ result: 'unposted', how: 'reversed', reversal_date: '2026-11-17', reversal_dated: 'today' })) });
    show(x);
    await screen.findByText('MONTHLY ACCOUNT FEE');
    tab(/^Posted/);
    fireEvent.click(within(await screen.findByTestId('bank-posted')).getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo posting' }));
    expect(await screen.findByTestId('bank-message')).toHaveTextContent("dated 2026-11-17 (today: the line's date is locked or before your books start)");
  });
  it('Needs attention: a posted line whose journal was reversed on the Journals screen', async () => {
    const x = api({ bankUnpost: vi.fn(() => ok({ result: 'unposted', how: 'already_reversed', reversal_date: null, reversal_dated: null })) });
    show(x);
    await screen.findByText('MONTHLY ACCOUNT FEE');
    tab(/^Needs attention/);
    const list = await screen.findByTestId('bank-attention');
    expect(list).toHaveTextContent('Was posted to 7900 Bank charges; that journal was reversed on the Journals screen');
    fireEvent.click(within(list).getByRole('button', { name: 'Back to Unmatched' }));
    expect(await screen.findByTestId('bank-message')).toHaveTextContent('Undone. The journal had already been reversed, so the line is back in Unmatched.');
  });
  it('the counts include posted; Match again reports lines returned to Unmatched', async () => {
    show(api());
    expect(await screen.findByTestId('bank-counts')).toHaveTextContent('3 unmatched, 0 matched, 0 ignored, 1 posted, 1 need attention.');
    fireEvent.click(screen.getByRole('button', { name: 'Match again' }));
    expect(await screen.findByTestId('bank-message')).toHaveTextContent('1 line whose journal was reversed is back in Unmatched.');
  });
});

describe('Bank: before the 3c-2 SQL is applied', () => {
  it('no posting controls and no Posted tab while the overview has no posted count', async () => {
    show(api({ bankOverview: vi.fn(() => ok(overview({ counts: { unmatched: 3, matched: 0, ignored: 0, needs_attention: 0 }, posted: undefined, needs_attention: [] }))) }));
    await screen.findByText('MONTHLY ACCOUNT FEE');
    expect(screen.queryByRole('button', { name: 'Post to ledger' })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('tab', { name: /^Posted/ })).toBeNull();
    expect(screen.getByTestId('bank-counts')).toHaveTextContent('3 unmatched, 0 matched, 0 ignored.');
  });
});

describe('Bank: members read only', () => {
  it('no Post, Post selected, checkboxes or Undo for a plain member', async () => {
    show(api({ bankOverview: vi.fn(() => ok(overview({ can_manage: false }))) }));
    await screen.findByText('MONTHLY ACCOUNT FEE');
    expect(screen.queryByRole('button', { name: 'Post to ledger' })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    tab(/^Posted/);
    expect(await screen.findByTestId('bank-posted')).toHaveTextContent('FEBRUARY FEE');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.getByTestId('bank-never-posts')).toHaveTextContent('Importing and matching never change your ledger. Posting a line you choose does, and you can undo it.');
  });
});
