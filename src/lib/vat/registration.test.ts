import { describe, expect, it } from 'vitest';
import { expenseVatMode, registrationFromStatus, vatFreeExpenseValues, vatRegisteredOn } from './registration';

describe('VAT registered on a date (same rule as _ledger_auto_vat_registered)', () => {
  it('not registered: never', () => expect(vatRegisteredOn({ vat_registered: false, vat_registered_from: null }, '2026-11-01')).toBe(false));
  it('registered with no date: always', () => expect(vatRegisteredOn({ vat_registered: true, vat_registered_from: null }, '2001-01-01')).toBe(true));
  it('registered from a date: on or after only', () => {
    const r = { vat_registered: true, vat_registered_from: '2026-03-01' };
    expect(vatRegisteredOn(r, '2026-02-28')).toBe(false);
    expect(vatRegisteredOn(r, '2026-03-01')).toBe(true);
    expect(vatRegisteredOn(r, '')).toBe(true);
  });
});

describe('ledger_auto_status → registration', () => {
  it('reads the two keys (No for a company with no settings row: the RPC answers false)', () => {
    expect(registrationFromStatus({ vat_registered: false, vat_registered_from: null })).toEqual({ vat_registered: false, vat_registered_from: null });
    expect(registrationFromStatus({ vat_registered: true, vat_registered_from: '2026-01-01' })).toEqual({ vat_registered: true, vat_registered_from: '2026-01-01' });
  });
  it('unknown when the key is missing (SQL not applied) or there is no result', () => {
    expect(registrationFromStatus({})).toBeUndefined();
    expect(registrationFromStatus(null)).toBeUndefined();
  });
});

describe('which expense form', () => {
  const NO = { vat_registered: false, vat_registered_from: null };
  it('unknown or registered: the full form', () => {
    expect(expenseVatMode(undefined, '2026-11-01')).toBe('full');
    expect(expenseVatMode({ vat_registered: true, vat_registered_from: null }, '2026-11-01')).toBe('full');
  });
  it('not registered: no VAT questions, unless the expense already has VAT recorded', () => {
    expect(expenseVatMode(NO, '2026-11-01')).toBe('none');
    expect(expenseVatMode(NO, '2026-11-01', { vat_status: 'not_recorded', vat_amount: null })).toBe('none');
    expect(expenseVatMode(NO, '2026-11-01', { vat_status: 'recorded', vat_amount: 0 })).toBe('none');
    expect(expenseVatMode(NO, '2026-11-01', { vat_status: 'recorded', vat_amount: '5.00' })).toBe('recorded');
  });
  it('VAT-free values: Outside the scope, including VAT, no override, not reclaimable; a recorded zero-VAT treatment is kept', () => {
    expect(vatFreeExpenseValues({ amount: '30', vat_treatment: 'standard', vat_entry: 'excluding', vat_override: '6', vat_reclaimable: true }))
      .toEqual({ amount: '30', vat_treatment: 'outside_scope', vat_entry: 'including', vat_override: '', vat_reclaimable: false });
    expect(vatFreeExpenseValues({ amount: '30' }, { vat_status: 'recorded', vat_treatment: 'zero' }).vat_treatment).toBe('zero');
    expect(vatFreeExpenseValues({ amount: '30' }, { vat_status: 'not_recorded', vat_treatment: 'zero' }).vat_treatment).toBe('outside_scope');
  });
});
