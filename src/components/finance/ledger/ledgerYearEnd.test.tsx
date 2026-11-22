// Finance phase 5: the Year end section of the Ledger tab, and the financial-year quick choices in Reports.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEDGER_DISCLAIMER, type LedgerAccount } from '@/lib/ledger';
import type { LedgerApi } from '@/lib/ledgerApi';
import type { YearEndPreview, YearEndStatus } from '@/lib/ledgerYearEnd';
import { LedgerYearEnd } from './LedgerYearEnd';
import { LedgerReports } from './LedgerReports';
import { LedgerJournals } from './LedgerJournals';

const ORG = 'org-1';
const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });
const fail = (code: string) => Promise.resolve({ ok: false as const, code });
const notSet: YearEndStatus = { set_up: true, can_manage: true, start_date: '2025-01-01', locked_through: null, year_end_month: null, year_end_day: null, closed_years: [], next_year_end: null };
const twoClosed: YearEndStatus = {
  set_up: true, can_manage: true, start_date: '2025-01-01', locked_through: '2026-03-31', year_end_month: 3, year_end_day: 31, first_year_end: '2025-03-31',
  closed_years: [
    { year_end: '2025-03-31', year_start: '2025-01-01', entry_id: 'e1', profit: '59.50' },
    { year_end: '2026-03-31', year_start: '2025-04-01', entry_id: 'e2', profit: '-99.00' },
  ],
  next_year_end: '2027-03-31', next_year_start: '2026-04-01', can_close_now: false, latest_closed: '2026-03-31',
};
const openFirst: YearEndStatus = { ...twoClosed, locked_through: null, closed_years: [], next_year_end: '2025-03-31', next_year_start: '2025-01-01', can_close_now: true, latest_closed: null };
const preview = (o: Partial<YearEndPreview> = {}): YearEndPreview => ({
  year_start: '2025-01-01', year_end: '2025-03-31', lock_date: '2025-03-31', profit: '59.50', retained_earnings: { debit: '0.00', credit: '59.50' },
  lines: [
    { account_id: 'a4000', code: '4000', name: 'Sales', type: 'income', is_active: true, debit: '180.00', credit: '0.00' },
    { account_id: 'a8200', code: '8200', name: 'Other overheads', type: 'expense', is_active: true, debit: '0.00', credit: '120.50' },
  ],
  warnings: { waiting: 0, held: 0, bank_unmatched: 0 }, needs_acknowledgement: false, problem: null, can_manage: true, ...o,
});
function yeApi(status: YearEndStatus, o: Partial<Record<keyof LedgerApi, unknown>> = {}) {
  return {
    yearEndStatus: vi.fn(() => ok(status)),
    yearEndSet: vi.fn(() => ok({ result: 'saved', first_year_end: '2025-03-31' })),
    yearEndPreview: vi.fn(() => ok(preview())),
    yearEndClose: vi.fn(() => ok({ result: 'closed', year_end: '2025-03-31', entry_id: 'e9', profit: '59.50', locked_through: '2025-03-31' })),
    yearEndReopen: vi.fn(() => ok({ result: 'reopened', year_end: '2026-03-31', reversal_entry_id: 'r1', locked_through: '2025-03-31' })),
    ...o,
  } as unknown as LedgerApi & Record<string, ReturnType<typeof vi.fn>>;
}
const show = (api: LedgerApi, onChanged = vi.fn()) => render(<LedgerYearEnd api={api} organizationId={ORG} onChanged={onChanged} />);

