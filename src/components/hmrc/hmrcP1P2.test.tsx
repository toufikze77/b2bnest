// HMRC P1 + P2: the test tools in the HMRC connection panel. Supabase is mocked; nothing here holds a token.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({
  status: null as unknown,
  events: [] as unknown[],
  invoke: vi.fn(),
  role: 'owner',
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async (fn: string) => (fn === 'hmrc_audit_events' ? { data: st.events, error: null } : { data: st.status, error: null }),
    functions: { invoke: (name: string, opts: unknown) => st.invoke(name, opts) },
  },
}));
vi.mock('@/contexts/OrganizationContext', () => ({
  useActiveOrganization: () => {
    const m = { organizationId: '0d100000-0000-4000-8000-000000000001', name: 'A Ltd', role: st.role };
    return { memberships: [m], organizationId: m.organizationId, organization: m, loading: false, setActiveOrganization: vi.fn(), refresh: vi.fn() };
  },
}));

import HMRCConnectionPanel from './HMRCConnectionPanel';

const CO = '0d100000-0000-4000-8000-000000000001';
const CONNECTED = { environment: 'sandbox', status: 'connected', connected_by_name: 'Ada Owner', connected_at: '2026-11-02T10:00:00Z', expires_at: null, needs_reconnect: false, scopes: ['read:vat', 'write:vat', 'hello'] };
const show = () => render(<HMRCConnectionPanel />, { wrapper: MemoryRouter });
const fnError = (status: number, body: unknown) => ({ data: null, error: { context: { status, json: async () => body } } });

beforeEach(() => {
  st.invoke.mockReset(); st.events = []; st.role = 'owner';
  st.status = { access: 'ok', can_manage: true, connections: [CONNECTED] };
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('HMRC test tools', () => {
  it('owner of a connected company: both buttons, the Sandbox (test) label, the privacy note', async () => {
    show();
    expect(await screen.findByRole('button', { name: 'Test the connection' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check HMRC header test' })).toBeInTheDocument();
    expect(screen.getByTestId('hmrc-environment')).toHaveTextContent('Sandbox (test)');
    expect(screen.getByTestId('hmrc-privacy-note')).toHaveTextContent('not your email address');
    expect(screen.getByTestId('hmrc-test-result')).toHaveAttribute('aria-live', 'polite');
  });

  it('Test the connection sends hello_user with the browser data and says the result in plain words', async () => {
    st.invoke.mockResolvedValue({ data: { ok: true, kind: 'hello_user', message: 'Hello User' }, error: null });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Test the connection' }));
    await waitFor(() => expect(screen.getByTestId('hmrc-test-result')).toHaveTextContent('The connection works. HMRC replied: Hello User.'));
    const [name, opts] = st.invoke.mock.calls[0] as [string, { body: { company_id: string; kind: string; fraud: Record<string, unknown> } }];
    expect(name).toBe('hmrc-test-call');
    expect(opts.body.company_id).toBe(CO);
    expect(opts.body.kind).toBe('hello_user');
    expect(Object.keys(opts.body.fraud).sort()).toEqual(expect.arrayContaining(['deviceId', 'webVersion']));
    expect(JSON.stringify(opts.body)).not.toMatch(/@|token/i);
  });

  it('errors are calm and plain: rate limit, reconnect for the test permission, HMRC busy', async () => {
    show();
    const btn = await screen.findByRole('button', { name: 'Test the connection' });
    for (const [code, text] of [
      ['test_limit', 'You can run 10 HMRC tests an hour for this company. Please try again later.'],
      ['scope_missing', 'Connect to HMRC again to run this test'],
      ['hmrc_busy', 'HMRC is busy right now.'],
    ]) {
      st.invoke.mockResolvedValueOnce(fnError(429, { ok: false, code }));
      fireEvent.click(btn);
      await waitFor(() => expect(screen.getByTestId('hmrc-test-result')).toHaveTextContent(text));
    }
  });

  it('Check HMRC header test lists header names and messages only', async () => {
    st.invoke.mockResolvedValue({ data: { ok: true, kind: 'fraud_headers_validate', result: {
      code: 'INVALID_HEADERS', message: 'At least 1 header is invalid',
      errors: [{ code: 'MISSING_HEADER', message: 'Header required', headers: ['gov-client-public-port'] }],
      warnings: [{ code: 'POTENTIALLY_INVALID_HEADER', message: 'Check the value', headers: ['gov-client-user-ids'] }],
    }, omitted: ['Gov-Client-Public-Port'] }, error: null });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Check HMRC header test' }));
    await waitFor(() => expect(screen.getByTestId('hmrc-test-result')).toHaveTextContent('HMRC says some headers are missing or not valid.'));
    expect(screen.getByTestId('hmrc-header-errors')).toHaveTextContent('gov-client-public-port: Header required');
    expect(screen.getByTestId('hmrc-header-warnings')).toHaveTextContent('gov-client-user-ids: Check the value');
    expect(st.invoke.mock.calls[0][1]).toMatchObject({ body: { kind: 'fraud_headers_validate' } });
  });

  it('shows the last tested time as 2 Nov 2026', async () => {
    st.events = [{ event: 'test_result', reason: 'hello_user_200', created_at: '2026-11-02T09:00:00Z' }, { event: 'test_call', reason: 'hello_user', created_at: '2026-11-02T09:00:00Z' }];
    show();
    expect(await screen.findByTestId('hmrc-last-tested')).toHaveTextContent('Last tested 2 Nov 2026 (connection test: HMRC answered).');
  });

  it('members see nothing new', async () => {
    st.role = 'member'; st.status = { access: 'ok', can_manage: false, connections: [CONNECTED] };
    show();
    expect(await screen.findByTestId('hmrc-member-note')).toBeInTheDocument();
    expect(screen.queryByTestId('hmrc-test-tools')).toBeNull();
  });

  it('Solo accounts see the plan message and no test tools', async () => {
    st.status = { access: 'plan_not_included', can_manage: false, connections: [] };
    show();
    expect(await screen.findByTestId('hmrc-ended')).toHaveTextContent('HMRC tools are included in the Business and Scale plans.');
    expect(screen.queryByTestId('hmrc-test-tools')).toBeNull();
  });

  it('not connected or needing reconnect: no test tools', async () => {
    st.status = { access: 'ok', can_manage: true, connections: [{ ...CONNECTED, status: 'needs_reconnect', needs_reconnect: true }] };
    show();
    expect(await screen.findByTestId('hmrc-needs-reconnect')).toBeInTheDocument();
    expect(screen.queryByTestId('hmrc-test-tools')).toBeNull();
  });
});
