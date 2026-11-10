import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { autoStateText, exactPence, invoicePosting, ISSUE_REASONS, issueReason, journalSources, paymentPosting } from './ledgerAuto';
import { ledgerApi, type LedgerClient } from './ledgerApi';

const inv = (o: Partial<Parameters<typeof invoicePosting>[0]> = {}) =>
  invoicePosting({ status: 'sent', currency: 'GBP', subtotal: '100.00', tax_amount: '20.00', total_amount: '120.00', ...o });

describe('automatic posting maths (integer pence)', () => {
  it('an invoice of 100.00 + 20.00 VAT: Dr Debtors 120.00, Cr Sales 100.00, Cr VAT control 20.00', () => {
    expect(inv()).toEqual({ lines: [{ account: 'debtors', debit: 12000, credit: 0 }, { account: 'sales', debit: 0, credit: 10000 }, { account: 'vat_control', debit: 0, credit: 2000 }] });
  });
  it('no VAT line when the VAT is zero; overdue and paid post too', () => {
    expect(inv({ tax_amount: 0, total_amount: 100 })).toEqual({ lines: [{ account: 'debtors', debit: 10000, credit: 0 }, { account: 'sales', debit: 0, credit: 10000 }] });
    expect('lines' in inv({ status: 'Overdue' })).toBe(true);
    expect('lines' in inv({ status: 'paid' })).toBe(true);
  });
  it('drafts (and anything else) never post', () => {
    for (const status of ['draft', 'pending', null, '']) expect(inv({ status })).toEqual({ none: true });
  });
  it('pence exact where floats are not: 33.33 + 6.67 = 40.00 and 0.10 + 0.20 = 0.30', () => {
    expect(inv({ subtotal: 33.33, tax_amount: 6.67, total_amount: 40 })).toMatchObject({ lines: [{ debit: 4000 }, { credit: 3333 }, { credit: 667 }] });
    expect(inv({ subtotal: 0.1, tax_amount: 0.2, total_amount: 0.3 })).toMatchObject({ lines: [{ debit: 30 }, { credit: 10 }, { credit: 20 }] });
  });
  it('needs attention instead of guessing', () => {
    expect(inv({ total_amount: '120.01' })).toEqual({ reason: 'amounts_do_not_add_up' });
    expect(inv({ currency: 'USD' })).toEqual({ reason: 'currency_not_gbp' });
    expect(inv({ currency: null })).toEqual({ reason: 'currency_not_gbp' });
    expect(inv({ subtotal: null })).toEqual({ reason: 'amounts_missing' });
    expect(inv({ subtotal: '100.001', total_amount: '120.001' })).toEqual({ reason: 'not_whole_pence' });
    expect(inv({ subtotal: -100, total_amount: -80 })).toEqual({ reason: 'negative_amount' });
    expect(inv({ subtotal: 0, tax_amount: 0, total_amount: 0 })).toEqual({ reason: 'zero_total' });
  });
  it('the payment journal: Dr Bank, Cr Debtors, the total', () => {
    expect(paymentPosting(12000)).toEqual([{ account: 'bank', debit: 12000, credit: 0 }, { account: 'debtors', debit: 0, credit: 12000 }]);
  });
  it('exactPence reads numbers and strings without float drift', () => {
    expect(exactPence('1234.5')).toBe(123450);
    expect(exactPence(19.99)).toBe(1999);
    expect(exactPence('0.105')).toBeNull();
    expect(exactPence('abc')).toBeNull();
  });
});

describe('screen helpers', () => {
  it('every reason code in the SQL has plain wording', () => {
    const sql = readFileSync('docs/ledger-auto/proposal.sql', 'utf8');
    const block = sql.slice(sql.indexOf('CONSTRAINT lpi_reason'), sql.indexOf('created_at', sql.indexOf('CONSTRAINT lpi_reason')));
    const codes = [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(codes.length).toBe(12);
    expect(codes.sort()).toEqual(Object.keys(ISSUE_REASONS).sort());
    expect(issueReason('before_start')).toBe('Dated before the ledger start date.');
    expect(issueReason('???')).toBe('Needs checking.');
  });
  it('journal sources: an automatic journal and its reversal both say which invoice', () => {
    const m = journalSources([{ entry_id: 'e1', reversal_entry_id: 'r1', source_label: 'INV-0012', kind: 'invoice_issued' },
      { entry_id: 'e2', reversal_entry_id: null, source_label: 'INV-0013', kind: 'invoice_paid' }]);
    expect([m.get('e1'), m.get('r1'), m.get('e2'), m.get('x')]).toEqual(['Invoice INV-0012', 'Invoice INV-0012', 'Invoice INV-0013', undefined]);
  });
  it('the state line: off, or on since a date', () => {
    expect(autoStateText({ invoices_enabled: false, enabled_at: '2026-03-03T10:00:00Z' })).toBe('Off');
    expect(autoStateText({ invoices_enabled: true, enabled_at: '2026-03-03T10:00:00Z' })).toBe('On since 3 March 2026');
  });
  it('the API answers NOT_AVAILABLE when the phase 3a functions are missing', async () => {
    const client = { rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.ledger_auto_status(p_org)' } }), from: () => ({}) } as unknown as LedgerClient;
    expect(await ledgerApi(client).autoStatus('o')).toEqual({ ok: false, code: 'NOT_AVAILABLE' });
  });
});
