// The password reset page: the recovery session arrives in the URL hash (or a ?code=), not in ?access_token=.
// The Supabase client is mocked: nothing is sent. Fictional values only.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  listeners: [] as ((event: string, session: unknown) => void)[],
  exchange: vi.fn(),
  verify: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
  updatePassword: vi.fn(async () => ({ error: null as null | { message?: string; code?: string } })),
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ toast }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ updatePassword: st.updatePassword }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: st.session }, error: null }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        st.listeners.push(cb);
        return { data: { subscription: { unsubscribe: () => { st.listeners = st.listeners.filter((l) => l !== cb); } } } };
      },
      exchangeCodeForSession: (code: string) => st.exchange(code),
      verifyOtp: (args: unknown) => st.verify(args),
      signOut: st.signOut,
    },
  },
}));

import ResetPassword from './ResetPassword';
import { markRecovery } from '@/lib/passwordRecovery';

const SECRET = 'eyJSECRET.recovery-access-token.SIG';
const Probe = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; };
const open = (url: string) => {
  window.history.replaceState(null, '', url);
  return render(
    <BrowserRouter>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<div>Home page</div>} />
        <Route path="/auth" element={<Probe />} />
        <Route path="/forgot-password" element={<div>Forgot password page</div>} />
      </Routes>
    </BrowserRouter>,
  );
};
const fillAndSubmit = (a: string, b: string) => {
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: a } });
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: b } });
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
};

beforeEach(() => {
  st.session = null; st.listeners = []; st.exchange.mockReset(); st.verify.mockReset(); st.signOut.mockClear(); st.updatePassword.mockReset();
  st.updatePassword.mockResolvedValue({ error: null });
  toast.mockClear(); sessionStorage.clear();
});
afterEach(() => { vi.useRealTimers(); });

