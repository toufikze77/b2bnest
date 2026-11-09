// HMRC P5: the VAT return preview screen. Supabase and HMRC are mocked: nothing is sent, filed or stored.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HmrcStatus } from '@/lib/hmrcConnection';

const st = vi.hoisted(() => ({
  org: { organizationId: 'org-x' as string | null, organization: { organizationId: 'org-x', name: 'Company X', role: 'owner' } as null | { organizationId: string; name: string; role: string },
    memberships: [{ organizationId: 'org-x', name: 'Company X', role: 'owner' }], loading: false },
  demo: false,
  status: null as unknown,
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  rpc: null as null | ((args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>),
  obligations: vi.fn(),
}));
// HMRC hide switch: these tests cover the HMRC features as shown (visible); the hidden state is in hmrcHide.test.tsx.
vi.mock('@/lib/hmrcAccess', async (orig) => ({ ...(await orig<object>()), useHmrcCustomerAccess: () => ({ loading: false, state: 'visible', tester: false, canUse: true }) }));
vi.mock('@/contexts/OrganizationContext', () => ({ useActiveOrganization: () => st.org }));
vi.mock('@/contexts/demoModeState', () => ({ useDemoMode: () => ({ isDemo: st.demo, loading: false }) }));
vi.mock('@/lib/hmrcConnection', async (orig) => ({ ...(await orig<object>()), fetchHmrcStatus: async () => st.status }));
vi.mock('@/lib/hmrcVat', async (orig) => ({ ...(await orig<object>()), getVatObligations: (...a: unknown[]) => st.obligations(...a) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async (fn: string, args: Record<string, unknown>) => { st.rpcCalls.push({ fn, args }); return st.rpc ? st.rpc(args) : { data: [], error: null }; } },
}));

import HMRCVATReturns from './HMRCVATReturns';

const connected: HmrcStatus = { kind: 'ok', canManage: true, production: false,
  connection: { environment: 'sandbox', status: 'connected', scopes: ['read:vat'], connected_by_name: 'A', connected_at: '2026-11-01', expires_at: null, needs_reconnect: false, updated_at: '2026-11-01' } as never };
const notConnected: HmrcStatus = { kind: 'ok', canManage: true, production: false, connection: null };
const inc = (source: string, treatment: string, records: number, net: number, vat: number, nr = 0) => ({ row_kind: 'included', source, treatment, reason: null, records, net, vat, vat_not_reclaimable: nr });
const out = (source: string, reason: string, records: number, nr = 0) => ({ row_kind: 'left_out', source, treatment: null, reason, records, net: 0, vat: 0, vat_not_reclaimable: nr });
// The README's worked example.
const EXAMPLE = [
  inc('invoices', 'standard', 1, 1000, 200), inc('invoices', 'reduced', 1, 100, 5), inc('invoices', 'zero', 1, 50, 0), inc('invoices', 'outside_scope', 1, 300, 0),
  inc('expenses', 'standard', 2, 450, 60, 30),
  out('expenses', 'vat_not_reclaimable', 1, 30), out('invoices', 'not_recorded', 2), out('bills', 'no_company', 1), out('invoices', 'not_gbp', 1),
];

const view = () => render(<MemoryRouter><HMRCVATReturns /></MemoryRouter>);
const setDates = async (from: string, to: string) => {
  fireEvent.change(await screen.findByLabelText('From'), { target: { value: from } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: to } });
};

beforeEach(() => {
  st.org = { organizationId: 'org-x', organization: { organizationId: 'org-x', name: 'Company X', role: 'owner' }, memberships: [{ organizationId: 'org-x', name: 'Company X', role: 'owner' }], loading: false };
  st.demo = false; st.status = notConnected; st.rpc = null; st.rpcCalls.length = 0; st.obligations.mockReset();
});

