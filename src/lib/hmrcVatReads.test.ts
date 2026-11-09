// HMRC P8: the pure parts (reminder, pre-submit checks, date range, money) and the call wrapper. No network.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => st.invoke(...a) } } }));
vi.mock('@/lib/hmrcFraud', () => ({ collectHmrcFraudData: () => ({ deviceId: 'd' }) }));

import {
  callRead, CHECK_NOT_ADVICE, deadlineReminder, gbp, getLiabilities, lastAccepted, last365, NOT_AVAILABLE, preSubmitChecks, rangeProblem, reminderText, viewReturn,
} from './hmrcVatReads';
import type { SubmissionRecord } from './hmrcVatSubmit';

const ob = (periodKey: string, due: string, status: 'O' | 'F' = 'O') => ({ periodKey, start: '2026-07-01', end: '2026-09-30', due, status, received: null });
const F = { vatDueSales: 205, vatDueAcquisitions: 0, totalVatDue: 205, vatReclaimedCurrPeriod: 60, netVatDue: 145,
  totalValueSalesExVAT: 1150, totalValuePurchasesExVAT: 450, totalValueGoodsSuppliedExVAT: 0, totalAcquisitionsExVAT: 0 };

beforeEach(() => st.invoke.mockReset());

describe('deadline reminder', () => {
  const today = '2026-11-08';
  it('14, 7 and 1 days, today, and overdue; fulfilled and far-off returns give none', () => {
    expect(deadlineReminder([ob('A', '2026-11-22')], today)).toMatchObject({ level: 'due_14', days: 14 });
    expect(deadlineReminder([ob('A', '2026-11-23')], today)).toBeNull();
    expect(deadlineReminder([ob('A', '2026-11-15')], today)?.level).toBe('due_7');
    expect(deadlineReminder([ob('A', '2026-11-09')], today)?.level).toBe('due_1');
    expect(deadlineReminder([ob('A', '2026-11-08')], today)).toMatchObject({ level: 'due_1', days: 0 });
    expect(deadlineReminder([ob('A', '2026-11-07')], today)).toMatchObject({ level: 'overdue', days: -1 });
    expect(deadlineReminder([ob('A', '2026-11-07', 'F')], today)).toBeNull();
    expect(deadlineReminder(null, today)).toBeNull();
  });
  it('the most urgent one first, with a count of the others', () => {
    const r = deadlineReminder([ob('B', '2026-11-20'), ob('A', '2026-11-01'), ob('C', '2027-02-07')], today)!;
    expect(r).toMatchObject({ periodKey: 'A', level: 'overdue', others: 1 });
    expect(reminderText(r, '1 Nov 2026')).toBe('The VAT return for A was due on 1 Nov 2026 and HMRC still shows it as open. 1 more return is due soon or overdue.');
    expect(reminderText({ level: 'due_7', periodKey: 'B', due: '2026-11-15', days: 7, others: 0 }, '15 Nov 2026')).toBe('The VAT return for B is due in 7 days, on 15 Nov 2026.');
    expect(reminderText({ level: 'due_1', periodKey: 'B', due: '2026-11-08', days: 0, others: 0 }, '8 Nov 2026')).toBe('The VAT return for B is due today (8 Nov 2026).');
  });
});

