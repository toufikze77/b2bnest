import { describe, expect, it } from 'vitest';
import type { LedgerAccount } from './ledger';
import {
  accountDetailCsv, accountFileName, balanceSheetCsv, balanceSheetFileName, buildCsv, completenessNotes, csvMoney, csvText, groupBalanceSheet, groupProfitLoss,
  profitLossCsv, profitLossFileName, profitWord, quickRange, rangeProblem, reportParamsFromSearch, searchWithReport, sourceText, startsBeforeBooks, taxYearOf, ukDate,
  type AccountDetail, type BsRow, type Completeness, type PlRow,
} from './ledgerReports';

const pl: PlRow[] = [
  { account_id: 'a4000', code: '4000', name: 'Sales', type: 'income', amount: '1234.56' },
  { account_id: 'a4900', code: '4900', name: 'Other income', type: 'income', amount: 0.1 },
  { account_id: 'a4100', code: '4100', name: 'Consulting', type: 'income', amount: '0.20' },
  { account_id: 'a5000', code: '5000', name: 'Cost of sales', type: 'expense', amount: '400.00' },
  { account_id: 'a7900', code: '7900', name: 'Bank charges', type: 'expense', amount: '12.34' },
  { account_id: 'a7100', code: '7100', name: 'Rent and rates', type: 'expense', amount: '1000.00' },
];
const chart = (o: Partial<LedgerAccount> & Pick<LedgerAccount, 'id' | 'code' | 'name' | 'type'>): LedgerAccount => ({ is_system: false, system_key: null, is_active: true, ...o });

describe('profit and loss grouping (whole pence)', () => {
  it('sales, other income, cost of sales, gross profit, overheads (code order), net', () => {
    const g = groupProfitLoss(pl);
    expect(g.sales.map((l) => l.code)).toEqual(['4000', '4100']);
    expect(g.otherIncome.map((l) => l.code)).toEqual(['4900']);
    expect(g.costOfSales.map((l) => l.code)).toEqual(['5000']);
    expect(g.overheads.map((l) => l.code)).toEqual(['7100', '7900']);
    expect([g.totalSales, g.totalOtherIncome, g.totalIncome, g.totalCostOfSales, g.grossProfit, g.totalOverheads, g.net])
      .toEqual([123476, 10, 123486, 40000, 83486, 101234, -17748]);
  });
  it('0.1 + 0.2 is exactly 0.30 here (no floats)', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    const g = groupProfitLoss([{ account_id: 'x', code: '4950', name: 'X', type: 'income', amount: 0.1 }, { account_id: 'y', code: '4960', name: 'Y', type: 'income', amount: '0.2' }]);
    expect(g.totalOtherIncome).toBe(30);
  });
  it('large totals stay exact', () => {
    const rows: PlRow[] = Array.from({ length: 1000 }, (_, i) => ({ account_id: `a${i}`, code: `40${String(i).padStart(3, '0')}`, name: 'S', type: 'income', amount: '999999999.99' }));
    expect(groupProfitLoss(rows).totalSales).toBe(99999999999 * 1000);
  });
  it('an income account outside 4xxx counts as other income; empty accounts only when asked (active only)', () => {
    const accounts = [chart({ id: 'a6000', code: '6000', name: 'Grants', type: 'income' }), chart({ id: 'a7500', code: '7500', name: 'Office costs', type: 'expense' }),
      chart({ id: 'a7150', code: '7150', name: 'Old', type: 'expense', is_active: false }), chart({ id: 'a1200', code: '1200', name: 'Bank', type: 'asset' })];
    expect(groupProfitLoss(pl, accounts).overheads).toHaveLength(2);
    const g = groupProfitLoss(pl, accounts, true);
    expect(g.otherIncome.map((l) => l.code)).toEqual(['4900', '6000']);
    expect(g.overheads.map((l) => `${l.code}:${l.pence}`)).toEqual(['7100:100000', '7500:0', '7900:1234']);
    expect(g.net).toBe(-17748);
  });
  it('a plain word for a loss', () => {
    expect(profitWord(-1)).toBe('Net loss');
    expect(profitWord(0)).toBe('Net profit');
    expect(profitWord(-5, 'Gross profit', 'Gross loss')).toBe('Gross loss');
  });
});

