// Phase 25: real two-step sign-in. The Supabase MFA API is mocked; every decision on screen comes from what it returns.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const { st, signOut, mfa, factor } = vi.hoisted(() => {
type F = { id: string; friendly_name?: string; factor_type: 'totp'; status: 'verified' | 'unverified'; created_at: string; updated_at: string };
const factor = (id: string, status: F['status'] = 'verified', name = 'My phone'): F =>
  ({ id, friendly_name: name, factor_type: 'totp', status, created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z' });

const st = {
  user: { id: 'u1', email: 'sam@example.test' } as null | { id: string; email: string },
  token: 't1',
  current: 'aal1', next: 'aal1',
  factors: [] as F[],
  superAdmin: false,
  roles: [] as string[],
  legacy: false,
  verifyResult: null as null | { message: string; code?: string; status?: number },
};
const signOut = vi.fn(async () => { st.user = null; });
const mfa = {
  getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: st.current, nextLevel: st.next, currentAuthenticationMethods: [] }, error: null })),
  listFactors: vi.fn(async () => ({ data: { all: st.factors, totp: st.factors.filter((f) => f.status === 'verified'), phone: [] }, error: null })),
  enroll: vi.fn(async ({ friendlyName }: { friendlyName: string }) => {
    st.factors = [...st.factors, factor('new', 'unverified', friendlyName)];
    return { data: { id: 'new', type: 'totp', friendly_name: friendlyName, totp: { qr_code: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"/>', secret: 'MOCKSECRETMOCKSECRET', uri: 'otpauth://totp/mock' } }, error: null };
  }),
  challengeAndVerify: vi.fn(async ({ factorId }: { factorId: string }) => {
    if (st.verifyResult) return { data: null, error: st.verifyResult };
    st.factors = st.factors.map((f) => (f.id === factorId ? { ...f, status: 'verified' as 'verified' | 'unverified' } : f));
    st.current = 'aal2'; st.next = 'aal2';
    return { data: {}, error: null };
  }),
  unenroll: vi.fn(async ({ factorId }: { factorId: string }) => {
    st.factors = st.factors.filter((f) => f.id !== factorId);
    if (!st.factors.some((f) => f.status === 'verified')) st.next = st.current === 'aal2' ? 'aal1' : st.next;
    return { data: { id: factorId }, error: null };
  }),
};

  return { st, signOut, mfa, factor };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: st.user, session: st.user ? { access_token: st.token } : null, loading: false, signOut }),
}));
vi.mock('@/hooks/useSuperAdmin', () => ({ useSuperAdmin: () => ({ isSuperAdmin: st.superAdmin, loading: false }) }));
vi.mock('@/contexts/OrganizationContext', () => ({
  useActiveOrganization: () => ({ memberships: st.roles.map((role, i) => ({ organizationId: `o${i}`, organizationName: 'Co', role })), loading: false }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => {
  const q = () => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) b[m] = () => b;
    b.maybeSingle = async () => ({ data: st.legacy ? { is_enabled: true } : null, error: null });
    b.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r);
    return b;
  };
  return { supabase: { auth: { mfa, signOut: vi.fn(), resend: vi.fn() }, from: q, rpc: vi.fn(async () => ({ data: null, error: null })), functions: { invoke: vi.fn() } } };
});

import { AssuranceProvider } from '@/components/twoStep/AssuranceProvider';
import TwoStepGate from '@/components/twoStep/TwoStepGate';
import TwoStepSetup from '@/components/twoStep/TwoStepSetup';
import ProtectAccountBanner from '@/components/twoStep/ProtectAccountBanner';
import LegacyTwoStepPrompt from '@/components/twoStep/LegacyTwoStepPrompt';
import ProtectedRoute from '@/components/ProtectedRoute';
import TwoStepRequired from '@/pages/TwoStepRequired';
import Auth from '@/pages/Auth';
import AdminLayout from '@/pages/admin/AdminLayout';
import { bannerSnoozed, BANNER_KEY, snoozeBanner, requirementFor, TWO_STEP_REQUIRED_ROLES, cleanCode } from '@/lib/twoStep';

