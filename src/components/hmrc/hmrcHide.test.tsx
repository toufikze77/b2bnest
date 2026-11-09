// HMRC hide switch: what customers and the owner's accounts see when HMRC is hidden or shown. Supabase and HMRC are
// mocked: nothing is sent, filed or stored.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HmrcStatus } from '@/lib/hmrcConnection';

const st = vi.hoisted(() => ({
  access: { loading: false, state: 'hidden', tester: false, canUse: false } as { loading: boolean; state: string; tester: boolean; canUse: boolean },
  org: { organizationId: 'org-x', organization: { organizationId: 'org-x', name: 'Company X', role: 'owner' }, memberships: [{ organizationId: 'org-x', name: 'Company X', role: 'owner' }], loading: false },
  status: null as unknown, invoke: vi.fn(), obligations: vi.fn(), superAdmin: false, accessStatus: vi.fn(), setAccess: vi.fn(),
}));
vi.mock('@/lib/hmrcAccess', async (orig) => ({
  ...(await orig<object>()), useHmrcCustomerAccess: () => st.access,
  fetchHmrcAccessStatus: (...a: unknown[]) => st.accessStatus(...a), setHmrcCustomerAccess: (...a: unknown[]) => st.setAccess(...a),
}));
vi.mock('@/contexts/OrganizationContext', () => ({ useActiveOrganization: () => st.org }));
vi.mock('@/contexts/demoModeState', () => ({ useDemoMode: () => ({ isDemo: false, loading: false }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, loading: false }), useSignedInUser: () => ({ id: 'u1' }) }));
vi.mock('@/hooks/useSuperAdmin', () => ({ useSuperAdmin: () => ({ isSuperAdmin: st.superAdmin, loading: false }) }));
vi.mock('@/lib/hmrcConnection', async (orig) => ({ ...(await orig<object>()), fetchHmrcStatus: async () => st.status, callHmrcFunction: (...a: unknown[]) => st.invoke(...a) }));
vi.mock('@/lib/hmrcVat', async (orig) => ({ ...(await orig<object>()), getVatObligations: (...a: unknown[]) => st.obligations(...a) }));
vi.mock('@/lib/hmrcVatSubmit', async (orig) => ({ ...(await orig<object>()), fetchSubmissions: async () => ({ rows: [] }) }));
vi.mock('@/components/hmrc/HMRCConnectionPanel', () => ({ default: () => <div data-testid="connection-panel" /> }));
vi.mock('@/components/hmrc/HMRCPayrollSubmissions', () => ({ default: () => <div /> }));
vi.mock('@/components/hmrc/HMRCTaxReturns', () => ({ default: () => <div /> }));
vi.mock('@/components/hmrc/HMRCObligations', () => ({ default: () => <div data-testid="obligations" /> }));
vi.mock('@/components/hmrc/HMRCSettings', () => ({ default: () => <div /> }));
vi.mock('@/components/hmrc/HMRCSubmissionLogs', () => ({ default: () => <div data-testid="submission-logs" /> }));
vi.mock('@/components/hmrc/HMRCTestTools', () => ({ default: () => <div data-testid="test-tools" /> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: async () => ({ data: [], error: null }) } }));

import HMRCIntegration from '@/components/HMRCIntegration';
import HMRCVATReturns from './HMRCVATReturns';
import HMRCAccessControl from '@/components/admin/HMRCAccessControl';
import { HMRC_COMING_SOON } from '@/lib/hmrcAccess';

const connected: HmrcStatus = { kind: 'ok', canManage: true, production: false,
  connection: { environment: 'sandbox', status: 'connected', scopes: ['read:vat', 'write:vat'], connected_by_name: 'A', connected_at: '2026-11-01', expires_at: null, needs_reconnect: false } as never };
const notConnected: HmrcStatus = { kind: 'ok', canManage: true, production: false, connection: null };
const hidden = { loading: false, state: 'hidden', tester: false, canUse: false };
const visible = { loading: false, state: 'visible', tester: false, canUse: true };
const testerWhileHidden = { loading: false, state: 'hidden', tester: true, canUse: true };
const page = () => render(<MemoryRouter><HMRCIntegration /></MemoryRouter>);

beforeEach(() => {
  st.access = hidden; st.status = notConnected; st.superAdmin = false;
  for (const f of [st.invoke, st.obligations, st.accessStatus, st.setAccess]) f.mockReset();
});

