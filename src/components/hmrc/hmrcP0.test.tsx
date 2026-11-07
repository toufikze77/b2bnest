// HMRC P0: the customer-facing HMRC connection screens. Supabase is mocked; nothing here holds a token or secret.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({
  rpc: { data: null as unknown, error: null as null | { code?: string; message?: string } },
  invoke: vi.fn(),
  memberships: [{ organizationId: '0d100000-0000-4000-8000-000000000001', name: 'A Ltd', role: 'owner' }],
  rpcCalls: [] as [string, unknown][],
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async (fn: string, args: unknown) => { st.rpcCalls.push([fn, args]); return st.rpc; },
    functions: { invoke: (name: string, opts: unknown) => st.invoke(name, opts) },
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'is', 'order', 'limit', 'update', 'insert']) q[m] = () => q;
      q.maybeSingle = async () => ({ data: null, error: null });
      q.then = (ok: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(ok);
      return q;
    },
  },
}));
vi.mock('@/contexts/OrganizationContext', () => ({
  useActiveOrganization: () => ({
    memberships: st.memberships, organizationId: st.memberships[0]?.organizationId ?? null, organization: st.memberships[0] ?? null,
    loading: false, setActiveOrganization: vi.fn(), refresh: vi.fn(),
  }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'ada@example.test' }, loading: false }) }));

import HMRCConnectionPanel from './HMRCConnectionPanel';
import HMRCSettings from './HMRCSettings';
import HMRCIntegration from '@/components/HMRCIntegration';
import HMRCCallback from '@/pages/HMRCCallback';
import { HMRC_COMPANY_KEY } from '@/lib/hmrcConnection';

const CO = '0d100000-0000-4000-8000-000000000001';
const show = (el: React.ReactElement) => render(el, { wrapper: MemoryRouter });
const status = (over: Record<string, unknown> = {}, connections: unknown[] = []) => { st.rpc = { data: { access: 'ok', can_manage: true, connections, ...over }, error: null }; };
const CONNECTED = { environment: 'sandbox', status: 'connected', connected_by_name: 'Ada Owner', connected_at: '2026-11-02T10:00:00Z', expires_at: null, needs_reconnect: false, scopes: ['read:vat', 'write:vat'] };
const fnError = (status: number, body: unknown) => ({ data: null, error: { context: { status, json: async () => body } } });

