import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  accountActions, checkBalance, checkManualJournal, checkNewAccount, DEFAULT_CHART, differenceText, formatPence, groupAccounts, isNotAvailable,
  ledgerCode, ledgerMessage, linesForRpc, parseOpeningCsv, parsePence, penceToDecimal, reverseReasonOk, toPence, trialBalance, type LedgerAccount,
} from './ledger';
import { ledgerApi, type LedgerClient } from './ledgerApi';

describe('ledger money: integer pence, never a float', () => {
  it('parses typed amounts into whole pence', () => {
    expect(parsePence('1,234.56')).toBe(123456);
    expect(parsePence('£12')).toBe(1200);
    expect(parsePence('0.07')).toBe(7);
    expect(parsePence('0.1')).toBe(10);
    expect(parsePence('1.')).toBe(100);
    expect(parsePence('')).toBe(0);
    expect(parsePence('  ')).toBe(0);
    expect(parsePence('999999999999.99')).toBe(99999999999999);
  });
  it('refuses negatives, three decimals, letters, bad grouping and more than 12 digits of pounds', () => {
    for (const bad of ['-1', '1.234', 'abc', '1,23', '12,34.5', '1e3', '1000000000000', '1 000']) expect(parsePence(bad), bad).toBeNull();
  });
  it('0.1 + 0.2 is exactly 0.3 in pence (the float trap)', () => {
    expect((parsePence('0.1') ?? 0) + (parsePence('0.2') ?? 0)).toBe(parsePence('0.3'));
  });
  it('reads database numerics (numbers or strings) and writes exact decimals', () => {
    expect(toPence('1500.10')).toBe(150010);
    expect(toPence(1500.1)).toBe(150010);
    expect(toPence(0.29)).toBe(29);
    expect(toPence('-5.5')).toBe(-550);
    expect(toPence(null)).toBe(0);
    expect(penceToDecimal(7)).toBe('0.07');
    expect(penceToDecimal(123456)).toBe('1234.56');
    expect(formatPence(123456789)).toBe('£1,234,567.89');
    expect(formatPence(-550)).toBe('-£5.50');
  });
});

describe('journal balance check', () => {
  const l = (account: string, debit: string, credit: string) => ({ account, debit, credit });
  it('balanced lines pass; blank rows are ignored', () => {
    const c = checkBalance([l('1200', '100.10', ''), l('3000', '', '100.10'), l('', '', '')]);
    expect(c).toMatchObject({ debit: 10010, credit: 10010, difference: 0, used: 2, ok: true });
    expect(differenceText(c)).toBe('Balanced');
  });
  it('shows the running difference either way', () => {
    expect(differenceText(checkBalance([l('1200', '10', ''), l('3000', '', '4')]))).toBe('Debits are £6.00 more than credits');
    expect(differenceText(checkBalance([l('1200', '1', ''), l('3000', '', '4.5')]))).toBe('Credits are £3.50 more than debits');
  });
  it('flags a line with both sides, neither side, no account, a bad amount, or an unknown account', () => {
    const c = checkBalance([l('1200', '5', '5'), l('3000', '', ''), l('', '1', ''), l('1200', '-1', ''), l('X1', '1', '')], new Set(['1200', '3000']));
    expect(c.ok).toBe(false);
    expect(c.problems.map((p) => p.line)).toEqual([1, 2, 3, 4, 5]);
    expect(c.problems.find((p) => p.line === 5)?.message).toBe('Unknown account X1.');
  });
  it('needs two lines and something to post', () => {
    expect(checkBalance([l('1200', '', ''), l('3000', '', '')]).ok).toBe(false);
    expect(checkBalance([l('1200', '1', '')]).ok).toBe(false);
  });
  it('a manual journal needs a description and a reason of at least 3 characters', () => {
    const lines = [l('a', '1', ''), l('b', '', '1')];
    expect(checkManualJournal({ date: '2026-04-01', memo: 'Accrual', reason: 'Year end', lines }).ok).toBe(true);
    expect(checkManualJournal({ date: '2026-04-01', memo: 'Accrual', reason: 'ab', lines }).errors).toContain('Add a reason (at least 3 characters).');
    expect(checkManualJournal({ date: '2026-04-01', memo: ' ', reason: 'abc', lines }).errors).toContain('Add a description.');
    expect(checkManualJournal({ date: '', memo: 'x', reason: 'abc', lines }).ok).toBe(false);
  });
  it('lines go to the database as exact decimal strings, blank rows dropped', () => {
    expect(linesForRpc([l(' 1200 ', '1,000.5', ''), l('3000', '', '1000.50'), l('', '', '')])).toEqual([
      { account_code: '1200', debit: '1000.50', credit: '0.00' }, { account_code: '3000', debit: '0.00', credit: '1000.50' }]);
  });
  it('a reversal needs a reason', () => {
    expect(reverseReasonOk('')).toBe(false);
    expect(reverseReasonOk('  ab ')).toBe(false);
    expect(reverseReasonOk('Posted twice')).toBe(true);
  });
});

