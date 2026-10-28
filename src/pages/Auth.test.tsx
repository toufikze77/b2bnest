import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let signInError: { code?: string; message: string } | null = null;
const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a), useToast: () => ({ toast }) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null, loading: false,
    signIn: async () => ({ data: null, error: signInError }),
    signUp: async () => ({ error: null }), verify2FA: async () => ({ error: null }), sendVerificationCode: async () => ({ error: null }),
    signInWithOAuth: async () => ({ error: null }),
  }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { resend: async () => ({ error: null }) }, from: () => ({}) } }));

import Auth from './Auth';
import { BANNED_MESSAGE } from '@/lib/authErrors';

const signInWith = async () => {
  render(<MemoryRouter initialEntries={['/auth']}><Auth /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-password' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
};

describe('Sign in: suspended (banned) account', () => {
  beforeEach(() => { toast.mockClear(); });

  it('a banned sign-in says the account is suspended, with a Contact link (not a generic error)', async () => {
    signInError = { code: 'user_banned', message: 'User is banned' };
    await signInWith();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This account has been suspended. Contact us.');
    expect(screen.getByRole('link', { name: 'Contact us.' })).toHaveAttribute('href', '/contact');
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Account suspended', description: BANNED_MESSAGE })));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Sign In Failed' }));
  });

  it('other sign-in errors are unchanged', async () => {
    signInError = { code: 'invalid_credentials', message: 'Invalid login credentials' };
    await signInWith();
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sign In Failed', description: 'Invalid login credentials' })));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