beforeEach(() => {
  st.rpcCalls = []; st.invoke.mockReset();
  st.memberships = [{ organizationId: CO, name: 'A Ltd', role: 'owner' }];
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('HMRC connection panel (customers, owners and admins)', () => {
  it('owner, connected: status, who and when (2 Nov 2026), the Sandbox (test) label, Disconnect; no token anywhere', async () => {
    status({}, [CONNECTED]);
    const { container } = show(<HMRCConnectionPanel />);
    expect(await screen.findByTestId('hmrc-state')).toHaveTextContent('Connected to HMRC');
    expect(screen.getByText('Connected by Ada Owner on 2 Nov 2026.')).toBeInTheDocument();
    expect(screen.getByTestId('hmrc-environment')).toHaveTextContent('Sandbox (test)');
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect to HMRC/ })).toBeNull();
    expect(st.rpcCalls[0]).toEqual(['hmrc_connection_status', { p_company: CO }]);
    // HMRC P1: owners of a connected company also read the last test time
    await waitFor(() => expect(st.rpcCalls.map((c) => c[0])).toContain('hmrc_audit_events'));
    expect(container.textContent).not.toMatch(/token|secret|client id/i);
  });

  it('owner, not connected: "Connect to HMRC" asks the server for the HMRC address, remembers the company and goes there', async () => {
    status();
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign } as Location);
    st.invoke.mockResolvedValue({ data: { ok: true, url: 'https://test-www.tax.service.gov.uk/oauth/authorize?state=s' }, error: null });
    show(<HMRCConnectionPanel />);
    expect(await screen.findByTestId('hmrc-state')).toHaveTextContent('Not connected to HMRC');
    fireEvent.click(screen.getByRole('button', { name: 'Connect to HMRC' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://test-www.tax.service.gov.uk/oauth/authorize?state=s'));
    expect(st.invoke).toHaveBeenCalledWith('hmrc-connect-start', { body: { company_id: CO } });
    expect(sessionStorage.getItem(HMRC_COMPANY_KEY)).toBe(CO);
  });

  it('a refusal from the server is announced in plain words (aria-live)', async () => {
    status();
    st.invoke.mockResolvedValue(fnError(403, { ok: false, code: 'two_step_required', message: 'Two-step sign-in is on for your account. Sign out, sign in again with your 6-digit code, then try again.' }));
    show(<HMRCConnectionPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Connect to HMRC' }));
    const live = screen.getByTestId('hmrc-announce');
    await waitFor(() => expect(live).toHaveTextContent('Sign out, sign in again with your 6-digit code'));
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it('disconnect asks first, calls the server, announces it and reloads the status', async () => {
    status({}, [CONNECTED]);
    st.invoke.mockResolvedValue({ data: { ok: true, status: 'disconnected' }, error: null });
    show(<HMRCConnectionPanel />);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    expect(st.invoke).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    status();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(screen.getByTestId('hmrc-announce')).toHaveTextContent('Disconnected from HMRC.'));
    expect(st.invoke).toHaveBeenCalledWith('hmrc-disconnect', { body: { company_id: CO } });
    expect(await screen.findByText('Not connected to HMRC')).toBeInTheDocument();
  });

  it('needs reconnect: says so and offers "Reconnect to HMRC"', async () => {
    status({}, [{ ...CONNECTED, status: 'needs_reconnect', needs_reconnect: true }]);
    show(<HMRCConnectionPanel />);
    expect(await screen.findByTestId('hmrc-needs-reconnect')).toHaveTextContent('An owner or admin needs to connect again.');
    expect(screen.getByRole('button', { name: 'Reconnect to HMRC' })).toBeInTheDocument();
  });
});

describe('who sees what', () => {
  it('member (not owner or admin): the status only, with "Ask an owner or admin", no buttons', async () => {
    st.memberships = [{ organizationId: CO, name: 'A Ltd', role: 'member' }];
    status({ can_manage: false }, [CONNECTED]);
    show(<HMRCConnectionPanel />);
    expect(await screen.findByTestId('hmrc-state')).toHaveTextContent('Connected to HMRC');
    expect(screen.getByTestId('hmrc-member-note')).toHaveTextContent('Ask an owner or admin of A Ltd to connect or disconnect HMRC.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('platform admin who is not in the company: nothing about the connection, no buttons', async () => {
    st.rpc = { data: null, error: { code: '42501', message: 'HMRC_NOT_ALLOWED' } };
    show(<HMRCConnectionPanel />);
    expect(await screen.findByTestId('hmrc-no-access')).toHaveTextContent("You don't have access to this company's HMRC connection.");
    expect(screen.queryByTestId('hmrc-status')).toBeNull();
    expect(screen.queryByText(/Connected by/)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('trial ended: told so, with See plans; suspended: told so; two-step pending: told so', async () => {
    status({ access: 'trial_ended', can_manage: false });
    const a = show(<HMRCConnectionPanel />);
    expect(await screen.findByTestId('hmrc-ended')).toHaveTextContent('Your trial has ended.');
    expect(screen.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/pricing');
    a.unmount();
    status({ access: 'suspended', can_manage: false });
    const b = show(<HMRCConnectionPanel />);
    expect(await screen.findByTestId('hmrc-ended')).toHaveTextContent('Your account is suspended.');
    expect(screen.queryByRole('link', { name: 'See plans' })).toBeNull();
    b.unmount();
    st.rpc = { data: null, error: { code: 'P0001', message: 'MFA_REQUIRED' } };
    show(<HMRCConnectionPanel />);
    expect(await screen.findByTestId('hmrc-two-step')).toHaveTextContent('6-digit code');
  });

  it('before the database update or the secrets: a calm "isn\'t set up yet", nothing breaks', async () => {
    st.rpc = { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.hmrc_connection_status' } };
    show(<HMRCConnectionPanel />);
    expect(await screen.findByTestId('hmrc-not-set-up')).toHaveTextContent("HMRC connection isn't set up yet.");
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('no company yet: says how to start', async () => {
    st.memberships = [];
    show(<HMRCConnectionPanel />);
    expect(screen.getByTestId('hmrc-no-company')).toHaveTextContent('Create or join a company');
    expect(st.rpcCalls).toEqual([]);
  });

  it('a normal signed-in customer reaches the HMRC tool and its connection panel (no platform role needed)', async () => {
    status();
    show(<HMRCIntegration />);
    expect(screen.getByRole('heading', { name: /HMRC Integration Suite/ })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Connect to HMRC' })).toBeInTheDocument();
    expect(screen.getAllByText(/Filing is not available yet|HMRC filing is not available yet/).length).toBeGreaterThan(0);
  });
});

describe('plan_not_included (docs/hmrc-plan): Business and Scale only', () => {
  it('owner or admin on Solo: the plan message with See plans; no connect button, no status, no figures', async () => {
    status({ access: 'plan_not_included', can_manage: false });
    const { container } = show(<HMRCConnectionPanel />);
    const box = await screen.findByTestId('hmrc-ended');
    expect(box).toHaveTextContent('HMRC tools are included in the Business and Scale plans.');
    expect(within(box).getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/pricing');
    expect(box).not.toHaveTextContent('Ask an owner or admin');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('hmrc-status')).toBeNull();
    expect(container.textContent).not.toMatch(/£|Connected by/);
  });

  it('member of a company on Solo: the plan message and "Ask an owner or admin", no buttons', async () => {
    st.memberships = [{ organizationId: CO, name: 'A Ltd', role: 'member' }];
    status({ access: 'plan_not_included', can_manage: false });
    show(<HMRCConnectionPanel />);
    const box = await screen.findByTestId('hmrc-ended');
    expect(box).toHaveTextContent('HMRC tools are included in the Business and Scale plans. Ask an owner or admin of A Ltd about the plan.');
    expect(within(box).getByRole('link', { name: 'See plans' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a refusal from the functions (plan changed meanwhile) is announced with the same words', async () => {
    status();
    st.invoke.mockResolvedValue(fnError(403, { ok: false, code: 'plan_not_included', message: 'HMRC tools are included in the Business and Scale plans.' }));
    show(<HMRCConnectionPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Connect to HMRC' }));
    await waitFor(() => expect(screen.getByTestId('hmrc-announce')).toHaveTextContent('HMRC tools are included in the Business and Scale plans.'));
  });

  it('Settings → HMRC shows the same message', async () => {
    status({ access: 'plan_not_included', can_manage: false });
    show(<HMRCSettings />);
    expect(await screen.findByTestId('hmrc-ended')).toHaveTextContent('HMRC tools are included in the Business and Scale plans.');
  });
});

describe('Settings → HMRC', () => {
  it('no HMRC credential fields and no sandbox switch; the business details remain', async () => {
    status();
    const { container } = show(<HMRCSettings />);
    await screen.findByTestId('hmrc-connection-panel');
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/Client ID|Client Secret|Redirect URI|Sandbox Mode|Government Gateway/i);
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(screen.getByLabelText('VAT registration number')).toBeInTheDocument();
    expect(screen.getByLabelText('Unique Taxpayer Reference (UTR)')).toBeInTheDocument();
  });
});

describe('/hmrc/callback', () => {
  const at = (search: string) => {
    window.history.replaceState({}, '', `/hmrc/callback${search}`);
    return render(<MemoryRouter initialEntries={[`/hmrc/callback${search}`]}><HMRCCallback /></MemoryRouter>);
  };

  it('posts code and state (and the remembered company) to hmrc-connect-complete, clears them from the address, shows success', async () => {
    sessionStorage.setItem(HMRC_COMPANY_KEY, CO);
    st.invoke.mockResolvedValue({ data: { ok: true, status: 'connected' }, error: null });
    const { container } = at('?code=the-code-123&state=the-state-abcdefghijklmnop');
    expect(window.location.search).toBe('');
    expect(await screen.findByText('Connected to HMRC (test environment).')).toBeInTheDocument();
    expect(st.invoke).toHaveBeenCalledTimes(1);
    expect(st.invoke).toHaveBeenCalledWith('hmrc-connect-complete', { body: { code: 'the-code-123', state: 'the-state-abcdefghijklmnop', company_id: CO } });
    expect(container.textContent).not.toContain('the-code-123');
    expect(screen.getByRole('link', { name: 'Back to HMRC Integration' })).toHaveAttribute('href', '/business-tools?tool=hmrc-integration');
    expect(within(screen.getByTestId('hmrc-callback')).getByText(/Connected/)).toBeInTheDocument();
  });

  it('a refused or expired sign-in shows a plain message', async () => {
    st.invoke.mockResolvedValue(fnError(400, { ok: false, code: 'bad_state', message: 'This HMRC sign-in has expired or was already used. Start again from the HMRC page.' }));
    at('?code=c&state=the-state-abcdefghijklmnop');
    expect(await screen.findByText(/has expired or was already used/)).toBeInTheDocument();
  });

  it('cancelled at HMRC, or nothing returned: nothing is sent', async () => {
    at('?error=access_denied&state=x');
    expect(await screen.findByText('You cancelled the HMRC sign-in. Nothing was connected.')).toBeInTheDocument();
    expect(st.invoke).not.toHaveBeenCalled();
    await act(async () => {});
  });
});
