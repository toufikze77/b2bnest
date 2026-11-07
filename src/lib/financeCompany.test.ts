// HMRC P4b: company link helpers and the bulk VAT plan (pure functions).
import { describe, expect, it, vi } from 'vitest';
import { companyErrorMessage, companyLabel, countText, hasCompanyColumn, planBulkVat, withOptionalCompany } from './financeCompany';
import { isRecordedInvoice, isRecordedMoneyOut } from '@/lib/vat';

const inv = (id: string, extra: Record<string, unknown> = {}) => ({
  id, invoice_number: `INV-${id}`, status: 'sent', currency: 'GBP', created_at: '2026-10-02T09:00:00Z', organization_id: null as string | null,
  items: [{ description: 'Work', quantity: 2, rate: 50, amount: 100 }, { description: 'Parts', quantity: 1, rate: 0.03, amount: 0.03 }],
  subtotal: 100.03, tax_rate: 0, tax_amount: 0, total_amount: 100.03, ...extra,
});
const exp = (id: string, amount: number, extra: Record<string, unknown> = {}) => ({ id, description: `E${id}`, amount, date: '2026-10-15', organization_id: null as string | null, ...extra });

describe('company column', () => {
  it('is known once rows carry the key; labels name the company, "No company" or "Another company"', () => {
    expect(hasCompanyColumn([{ id: '1' }])).toBe(false);
    expect(hasCompanyColumn([{ id: '1', organization_id: null }])).toBe(true);
    const companies = [{ organizationId: 'x', name: 'Company X' }];
    expect(companyLabel('x', companies)).toBe('Company X');
    expect(companyLabel(null, companies)).toBe('No company');
    expect(companyLabel('gone', companies)).toBe('Another company');
    expect(countText({ invoice: 3, expense: 1, bill: 2 })).toBe('3 invoices, 1 expense and 2 bills');
    expect(countText({ expense: 2 })).toBe('2 expenses');
  });
  it('turns the database rules into plain words', () => {
    expect(companyErrorMessage({ message: 'FINANCE_COMPANY_REQUIRED: x' })).toMatch(/needs a company/);
    expect(companyErrorMessage({ message: 'FINANCE_COMPANY_NOT_MEMBER: x' })).toMatch(/active member/);
    expect(companyErrorMessage({ message: 'other' })).toBeNull();
  });
  it('before the database update a save is sent again without organization_id (only for that column)', async () => {
    const create = vi.fn(async (p: Record<string, unknown>) => ('organization_id' in p ? { error: { code: 'PGRST204', message: "Could not find the 'organization_id' column of 'expenses' in the schema cache" } } : { error: null }));
    const update = vi.fn(async (_id: string, _p: Record<string, unknown>) => ({ error: { code: 'PGRST204', message: "Could not find the 'vat_status' column" } }));
    const api = withOptionalCompany({ create, update });
    expect(await api.create({ amount: 1, organization_id: 'x' })).toEqual({ error: null });
    expect(create.mock.calls[1][0]).toEqual({ amount: 1 });
    // Another missing column is not this wrapper's business: passed back unchanged, no retry.
    expect((await api.update('1', { organization_id: 'x', vat_status: 'recorded' })).error).toMatchObject({ code: 'PGRST204' });
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe('bulk VAT plan', () => {
  it('invoices: the treatment on every line, VAT per line then summed, tax point = the invoice date, recorded', () => {
    const plan = planBulkVat({ invoices: [inv('1')], expenses: [], bills: [], accountCurrency: 'GBP' });
    expect(plan.changes).toHaveLength(1);
    const p = plan.changes[0].payload as Record<string, unknown> & { items: Record<string, unknown>[] };
    expect(p.items[0]).toMatchObject({ vat_treatment: 'standard', vat_rate: 20, net: 100, vat: 20, gross: 120, description: 'Work' });
    expect(p.items[1]).toMatchObject({ net: 0.03, vat: 0.01, gross: 0.04 });
    expect(p).toMatchObject({ subtotal: 100.03, tax_amount: 20.01, total_amount: 120.04, tax_rate: 20, vat_status: 'recorded', vat_scheme: 'standard', tax_point_date: '2026-10-02' });
    expect(isRecordedInvoice(p)).toBe(true); // the same rule the database checks
    expect(plan.changes[0].totalChanged).toBe(true);
    expect(plan.totals).toEqual({ net: 10003, vat: 2001, gross: 12004 });
    expect(plan.needCompany).toBe(1);
  });
  it('expenses: including VAT keeps the amount; excluding adds VAT on top; tax point = the expense date', () => {
    const inc = planBulkVat({ invoices: [], expenses: [exp('1', 12)], bills: [], accountCurrency: 'GBP' });
    expect(inc.changes[0].payload).toMatchObject({ amount: 12, net_amount: 10, vat_amount: 2, vat_status: 'recorded', tax_point_date: '2026-10-15', vat_reclaimable: true });
    expect(isRecordedMoneyOut(inc.changes[0].payload)).toBe(true);
    expect(inc.changes[0].totalChanged).toBe(false);
    const exc = planBulkVat({ invoices: [], expenses: [exp('1', 10)], bills: [], treatment: 'reduced', entry: 'excluding', accountCurrency: 'GBP' });
    expect(exc.changes[0].payload).toMatchObject({ amount: 10.5, net_amount: 10, vat_amount: 0.5, vat_treatment: 'reduced', vat_rate: 5 });
    const zero = planBulkVat({ invoices: [], expenses: [exp('1', 8, { vat_reclaimable: false })], bills: [], treatment: 'exempt', accountCurrency: 'GBP' });
    expect(zero.changes[0].payload).toMatchObject({ amount: 8, net_amount: 8, vat_amount: 0, vat_rate: 0, vat_reclaimable: false });
  });
  it('GBP only, bills and already recorded records left out, and each kind counted', () => {
    const recorded = exp('r', 12, { net_amount: 10, vat_amount: 2, vat_treatment: 'standard', vat_rate: 20, vat_status: 'recorded', tax_point_date: '2026-10-15' });
    const plan = planBulkVat({
      invoices: [inv('1'), inv('2', { currency: 'USD' }), inv('3', { items: [] })],
      expenses: [exp('1', 12, { organization_id: 'x' }), recorded], bills: [{ id: 'b1', amount: 10 }], accountCurrency: 'GBP',
    });
    expect(plan.changes.map((c) => c.id)).toEqual(['1', '1']);
    expect(plan.skipped).toEqual({ notGbp: 1, bills: 1, alreadyRecorded: 1, unreadable: 1 });
    expect(plan.needCompany).toBe(1); // the invoice; the expense already has a company
    const usd = planBulkVat({ invoices: [], expenses: [exp('1', 12)], bills: [], accountCurrency: 'USD' });
    expect(usd.changes).toHaveLength(0);
    expect(usd.skipped.notGbp).toBe(1); // expenses are in the account currency
  });
});
