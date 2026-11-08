// HMRC P6: the "Submit to HMRC (test environment)" section. The Edge Function and the database are mocked: nothing is
// sent to HMRC and nothing is written.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HmrcStatus } from '@/lib/hmrcConnection';

const st = vi.hoisted(() => ({
  prepare: vi.fn(), submit: vi.fn(), check: vi.fn(), history: vi.fn(), obligations: vi.fn(),
  org: { organizationId: 'org-x' as string | null, organization: { organizationId: 'org-x', name: 'Company X', role: 'owner' } as null | { organizationId: string; name: string; role: string },
    memberships: [{ organizationId: 'org-x', name: 'Company X', role: 'owner' }], loading: false },
  demo: false, status: null as unknown,
}));
vi.mock('@/lib/hmrcVatSubmit', async (orig) => ({
  ...(await orig<object>()),
  prepareReturn: (...a: unknown[]) => st.prepare(...a), submitReturn: (...a: unknown[]) => st.submit(...a), checkReturn: (...a: unknown[]) => st.check(...a),
  fetchSubmissions: (...a: unknown[]) => st.history(...a),
}));
vi.mock('@/lib/hmrcVat', async (orig) => ({ ...(await orig<object>()), getVatObligations: (...a: unknown[]) => st.obligations(...a) }));
vi.mock('@/components/hmrc/HMRCTestTools', () => ({ default: () => <div data-testid="test-tools">test tools</div> }));
vi.mock('@/contexts/OrganizationContext', () => ({ useActiveOrganization: () => st.org }));
vi.mock('@/contexts/demoModeState', () => ({ useDemoMode: () => ({ isDemo: st.demo, loading: false }) }));
vi.mock('@/lib/hmrcConnection', async (orig) => ({ ...(await orig<object>()), fetchHmrcStatus: async () => st.status }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: async () => ({ data: [], error: null }) } }));

import HMRCVATSubmit from './HMRCVATSubmit';
import HMRCVATReturns from './HMRCVATReturns';
import { receiptCsv, type SubmissionRecord } from '@/lib/hmrcVatSubmit';

const OPEN = { periodKey: '18A1', start: '2026-07-01', end: '2026-09-30', due: '2026-11-07', status: 'O', received: null };
const FIGURES = { periodKey: '18A1', vatDueSales: 205, vatDueAcquisitions: 0, totalVatDue: 205, vatReclaimedCurrPeriod: 60, netVatDue: 145,
  totalValueSalesExVAT: 1150, totalValuePurchasesExVAT: 450, totalValueGoodsSuppliedExVAT: 0, totalAcquisitionsExVAT: 0, finalised: true };
const PREPARED = { ok: true, obligation: OPEN, figures: FIGURES, boxes: { leftOut: [{ reason: 'vat_not_reclaimable', source: 'expenses', records: 1, vat: 3000 }] },
  blocking: [], blocking_messages: [], confirmation_token: 'v1.1762600000000.' + 'a'.repeat(64) + '.sig' };
const ROW: SubmissionRecord = {
  id: 's1', period_key: '18A1', period_start: '2026-07-01', period_end: '2026-09-30', status: 'accepted', figures: FIGURES, submitted_by_name: 'Ann Owner',
  submitted_at: '2026-11-08T10:00:00Z', completed_at: '2026-11-08T10:00:02Z', processing_date: '2026-11-08T10:00:01Z', payment_indicator: 'BANK',
  form_bundle_number: '256660290587', charge_ref_number: null, http_status: 201, error_code: null, error_message: null, vrn_last3: '789', test_scenario: null,
};
const connected = (scopes = ['read:vat', 'write:vat']): HmrcStatus => ({ kind: 'ok', canManage: true, production: false,
  connection: { environment: 'sandbox', status: 'connected', scopes, connected_by_name: 'A', connected_at: '2026-11-01', expires_at: null, needs_reconnect: false, updated_at: '2026-11-01' } as never });

const section = (access: 'ready' | 'not_connected' | 'scope_missing' = 'ready') => render(<MemoryRouter><HMRCVATSubmit companyId="org-x" companyName="Company X" access={access} /></MemoryRouter>);
const toPrepared = async () => {
  section();
  fireEvent.click(screen.getByTestId('vats-get-obligations'));
  await screen.findByLabelText('Open obligation');
  fireEvent.click(screen.getByTestId('vats-prepare'));
  return screen.findByTestId('vats-prepared');
};
const confirm = (key = '18A1') => {
  fireEvent.click(screen.getByTestId('vats-declaration'));
  fireEvent.change(screen.getByLabelText(/Type the period key/), { target: { value: key } });
};