describe('Year end: setting the date', () => {
  it('no default: says it is not set; day and month pickers; shows how long the first year would be; saves', async () => {
    const api = yeApi(notSet);
    show(api);
    expect(await screen.findByTestId('ye-current')).toHaveTextContent('Not set yet. There is no default');
    const save = screen.getByRole('button', { name: 'Save year end' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '31' } });
    expect(screen.getByTestId('ye-first-year')).toHaveTextContent('Your first year would run from 01/01/2025 to 31/03/2025 (90 days).');
    fireEvent.click(save);
    await waitFor(() => expect(api.yearEndSet).toHaveBeenCalledWith(ORG, 3, 31));
    expect(await screen.findByText('Financial year end saved: 31 March.')).toBeInTheDocument();
    expect(screen.getByText(LEDGER_DISCLAIMER)).toBeInTheDocument();
  });
  it('February offers 29 days; choosing February after 31 brings the day down', async () => {
    show(yeApi(notSet));
    await screen.findByTestId('ye-current');
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '31' } });
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2' } });
    expect((screen.getByLabelText('Day') as HTMLSelectElement).value).toBe('29');
    expect(within(screen.getByLabelText('Day')).queryByRole('option', { name: '30' })).toBeNull();
  });
  it('once a year is closed the date cannot change (no pickers)', async () => {
    show(yeApi(twoClosed));
    expect(await screen.findByTestId('ye-current')).toHaveTextContent('31 March.');
    expect(screen.getByText("It can't change while a year is closed.")).toBeInTheDocument();
    expect(screen.queryByLabelText('Month')).toBeNull();
  });
});

describe('Year end: members read only', () => {
  it('a plain member sees the closed years and can preview, but has no actions or boxes', async () => {
    const status = { ...twoClosed, can_manage: false };
    const api = yeApi(status, { yearEndPreview: vi.fn(() => ok(preview({ year_end: '2027-03-31', lock_date: '2027-03-31', problem: 'future', can_manage: false, warnings: { waiting: 1, held: 0, bank_unmatched: 0 } }))) });
    show(api);
    expect(await screen.findByTestId('ye-read-only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Re-open year' })).toBeNull();
    expect(screen.queryByLabelText('Month')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Preview the close' }));
    expect(await screen.findByTestId('ye-warnings')).toHaveTextContent('1 invoice, bill or expense dated in this year is still waiting to be posted.');
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close year' })).toBeNull();
  });
});