describe('reset link', () => {
  it('a recovery session in the hash: the form shows, the tokens are never shown and leave the address bar', async () => {
    st.session = { user: { id: 'u1' } };
    open(`/reset-password#access_token=${SECRET}&expires_in=3600&refresh_token=REFRESH-SECRET&token_type=bearer&type=recovery`);
    expect(screen.getByText('Checking your link…')).toBeInTheDocument();
    expect(await screen.findByText('Reset Your Password')).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(SECRET);
    expect(document.body.innerHTML).not.toContain('REFRESH-SECRET');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/reset-password');
  });

  it('the link is still being read when the page opens: the form shows on PASSWORD_RECOVERY', async () => {
    open(`/reset-password#access_token=${SECRET}&type=recovery`);
    await waitFor(() => expect(st.listeners.length).toBeGreaterThan(0));
    expect(screen.getByText('Checking your link…')).toBeInTheDocument();
    st.session = { user: { id: 'u1' } };
    act(() => { st.listeners.forEach((l) => l('PASSWORD_RECOVERY', st.session)); });
    expect(await screen.findByText('Reset Your Password')).toBeInTheDocument();
  });

  it('the app already read the link (hash cleared, PASSWORD_RECOVERY noted): the form shows', async () => {
    markRecovery();
    st.session = { user: { id: 'u1' } };
    open('/reset-password');
    expect(await screen.findByText('Reset Your Password')).toBeInTheDocument();
  });

  it('?code= is exchanged once, then the form shows and the code leaves the address bar', async () => {
    st.exchange.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
    open('/reset-password?code=pkce-code-123');
    expect(await screen.findByText('Reset Your Password')).toBeInTheDocument();
    expect(st.exchange).toHaveBeenCalledTimes(1);
    expect(st.exchange).toHaveBeenCalledWith('pkce-code-123');
    expect(window.location.search).toBe('');
  });

  it('a ?code= that fails to exchange: the expired message', async () => {
    st.exchange.mockResolvedValue({ data: { session: null }, error: { message: 'invalid flow state' } });
    open('/reset-password?code=used-code');
    expect(await screen.findByTestId('reset-link-problem')).toHaveTextContent('This link has expired or was already used. Request a new one.');
  });

  it('an expired link (error in the hash): a clear message, the scanner note, and a link to request a new one', async () => {
    open('/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    expect(await screen.findByTestId('reset-link-problem')).toHaveTextContent('This link has expired or was already used. Request a new one.');
    expect(screen.getByText(/email security scanners open links before you do/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Request a new link' }));
    expect(await screen.findByText('Forgot password page')).toBeInTheDocument();
  });

  it('no link, signed out: the invalid screen', async () => {
    open('/reset-password');
    expect(await screen.findByText('Invalid Reset Link')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password');
  });

  it('no link, signed in: goes to the home page', async () => {
    st.session = { user: { id: 'u1' } };
    open('/reset-password');
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });

  it('signed in already and opening a genuine recovery link: the form, no redirect', async () => {
    st.session = { user: { id: 'someone-signed-in' } };
    open(`/reset-password#access_token=${SECRET}&type=recovery`);
    expect(await screen.findByText('Reset Your Password')).toBeInTheDocument();
    expect(screen.queryByText('Home page')).toBeNull();
  });

  it('a link that never turns into a session: invalid after a few seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    open(`/reset-password#access_token=${SECRET}&type=recovery`);
    await act(async () => { await vi.advanceTimersByTimeAsync(6500); });
    expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
  });
});

describe('scanner-proof link (?token_hash=…&type=recovery)', () => {
  const HASH = 'pkce_0123456789abcdefSECRETHASH';
  it('nothing is verified on load: a short page with a Continue button, and the hash is never shown', async () => {
    open(`/reset-password?token_hash=${HASH}&type=recovery`);
    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    expect(screen.getByText('Click the button to continue.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(st.verify).not.toHaveBeenCalled();
    expect(st.exchange).not.toHaveBeenCalled();
    expect(document.body.innerHTML).not.toContain(HASH);
  });

  it('Continue verifies once (even on a double click), the hash leaves the address bar, then the form shows', async () => {
    let answer!: (v: unknown) => void;
    st.verify.mockReturnValue(new Promise((r) => { answer = r; }));
    open(`/reset-password?token_hash=${HASH}&type=recovery`);
    const button = screen.getByRole('button', { name: 'Continue' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(st.verify).toHaveBeenCalledTimes(1);
    expect(st.verify).toHaveBeenCalledWith({ token_hash: HASH, type: 'recovery' });
    expect(window.location.search).toBe('');
    await act(async () => { answer({ data: { session: { user: { id: 'u1' } } }, error: null }); });
    expect(await screen.findByText('Reset Your Password')).toBeInTheDocument();
    expect(st.verify).toHaveBeenCalledTimes(1);
    expect(document.body.innerHTML).not.toContain(HASH);
  });

  it('a used or expired token: the expired message and the button to request a new link', async () => {
    st.verify.mockResolvedValue({ data: { session: null }, error: { code: 'otp_expired', message: 'Email link is invalid or has expired' } });
    open(`/reset-password?token_hash=${HASH}&type=recovery`);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByTestId('reset-link-problem')).toHaveTextContent('This link has expired or was already used. Request a new one.');
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password');
  });

  it('the new-password form after Continue has the same rules', async () => {
    st.verify.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
    open(`/reset-password?token_hash=${HASH}&type=recovery`);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Reset Your Password');
    fillAndSubmit('abc', 'abc');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Password too short' }));
    fillAndSubmit('new-password-1', 'new-password-1');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/auth?reset=done'));
  });
});

describe('the form', () => {
  const ready = async () => {
    st.session = { user: { id: 'u1' } };
    open(`/reset-password#access_token=${SECRET}&type=recovery`);
    await screen.findByText('Reset Your Password');
  };

  it('different passwords and a too-short password are still blocked', async () => {
    await ready();
    fillAndSubmit('abcdef1', 'abcdef2');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Passwords don't match" }));
    fillAndSubmit('abc', 'abc');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Password too short' }));
    expect(st.updatePassword).not.toHaveBeenCalled();
  });

  it('success: the recovery session ends on this device and the sign-in page says the password was updated', async () => {
    await ready();
    fillAndSubmit('new-password-1', 'new-password-1');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/auth?reset=done'));
    expect(st.updatePassword).toHaveBeenCalledWith('new-password-1');
    expect(st.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(sessionStorage.getItem('b2bnest.passwordRecovery')).toBeNull();
  });

  it('two-step sign-in needed (insufficient_aal): a clear message with Help, not the raw error', async () => {
    await ready();
    st.updatePassword.mockResolvedValue({ error: { code: 'insufficient_aal', message: 'AAL2 session is required to update email or password when MFA is enabled.' } });
    fillAndSubmit('new-password-1', 'new-password-1');
    const alert = await screen.findByTestId('reset-problem');
    expect(alert).toHaveTextContent('You also need your two-step code; use the recovery steps in Help.');
    expect(alert).not.toHaveTextContent('AAL2');
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
  });

  it('the recovery session ran out: the expired message', async () => {
    await ready();
    st.updatePassword.mockResolvedValue({ error: { code: 'session_not_found', message: 'Session not found' } });
    fillAndSubmit('new-password-1', 'new-password-1');
    expect(await screen.findByTestId('reset-link-problem')).toHaveTextContent('This link has expired or was already used.');
  });
});
