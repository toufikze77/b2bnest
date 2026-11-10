// HMRC P8: "Check what HMRC holds", the receipt, liabilities and payments, penalties, the deadline reminder and the
// pre-submit checks. The Edge Functions and the database are mocked: nothing is sent to HMRC and nothing is written.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HmrcStatus } from '@/lib/hmrcConnection';

const st = vi.hoisted(() => ({
  prepare: vi.fn(), history: vi.fn(), obligations: vi.fn(), view: vi.fn(), liabilities: vi.fn(), payments: vi.fn(), penalties: vi.fn(),
  org: { organizationId: 'org-x' as string | null, organization: { organizationId: 'org-x', name: 'Company X', role: 'owner' } as null | { organizationId: string; name: string; role: string },
    memberships: [{ organizationId: 'org-x', name: 'Company X', role: 'owner' }], loading: false },
  status: null as unknown,
}));
// HMRC hide switch: these tests cover the HMRC features as shown (visible); the hidden state is in hmrcHide.test.tsx.
vi.mock('@/lib/hmrcAccess', async (orig) => ({ ...(await orig<object>()), useHmrcCustomerAccess: () => ({ loading: false, state: 'visible', tester: false, canUse: true }) }));
vi.mock('@/lib/hmrcVatSubmit', async (orig) => ({ ...(await orig<object>()), prepareReturn: (...a: unknown[]) => st.prepare(...a), fetchSubmissions: (...a: unknown[]) => st.history(...a) }));
vi.mock('@/lib/hmrcVat', async (orig) => ({ ...(await orig<object>()), getVatObligations: (...a: unknown[]) => st.obligations(...a) }));
vi.mock('@/lib/hmrcVatReads', async (orig) => ({
  ...(await orig<object>()),
  viewReturn: (...a: unknown[]) => st.view(...a), getLiabilities: (...a: unknown[]) => st.liabilities(...a),
  getPayments: (...a: unknown[]) => st.payments(...a), getPenalties: (...a: unknown[]) => st.penalties(...a),
}));
vi.mock('@/components/hmrc/HMRCTestTools', () => ({ default: () => <div /> }));
vi.mock('@/contexts/OrganizationContext', () => ({ useActiveOrganization: () => st.org }));
vi.mock('@/contexts/demoModeState', () => ({ useDemoMode: () => ({ isDemo: false, loading: false }) }));
vi.mock('@/lib/hmrcConnection', async (orig) => ({ ...(await orig<object>()), fetchHmrcStatus: async () => st.status }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: async () => ({ data: [], error: null }) } }));

import HMRCVATSubmit from './HMRCVATSubmit';
import HMRCVATReturns from './HMRCVATReturns';
import HMRCVATAccount, { HMRCDeadlineBanner } from './HMRCVATReads';
import type { SubmissionRecord } from '@/lib/hmrcVatSubmit';

const FIGURES = { periodKey: '18A1', vatDueSales: 205, vatDueAcquisitions: 0, totalVatDue: 205, vatReclaimedCurrPeriod: 60, netVatDue: 145,
  totalValueSalesExVAT: 1150, totalValuePurchasesExVAT: 450, totalValueGoodsSuppliedExVAT: 0, totalAcquisitionsExVAT: 0, finalised: true };
const ROW: SubmissionRecord = {
  id: 's1', period_key: '18A1', period_start: '2026-07-01', period_end: '2026-09-30', status: 'accepted', figures: FIGURES, submitted_by_name: 'Ann Owner',
  submitted_at: '2026-11-08T10:00:00Z', completed_at: '2026-11-08T10:00:02Z', processing_date: '2026-11-08T10:00:01Z', payment_indicator: 'BANK',
  form_bundle_number: '256660290587', charge_ref_number: null, http_status: 201, error_code: null, error_message: null, vrn_last3: '789', test_scenario: null,
};
const OPEN = { periodKey: '18A2', start: '2026-10-01', end: '2026-12-31', due: '2027-02-07', status: 'O' as const, received: null };
const connected = (): HmrcStatus => ({ kind: 'ok', canManage: true, production: false,
  connection: { environment: 'sandbox', status: 'connected', scopes: ['read:vat', 'write:vat'], connected_by_name: 'A', connected_at: '2026-11-01', expires_at: null, needs_reconnect: false } as never });