describe('who sees what', () => {
  it('a member: "Only owners and admins can see the VAT return", no controls', async () => {
    st.org.organization = { organizationId: 'org-x', name: 'Company X', role: 'member' };
    st.status = { ...connected, canManage: false };
    view();
    expect(await screen.findByTestId('vatr-member')).toHaveTextContent('Only owners and admins can see the VAT return.');
    expect(screen.queryByTestId('vatr-show')).toBeNull();
  });
  it('Solo: the plan message', async () => {
    st.status = { kind: 'ended', reason: 'plan_not_included' };
    view();
    expect(await screen.findByTestId('vatr-plan')).toHaveTextContent('HMRC tools are included in the Business and Scale plans.');
    expect(screen.queryByTestId('vatr-show')).toBeNull();
  });
  it('demo: no VAT return controls, and nothing is asked of the database', async () => {
    st.demo = true;
    view();
    expect(await screen.findByTestId('vatr-demo')).toBeInTheDocument();
    expect(screen.queryByTestId('vatr-show')).toBeNull();
    expect(st.rpcCalls).toHaveLength(0);
  });
  it('a production connection: "Production is not available yet."', async () => {
    st.status = { ...connected, production: true };
    view();
    expect(await screen.findByTestId('vatr-production')).toHaveTextContent('Production is not available yet.');
  });
  it('loading: while the company or access is being checked', async () => {
    st.org.loading = true;
    const v = view();
    expect(screen.getByTestId('vatr-loading')).toBeInTheDocument();
    v.unmount();
    st.org.loading = false;
    st.status = new Promise(() => {}) as never; // never answers
    view();
    expect(screen.getByTestId('vatr-checking')).toBeInTheDocument();
  });
});