const Where = () => { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; };
function app(path: string, extra?: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AssuranceProvider>
        <TwoStepGate>
          <Routes>
            <Route path="/" element={<p>home page</p>} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/crm" element={<ProtectedRoute><p>private CRM data</p></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route index element={<p>admin home</p>} />
            </Route>
            <Route path="/two-step-required" element={<ProtectedRoute><TwoStepRequired /></ProtectedRoute>} />
            <Route path="/settings" element={<p>settings page</p>} />
            <Route path="/dashboard" element={<p>dashboard</p>} />
          </Routes>
          <Where />
          {extra}
        </TwoStepGate>
      </AssuranceProvider>
    </MemoryRouter>,
  );
}
const typeCode = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  Object.assign(st, { user: { id: 'u1', email: 'sam@example.test' }, token: 't1', current: 'aal1', next: 'aal1', factors: [], superAdmin: false, roles: [], legacy: false, verifyResult: null });
  vi.clearAllMocks();
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('sign-in with an authenticator app', () => {
  it('password accepted but the account has an app (aal1 → aal2): only the code screen shows, ?next= is kept', async () => {
    st.factors = [factor('f1')]; st.next = 'aal2';
    app('/auth?next=%2Fcrm');
    expect(await screen.findByTestId('two-step-code-screen')).toBeInTheDocument();
    expect(screen.queryByText('private CRM data')).toBeNull();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.queryByTestId('where')).toBeNull(); // nothing of the app renders behind it
    typeCode('Code', '123 456');                       // pasted with a space
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' }));
    expect(await screen.findByText('private CRM data')).toBeInTheDocument();
    expect(screen.getByTestId('where').textContent).toBe('/crm');
  });

  it('?next= only accepts same-origin paths: an outside address goes home after the code', async () => {
    st.factors = [factor('f1')]; st.next = 'aal2';
    app('/auth?next=%2F%2Fevil.example%2Fsteal');
    typeCode(await screen.findByLabelText('Code').then(() => 'Code'), '123456');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(screen.getByTestId('where').textContent).toBe('/');
  });

  it('a wrong code says so plainly and stays locked; a rate limit has its own message', async () => {
    st.factors = [factor('f1')]; st.next = 'aal2';
    st.verifyResult = { message: 'Invalid TOTP code entered', code: 'mfa_verification_failed', status: 422 };
    app('/crm');
    typeCode(await screen.findByLabelText('Code').then(() => 'Code'), '000000');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("That code didn't work");
    expect(screen.queryByText('private CRM data')).toBeNull();
    st.verifyResult = { message: 'Too many requests', code: 'over_request_rate_limit', status: 429 };
    typeCode('Code', '111111');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Too many attempts. Wait a minute, then try again.')).toBeInTheDocument();
  });

  it('page reload / opening a protected link directly at aal1 with an app: locked', async () => {
    st.factors = [factor('f1')]; st.next = 'aal2';
    app('/crm');
    expect(await screen.findByTestId('two-step-code-screen')).toBeInTheDocument();
    expect(screen.queryByText('private CRM data')).toBeNull();
  });

  it('public pages are locked too while the code is pending', async () => {
    st.factors = [factor('f1')]; st.next = 'aal2';
    app('/');
    expect(await screen.findByTestId('two-step-code-screen')).toBeInTheDocument();
    expect(screen.queryByText('home page')).toBeNull();
  });

  it('a new session token (refresh) is re-checked before anything shows', async () => {
    st.current = 'aal2'; st.next = 'aal2'; st.factors = [factor('f1')];
    const view = app('/crm');
    expect(await screen.findByText('private CRM data')).toBeInTheDocument();
    st.token = 't2'; st.current = 'aal1';
    view.rerender(<MemoryRouter initialEntries={['/crm']}><AssuranceProvider><TwoStepGate><p>private CRM data</p></TwoStepGate></AssuranceProvider></MemoryRouter>);
    expect(await screen.findByTestId('two-step-code-screen')).toBeInTheDocument();
  });

  it('no app: password-only sign-in goes straight through (two-step is optional)', async () => {
    app('/crm');
    expect(await screen.findByText('private CRM data')).toBeInTheDocument();
  });

  it('"Use a different account" signs out', async () => {
    st.factors = [factor('f1')]; st.next = 'aal2';
    app('/crm');
    fireEvent.click(await screen.findByRole('button', { name: 'Use a different account' }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it('two apps: the person chooses which one', async () => {
    st.factors = [factor('f1', 'verified', 'Work phone'), factor('f2', 'verified', 'Home phone')]; st.next = 'aal2';
    app('/crm');
    fireEvent.click(await screen.findByLabelText('Home phone'));
    typeCode('Code', '123456');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f2', code: '123456' }));
  });
});

describe('Admin needs two-step sign-in (super admins)', () => {
  it('super admin without an app is sent from /admin to the set-up page; the rest of the app still works', async () => {
    st.superAdmin = true;
    const view = app('/admin');
    expect(await screen.findByTestId('two-step-required')).toBeInTheDocument();
    expect(screen.getByText('Set up two-step sign-in to use Admin')).toBeInTheDocument();
    expect(screen.getByTestId('where').textContent).toBe('/two-step-required?next=%2Fadmin');
    expect(screen.queryByText('admin home')).toBeNull();
    view.unmount();
    app('/crm');
    expect(await screen.findByText('private CRM data')).toBeInTheDocument();
  });

  it('super admin with an app at aal1 gets the code screen; at aal2 gets Admin', async () => {
    st.superAdmin = true; st.factors = [factor('f1')]; st.next = 'aal2';
    const view = app('/admin');
    expect(await screen.findByTestId('two-step-code-screen')).toBeInTheDocument();
    view.unmount();
    st.current = 'aal2';
    app('/admin');
    expect(await screen.findByText('admin home')).toBeInTheDocument();
  });

  it('the required list is one constant: super admins only today; company roles only if added', () => {
    expect(TWO_STEP_REQUIRED_ROLES).toEqual(['super_admin']);
    expect(requirementFor({ isSuperAdmin: true, companyRoles: [] })).toBe('admin');
    expect(requirementFor({ isSuperAdmin: false, companyRoles: ['owner', 'admin'] })).toBeNull();
  });
});

describe('Settings → Security: set up an authenticator app', () => {
  const settings = () => render(<MemoryRouter><AssuranceProvider><TwoStepSetup /></AssuranceProvider></MemoryRouter>);

  it('enrol: QR code and typed key from Supabase, then the 6-digit code; "On" only after verify', async () => {
    st.current = 'aal1';
    settings();
    expect(await screen.findByTestId('two-step-status')).toHaveTextContent('Off');
    expect(screen.getByText(/Microsoft Authenticator/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Set up an authenticator app' }));
    const enrol = await screen.findByTestId('two-step-enrol');
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'Authenticator app' });
    expect(within(enrol).getByAltText(/QR code/)).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'));
    expect(within(enrol).getByTestId('two-step-secret')).toHaveTextContent('MOCKSECRETMOCKSECRET');
    expect(screen.getByTestId('two-step-status')).toHaveTextContent('Off');
    typeCode('6-digit code from the app', '654321');
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    await waitFor(() => expect(screen.getByTestId('two-step-status')).toHaveTextContent('On'));
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'new', code: '654321' });
  });

  it('enrol with a wrong code: stays Off, says why, the half-finished set-up can be cancelled (removed)', async () => {
    settings();
    fireEvent.click(await screen.findByRole('button', { name: 'Set up an authenticator app' }));
    await screen.findByTestId('two-step-enrol');
    st.verifyResult = { message: 'Invalid TOTP code entered', code: 'mfa_verification_failed' };
    typeCode('6-digit code from the app', '000000');
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("That code didn't work");
    expect(screen.getByTestId('two-step-status')).toHaveTextContent('Off');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'new' }));
  });

  it('"On" only with a verified factor: an unverified one is Off and is cleaned up', async () => {
    st.factors = [factor('stale', 'unverified')];
    settings();
    expect(await screen.findByTestId('two-step-status')).toHaveTextContent('Off');
    await waitFor(() => expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'stale' }));
  });

  it('second factor: recommends a backup phone and enrols it under its own name', async () => {
    st.current = 'aal2'; st.next = 'aal2'; st.factors = [factor('f1')];
    settings();
    expect(await screen.findByTestId('two-step-status')).toHaveTextContent('On');
    expect(screen.getByTestId('two-step-backup-tip')).toHaveTextContent('Add a second phone');
    fireEvent.click(screen.getByRole('button', { name: 'Add a backup phone' }));
    await screen.findByTestId('two-step-enrol');
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'Backup phone' });
  });

  it('removal needs a fresh code (aal2) first; a wrong code removes nothing', async () => {
    st.current = 'aal2'; st.next = 'aal2'; st.factors = [factor('f1')];
    settings();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove My phone' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Remove' })).toBeDisabled();
    expect(mfa.unenroll).not.toHaveBeenCalled();
    st.verifyResult = { message: 'Invalid TOTP code entered', code: 'mfa_verification_failed' };
    typeCode('6-digit code', '000000');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("That code didn't work");
    expect(mfa.unenroll).not.toHaveBeenCalled();
    st.verifyResult = null;
    typeCode('6-digit code', '123456');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'f1' }));
    const verifyOrder = mfa.challengeAndVerify.mock.invocationCallOrder.at(-1)!;
    expect(verifyOrder).toBeLessThan(mfa.unenroll.mock.invocationCallOrder[0]);
  });
});