describe('opening balances CSV', () => {
  const codes = new Set(DEFAULT_CHART.map((a) => a.code));
  it('reads account_code,debit,credit with or without a header, and quoted amounts', () => {
    const r = parseOpeningCsv('account_code,debit,credit\r\n1200,"1,500.00",\n3000,,1500\n\n', codes);
    expect(r.problems).toEqual([]);
    expect(checkBalance(r.lines, codes).ok).toBe(true);
    expect(parseOpeningCsv('1200,10,\n3000,,10', codes).lines).toHaveLength(2);
  });
  it('reports problems by CSV line number', () => {
    const r = parseOpeningCsv('account_code,debit,credit\n1200,10,10\nZZZ,1,\n1200\n3000,-4,', codes);
    expect(r.problems).toEqual([
      { line: 2, message: 'Enter a debit or a credit, not both.' },
      { line: 3, message: 'Unknown account code ZZZ.' },
      { line: 4, message: 'Expected account_code,debit,credit.' },
      { line: 5, message: 'Amounts are numbers with up to 2 decimal places, not negative.' },
    ]);
  });
});

describe('trial balance', () => {
  it('nets each account onto its side and checks the totals in pence', () => {
    const tb = trialBalance([
      { account_id: 'b', code: '1200', name: 'Bank', type: 'asset', is_active: true, debit: 1500.1, credit: '200.00' },
      { account_id: 's', code: '3000', name: 'Share capital', type: 'equity', is_active: true, debit: 0, credit: '1300.10' },
      { account_id: 'z', code: '4000', name: 'Sales', type: 'income', is_active: true, debit: '5', credit: '5' },
    ]);
    expect(tb.lines.map((l) => [l.code, l.debit, l.credit])).toEqual([['1200', 130010, 0], ['3000', 0, 130010]]);
    expect(tb).toMatchObject({ totalDebit: 130010, totalCredit: 130010, balanced: true });
  });
  it('says when the totals do not agree', () => {
    expect(trialBalance([{ account_id: 'b', code: '1200', name: 'Bank', type: 'asset', is_active: true, debit: '1', credit: 0 }]).balanced).toBe(false);
  });
});