describe('the preview', () => {
  it('not connected: chosen dates still work, marked not confirmed by HMRC; the obligation choice is off', async () => {
    st.rpc = async () => ({ data: EXAMPLE, error: null });
    view();
    await screen.findByTestId('vatr-show');
    expect(screen.getByLabelText(/Use an HMRC obligation/)).toBeDisabled();
    expect(screen.getByTestId('vatr-not-confirmed')).toHaveTextContent('Dates you choose are not confirmed by HMRC.');
    await setDates('2026-07-01', '2026-09-30');
    fireEvent.click(screen.getByTestId('vatr-show'));
    await screen.findByTestId('vatr-result');
    expect(st.rpcCalls).toEqual([{ fn: 'vat_company_return_preview', args: { p_organization_id: 'org-x', p_from: '2026-07-01', p_to: '2026-09-30' } }]);
    expect(screen.getByText('Not confirmed by HMRC')).toBeInTheDocument();
  });

  it('success: the nine boxes with explanations, to pay, totals per treatment, and no submit button', async () => {
    st.rpc = async () => ({ data: EXAMPLE, error: null });
    view();
    await setDates('2026-07-01', '2026-09-30');
    fireEvent.click(await screen.findByTestId('vatr-show'));
    await screen.findByTestId('vatr-result');
    const box = (n: number) => screen.getByTestId(`vatr-box-${n}`);
    expect(box(1)).toHaveTextContent('205.00');
    expect(box(1)).toHaveTextContent('Box 1 = VAT on standard and reduced sales lines recorded in this period.');
    expect(box(2)).toHaveTextContent('0.00');
    expect(box(2)).toHaveTextContent('not supported yet');
    expect(box(3)).toHaveTextContent('205.00');
    expect(box(4)).toHaveTextContent('60.00');
    expect(box(5)).toHaveTextContent('145.00');
    expect(screen.getByTestId('vatr-direction')).toHaveTextContent('to pay');
    expect(box(6)).toHaveTextContent('1,150');
    expect(box(7)).toHaveTextContent('450');
    expect(box(8)).toHaveTextContent('not supported yet');
    const how = screen.getByTestId('vatr-how');
    expect(within(how).getByText('Outside scope')).toBeInTheDocument();
    expect(within(how).getByText('£300.00')).toBeInTheDocument();
    expect(within(how).getByText('£30.00')).toBeInTheDocument(); // VAT not reclaimable
    expect(screen.queryByRole('button', { name: /submit/i })).toBeNull();
    expect(document.body.textContent).not.toMatch(/ready to file|MTD ready|Making Tax Digital ready/i);
    expect(screen.getByText(/^Preview only: nothing is sent to HMRC\./)).toBeInTheDocument();
    expect(screen.getByText('HMRC filing is not available yet. Nothing has been sent to HMRC.')).toBeInTheDocument();
  });

  it('the left-out panel: counts, reasons and links to fix them; warnings', async () => {
    st.rpc = async () => ({ data: EXAMPLE, error: null });
    view();
    await setDates('2026-07-01', '2026-09-30');
    fireEvent.click(await screen.findByTestId('vatr-show'));
    const panel = await screen.findByTestId('vatr-left-out');
    expect(within(panel).getByTestId('vatr-left-invoices-not_recorded')).toHaveTextContent('2 invoices: VAT details not recorded');
    expect(within(within(panel).getByTestId('vatr-left-invoices-not_recorded')).getByRole('link', { name: 'Finance → Invoices' })).toHaveAttribute('href', '/business-tools?tool=business-finance-assistant&tab=invoices');
    expect(within(panel).getByTestId('vatr-left-bills-no_company')).toHaveTextContent('1 bill: Not linked to a company');
    expect(within(within(panel).getByTestId('vatr-left-bills-no_company')).getByRole('link', { name: 'Finance → Company records' })).toHaveAttribute('href', '/business-tools?tool=business-finance-assistant&tab=company-records');
    expect(within(panel).getByTestId('vatr-left-expenses-vat_not_reclaimable')).toHaveTextContent('1 expense: VAT not reclaimable (purchase counted in box 7, VAT not in box 4) (£30.00 of VAT)');
    expect(within(panel).getByTestId('vatr-left-invoices-not_gbp')).toHaveTextContent('1 invoice: Not in GBP');
    const warnings = within(panel).getByTestId('vatr-warnings');
    expect(warnings).toHaveTextContent('2 records dated in this period have no VAT details and are left out.');
    expect(warnings).toHaveTextContent('1 record by members of this company is not linked to a company and left out.');
    expect(warnings).toHaveTextContent('1 record not in GBP is left out');
    expect(warnings).toHaveTextContent('Boxes 2, 8 and 9 (EU and Northern Ireland trade) are not supported yet and show 0.');
    expect(warnings).toHaveTextContent('B2BNEST has no credit notes');
    expect(warnings).not.toHaveTextContent('has not ended yet');
  });

  it('a period that has not ended yet is flagged', async () => {
    view();
    await setDates('2026-01-01', '2099-12-31');
    fireEvent.click(await screen.findByTestId('vatr-show'));
    expect(await screen.findByTestId('vatr-warnings')).toHaveTextContent('This period has not ended yet');
  });

  it('empty: no recorded records, every box 0', async () => {
    st.rpc = async () => ({ data: [], error: null });
    view();
    fireEvent.click(await screen.findByTestId('vatr-show'));
    expect(await screen.findByTestId('vatr-empty')).toHaveTextContent('No VAT-recorded records for this company in this period');
    expect(screen.getByTestId('vatr-box-5')).toHaveTextContent('0.00');
    expect(screen.getByTestId('vatr-direction')).toHaveTextContent('nothing to pay');
  });

  it('SQL not applied yet: "not available yet", no crash', async () => {
    st.rpc = async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.vat_company_return_preview' } });
    view();
    fireEvent.click(await screen.findByTestId('vatr-show'));
    expect(await screen.findByTestId('vatr-failure-not_available')).toHaveTextContent('The VAT return preview is not available yet.');
  });

  it('the database refuses (not an owner or admin, plan, two-step) with plain words; an error offers Try again', async () => {
    const cases: [unknown, string, string][] = [
      [{ code: '42501', message: 'VAT_PREVIEW_DENIED: only an owner or admin of this company can see its VAT return' }, 'denied', 'Only owners and admins can see the VAT return.'],
      [{ code: '42501', message: 'VAT_PREVIEW_PLAN: plan_not_included' }, 'plan', 'HMRC tools are included in the Business and Scale plans.'],
      [{ code: '42501', message: 'VAT_PREVIEW_DENIED: enter your authenticator code first' }, 'two_step', 'Two-step sign-in is on for your account.'],
      [{ code: '500', message: 'boom' }, 'error', 'Try again'],
    ];
    for (const [error, kind, text] of cases) {
      st.rpc = async () => ({ data: null, error });
      const v = view();
      fireEvent.click(await screen.findByTestId('vatr-show'));
      expect(await screen.findByTestId(`vatr-failure-${kind}`)).toHaveTextContent(text);
      v.unmount();
    }
  });

  it('a back-to-front period is caught before asking the database', async () => {
    view();
    await screen.findByTestId('vatr-show');
    await setDates('2026-09-30', '2026-07-01');
    expect(screen.getByTestId('vatr-period-error')).toBeInTheDocument();
    expect(screen.getByTestId('vatr-show')).toBeDisabled();
    // P7a: the error is announced and tied to both date fields, not shown by colour alone.
    expect(screen.getByTestId('vatr-period-error')).toHaveAttribute('role', 'alert');
    for (const label of ['From', 'To']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-describedby', 'vatr-period-error');
    }
    expect(screen.getByRole('group', { name: 'How to choose the period' })).toBeInTheDocument();
  });

  it('connected: an HMRC obligation sets the period (open and fulfilled are read); a failed read falls back to dates', async () => {
    st.status = connected;
    st.obligations.mockImplementation(async (_c: string, q: { status: string }) => (q.status === 'O'
      ? { ok: true, obligations: [{ periodKey: '24A1', start: '2026-10-01', end: '2026-12-31', due: '2027-02-07', status: 'O', received: null }] }
      : { ok: true, obligations: [{ periodKey: '24A0', start: '2026-07-01', end: '2026-09-30', due: '2026-11-07', status: 'F', received: '2026-11-01' }] }));
    st.rpc = async () => ({ data: EXAMPLE, error: null });
    const v = view();
    fireEvent.click(await screen.findByLabelText(/Use an HMRC obligation/));
    fireEvent.click(screen.getByTestId('vatr-get-obligations'));
    const select = await screen.findByLabelText('Obligation');
    expect(st.obligations).toHaveBeenCalledTimes(2);
    expect((select as HTMLSelectElement).options).toHaveLength(2);
    fireEvent.change(select, { target: { value: '24A0' } });
    fireEvent.click(screen.getByTestId('vatr-show'));
    await screen.findByTestId('vatr-result');
    expect(st.rpcCalls[0].args).toEqual({ p_organization_id: 'org-x', p_from: '2026-07-01', p_to: '2026-09-30' });
    expect(screen.getByText('HMRC obligation (test environment)')).toBeInTheDocument();
    v.unmount();
    st.obligations.mockResolvedValue({ ok: false, code: 'hmrc_refused', message: 'HMRC is not answering' });
    view();
    fireEvent.click(await screen.findByLabelText(/Use an HMRC obligation/));
    fireEvent.click(screen.getByTestId('vatr-get-obligations'));
    expect(await screen.findByTestId('vatr-obligations-note')).toHaveTextContent('Choose dates instead: the period is then not confirmed by HMRC.');
  });

  it('Download preview (CSV): the nine boxes and per-treatment totals, written in the browser, no individual record', async () => {
    st.rpc = async () => ({ data: EXAMPLE, error: null });
    let blob: Blob | null = null;
    const create = vi.fn((b: Blob) => { blob = b; return 'blob:preview'; });
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    view();
    await setDates('2026-07-01', '2026-09-30');
    fireEvent.click(await screen.findByTestId('vatr-show'));
    fireEvent.click(await screen.findByTestId('vatr-download'));
    expect(click).toHaveBeenCalledTimes(1);
    const text = await (blob as unknown as Blob).text();
    expect(text).toContain('1,VAT due on sales,205.00');
    expect(text).toContain('purchases,Standard 20%,2,450.00,60.00,30.00');
    expect(text.split('\n').filter((l) => /^\d,/.test(l))).toHaveLength(9);
    expect(st.rpcCalls).toHaveLength(1); // the download asked nothing more of the database
    click.mockRestore();
  });
});