describe('"Protect your account" banner (company owners and admins without an app)', () => {
  const banner = () => render(<MemoryRouter><AssuranceProvider><ProtectAccountBanner /></AssuranceProvider></MemoryRouter>);

  it('shown to an owner without an app; "Remind me in 7 days" hides it and it comes back after 7 days', async () => {
    st.roles = ['owner'];
    const view = banner();
    expect(await screen.findByTestId('protect-account-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Remind me in 7 days/ }));
    expect(screen.queryByTestId('protect-account-banner')).toBeNull();
    expect(localStorage.getItem(BANNER_KEY)).toBeTruthy();
    view.unmount();
    banner();
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId('protect-account-banner')).toBeNull();
    const now = Date.now();
    snoozeBanner(now);
    expect(bannerSnoozed(now + 6 * 86400000)).toBe(true);
    expect(bannerSnoozed(now + 7 * 86400000 + 1)).toBe(false);
  });

  it('not shown to members, to anyone with an app, or to signed-out visitors', async () => {
    st.roles = ['member'];
    const a = banner(); await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId('protect-account-banner')).toBeNull(); a.unmount();
    st.roles = ['admin']; st.factors = [factor('f1')]; st.current = 'aal2'; st.next = 'aal2';
    const b = banner(); await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId('protect-account-banner')).toBeNull(); b.unmount();
    st.roles = ['owner']; st.factors = []; st.user = null;
    banner(); await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId('protect-account-banner')).toBeNull();
  });
});

