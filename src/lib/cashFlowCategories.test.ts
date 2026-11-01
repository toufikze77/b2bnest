import { describe, it, expect, beforeEach } from 'vitest';
import { addCustomCategory, CUSTOM_KEY, EXPENSE_GROUPS, INCOME_GROUPS, loadCustomCategories, saveCustomCategories, standardCategories } from './cashFlowCategories';

const OLD_INCOME = ['Sales Revenue', 'Service Revenue', 'Investment', 'Loan', 'Grant', 'Other Income'];
const OLD_EXPENSE = ['Office Rent', 'Marketing', 'Software/Tools', 'Utilities', 'Salaries', 'Travel', 'Equipment', 'Legal/Professional', 'Insurance', 'Other Expenses'];

describe('cash flow categories', () => {
  beforeEach(() => localStorage.clear());

  it('income: the full UK list, every old name kept, no duplicates', () => {
    const income = standardCategories('income');
    expect([...income].sort()).toEqual(['Sales Revenue', 'Service Revenue', 'Consulting / Fees', 'Subscriptions / Retainers', 'Commission', 'Rental Income',
      'Interest', 'Investment', 'Loan', 'Grant', 'Refund Received', 'Other Income'].sort());
    for (const old of OLD_INCOME) expect(income).toContain(old);
    expect(new Set(income).size).toBe(income.length);
    expect(INCOME_GROUPS.length).toBeGreaterThan(1);
  });

  it('expenses: the full UK list including HMRC lines, every old name kept, no duplicates', () => {
    const expense = standardCategories('expense');
    expect([...expense].sort()).toEqual(['Office Rent', 'Utilities', 'Salaries', 'Employer NI & Pension', 'HMRC: VAT', 'HMRC: PAYE / NI', 'HMRC: Corporation Tax',
      'Insurance', 'Software/Tools', 'Marketing', 'Travel', 'Fuel & Vehicle', 'Equipment', 'Stock / Materials', 'Subcontractors', 'Legal/Professional',
      'Accountancy', 'Bank Charges', 'Loan Repayment', 'Telephone & Internet', 'Repairs & Maintenance', 'Training', 'Office Supplies', 'Entertainment',
      'Refund Given', 'Other Expenses'].sort());
    for (const old of OLD_EXPENSE) expect(expense).toContain(old);
    expect(new Set(expense).size).toBe(expense.length);
    expect(EXPENSE_GROUPS.length).toBeGreaterThan(1);
  });

  it('custom categories: trimmed, max 40 characters, no duplicates (ignoring case), saved per type', () => {
    const empty = { income: [], expense: [] };
    const r = addCustomCategory('expense', '  Parking   fees ', empty);
    expect(r).toMatchObject({ ok: true, name: 'Parking fees' });
    if (!r.ok) throw new Error('expected ok');
    expect(r.custom).toEqual({ income: [], expense: ['Parking fees'] });
    expect(addCustomCategory('expense', 'parking FEES', r.custom)).toMatchObject({ ok: false });
    expect(addCustomCategory('expense', 'marketing', empty)).toMatchObject({ ok: false, error: '"Marketing" is already in the list.' });
    expect(addCustomCategory('expense', 'x'.repeat(41), empty)).toMatchObject({ ok: false });
    expect(addCustomCategory('income', '   ', empty)).toMatchObject({ ok: false });
    saveCustomCategories(r.custom);
    expect(JSON.parse(localStorage.getItem(CUSTOM_KEY)!)).toEqual({ income: [], expense: ['Parking fees'] });
    expect(loadCustomCategories()).toEqual({ income: [], expense: ['Parking fees'] });
  });

  it('broken storage reads as empty', () => {
    localStorage.setItem(CUSTOM_KEY, '{not json');
    expect(loadCustomCategories()).toEqual({ income: [], expense: [] });
  });
});