describe('pre-submit checks', () => {
  it('a consistent return has no checks', () => {
    expect(preSubmitChecks(F)).toEqual([]);
    expect(preSubmitChecks(null)).toEqual([]);
  });
  it('box 3 ≠ box 1 + box 2 blocks (HMRC rejects it)', () => {
    expect(preSubmitChecks({ ...F, totalVatDue: 200 })).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'box3_sum', block: true })]));
  });
  it('box 5 ≠ |box 3 − box 4| blocks; a negative box 5 blocks; other boxes may be negative', () => {
    expect(preSubmitChecks({ ...F, netVatDue: 140 })).toEqual([expect.objectContaining({ rule: 'box5_net', block: true })]);
    expect(preSubmitChecks({ ...F, netVatDue: -145 })).toEqual([expect.objectContaining({ rule: 'box5_negative', block: true })]);
    expect(preSubmitChecks({ ...F, vatDueSales: -5, totalVatDue: -5, vatReclaimedCurrPeriod: 60, netVatDue: 65, totalValueSalesExVAT: -20 })).toEqual([]);
    expect(preSubmitChecks({ ...F, vatDueSales: 0.1, vatDueAcquisitions: 0.2, totalVatDue: 0.3, vatReclaimedCurrPeriod: 0, netVatDue: 0.3 })).toEqual([]);
  });
  it('more than a 50% change from the last accepted return warns, without blocking', () => {
    const c = preSubmitChecks({ ...F, vatDueSales: 400, totalVatDue: 400, netVatDue: 340 }, F);
    expect(c.every((x) => !x.block)).toBe(true);
    expect(c.map((x) => x.message)).toEqual([
      'Box 1 (vat due on sales) is 95% higher than in your last accepted return. Check it\'s right.',
      'Box 3 (total vat due) is 95% higher than in your last accepted return. Check it\'s right.',
      'Box 5 (net vat) is 134% higher than in your last accepted return. Check it\'s right.',
    ]);
    expect(preSubmitChecks({ ...F, vatDueSales: 300, totalVatDue: 300, netVatDue: 240 }, F).map((x) => x.rule)).toEqual(['big_change']);
    expect(preSubmitChecks(F, { ...F, totalValueGoodsSuppliedExVAT: 0 })).toEqual([]);
    expect(CHECK_NOT_ADVICE).toBe('This is a check, not tax advice.');
  });
  it('the last accepted return is another period\'s', () => {
    const row = (id: string, period_key: string, status: SubmissionRecord['status']) => ({ id, period_key, status }) as SubmissionRecord;
    expect(lastAccepted([row('1', '18A2', 'rejected'), row('2', '18A2', 'accepted'), row('3', '18A1', 'accepted')], '18A2')?.id).toBe('3');
    expect(lastAccepted([], '18A1')).toBeNull();
  });
});

describe('dates and money', () => {
  it('a default of 365 days to today; checks before HMRC is asked', () => {
    expect(last365(new Date(2026, 10, 8))).toEqual({ from: '2025-11-09', to: '2026-11-08' });
    expect(rangeProblem('2025-11-09', '2026-11-08', '2026-11-08')).toBe('');
    expect(rangeProblem('2025-11-08', '2026-11-08', '2026-11-08')).toBe('HMRC allows at most 365 days at a time.');
    expect(rangeProblem('2026-11-01', '2026-11-09', '2026-11-08')).toBe('Choose an end date up to today.');
    expect(rangeProblem('2026-02-01', '2026-01-01', '2026-11-08')).toBe('Choose a start date on or before the end date.');
  });
  it('GBP', () => {
    expect(gbp(463872)).toBe('£463,872.00');
    expect(gbp(-5.5)).toBe('−£5.50');
    expect(gbp(null)).toBe('—');
  });
});

describe('calls', () => {
  it('sends the company, the query and the fraud data; never figures', async () => {
    st.invoke.mockResolvedValue({ data: { ok: true, liabilities: [] }, error: null });
    await getLiabilities('org-x', '2026-01-01', '2026-02-01', 'SINGLE_LIABILITY');
    expect(st.invoke).toHaveBeenCalledWith('hmrc-vat-liabilities', { body: { company_id: 'org-x', from: '2026-01-01', to: '2026-02-01', scenario: 'SINGLE_LIABILITY', fraud: { deviceId: 'd' } } });
    await viewReturn('org-x', '18A1');
    expect(st.invoke).toHaveBeenLastCalledWith('hmrc-vat-return-view', { body: { company_id: 'org-x', period_key: '18A1', fraud: { deviceId: 'd' } } });
  });
  it('not deployed (404 or unreachable) is "not available yet"; a refusal keeps its code and message', async () => {
    st.invoke.mockResolvedValue({ data: null, error: { context: { status: 404 } } });
    expect(await callRead('hmrc-vat-payments', {})).toEqual({ ok: false, code: 'not_available', message: NOT_AVAILABLE });
    st.invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError' } });
    expect((await callRead('hmrc-vat-payments', {})).code).toBe('not_available');
    st.invoke.mockRejectedValue(new Error('boom'));
    expect((await callRead('hmrc-vat-payments', {})).code).toBe('not_available');
    st.invoke.mockResolvedValue({ data: null, error: { context: { status: 429, json: async () => ({ ok: false, code: 'read_limit', message: 'You can do this 10 times an hour for this company. Please try again later.' }) } } });
    expect(await callRead('hmrc-vat-payments', {})).toMatchObject({ ok: false, code: 'read_limit', message: 'You can do this 10 times an hour for this company. Please try again later.' });
  });
});
