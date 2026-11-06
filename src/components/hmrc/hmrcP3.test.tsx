// HMRC P3: the Obligations tab in each state. Supabase is mocked; nothing here holds a token.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({
  status: null as unknown,
  statusError: null as null | { code?: string; message?: string },
  invoke: vi.fn(),
  role: 'owner',
  demo: false,
  pending: false,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async () => (st.pending ? new Promise(() => {}) : { data: st.status, error: st.statusError }),
    functions: { invoke: (name: string, opts: unknown) => st.invoke(name, opts) },
  },
}));
vi.mock('@/contexts/OrganizationContext', () => ({
  useActiveOrganization: () => {
    const m = { organizationId: '0d300000-0000-4000-8000-000000000001', name: 'V Ltd', role: st.role };
    return { memberships: [m], organizationId: m.organizationId, organization: m, loading: false };
  },
}));
vi.mock('@/contexts/demoModeState', () => ({ useDemoMode: () => ({ isDemo: st.demo, loading: false }) }));

import HMRCObligations from './HMRCObligations';
import { HMRC_FILING_UNAVAILABLE } from './filingStatus';
import { labelFor, lastYear, rangeDays, ukDay } from '@/lib/hmrcVat';

const CO = '0d300000-0000-4000-8000-000000000001';
const CONNECTED = { environment: 'sandbox', status: 'connected', connected_by_name: 'Ada', connected_at: '2026-11-04T18:18:24Z', expires_at: null, needs_reconnect: false, scopes: ['read:vat', 'write:vat', 'hello'] };
const ok = (over: Record<string, unknown> = {}, connections: unknown[] = [CONNECTED]) => { st.status = { access: 'ok', can_manage: true, connections, ...over }; };
const show = () => render(<HMRCObligations />, { wrapper: MemoryRouter });
const HMRC_EXAMPLE = [
  { periodKey: '18A1', start: '2017-01-01', end: '2017-03-31', due: '2017-05-07', status: 'F', received: '2017-05-06' },
  { periodKey: '18A2', start: '2017-04-01', end: '2017-06-30', due: '2017-08-07', status: 'O', received: null },
];

beforeEach(() => {
  st.invoke.mockReset(); st.role = 'owner'; st.demo = false; st.pending = false; st.statusError = null; ok();
});