const section = () => render(<MemoryRouter><HMRCVATSubmit companyId="org-x" companyName="Company X" access="ready" /></MemoryRouter>);

beforeEach(() => {
  for (const f of [st.prepare, st.history, st.obligations, st.view, st.liabilities, st.payments, st.penalties]) f.mockReset();
  st.history.mockResolvedValue({ rows: [ROW] });
  st.obligations.mockResolvedValue({ ok: true, obligations: [OPEN] });
  st.status = connected();
});

describe('check what HMRC holds', () => {
  it('matches, with loading; only for accepted submissions', async () => {
    let resolve: (v: unknown) => void = () => {};
    st.view.mockReturnValue(new Promise((r) => { resolve = r; }));
    st.history.mockResolvedValue({ rows: [ROW, { ...ROW, id: 's2', period_key: '18A2', status: 'rejected' }] });
    section();
    const buttons = await screen.findAllByTestId('vats-hmrc-check');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(buttons[0]).toBeDisabled();
    expect(st.view).toHaveBeenCalledWith('org-x', '18A1');
    resolve({ ok: true, matches: true, differences: [] });
    expect(await screen.findByTestId('vats-hmrc-matches')).toHaveTextContent('Matches what you sent.');
  });
  it('the differing boxes', async () => {
    st.view.mockResolvedValue({ ok: true, matches: false, differences: [{ box: 1, field: 'vatDueSales', ours: 205, hmrc: 200 }, { box: 6, field: 'totalValueSalesExVAT', ours: 1150, hmrc: null }] });
    section();
    fireEvent.click(await screen.findByTestId('vats-hmrc-check'));
    const d = await screen.findByTestId('vats-hmrc-differs');
    expect(d).toHaveTextContent('HMRC holds different figures for 2 boxes');
    expect(d).toHaveTextContent('Box 1: you sent 205.00, HMRC holds 200.00');
    expect(d).toHaveTextContent('Box 6: you sent 1,150, HMRC holds —');
  });
  it('not available yet, and errors', async () => {
    st.view.mockResolvedValue({ ok: false, code: 'not_available', message: "This isn't available yet." });
    section();
    fireEvent.click(await screen.findByTestId('vats-hmrc-check'));
    expect(await screen.findByTestId('vats-hmrc-check-not-available')).toHaveTextContent("This isn't available yet.");
    st.view.mockResolvedValue({ ok: false, code: 'return_not_found', message: 'HMRC has no return for this period.' });
    fireEvent.click(screen.getByTestId('vats-hmrc-check'));
    expect(await screen.findByTestId('vats-hmrc-check-error')).toHaveTextContent('HMRC has no return for this period.');
  });
});

describe('receipt', () => {
  it('built from the stored row, no HMRC call; prints only the receipt', async () => {
    section();
    fireEvent.click(await screen.findByTestId('vats-receipt-open'));
    const r = screen.getByTestId('vats-receipt');
    expect(r).toHaveTextContent('VAT return receipt: 18A1');
    expect(r).toHaveTextContent('HMRC TEST ENVIRONMENT (sandbox): nothing was filed with HMRC for real.');
    expect(r).toHaveTextContent('Company X');
    expect(r).toHaveTextContent('…789');
    expect(within(r).getByTestId('vats-receipt-bundle')).toHaveTextContent('256660290587');
    expect(within(r).getByTestId('vats-receipt-box-1')).toHaveTextContent('205.00');
    expect(within(r).getByTestId('vats-receipt-box-6')).toHaveTextContent('1,150');
    expect(r).toHaveTextContent('Sent via B2BNEST to HMRC');
    expect(r).toHaveTextContent('1 Jul 2026 to 30 Sept 2026');
    expect(st.view).not.toHaveBeenCalled();
    const print = vi.fn(() => { expect(document.body.classList.contains('print-hmrc-receipt')).toBe(true); });
    window.print = print;
    fireEvent.click(within(r).getByTestId('vats-receipt-print'));
    expect(print).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('afterprint'));
    expect(document.body.classList.contains('print-hmrc-receipt')).toBe(false);
  });
});