describe('a customer while HMRC is hidden', () => {
  it('the HMRC page: one calm line instead of the connection; only the VAT return preview and its CSV stay', async () => {
    page();
    expect(screen.getByTestId('hmrc-hidden-page')).toBeInTheDocument();
    expect(screen.getByTestId('hmrc-coming-soon')).toHaveTextContent(HMRC_COMING_SOON);
    expect(screen.queryByTestId('connection-panel')).toBeNull();
    expect(screen.queryByTestId('obligations')).toBeNull();
    expect(screen.queryByTestId('submission-logs')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(await screen.findByTestId('vatr-show')).toBeInTheDocument(); // the preview
    expect(screen.queryByTestId('vats-section')).toBeNull(); // submit, test, header test, history
    expect(screen.queryByTestId('vata-section')).toBeNull(); // liabilities and payments
    expect(screen.queryByTestId('vatp-section')).toBeNull(); // penalties
    expect(screen.queryByTestId('test-tools')).toBeNull();
    expect(screen.queryByText(/Use an HMRC obligation/)).toBeNull();
    expect(screen.getAllByText(HMRC_COMING_SOON)).toHaveLength(1);
    expect(st.obligations).not.toHaveBeenCalled();
    expect(st.invoke).not.toHaveBeenCalled();
  });
  it('the VAT Returns screen on its own: the line, the preview, no HMRC piece, no scenario picker', async () => {
    render(<MemoryRouter><HMRCVATReturns /></MemoryRouter>);
    expect(await screen.findByTestId('vatr-coming-soon')).toHaveTextContent(HMRC_COMING_SOON);
    expect(screen.getByTestId('vatr-show')).toBeInTheDocument();
    expect(screen.getByTestId('vatr-not-confirmed')).toBeInTheDocument();
    expect(screen.queryByLabelText(/test scenario/i)).toBeNull();
    expect(screen.queryByTestId(/vatr-reminder/)).toBeNull();
  });
  it('a company still connected to the test environment keeps its connection and can Disconnect', async () => {
    st.status = connected;
    st.invoke.mockResolvedValue({ ok: true, status: 'disconnected' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    page();
    fireEvent.click(await screen.findByTestId('hmrc-hidden-disconnect'));
    await waitFor(() => expect(st.invoke).toHaveBeenCalledWith('hmrc-disconnect', { company_id: 'org-x' }));
    expect(await screen.findByText('Disconnected from HMRC.')).toBeInTheDocument();
  });
  it('nothing HMRC flashes up while access is still being checked', () => {
    st.access = { loading: true, state: 'hidden', tester: false, canUse: false };
    page();
    expect(screen.getByTestId('hmrc-access-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('connection-panel')).toBeNull();
  });
});

describe('shown (visible), or the owner\'s accounts while hidden', () => {
  for (const [name, access] of [['a customer while visible', visible], ['a platform super admin or admin while hidden', testerWhileHidden]] as const) {
    it(`${name}: today's HMRC page`, async () => {
      st.access = access; st.status = connected;
      page();
      expect(screen.getByTestId('connection-panel')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Obligations' })).toBeInTheDocument();
      expect(screen.queryByTestId('hmrc-coming-soon')).toBeNull();
    });
    it(`${name}: the VAT Returns screen keeps the HMRC pieces`, async () => {
      st.access = access; st.status = connected;
      render(<MemoryRouter><HMRCVATReturns /></MemoryRouter>);
      expect(await screen.findByTestId('vats-section')).toBeInTheDocument();
      expect(screen.getByTestId('vata-section')).toBeInTheDocument();
      expect(screen.getByText(/Use an HMRC obligation/)).toBeInTheDocument();
      expect(screen.queryByTestId('vatr-coming-soon')).toBeNull();
    });
  }
});

describe('the owner\'s switch (Admin → Settings)', () => {
  it('renders nothing for anyone who is not a super admin', () => {
    const { container } = render(<HMRCAccessControl />);
    expect(container).toBeEmptyDOMElement();
    expect(st.accessStatus).not.toHaveBeenCalled();
  });
  it('a super admin sees the state, who and when, and flips it', async () => {
    st.superAdmin = true;
    st.accessStatus.mockResolvedValue({ state: 'hidden', updated_at: '2026-11-09T10:00:00Z', updated_by_email: 'owner@example.test' });
    st.setAccess.mockResolvedValue({ ok: true });
    render(<HMRCAccessControl />);
    const state = await screen.findByTestId('hmrc-access-state');
    expect(state).toHaveTextContent('Hidden from customers');
    expect(state).toHaveTextContent('by owner@example.test');
    expect(screen.getByTestId('hmrc-access-hide')).toBeDisabled();
    expect(screen.getByTestId('hmrc-access-show')).toHaveTextContent('Show HMRC test features to customers');
    fireEvent.click(screen.getByTestId('hmrc-access-show'));
    await waitFor(() => expect(st.setAccess).toHaveBeenCalledWith('visible'));
    expect(await screen.findByTestId('hmrc-access-said')).toHaveTextContent('HMRC test features are now shown to customers.');
    expect(screen.getByTestId('hmrc-access-hide')).toHaveTextContent('Hide HMRC test features from customers');
  });
  it('before the database update: says so, and the buttons are off', async () => {
    st.superAdmin = true;
    st.accessStatus.mockResolvedValue('not_set_up');
    render(<HMRCAccessControl />);
    expect(await screen.findByTestId('hmrc-access-not-set-up')).toBeInTheDocument();
    expect(screen.getByTestId('hmrc-access-show')).toBeDisabled();
  });
});