describe('chart rules', () => {
  const acc = (o: Partial<LedgerAccount>): LedgerAccount => ({ id: 'x', code: '7100', name: 'Rent', type: 'expense', is_system: false, system_key: null, is_active: true, ...o });
  it('system accounts cannot be renamed or made inactive; others can; nothing for readers', () => {
    expect(accountActions(acc({ is_system: true }), true)).toEqual({ rename: false, deactivate: false, reactivate: false });
    expect(accountActions(acc({}), true)).toEqual({ rename: true, deactivate: true, reactivate: false });
    expect(accountActions(acc({ is_active: false }), true)).toEqual({ rename: true, deactivate: false, reactivate: true });
    expect(accountActions(acc({}), false)).toEqual({ rename: false, deactivate: false, reactivate: false });
  });
  it('groups by type in the usual order', () => {
    const g = groupAccounts([acc({ id: '1', code: '4000', type: 'income' }), acc({ id: '2', code: '1200', type: 'asset' }), acc({ id: '3', code: '1100', type: 'asset' })]);
    expect(g.map((x) => [x.label, x.accounts.map((a) => a.code)])).toEqual([['Assets', ['1100', '1200']], ['Income', ['4000']]]);
  });
  it('checks a new account like the database', () => {
    expect(checkNewAccount({ code: '7150', name: 'Insurance', type: 'expense' }, new Set(['7100']))).toEqual([]);
    expect(checkNewAccount({ code: '7100', name: 'Insurance', type: 'expense' }, new Set(['7100']))).toEqual(['That code is already used.']);
    expect(checkNewAccount({ code: '-x', name: '', type: 'other' }, new Set())).toHaveLength(3);
  });
  it('the standard chart matches ledger_seed_chart in docs/ledger/proposal.sql', () => {
    const sql = readFileSync('docs/ledger/proposal.sql', 'utf8');
    const block = sql.slice(sql.indexOf('CREATE FUNCTION public.ledger_seed_chart'), sql.indexOf(') AS c(code, name, type, sys)'));
    const rows = [...block.matchAll(/\('(\w+)', '((?:[^']|'')+)', '(\w+)', (NULL|'\w+')\)/g)]
      .map((m) => ({ code: m[1], name: m[2].replace(/''/g, "'"), type: m[3], system: m[4] !== 'NULL' }));
    expect(rows).toEqual(DEFAULT_CHART);
    expect(rows.filter((r) => r.system)).toHaveLength(17);
  });
});

describe('errors and "Not available yet"', () => {
  it('maps database errors to codes and messages', () => {
    expect(ledgerCode({ message: 'LEDGER_UNBALANCED: debits 1 and credits 2 differ' })).toBe('UNBALANCED');
    expect(ledgerCode({ message: 'LEDGER_PLAN_NOT_INCLUDED' })).toBe('PLAN_NOT_INCLUDED');
    expect(ledgerCode({ message: 'MFA_REQUIRED' })).toBe('MFA_REQUIRED');
    expect(ledgerCode({ message: 'This is a demo account. It is view only.' })).toBe('DEMO');
    expect(ledgerCode({ code: 'PGRST202', message: 'Could not find the function public.ledger_status' })).toBe('NOT_AVAILABLE');
    expect(ledgerCode({ code: '42P01', message: 'relation "public.journal_entries" does not exist' })).toBe('NOT_AVAILABLE');
    expect(ledgerCode({ message: 'boom' })).toBe('ERROR');
    expect(isNotAvailable({ code: 'PGRST205' })).toBe(true);
    expect(ledgerMessage('NOT_AVAILABLE')).toBe('The ledger is not available yet.');
    expect(ledgerMessage('nonsense')).toBe('Something went wrong. Please try again.');
  });
  it('the API answers NOT_AVAILABLE before the SQL is applied, for RPCs and table reads', async () => {
    const q = { select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q,
      then: (r: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.ledger_accounts'" } }).then(r) };
    const client = { rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.ledger_status(p_org)' } }), from: () => q } as unknown as LedgerClient;
    const api = ledgerApi(client);
    expect(await api.status('o')).toEqual({ ok: false, code: 'NOT_AVAILABLE' });
    expect(await api.accounts('o')).toEqual({ ok: false, code: 'NOT_AVAILABLE' });
  });
  it('the API sends a manual journal with the reason, manual source and an idempotency key', async () => {
    const calls: [string, Record<string, unknown>][] = [];
    const client = { rpc: async (fn: string, a: Record<string, unknown>) => { calls.push([fn, a]); return { data: { result: 'ok', entry_id: 'e' }, error: null }; }, from: () => ({}) } as unknown as LedgerClient;
    await ledgerApi(client).post('o', { date: '2026-04-01', memo: ' Accrual ', reason: ' Year end ', lines: [], key: 'abcdefgh12' });
    expect(calls).toEqual([['ledger_post_journal', { p_org: 'o', p_entry_date: '2026-04-01', p_memo: 'Accrual', p_reason: 'Year end', p_lines: [], p_source_type: 'manual', p_idempotency_key: 'abcdefgh12' }]]);
  });
});
