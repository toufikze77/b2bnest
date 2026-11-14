import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { billPosting, categoryKey, expensePosting, journalSources, SOURCE_LINKS, sourceOfKind } from './ledgerAuto';
import { runWaitingPostings, withLedgerAutoRun } from './ledgerAutoRun';

const rec = (o: Record<string, unknown> = {}) => ({ status: 'pending', currency: 'GBP', amount: '120.00', net_amount: '100.00', vat_amount: '20.00',
  vat_status: 'recorded', vat_reclaimable: true, ...o }) as Parameters<typeof billPosting>[0];

describe('bill posting maths (integer pence)', () => {
  it('a bill of 100.00 + 20.00 VAT, reclaimable: Dr expense 100.00, Dr VAT control 20.00, Cr Creditors 120.00', () => {
    expect(billPosting(rec())).toEqual({ lines: [{ account: 'expense', debit: 10000, credit: 0 }, { account: 'vat_control', debit: 2000, credit: 0 }, { account: 'creditors', debit: 0, credit: 12000 }] });
  });
  it('VAT not reclaimable: the VAT is part of the cost', () => {
    expect(billPosting(rec({ vat_reclaimable: false }))).toEqual({ lines: [{ account: 'expense', debit: 12000, credit: 0 }, { account: 'creditors', debit: 0, credit: 12000 }] });
  });
  it('pence exact: 33.33 + 6.67 = 40.00; zero-rated: no VAT line', () => {
    expect(billPosting(rec({ amount: 40, net_amount: 33.33, vat_amount: 6.67 }))).toMatchObject({ lines: [{ debit: 3333 }, { debit: 667 }, { credit: 4000 }] });
    expect(billPosting(rec({ amount: 10, net_amount: 10, vat_amount: 0 }))).toEqual({ lines: [{ account: 'expense', debit: 1000, credit: 0 }, { account: 'creditors', debit: 0, credit: 1000 }] });
  });
  it('pending, overdue and paid post; cancelled never does', () => {
    for (const status of ['pending', 'Overdue', 'paid']) expect('lines' in billPosting(rec({ status }))).toBe(true);
    expect(billPosting(rec({ status: 'cancelled' }))).toEqual({ none: true });
  });
  it('needs attention instead of guessing', () => {
    expect(billPosting(rec({ currency: 'EUR' }))).toEqual({ reason: 'currency_not_gbp' });
    expect(billPosting(rec({ vat_status: 'not_recorded', net_amount: null, vat_amount: null }))).toEqual({ reason: 'vat_details_missing' });
    expect(billPosting(rec({ amount: '120.01' }))).toEqual({ reason: 'amounts_do_not_add_up' });
    expect(billPosting(rec({ amount: '120.005' }))).toEqual({ reason: 'not_whole_pence' });
    expect(billPosting(rec({ amount: 0, net_amount: 0, vat_amount: 0 }))).toEqual({ reason: 'zero_total' });
    expect(billPosting(rec({ amount: -12, net_amount: -10, vat_amount: -2 }))).toEqual({ reason: 'negative_amount' });
    expect(billPosting(rec({ amount: null }))).toEqual({ reason: 'amounts_missing' });
  });
});

describe('expense posting maths', () => {
  it('an approved or paid expense: Dr expense, Dr VAT control, Cr Bank', () => {
    expect(expensePosting(rec({ status: 'approved', amount: '24.00', net_amount: '20.00', vat_amount: '4.00' }), 'GBP'))
      .toEqual({ lines: [{ account: 'expense', debit: 2000, credit: 0 }, { account: 'vat_control', debit: 400, credit: 0 }, { account: 'bank', debit: 0, credit: 2400 }] });
    expect('lines' in expensePosting(rec({ status: 'paid' }), 'gbp')).toBe(true);
  });
  it('pending, rejected and anything else: nothing; an account not in GBP: needs attention', () => {
    for (const status of ['pending', 'rejected', null]) expect(expensePosting(rec({ status }), 'GBP')).toEqual({ none: true });
    expect(expensePosting(rec({ status: 'approved' }), 'USD')).toEqual({ reason: 'currency_not_gbp' });
    expect(expensePosting(rec({ status: 'approved' }), null)).toEqual({ reason: 'currency_not_gbp' });
  });
});