describe('HMRC Obligations tab', () => {
  it('always says the data comes from HMRC\'s test environment and that nothing is filed', async () => {
    show();
    expect(screen.getByText(HMRC_FILING_UNAVAILABLE)).toBeInTheDocument();
    expect(screen.getByTestId('vat-test-env')).toHaveTextContent("HMRC's test environment (sandbox)");
    expect(screen.queryByRole('button', { name: /submit/i })).toBeNull();
    await screen.findByTestId('vat-get');
  });

  it('loading', () => {
    st.pending = true;
    show();
    expect(screen.getByTestId('vat-loading')).toBeInTheDocument();
  });

  it('admin: Get VAT obligations sends open by default, with the browser data, and shows HMRC\'s answer in a table', async () => {
    st.role = 'admin';
    st.invoke.mockResolvedValue({ data: { ok: true, obligations: HMRC_EXAMPLE, fetched_at: '2026-11-06T10:00:00Z', vrn_last3: '789' }, error: null });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Get VAT obligations' }));
    await waitFor(() => expect(screen.getByTestId('vat-announce')).toHaveTextContent('HMRC returned 2 VAT obligations.'));
    const [name, opts] = st.invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(name).toBe('hmrc-vat-obligations');
    expect(opts.body).toMatchObject({ company_id: CO, status: 'O' });
    expect(opts.body.from).toBeUndefined();
    expect(opts.body.scenario).toBeUndefined();
    expect(opts.body.fraud).toBeTruthy();
    const table = screen.getByTestId('vat-table');
    expect(table).toHaveTextContent('1 Apr 2017 to 30 Jun 2017');
    expect(table).toHaveTextContent('7 Aug 2017');
    expect(table).toHaveTextContent('Open, due date passed');
    expect(table).toHaveTextContent('Fulfilled');
    expect(table).toHaveTextContent('6 May 2017');
    expect(screen.getByTestId('vat-fetched')).toHaveTextContent("Read from HMRC's test environment on 6 Nov 2026");
    expect(document.body.textContent).not.toMatch(/123456789|token/i);
  });

  it('fulfilled needs a date range of at most 366 days; the sandbox scenario is sent when picked', async () => {
    st.invoke.mockResolvedValue({ data: { ok: true, obligations: [], fetched_at: '2026-11-06T10:00:00Z' }, error: null });
    show();
    fireEvent.change(await screen.findByLabelText('Show'), { target: { value: 'F' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-02' } });
    expect(screen.getByTestId('vat-range-error')).toHaveTextContent('at most 366 days');
    expect(screen.getByRole('button', { name: 'Get VAT obligations' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2025-12-31' } });
    fireEvent.change(screen.getByLabelText(/Test scenario/), { target: { value: 'QUARTERLY_TWO_MET' } });
    fireEvent.click(screen.getByRole('button', { name: 'Get VAT obligations' }));
    await waitFor(() => expect(screen.getByTestId('vat-announce')).toHaveTextContent('HMRC returned no VAT obligations for this search.'));
    expect((st.invoke.mock.calls[0][1] as { body: Record<string, unknown> }).body).toMatchObject({ status: 'F', from: '2025-01-01', to: '2025-12-31', scenario: 'QUARTERLY_TWO_MET' });
    expect(screen.queryByTestId('vat-table')).toBeNull();
  });

  it('errors are plain: VAT number missing, limit, HMRC refused', async () => {
    show();
    const btn = await screen.findByRole('button', { name: 'Get VAT obligations' });
    for (const [body, text] of [
      [{ ok: false, code: 'vrn_missing' }, 'Add your VAT number in Settings → HMRC first.'],
      [{ ok: false, code: 'obligations_limit' }, 'You can get VAT obligations 10 times an hour'],
      [{ ok: false, code: 'hmrc_refused', hmrc_code: 'ACCEPT_HEADER_INVALID' }, "HMRC didn't accept the request (ACCEPT_HEADER_INVALID)"],
    ] as const) {
      st.invoke.mockResolvedValueOnce({ data: null, error: { context: { status: 409, json: async () => body } } });
      fireEvent.click(btn);
      await waitFor(() => expect(screen.getByTestId('vat-announce')).toHaveTextContent(text));
    }
  });

  it('member: the status only, no button', async () => {
    st.role = 'member'; ok({ can_manage: false });
    show();
    expect(await screen.findByTestId('vat-member')).toHaveTextContent('Only an owner or admin');
    expect(screen.queryByTestId('vat-get')).toBeNull();
  });

  it('Solo: the plan message', async () => {
    st.status = { access: 'plan_not_included', can_manage: false, connections: [] };
    show();
    expect(await screen.findByTestId('vat-ended')).toHaveTextContent('HMRC tools are included in the Business and Scale plans.');
    expect(screen.queryByTestId('vat-get')).toBeNull();
  });

  it('demo account: no button', async () => {
    st.demo = true;
    show();
    expect(await screen.findByTestId('vat-demo')).toBeInTheDocument();
    expect(screen.queryByTestId('vat-get')).toBeNull();
  });

  it('not connected, needs reconnecting, scope missing, production', async () => {
    ok({}, []);
    const a = show();
    expect(await screen.findByTestId('vat-not-connected')).toHaveTextContent('Connect this company to HMRC first in Settings → HMRC.');
    a.unmount();
    ok({}, [{ ...CONNECTED, status: 'needs_reconnect', needs_reconnect: true }]);
    const b = show();
    expect(await screen.findByTestId('vat-needs-reconnect')).toBeInTheDocument();
    b.unmount();
    ok({}, [{ ...CONNECTED, scopes: ['hello'] }]);
    const c = show();
    expect(await screen.findByTestId('vat-scope-missing')).toHaveTextContent('Connect to HMRC again');
    expect(screen.queryByTestId('vat-get')).toBeNull();
    c.unmount();
    ok({}, [CONNECTED, { ...CONNECTED, environment: 'production' }]);
    show();
    expect(await screen.findByTestId('vat-production')).toHaveTextContent('Production is not available yet.');
    expect(screen.queryByTestId('vat-get')).toBeNull();
  });

  it('a status error', async () => {
    st.status = null; st.statusError = { code: 'XX000', message: 'boom' };
    show();
    expect(await screen.findByTestId('vat-error')).toBeInTheDocument();
  });
});

describe('VAT helpers', () => {
  it('labels, dates and the default range', () => {
    expect(labelFor({ periodKey: '18A2', start: '2026-10-01', end: '2026-12-31', due: '2027-02-07', status: 'O', received: null }, '2026-11-06')).toBe('Open');
    expect(labelFor({ periodKey: '18A2', start: '2017-04-01', end: '2017-06-30', due: '2017-08-07', status: 'O', received: null }, '2026-11-06')).toBe('Open, due date passed');
    expect(ukDay('2017-08-07')).toBe('7 Aug 2017');
    const r = lastYear(new Date(2026, 10, 6));
    expect(r).toEqual({ from: '2025-11-07', to: '2026-11-06' });
    expect(rangeDays(r.from, r.to)).toBe(365);
    expect(rangeDays('2024-01-01', '2024-12-31')).toBe(366);
  });
});