beforeEach(() => {
  for (const f of [st.prepare, st.submit, st.check, st.history, st.obligations]) f.mockReset();
  st.history.mockResolvedValue({ rows: [] });
  st.obligations.mockResolvedValue({ ok: true, obligations: [OPEN] });
  st.prepare.mockResolvedValue(PREPARED);
  st.org = { organizationId: 'org-x', organization: { organizationId: 'org-x', name: 'Company X', role: 'owner' }, memberships: [{ organizationId: 'org-x', name: 'Company X', role: 'owner' }], loading: false };
  st.demo = false; st.status = connected();
});

describe('submit section', () => {
  it('the TEST ENVIRONMENT banner; prepared: the nine boxes, left-out counts, the declaration; Submit off until both are done', async () => {
    const prepared = await toPrepared();
    expect(screen.getByTestId('vats-banner')).toHaveTextContent('TEST ENVIRONMENT. Nothing here is filed with HMRC for real.');
    expect(st.prepare).toHaveBeenCalledWith('org-x', '18A1');
    expect(within(prepared).getByTestId('vats-box-1')).toHaveTextContent('205.00');
    expect(within(prepared).getByTestId('vats-box-5')).toHaveTextContent('145.00');
    expect(within(prepared).getByTestId('vats-box-6')).toHaveTextContent('1,150');
    expect(within(prepared).getByTestId('vats-left-out')).toHaveTextContent('1 expenses: VAT not reclaimable');
    expect(prepared).toHaveTextContent("I confirm that the information in this return is correct and complete to the best of my knowledge. I understand this is a submission to HMRC's test environment.");
    const submit = screen.getByTestId('vats-submit');
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByTestId('vats-declaration'));
    expect(submit).toBeDisabled(); // the key is not typed yet
    fireEvent.change(screen.getByLabelText(/Type the period key/), { target: { value: '18A2' } });
    expect(submit).toBeDisabled(); // the wrong key
    fireEvent.change(screen.getByLabelText(/Type the period key/), { target: { value: '18A1' } });
    expect(submit).toBeEnabled();
    fireEvent.click(screen.getByTestId('vats-declaration'));
    expect(submit).toBeDisabled(); // the declaration unticked again
    expect(st.submit).not.toHaveBeenCalled();
  });

  it('submitting: a spinner, then accepted with the receipt; a double click submits once; the history reloads', async () => {
    let answer!: (v: unknown) => void;
    st.submit.mockReturnValue(new Promise((r) => { answer = r; }));
    await toPrepared();
    confirm();
    fireEvent.click(screen.getByTestId('vats-submit'));
    fireEvent.click(screen.getByTestId('vats-submit'));
    expect(screen.getByTestId('vats-submit')).toHaveTextContent('Submitting to the test environment…');
    expect(st.submit).toHaveBeenCalledTimes(1);
    expect(st.submit).toHaveBeenCalledWith('org-x', '18A1', PREPARED.confirmation_token, null);
    st.history.mockResolvedValue({ rows: [ROW] });
    await act(async () => { answer({ ok: true, status: 'accepted', receipt: { processing_date: '2026-11-08T10:00:01Z', payment_indicator: 'BANK', form_bundle_number: '256660290587', charge_ref_number: null } }); });
    const ok = await screen.findByTestId('vats-accepted');
    expect(ok).toHaveTextContent('Form bundle number: 256660290587');
    expect(ok).toHaveTextContent('Payment indicator: BANK');
    expect(await screen.findAllByTestId('vats-history-row')).toHaveLength(1);
    expect(st.submit).toHaveBeenCalledTimes(1);
  });

  it('a scenario chosen in the picker is passed (test environment only)', async () => {
    st.submit.mockResolvedValue({ ok: true, status: 'rejected', message: "HMRC says this VAT period hasn't ended yet. Submit it after the period ends." });
    section();
    fireEvent.click(screen.getByTestId('vats-get-obligations'));
    fireEvent.change(await screen.findByLabelText(/Test scenario/), { target: { value: 'TAX_PERIOD_NOT_ENDED' } });
    fireEvent.click(screen.getByTestId('vats-prepare'));
    await screen.findByTestId('vats-prepared');
    confirm();
    fireEvent.click(screen.getByTestId('vats-submit'));
    expect(await screen.findByTestId('vats-rejected')).toHaveTextContent("HMRC says this VAT period hasn't ended yet.");
    expect(st.submit).toHaveBeenCalledWith('org-x', '18A1', PREPARED.confirmation_token, 'TAX_PERIOD_NOT_ENDED');
  });

  it('unknown: "Do not submit again. Check with HMRC", then the check; still open lets the owner record it was not received', async () => {
    st.submit.mockResolvedValue({ ok: true, status: 'unknown', message: 'x' });
    await toPrepared();
    confirm();
    fireEvent.click(screen.getByTestId('vats-submit'));
    const unknown = await screen.findByTestId('vats-unknown');
    expect(unknown).toHaveTextContent("We don't know if HMRC received it");
    expect(unknown).toHaveTextContent('Do not submit again. Check with HMRC.');
    expect(screen.queryByTestId('vats-submit')).toBeNull(); // the prepared return is gone: no resubmit from here
    st.check.mockResolvedValueOnce({ ok: true, status: 'still_open', message: 'HMRC still shows this period as open.' });
    fireEvent.click(screen.getByTestId('vats-check'));
    await waitFor(() => expect(screen.getByTestId('vats-not-received')).toBeInTheDocument());
    expect(st.check).toHaveBeenCalledWith('org-x', '18A1', false);
    st.check.mockResolvedValueOnce({ ok: true, status: 'rejected', message: 'Recorded: HMRC did not receive it. You can prepare and submit this period again.' });
    fireEvent.click(screen.getByTestId('vats-not-received'));
    expect(await screen.findByTestId('vats-rejected')).toHaveTextContent('Recorded: HMRC did not receive it.');
    expect(st.check).toHaveBeenLastCalledWith('org-x', '18A1', true);
  });

  it('check finds the period fulfilled: accepted, receipt unknown', async () => {
    st.submit.mockResolvedValue({ ok: true, status: 'unknown' });
    st.check.mockResolvedValue({ ok: true, status: 'accepted', receipt_known: false, message: 'HMRC shows this period as fulfilled, so the return was received. HMRC did not send us a receipt.' });
    await toPrepared();
    confirm();
    fireEvent.click(screen.getByTestId('vats-submit'));
    fireEvent.click(await screen.findByTestId('vats-check'));
    expect(await screen.findByTestId('vats-accepted')).toHaveTextContent('HMRC did not send us a receipt.');
  });

  it('blocking issues: no declaration or submit, the reasons listed', async () => {
    st.prepare.mockResolvedValue({ ...PREPARED, blocking: ['period_not_ended'], blocking_messages: ["This VAT period hasn't ended yet. Submit it after the period ends."], confirmation_token: null });
    await toPrepared();
    expect(screen.getByTestId('vats-blocking')).toHaveTextContent("This VAT period hasn't ended yet.");
    expect(screen.queryByTestId('vats-submit')).toBeNull();
    expect(screen.queryByTestId('vats-declaration')).toBeNull();
  });

  it('refusals from the server are shown in plain words (figures changed, already submitted)', async () => {
    st.submit.mockResolvedValue({ ok: false, code: 'figures_changed', message: 'Your records changed: review the return again.' });
    await toPrepared();
    confirm();
    fireEvent.click(screen.getByTestId('vats-submit'));
    expect(await screen.findByTestId('vats-said')).toHaveTextContent('Your records changed: review the return again.');
  });

  it('no open obligation: says so; prepare is not offered', async () => {
    st.obligations.mockResolvedValue({ ok: true, obligations: [{ ...OPEN, status: 'F' }] });
    section();
    fireEvent.click(screen.getByTestId('vats-get-obligations'));
    expect(await screen.findByTestId('vats-said')).toHaveTextContent('HMRC shows no open VAT obligations for this company.');
    expect(screen.queryByTestId('vats-prepare')).toBeNull();
  });

  it('not connected and scope missing: the message, the history still shown, no submit controls', async () => {
    const v = section('not_connected');
    expect(screen.getByTestId('vats-not-connected')).toHaveTextContent("Connect Company X to HMRC's test environment first");
    expect(screen.queryByTestId('vats-get-obligations')).toBeNull();
    expect(await screen.findByTestId('vats-history-empty')).toBeInTheDocument();
    v.unmount();
    section('scope_missing');
    expect(screen.getByTestId('vats-scope-missing')).toHaveTextContent('Connect to HMRC again');
  });

  it('history: period, who, status, receipt, scenario, no edit or delete; receipt CSV per row', async () => {
    st.history.mockResolvedValue({ rows: [ROW, { ...ROW, id: 's0', status: 'rejected', form_bundle_number: null, error_message: 'HMRC says this VAT period has not ended yet.', test_scenario: 'TAX_PERIOD_NOT_ENDED' }] });
    let blob: Blob | null = null;
    Object.assign(URL, { createObjectURL: vi.fn((b: Blob) => { blob = b; return 'blob:x'; }), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    section();
    const rows = await screen.findAllByTestId('vats-history-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('18A1');
    expect(rows[0]).toHaveTextContent('Ann Owner');
    expect(rows[0]).toHaveTextContent('Accepted');
    expect(rows[0]).toHaveTextContent('Form bundle 256660290587');
    expect(rows[1]).toHaveTextContent('Rejected');
    expect(rows[1]).toHaveTextContent('TAX_PERIOD_NOT_ENDED');
    expect(screen.queryByRole('button', { name: /delete|edit/i })).toBeNull();
    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Download receipt for 18A1' }));
    expect(click).toHaveBeenCalled();
    const text = await (blob as unknown as Blob).text();
    expect(text).toContain('Form bundle number,256660290587');
    click.mockRestore();
  });

  it('history not available yet (SQL not applied) and a load error', async () => {
    st.history.mockResolvedValue({ rows: [], notAvailable: true });
    const v = section();
    expect(await screen.findByTestId('vats-history-unavailable')).toBeInTheDocument();
    v.unmount();
    st.history.mockResolvedValue({ rows: [], error: true });
    section();
    expect(await screen.findByTestId('vats-history-error')).toBeInTheDocument();
  });

  it('the fraud-header check reuses the existing test tools (no VAT figures sent)', async () => {
    section();
    expect(within(screen.getByTestId('vats-fraud')).getByTestId('test-tools')).toBeInTheDocument();
  });
});

describe('receipt CSV', () => {
  it('the period, the nine boxes as sent, the receipt and the times; no token or full VAT number', () => {
    const csv = receiptCsv(ROW);
    expect(csv).toContain('HMRC TEST ENVIRONMENT: nothing filed for real');
    expect(csv).toContain('Period key,18A1');
    expect(csv).toContain('1,vatDueSales,205');
    expect(csv).toContain('5,netVatDue,145');
    expect(csv).toContain('6,totalValueSalesExVAT,1150');
    expect(csv).toContain('Processing date,2026-11-08T10:00:01Z');
    expect(csv).toContain('VAT number ends,789');
    expect(csv).not.toMatch(/Bearer|token|123456789/i);
  });
});

describe('on the VAT Returns tab', () => {
  const tab = () => render(<MemoryRouter><HMRCVATReturns /></MemoryRouter>);
  it('an owner of a sandbox-connected company sees the submit section', async () => {
    tab();
    expect(await screen.findByTestId('vats-section')).toBeInTheDocument();
  });
  it('member, Solo, demo and production see no submit section', async () => {
    const cases: [() => void, string][] = [
      [() => { st.org.organization = { organizationId: 'org-x', name: 'Company X', role: 'member' }; st.status = { ...connected(), canManage: false }; }, 'vatr-member'],
      [() => { st.status = { kind: 'ended', reason: 'plan_not_included' }; }, 'vatr-plan'],
      [() => { st.demo = true; }, 'vatr-demo'],
      [() => { st.status = { ...connected(), production: true }; }, 'vatr-production'],
    ];
    for (const [setup, testid] of cases) {
      setup();
      const v = tab();
      expect(await screen.findByTestId(testid)).toBeInTheDocument();
      expect(screen.queryByTestId('vats-section')).toBeNull();
      v.unmount();
      st.org.organization = { organizationId: 'org-x', name: 'Company X', role: 'owner' }; st.status = connected(); st.demo = false;
    }
  });
  it('write:vat missing: the "connect again" message in the section', async () => {
    st.status = connected(['read:vat']);
    tab();
    expect(await screen.findByTestId('vats-scope-missing')).toBeInTheDocument();
  });
});