describe('balance sheet grouping', () => {
  const bs: BsRow[] = [
    { account_id: 'a0010', code: '0010', name: 'Fixed assets', type: 'asset', balance: '5000.00', balanced: true },
    { account_id: 'a0050', code: '0050', name: 'Accumulated depreciation', type: 'asset', balance: '-1000.00', balanced: true },
    { account_id: 'a1200', code: '1200', name: 'Bank', type: 'asset', balance: '837.66', balanced: true },
    { account_id: 'a1100', code: '1100', name: 'Debtors', type: 'asset', balance: '120.00', balanced: true },
    { account_id: 'a2200', code: '2200', name: 'VAT control', type: 'liability', balance: '-20.00', balanced: true },
    { account_id: 'a2100', code: '2100', name: 'Creditors', type: 'liability', balance: '120.00', balanced: true },
    { account_id: null, code: 'PL', name: 'Profit for the period (not yet closed to retained earnings)', type: 'equity', balance: '-142.34', balanced: true },
    { account_id: 'a3000', code: '3000', name: 'Share capital', type: 'equity', balance: '4000.00', balanced: true },
  ];
  it('fixed (code below 1000), current assets, liabilities, net assets, equity with the PL row last', () => {
    const g = groupBalanceSheet(bs);
    expect(g.fixedAssets.map((l) => l.code)).toEqual(['0010', '0050']);
    expect(g.currentAssets.map((l) => l.code)).toEqual(['1100', '1200']);
    expect(g.liabilities.map((l) => l.code)).toEqual(['2100', '2200']);
    expect(g.equity.map((l) => l.code)).toEqual(['3000', 'PL']);
    expect([g.totalFixed, g.totalCurrent, g.totalAssets, g.totalLiabilities, g.netAssets, g.totalEquity]).toEqual([400000, 95766, 495766, 10000, 485766, 385766]);
    expect(g.balanced).toBe(false); // these sample figures don't agree
  });
  it('balanced when net assets equal equity and the database says so', () => {
    const rows: BsRow[] = [{ account_id: 'a', code: '1200', name: 'Bank', type: 'asset', balance: '0.30', balanced: true },
      { account_id: 'b', code: '3000', name: 'Share capital', type: 'equity', balance: 0.1, balanced: true }, { account_id: null, code: 'PL', name: 'P', type: 'equity', balance: '0.20', balanced: true }];
    expect(groupBalanceSheet(rows).balanced).toBe(true);
    expect(groupBalanceSheet(rows.map((r) => ({ ...r, balanced: false }))).balanced).toBe(false);
  });
});

