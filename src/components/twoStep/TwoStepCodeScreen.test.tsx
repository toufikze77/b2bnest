// The sign-in code screen: the main authenticator only, the backup as a choice at the bottom.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({
  verified: [] as { id: string; friendly_name?: string; factor_type: 'totp'; status: 'verified'; created_at: string; updated_at: string }[],
  result: null as null | { message: string; code?: string; status?: number },
  refresh: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
  verify: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'sam@example.test' }, signOut: st.signOut }) }));
vi.mock('@/hooks/useAssurance', () => ({ useAssurance: () => ({ verified: st.verified, refresh: st.refresh }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { mfa: { challengeAndVerify: async (a: { factorId: string; code: string }) => { st.verify(a); return { data: st.result ? null : {}, error: st.result }; } } } },
}));

import TwoStepCodeScreen from './TwoStepCodeScreen';

const f = (id: string, name: string, at: string) => ({ id, friendly_name: name, factor_type: 'totp' as const, status: 'verified' as const, created_at: at, updated_at: at });
const MAIN = f('main', 'Authenticator app', '2026-10-01T09:00:00Z');
const BACKUP = f('backup', 'Backup phone', '2026-10-05T09:00:00Z');
const THIRD = f('third', 'Tablet', '2026-10-09T09:00:00Z');
const show = () => render(<MemoryRouter><TwoStepCodeScreen /></MemoryRouter>);
const code = () => screen.getByLabelText('Code') as HTMLInputElement;
const submit = (v: string) => { fireEvent.change(code(), { target: { value: v } }); fireEvent.click(screen.getByRole('button', { name: 'Continue' })); };

beforeEach(() => { st.verified = []; st.result = null; vi.clearAllMocks(); });

describe('TwoStepCodeScreen', () => {
  it('one factor: the usual form, no choice of factor and no backup button', async () => {
    st.verified = [MAIN];
    show();
    expect(screen.getByRole('heading', { name: 'Enter your 6-digit code' })).toBeInTheDocument();
    expect(screen.getByText(/Open your authenticator app for sam@example.test/)).toBeInTheDocument();
    expect(screen.queryByTestId('two-step-factor-name')).toBeNull(); // the default name isn't repeated
    expect(screen.queryByRole('button', { name: /backup authenticator/ })).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    submit('123456');
    await waitFor(() => expect(st.verify).toHaveBeenCalledWith({ factorId: 'main', code: '123456' }));
  });

  it('two factors: only the main form, no radio list, no "Which app?"; the backup button sits at the bottom', () => {
    st.verified = [BACKUP, MAIN];
    show();
    expect(screen.queryByText('Which app?')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByText(/Backup phone/)).toBeNull(); // nothing offers the backup before the button is pressed
    const btn = screen.getByRole('button', { name: 'Use a backup authenticator instead' });
    const other = screen.getByRole('button', { name: 'Use a different account' });
    expect(btn.compareDocumentPosition(screen.getByRole('button', { name: 'Continue' })) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy(); // below the form
    expect(btn.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // above "Use a different account"
  });

  it('switching to the backup clears the code and error, focuses the field, announces it; switching back works; verified against the factor shown', async () => {
    st.verified = [MAIN, BACKUP];
    show();
    st.result = { message: 'Invalid TOTP code entered', code: 'mfa_verification_failed', status: 422 };
    submit('000000');
    expect(await screen.findByRole('alert')).toHaveTextContent("That code didn't work");
    expect(st.verify).toHaveBeenLastCalledWith({ factorId: 'main', code: '000000' });
    fireEvent.change(code(), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use a backup authenticator instead' }));
    expect(code()).toHaveValue('');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.activeElement).toBe(code());
    expect(screen.getByTestId('two-step-announce')).toHaveTextContent('Now using your backup: Backup phone.');
    expect(screen.getByTestId('two-step-announce')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('two-step-factor-name')).toHaveTextContent('Backup: Backup phone');
    expect(screen.getByText(/Open your backup authenticator app/)).toBeInTheDocument();
    st.result = null;
    submit('222222');
    await waitFor(() => expect(st.verify).toHaveBeenLastCalledWith({ factorId: 'backup', code: '222222' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use my main authenticator instead' }));
    expect(screen.getByTestId('two-step-announce')).toHaveTextContent('Now using your main authenticator.');
    expect(document.activeElement).toBe(code());
    submit('333333');
    await waitFor(() => expect(st.verify).toHaveBeenLastCalledWith({ factorId: 'main', code: '333333' }));
  });

  it('order is by created_at, not by name: an oldest factor called "Backup phone" is the main one', async () => {
    st.verified = [f('new', 'Authenticator app', '2026-10-20T09:00:00Z'), f('old', 'Backup phone', '2026-09-01T09:00:00Z')];
    show();
    expect(screen.getByTestId('two-step-factor-name')).toHaveTextContent(/^Backup phone$/); // main, shown by its own name
    submit('123456');
    await waitFor(() => expect(st.verify).toHaveBeenCalledWith({ factorId: 'old', code: '123456' }));
  });

  it('three factors: the backup button offers the next one each time', () => {
    st.verified = [THIRD, BACKUP, MAIN];
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Use a backup authenticator instead' }));
    expect(screen.getByTestId('two-step-factor-name')).toHaveTextContent('Backup: Backup phone');
    fireEvent.click(screen.getByRole('button', { name: 'Use another backup authenticator' }));
    expect(screen.getByTestId('two-step-factor-name')).toHaveTextContent('Backup: Tablet');
    fireEvent.click(screen.getByRole('button', { name: 'Use another backup authenticator' }));
    expect(screen.getByTestId('two-step-factor-name')).toHaveTextContent('Backup: Backup phone');
  });

  it('a wrong code does not switch factor; the rate-limit message is unchanged; lost-phone text and "Use a different account" stay', async () => {
    st.verified = [MAIN, BACKUP];
    show();
    st.result = { message: 'Invalid TOTP code entered', code: 'mfa_verification_failed', status: 422 };
    submit('000000');
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Use a backup authenticator instead' })).toBeInTheDocument(); // still on the main one
    st.result = { message: 'Too many requests', code: 'over_request_rate_limit', status: 429 };
    submit('111111');
    expect(await screen.findByText('Too many attempts. Wait a minute, then try again.')).toBeInTheDocument();
    expect(st.verify).toHaveBeenLastCalledWith({ factorId: 'main', code: '111111' });
    expect(screen.getByText(/Lost your phone\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use a different account' }));
    await waitFor(() => expect(st.signOut).toHaveBeenCalled());
  });
});