describe('the two accounts with the old setting switched on', () => {
  it('get a one-time, non-blocking "Set up / Later" prompt', async () => {
    st.legacy = true;
    const view = app('/crm', <LegacyTwoStepPrompt />);
    expect(await screen.findByText('private CRM data')).toBeInTheDocument(); // not locked out
    const prompt = await screen.findByTestId('legacy-two-step-prompt');
    fireEvent.click(within(prompt).getByRole('button', { name: 'Later' }));
    await waitFor(() => expect(screen.queryByTestId('legacy-two-step-prompt')).toBeNull());
    view.unmount();
    app('/crm', <LegacyTwoStepPrompt />);
    await screen.findByText('private CRM data');
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId('legacy-two-step-prompt')).toBeNull();
  });

  it('"Set up two-step sign-in" goes to Settings → Security', async () => {
    st.legacy = true;
    app('/crm', <LegacyTwoStepPrompt />);
    fireEvent.click(await screen.findByRole('button', { name: 'Set up two-step sign-in' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/settings?tab=security'));
  });
});

describe('code input', () => {
  it('keeps only digits, at most 6 (paste "123 456" or "123-456")', () => {
    expect(cleanCode('123 456')).toBe('123456');
    expect(cleanCode('123-456-789')).toBe('123456');
    expect(cleanCode('abc')).toBe('');
  });
});