describe('dates: UK tax year and quick choices', () => {
  it.each([
    ['2026-04-05', '2025-04-06', '2026-04-05'], ['2026-04-06', '2026-04-06', '2027-04-05'], ['2026-01-01', '2025-04-06', '2026-04-05'],
    ['2026-12-31', '2026-04-06', '2027-04-05'], ['2024-02-29', '2023-04-06', '2024-04-05'],
  ])('%s is in the tax year %s to %s', (d, f, t) => expect(taxYearOf(d)).toEqual({ from: f, to: t }));
  it('quick choices as at a date', () => {
    expect(quickRange('this-month', '2024-02-10', null)).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(quickRange('last-month', '2026-01-15', null)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(quickRange('this-quarter', '2026-11-16', null)).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(quickRange('this-tax-year', '2026-11-16', null)).toEqual({ from: '2026-04-06', to: '2027-04-05' });
    expect(quickRange('last-tax-year', '2026-11-16', null)).toEqual({ from: '2025-04-06', to: '2026-04-05' });
    expect(quickRange('last-tax-year', '2026-04-05', null)).toEqual({ from: '2024-04-06', to: '2025-04-05' });
    expect(quickRange('since-start', '2026-11-16', '2026-01-01')).toEqual({ from: '2026-01-01', to: '2026-11-16' });
  });
  it('range rules match the database (from <= to, under 5 years)', () => {
    expect(rangeProblem('2026-03-31', '2026-01-01')).toBe('The start date is after the end date.');
    expect(rangeProblem('2021-01-01', '2026-01-01')).toBe('Choose a period of 5 years or less.');
    expect(rangeProblem('2021-01-02', '2026-01-01')).toBeNull();
    expect(rangeProblem('2026-01-01', '2026-01-01')).toBeNull();
  });
  it('UK date order; the books-start warning', () => {
    expect(ukDate('2026-03-01')).toBe('01/03/2026');
    expect(startsBeforeBooks('2025-12-31', '2026-01-01')).toBe(true);
    expect(startsBeforeBooks('2026-01-01', '2026-01-01')).toBe(false);
  });
});

describe('CSV', () => {
  it('BOM, title, disclaimer, CRLF; commas and quotes escaped; formula injection guarded', () => {
    const t = buildCsv('Profit and loss 01/01/2026 to 31/03/2026', ['Code', 'Account', 'Amount'], [[csvText('4000'), csvText('Sales, "UK"'), csvMoney(-123456)]]);
    expect(t.startsWith('\uFEFFProfit and loss 01/01/2026 to 31/03/2026\r\n"Bookkeeping tool. Not accounting, tax or legal advice."\r\n\r\nCode,Account,Amount\r\n')).toBe(true);
    expect(t).toContain('4000,"Sales, ""UK""",-1234.56\r\n');
    for (const bad of ['=HYPERLINK("x")', '+1', '-2', '@SUM(A1)', '\tx', '\rx']) expect(csvText(bad).replace(/^"/, '').startsWith("'")).toBe(true);
    expect(csvText('Rent')).toBe('Rent');
    expect(csvMoney(5)).toBe('0.05');
  });
  it('profit and loss and balance sheet files: plain numbers, section totals, file names', () => {
    const p = profitLossCsv(groupProfitLoss([...pl, { account_id: 'evil', code: '7999', name: '=cmd|calc', type: 'expense', amount: '1.00' }]), '2026-01-01', '2026-03-31');
    expect(p).toContain('Income,4000,Sales,1234.56');
    expect(p).toContain('Overheads,7999,\'=cmd|calc,1.00');
    expect(p).toContain(',,Net loss for the period,-178.48');
    expect(profitLossFileName('2026-01-01', '2026-03-31')).toBe('profit-and-loss-2026-01-01-to-2026-03-31.csv');
    const b = balanceSheetCsv(groupBalanceSheet([{ account_id: null, code: 'PL', name: 'Profit for the period (not yet closed to retained earnings)', type: 'equity', balance: '-1.00' }]), '2026-03-31');
    expect(b).toContain('Balance sheet as at 31/03/2026');
    expect(b).toContain('Equity,,Profit for the period (not yet closed to retained earnings),-1.00');
    expect(balanceSheetFileName('2026-03-31')).toBe('balance-sheet-2026-03-31.csv');
  });
  it('account detail file: dd/mm/yyyy, opening and closing rows, the source of each line', () => {
    const d: AccountDetail = {
      account: { id: 'a', code: '1200', name: 'Bank', type: 'asset', normal_side: 'debit', is_active: true }, from: '2026-02-01', to: '2026-03-31',
      opening_balance: '987.66', closing_balance: '837.66', total_debit: '120.00', total_credit: '270.00', line_count: 2, truncated: false,
      rows: [
        { entry_id: 'e1', entry_date: '2026-02-20', source_type: 'auto_invoice_payment', source_label: 'A-1', memo: 'Invoice A-1 paid', description: null, line_no: 1, debit: '120.00', credit: '0.00', balance: '1107.66' },
        { entry_id: 'e2', entry_date: '2026-03-01', source_type: 'manual', source_label: null, memo: '-Rent, March', description: null, line_no: 2, debit: 0, credit: '270.00', balance: '837.66' },
      ],
    };
    const c = accountDetailCsv(d);
    expect(c).toContain('01/02/2026,Opening balance,,,,987.66');
    expect(c).toContain('20/02/2026,Invoice payment A-1,Invoice A-1 paid,120.00,0.00,1107.66');
    expect(c).toContain('01/03/2026,Manual journal,"\'-Rent, March",0.00,270.00,837.66');
    expect(c).toContain('31/03/2026,Closing balance,,120.00,270.00,837.66');
    expect(accountFileName('1200', '2026-02-01', '2026-03-31')).toBe('account-1200-2026-02-01-to-2026-03-31.csv');
    expect(sourceText({ source_type: 'reversal', source_label: null })).toBe('Reversal');
  });
});

describe('completeness wording', () => {
  const full: Completeness = { set_up: true, start_date: '2026-01-01', locked_through: null, invoices_auto_on: true, bills_auto_on: true, waiting: 0, open_issues: 0, last_posting_at: null, bank_unmatched: 0 };
  it('nothing to say when everything is posted', () => expect(completenessNotes(full)).toEqual([]));
  it('one plain note per gap, with where to go', () => {
    const n = completenessNotes({ ...full, invoices_auto_on: false, bills_auto_on: false, waiting: 1, open_issues: 3, bank_unmatched: 2 });
    expect(n.map((x) => x.link)).toEqual(['automatic', 'automatic', 'automatic', 'automatic', 'bank']);
    expect(n[0].text).toBe("Invoices are not posted to the ledger automatically for this company, so sales shown here only include what you've posted. Turn it on under Automatic postings.");
    expect(n[2].text).toContain('1 record is waiting');
    expect(n[3].text).toContain('3 records are held');
    expect(n[4].text).toContain("2 bank statement lines don't match anything");
    expect(completenessNotes(null)).toEqual([]);
  });
});

describe('the report in the URL', () => {
  it('reads and writes the view, dates and account; keeps other params', () => {
    const s = searchWithReport('?tab=ledger&ledger=trial-balance', { view: 'account', account: 'a1', from: '2026-01-01', to: '2026-03-31' });
    expect(s).toBe('tab=ledger&ledger=reports&report=account&from=2026-01-01&to=2026-03-31&account=a1');
    expect(reportParamsFromSearch(`?${s}`)).toEqual({ view: 'account', account: 'a1', from: '2026-01-01', to: '2026-03-31', asOf: undefined });
    expect(reportParamsFromSearch('?report=nonsense&from=1/1/2026').view).toBe('profit-loss');
    expect(reportParamsFromSearch('?report=nonsense&from=1/1/2026').from).toBeUndefined();
  });
});
