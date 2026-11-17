import { describe, expect, it } from 'vitest';
import type { LedgerAccount } from './ledger';
import { ledgerMessage } from './ledger';
import { allowedAccounts, BANK_POSTING_NOTE, effectText, isBlocked, linesTotal, searchAccounts, suggestAccount } from './ledgerBankPost';

const a = (code: string, name: string, system_key: string | null = null, is_active = true, type: LedgerAccount['type'] = 'expense'): LedgerAccount =>
  ({ id: `id-${code}`, code, name, type, is_system: system_key !== null, system_key, is_active });
const chart = [
  a('1100', 'Debtors', 'debtors', true, 'asset'), a('1200', 'Bank', 'bank', true, 'asset'), a('1210', 'Cash', null, true, 'asset'),
  a('2100', 'Creditors', 'creditors', true, 'liability'), a('2200', 'VAT control', 'vat_control', true, 'liability'), a('2210', 'PAYE and NI', 'paye_ni', true, 'liability'),
  a('2220', 'Corporation Tax', 'corporation_tax', true, 'liability'), a('2310', "Directors' loan account", null, true, 'liability'), a('3000', 'Share capital', 'share_capital', true, 'equity'),
  a('4900', 'Other income', null, true, 'income'), a('7900', 'Bank charges'), a('8200', 'Other overheads'), a('7150', 'Old costs', null, false),
];

describe('allowed counter accounts (the database checks the same rule)', () => {
  it('blocks the bank and the accounts invoices, bills, payroll and returns drive; inactive ones too', () => {
    expect(allowedAccounts(chart).map((x) => x.code)).toEqual(['1210', '2310', '3000', '4900', '7900', '8200']);
    expect(['bank', 'debtors', 'creditors', 'vat_control', 'paye_ni', 'corporation_tax'].every((k) => isBlocked({ system_key: k }))).toBe(true);
    expect(isBlocked({ system_key: 'share_capital' })).toBe(false);
  });
  it('search by code or name', () => {
    expect(searchAccounts(allowedAccounts(chart), 'charg').map((x) => x.code)).toEqual(['7900']);
    expect(searchAccounts(allowedAccounts(chart), '23').map((x) => x.code)).toEqual(['2310']);
    expect(searchAccounts(allowedAccounts(chart), ' ')).toHaveLength(6);
  });
});

describe('suggestions from the description (a suggestion only)', () => {
  const ok = allowedAccounts(chart);
  it.each([
    ['MONTHLY ACCOUNT FEE', -550, '7900'], ['Bank charges March', -1200, '7900'], ['FX COMMISSION', -300, '7900'], ['Card fees', -10, '7900'],
    ['INTEREST PAID', 12, '4900'], ['Overdraft interest', -450, '8200'],
  ])('%s (%i) -> %s', (d, p, code) => expect(suggestAccount(d, p, ok)?.code).toBe(code));
  it.each([['TRANSFER TO SAVINGS', -10000], ['TFR FROM DIRECTOR', 50000], ['Own account transfer', -1], ['ACME LTD', 12000], ['Feeder Ltd', -100]])(
    '%s: no suggestion', (d, p) => expect(suggestAccount(d, p, ok)).toBeNull());
  it('only an account that exists, is active and is allowed', () => {
    expect(suggestAccount('ACCOUNT FEE', -550, allowedAccounts(chart.filter((x) => x.code !== '7900')))).toBeNull();
    expect(suggestAccount('ACCOUNT FEE', -550, allowedAccounts(chart.map((x) => (x.code === '7900' ? { ...x, is_active: false } : x))))).toBeNull();
  });
});

describe('the effect in plain words; whole pence', () => {
  it('money out and money in', () => {
    expect(effectText(-550, { code: '7900', name: 'Bank charges' })).toBe('Money out £5.50: Bank charges (7900) debit, Bank credit');
    expect(effectText(12, { code: '4900', name: 'Other income' })).toBe('Money in £0.12: Bank debit, Other income (4900) credit');
    expect(effectText(-1, null)).toBe('Money out £0.01: the account you choose debit, Bank credit');
  });
  it('totals with no float error', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(linesTotal([{ amount_pence: -10 }, { amount_pence: -20 }])).toBe(-30);
    expect(linesTotal(Array.from({ length: 50 }, () => ({ amount_pence: -550 })))).toBe(-27500);
  });
});

describe('wording and messages', () => {
  it('the top note', () => expect(BANK_POSTING_NOTE).toBe('Importing and matching never change your ledger. Posting a line you choose does, and you can undo it.'));
  it.each([
    ['BANK_ALREADY_POSTED', 'already posted to another account'], ['BANK_NOT_POSTED', "isn't posted"], ['BANK_ACCOUNT_NOT_ALLOWED', 'Use a manual journal for this.'],
    ['BANK_TOO_MANY_LINES', 'at most 50'], ['BANK_IGNORED', 'Un-ignore it first'], ['BEFORE_START', 'before the ledger start date'], ['PERIOD_LOCKED', 'locked period'],
  ])('%s', (code, text) => expect(ledgerMessage(code)).toContain(text));
});