describe('categories, sources and links', () => {
  it('category keys match the database rule, and production categories find the standard mapping', () => {
    expect(categoryKey('Software and subscriptions')).toBe('software_and_subscriptions');
    expect(categoryKey(' office_costs ')).toBe('office_costs');
    expect(categoryKey('Meals & entertainment!')).toBe('meals_entertainment');
    const sql = readFileSync('docs/ledger-auto-bills/proposal.sql', 'utf8');
    const block = sql.slice(sql.indexOf('CREATE FUNCTION public._ledger_auto_default_categories'), sql.indexOf(') AS d(category_key, code, system_key)'));
    const keys = new Set([...block.matchAll(/\('([a-z_]+)', /g)].map((m) => m[1]));
    expect(keys.size).toBe(27);
    // The categories seen in production (14 Nov 2026), except Equipment, which is left unmapped on purpose.
    for (const c of ['Insurance', 'Marketing', 'Meals and entertainment', 'Office supplies', 'office_costs', 'other', 'Professional fees',
      'Software and subscriptions', 'Software subscription', 'software_subscriptions', 'stock_materials', 'telephone_internet', 'Travel', 'utilities',
      'Utilities', 'Design', 'Postage', 'Software']) expect(keys.has(categoryKey(c)), c).toBe(true);
    expect(keys.has(categoryKey('Equipment'))).toBe(false);
  });
  it('journal sources: "Bill BILL-0012" and "Expense: Travel", reversals included', () => {
    const m = journalSources([{ entry_id: 'b1', reversal_entry_id: 'r1', source_label: 'BILL-0012', kind: 'bill_received' },
      { entry_id: 'b2', reversal_entry_id: null, source_label: 'BILL-0012', kind: 'bill_paid' },
      { entry_id: 'e1', reversal_entry_id: null, source_label: 'Travel', kind: 'expense' },
      { entry_id: 'i1', reversal_entry_id: null, source_label: 'INV-1', kind: 'invoice_issued' }]);
    expect([m.get('b1'), m.get('r1'), m.get('b2'), m.get('e1'), m.get('i1')]).toEqual(['Bill BILL-0012', 'Bill BILL-0012', 'Bill BILL-0012', 'Expense: Travel', 'Invoice INV-1']);
  });
  it('needs-attention links: expenses to their tab, bills to Company records (bills have no screen of their own)', () => {
    expect(SOURCE_LINKS[sourceOfKind('expense')].to).toContain('tab=expenses');
    expect(SOURCE_LINKS[sourceOfKind('bill_paid')].to).toContain('tab=company-records');
    expect(SOURCE_LINKS[sourceOfKind('invoice_issued')].to).toContain('tab=invoices');
  });
});

describe('instant posting for bills and expenses', () => {
  it('runs when only the bills and expenses switch is on', async () => {
    const api = { autoStatus: vi.fn(() => Promise.resolve({ ok: true as const, data: { access: 'ok', can_manage: true, set_up: true, invoices_enabled: false, bills_enabled: true, enabled_at: null, waiting: 1, open_issues: 0 } })),
      autoRun: vi.fn(() => Promise.resolve({ ok: true as const, data: { processed: 1, failed: 0, dropped: 0, remaining: 0 } })) };
    expect(await runWaitingPostings(api as never, 'o')).toBe(1);
  });
  it("expense writes: each successful create, edit and delete asks to post for the record's company; failures don't; results pass through", async () => {
    const soon = vi.fn();
    const base = { create: vi.fn((_p: Record<string, unknown>) => Promise.resolve({ error: null as unknown })),
      update: vi.fn((_id: string, _p: Record<string, unknown>) => Promise.resolve({ error: null as unknown })),
      remove: vi.fn((_id: string) => Promise.resolve({ error: { message: 'nope' } as unknown })) };
    const api = withLedgerAutoRun(base, (id) => (id === 'e1' ? 'org-a' : null), soon);
    expect(await api.create({ description: 'x', organization_id: 'org-a' })).toEqual({ error: null });
    expect(await api.create({ description: 'personal' })).toEqual({ error: null });
    await api.update('e1', { organization_id: 'org-b' });
    expect(await api.remove('e1')).toEqual({ error: { message: 'nope' } });
    expect(soon.mock.calls.map((c) => c[0])).toEqual(['org-a', null, 'org-a', 'org-b']);
    expect(base.create).toHaveBeenCalledTimes(2);
  });
});