describe('Year end: closed years and re-open', () => {
  it('lists each closed year with its result; only the latest has Re-open, with a confirm', async () => {
    const onChanged = vi.fn();
    const api = yeApi(twoClosed);
    show(api, onChanged);
    const table = await screen.findByTestId('ye-closed-table');
    expect(table).toHaveTextContent('01/01/2025 to 31/03/2025');
    expect(table).toHaveTextContent('Net profit £59.50');
    expect(table).toHaveTextContent('Net loss £99.00');
    const buttons = screen.getAllByRole('button', { name: 'Re-open year' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    const box = screen.getByRole('group', { name: 'Re-open year' });
    expect(box).toHaveTextContent('Re-open the year ending 31/03/2026? The close journal is reversed on 31/03/2026 and the books are locked through 31/03/2025 again.');
    fireEvent.click(within(box).getByRole('button', { name: 'Cancel' }));
    expect(api.yearEndReopen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Re-open year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Re-open the year' }));
    await waitFor(() => expect(api.yearEndReopen).toHaveBeenCalledWith(ORG, '2026-03-31'));
    expect(await screen.findByText('The year ending 31/03/2026 is open again.')).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });
  it('a refused re-open shows the reason', async () => {
    const api = yeApi(twoClosed, { yearEndReopen: vi.fn(() => fail('YEAR_END_NOT_LATEST')) });
    show(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Re-open year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Re-open the year' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only the most recent closed year can be re-opened.');
  });
});

describe('Year end: closing a year', () => {
  it('preview table (the README example), the result, and the lock confirmation before Close year', async () => {
    const onChanged = vi.fn();
    const api = yeApi(openFirst);
    show(api, onChanged);
    fireEvent.click(await screen.findByRole('button', { name: 'Preview the close' }));
    const p = await screen.findByTestId('ye-preview');
    expect(api.yearEndPreview).toHaveBeenCalledWith(ORG, '2025-03-31');
    const rows = within(p).getAllByRole('row').map((r) => r.textContent);
    expect(rows).toEqual(['AccountDebitCredit', '4000 Sales£180.00', '8200 Other overheads£120.50', '3200 Retained earnings£59.50']);
    expect(screen.getByTestId('ye-result')).toHaveTextContent('Net profit £59.50 for the year 01/01/2025 to 31/03/2025.');
    expect(screen.queryByTestId('ye-warnings')).toBeNull();
    const close = screen.getByRole('button', { name: 'Close year' });
    expect(close).toBeDisabled();
    fireEvent.click(screen.getByLabelText('This locks the books through 31/03/2025. You can re-open the most recent year.'));
    fireEvent.click(close);
    await waitFor(() => expect(api.yearEndClose).toHaveBeenCalledWith(ORG, '2025-03-31', false));
    expect(await screen.findByText('The year ending 31/03/2025 is closed and the books are locked through 31/03/2025.')).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });
  it('a loss debits retained earnings', async () => {
    const api = yeApi(openFirst, { yearEndPreview: vi.fn(() => ok(preview({ profit: '-100.00', retained_earnings: { debit: '100.00', credit: '0.00' }, lines: [
      { account_id: 'a4000', code: '4000', name: 'Sales', type: 'income', is_active: true, debit: '300.00', credit: '0.00' },
      { account_id: 'a7100', code: '7100', name: 'Rent and rates', type: 'expense', is_active: true, debit: '0.00', credit: '400.00' }] }))) });
    show(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Preview the close' }));
    const p = await screen.findByTestId('ye-preview');
    expect(within(p).getAllByRole('row').at(-1)?.textContent).toBe('3200 Retained earnings£100.00');
    expect(screen.getByTestId('ye-result')).toHaveTextContent('Net loss £100.00');
  });
  it('warnings: a box per warning; Close year needs every box and the confirmation; then it acknowledges', async () => {
    const api = yeApi(openFirst, { yearEndPreview: vi.fn(() => ok(preview({ warnings: { waiting: 2, held: 0, bank_unmatched: 1 }, needs_acknowledgement: true }))) });
    show(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Preview the close' }));
    const w = await screen.findByTestId('ye-warnings');
    expect(w).toHaveTextContent('2 invoices, bills or expenses dated in this year are still waiting to be posted.');
    expect(w).toHaveTextContent('1 bank statement line in this year is not matched or posted.');
    const boxes = within(w).getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    fireEvent.click(screen.getByLabelText(/This locks the books through 31\/03\/2025/));
    const close = screen.getByRole('button', { name: 'Close year' });
    expect(close).toBeDisabled();
    fireEvent.click(boxes[0]);
    expect(close).toBeDisabled();
    fireEvent.click(boxes[1]);
    expect(close).toBeEnabled();
    fireEvent.click(close);
    await waitFor(() => expect(api.yearEndClose).toHaveBeenCalledWith(ORG, '2025-03-31', true));
  });
  it('a year that cannot close says why and offers no Close year', async () => {
    const api = yeApi(twoClosed, { yearEndPreview: vi.fn(() => ok(preview({ year_end: '2027-03-31', lock_date: '2027-03-31', problem: 'future' }))) });
    show(api);
    expect(await screen.findByText(/it can only be closed after 31\/03\/2027/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview the close' }));
    expect(await screen.findByTestId('ye-problem')).toHaveTextContent("This year hasn't ended yet.");
    expect(screen.queryByRole('button', { name: 'Close year' })).toBeNull();
  });
  it('a year with nothing to move says no journal is posted', async () => {
    const api = yeApi(openFirst, { yearEndPreview: vi.fn(() => ok(preview({ lines: [], profit: '0.00', retained_earnings: { debit: '0.00', credit: '0.00' } }))) });
    show(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Preview the close' }));
    expect(await screen.findByText(/no journal is posted. Closing only locks the books./)).toBeInTheDocument();
  });
  it('MFA and other refusals in plain words', async () => {
    const api = yeApi(openFirst, { yearEndClose: vi.fn(() => fail('MFA_REQUIRED')) });
    show(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Preview the close' }));
    await screen.findByTestId('ye-preview');
    fireEvent.click(screen.getByLabelText(/This locks the books/));
    fireEvent.click(screen.getByRole('button', { name: 'Close year' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirm with your authenticator app, then try again.');
  });
  it('before the SQL is applied: says it is not available', async () => {
    show(yeApi(notSet, { yearEndStatus: vi.fn(() => fail('NOT_AVAILABLE')) }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Year end is not available yet.');
  });
});

describe('Reports: financial-year quick choices', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-22T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });
  const accounts: LedgerAccount[] = [{ id: 'a4000', code: '4000', name: 'Sales', type: 'income', is_system: false, system_key: null, is_active: true }];
  const reportsApi = (status: YearEndStatus | null) => ({
    reportProfitLoss: vi.fn(() => ok([])),
    reportBalanceSheet: vi.fn(() => ok([])),
    reportAccountDetail: vi.fn(() => ok(null)),
    reportCompleteness: vi.fn(() => ok(null)),
    yearEndStatus: vi.fn(() => (status ? ok(status) : fail('NOT_AVAILABLE'))),
  }) as unknown as LedgerApi;
  const showReports = (api: LedgerApi) => render(
    <MemoryRouter initialEntries={['/business-tools?ledger=reports&report=profit-loss&from=2026-01-01&to=2026-03-31']}>
      <LedgerReports api={api} organizationId={ORG} accounts={accounts} startDate="2025-01-01" />
    </MemoryRouter>,
  );
  it('with a year end set: "This financial year" and "Last financial year" from it, next to the tax-year choices', async () => {
    showReports(reportsApi(twoClosed));
    const group = await screen.findByTestId('quick-choices');
    const thisFy = await within(group).findByRole('button', { name: 'This financial year' });
    expect(within(group).getByRole('button', { name: 'This tax year' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Last tax year' })).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('button', { name: 'Last financial year' }));
    expect(await screen.findByText('Profit and loss, 01/04/2025 to 31/03/2026')).toBeInTheDocument();
    fireEvent.click(thisFy);
    expect(await screen.findByText('Profit and loss, 01/04/2026 to 31/03/2027')).toBeInTheDocument();
  });
  it('without a year end (or before the SQL): no financial-year choices', async () => {
    showReports(reportsApi(null));
    const group = await screen.findByTestId('quick-choices');
    await waitFor(() => expect(within(group).getByRole('button', { name: 'This tax year' })).toBeInTheDocument());
    expect(within(group).queryByRole('button', { name: 'This financial year' })).toBeNull();
  });
});

describe('Journals: the close journal', () => {
  it('is labelled "Year end close" and has no Reverse (re-open the year instead); a manual journal still has Reverse', async () => {
    const entry = (id: string, source_type: 'year_end' | 'manual', memo: string) => ({ id, entry_date: '2025-03-31', memo, reason: 'x', source_type, reverses_entry_id: null, posted_by_name: null, posted_at: '2025-04-01T00:00:00Z' });
    const api = { lines: vi.fn(() => ok([])) } as unknown as LedgerApi;
    render(<LedgerJournals api={api} organizationId={ORG} accounts={[]} canPost journals={[entry('y1', 'year_end', 'Year end close: year ending 31/03/2025'), entry('m1', 'manual', 'Rent')]} onChanged={vi.fn()} />);
    expect(screen.getByText('Year end close')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Year end close: year ending 31/03/2025' }));
    await waitFor(() => expect(api.lines).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Reverse' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Rent' }));
    expect(await screen.findByRole('button', { name: 'Reverse' })).toBeInTheDocument();
  });
});