describe('pre-submit checks', () => {
  const prepareWith = async (figures: object) => {
    st.prepare.mockResolvedValue({ ok: true, obligation: OPEN, figures, boxes: { leftOut: [] }, blocking: [], blocking_messages: [], confirmation_token: 'tok' });
    section();
    await screen.findByTestId('vats-history-row');
    fireEvent.click(screen.getByTestId('vats-get-obligations'));
    await screen.findByLabelText('Open obligation');
    fireEvent.click(screen.getByTestId('vats-prepare'));
    await screen.findByTestId('vats-prepared');
    fireEvent.click(screen.getByTestId('vats-declaration'));
    fireEvent.change(screen.getByLabelText(/Type the period key/), { target: { value: '18A2' } });
  };
  it('a big change from the last accepted return warns and does not block', async () => {
    await prepareWith({ ...FIGURES, periodKey: '18A2', vatDueSales: 500, totalVatDue: 500, netVatDue: 440 });
    const c = screen.getByTestId('vats-checks');
    expect(c).toHaveTextContent('Check these figures before you submit');
    expect(within(c).getAllByTestId('vats-check-big_change').length).toBeGreaterThan(0);
    expect(c).toHaveTextContent('This is a check, not tax advice.');
    expect(screen.getByTestId('vats-submit')).toBeEnabled();
  });
  it('what HMRC itself rejects blocks the submit button', async () => {
    await prepareWith({ ...FIGURES, periodKey: '18A2', netVatDue: 100 });
    expect(screen.getByTestId('vats-checks')).toHaveTextContent('HMRC would reject this return');
    expect(screen.getByTestId('vats-check-box5_net')).toBeInTheDocument();
    expect(screen.getByTestId('vats-submit')).toBeDisabled();
  });
  it('a consistent return has no checks', async () => {
    await prepareWith({ ...FIGURES, periodKey: '18A2' });
    expect(screen.queryByTestId('vats-checks')).toBeNull();
    expect(screen.getByTestId('vats-submit')).toBeEnabled();
  });
});

describe('what you owe and what HMRC received; penalties', () => {
  const account = () => render(<HMRCVATAccount companyId="org-x" ready />);
  it('liabilities and payments in GBP for a date range, with the sandbox note', async () => {
    st.liabilities.mockResolvedValue({ ok: true, liabilities: [{ taxPeriod: { from: '2017-01-01', to: '2017-02-01' }, type: 'VAT Return Debit Charge', originalAmount: 463872, outstandingAmount: 463872, due: '2017-05-12' }] });
    st.payments.mockResolvedValue({ ok: true, payments: [{ amount: 5, received: '2017-02-11' }] });
    account();
    expect(screen.getByTestId('vata-sandbox-note')).toHaveTextContent("test environment (sandbox), so they are test data");
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2017-01-02' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2017-02-02' } });
    fireEvent.change(screen.getByLabelText('Liabilities test scenario'), { target: { value: 'SINGLE_LIABILITY' } });
    fireEvent.click(screen.getByTestId('vata-load'));
    expect(st.liabilities).toHaveBeenCalledWith('org-x', '2017-01-02', '2017-02-02', 'SINGLE_LIABILITY');
    expect(st.payments).toHaveBeenCalledWith('org-x', '2017-01-02', '2017-02-02', undefined);
    const row = await screen.findByTestId('vata-liability-row');
    expect(row).toHaveTextContent('VAT Return Debit Charge');
    expect(row).toHaveTextContent('£463,872.00');
    expect(screen.getByTestId('vata-payment-row')).toHaveTextContent('£5.00');
  });
  it('a bad range is refused before HMRC is asked; empty and "not available yet" states', async () => {
    account();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2021-06-01' } });
    expect(screen.getByTestId('vata-range-error')).toHaveTextContent('HMRC allows at most 365 days at a time.');
    expect(screen.getByTestId('vata-load')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2021-01-01' } });
    st.liabilities.mockResolvedValue({ ok: true, liabilities: [] });
    st.payments.mockResolvedValue({ ok: false, code: 'not_available', message: "This isn't available yet." });
    fireEvent.click(screen.getByTestId('vata-load'));
    expect(await screen.findByTestId('vata-liabilities-empty')).toHaveTextContent('HMRC shows no liabilities for these dates.');
    expect(screen.getByTestId('vata-payments-error')).toHaveTextContent("This isn't available yet.");
  });
  it('penalties: the "check your HMRC account" note, totals, and none', async () => {
    st.penalties.mockResolvedValue({ ok: true, penalties: { totalisations: { lateSubmissionPenaltyTotalValue: 200 }, lateSubmission: { summary: { activePenaltyPoints: 1 }, details: [{ penaltyNumber: '123456789', penaltyStatus: 'ACTIVE' }] }, latePayment: { details: [] } } });
    account();
    expect(screen.getByTestId('vatp-note')).toHaveTextContent('This is what HMRC shows. Check your HMRC account for the final position.');
    fireEvent.click(screen.getByTestId('vatp-load'));
    expect(await screen.findByTestId('vatp-totals')).toHaveTextContent('Late submission penalties£200.00');
    expect(screen.getByTestId('vatp-lsp-summary')).toHaveTextContent('Active penalty points1');
    expect(screen.getByText('Late submission penalty 123456789')).toBeInTheDocument();
    st.penalties.mockResolvedValue({ ok: true, penalties: { totalisations: {}, lateSubmission: { summary: {}, details: [] }, latePayment: { details: [] } } });
    fireEvent.click(screen.getByTestId('vatp-load'));
    expect(await screen.findByTestId('vatp-none')).toHaveTextContent('HMRC shows no penalties.');
  });
  it('not connected: no buttons', () => {
    render(<HMRCVATAccount companyId="org-x" ready={false} />);
    expect(screen.getByTestId('vata-not-connected')).toBeInTheDocument();
    expect(screen.queryByTestId('vata-load')).toBeNull();
  });
});

describe('deadline reminder', () => {
  it('banner levels; nothing without open obligations due within 14 days', () => {
    const { rerender } = render(<HMRCDeadlineBanner obligations={[{ ...OPEN, due: '2026-11-07' }]} today="2026-11-08" />);
    expect(screen.getByTestId('vatr-reminder-overdue')).toHaveTextContent('A VAT return is overdue');
    rerender(<HMRCDeadlineBanner obligations={[{ ...OPEN, due: '2026-11-15' }]} today="2026-11-08" />);
    expect(screen.getByTestId('vatr-reminder-due_7')).toHaveTextContent('due in 7 days');
    rerender(<HMRCDeadlineBanner obligations={[{ ...OPEN, due: '2026-12-31' }]} today="2026-11-08" />);
    expect(screen.queryByTestId(/vatr-reminder/)).toBeNull();
  });
  it('the page shows it once the submit section has read the open obligations (no extra HMRC call)', async () => {
    const soon = new Date(); soon.setDate(soon.getDate() + 3);
    const due = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
    st.obligations.mockResolvedValue({ ok: true, obligations: [{ ...OPEN, due }] });
    render(<MemoryRouter><HMRCVATReturns /></MemoryRouter>);
    fireEvent.click(await screen.findByTestId('vats-get-obligations'));
    await waitFor(() => expect(screen.getByTestId('vatr-reminder-due_7')).toHaveTextContent('due in 3 days'));
    expect(st.obligations).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('vata-section')).toBeInTheDocument();
  });
});
