import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({
  user: { id: 'u1' } as null | { id: string },
  row: null as null | { consented: boolean; updated_at: string },
  missing: false,
  rpc: [] as [string, unknown][],
  signUp: vi.fn(async () => ({ error: null })),
}));
const MISSING = { code: 'PGRST202', message: 'Could not find the function public.marketing_consent_set' };
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: st.user, loading: false, signIn: async () => ({ error: null }), signUp: st.signUp, signInWithOAuth: async () => ({ error: null }) }),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { resend: async () => ({ error: null }) },
    rpc: async (fn: string, args: { p_consented?: boolean }) => {
      st.rpc.push([fn, args]);
      if (st.missing) return { data: null, error: MISSING };
      if (fn === 'marketing_consent_set') { st.row = { consented: !!args.p_consented, updated_at: '2026-11-02T10:00:00Z' }; return { data: st.row, error: null }; }
      return { data: { recorded: false, reason: 'no_choice' }, error: null };
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => (st.missing ? { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.marketing_consents'" } } : { data: st.row, error: null }) }) }) }),
  },
}));

import Auth from '@/pages/Auth';
import { ConsentRecorder, MarketingConsentSwitch } from './MarketingConsent';
import { CONSENT_TEXT, signupSourceFromNext } from '@/lib/marketingConsent';

beforeEach(() => { st.user = { id: 'u1' }; st.row = null; st.missing = false; st.rpc = []; st.signUp.mockClear(); sessionStorage.clear(); });

const signUpForm = (path: string) => {
  st.user = null;
  render(<MemoryRouter initialEntries={[path]}><Auth /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Ada Lovelace' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-long-password' } });
};

describe('sign-up (Phase 39b): no marketing checkbox; the free tool signed up from is still passed', () => {
  it('the sign-up form has no marketing checkbox, and sign-up passes only signup_source', async () => {
    signUpForm('/auth?mode=signup');
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(CONSENT_TEXT)).toBeNull();
    expect(screen.queryByText(/tips and offers/i)).toBeNull();
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
    await waitFor(() => expect(st.signUp).toHaveBeenCalledTimes(1));
    expect(st.signUp).toHaveBeenCalledWith('ada@example.test', 'a-long-password', 'Ada Lovelace', '', { signup_source: 'signup' });
  });

  it('from a free tool: that tool is the source, and no marketing choice is sent', async () => {
    signUpForm(`/auth?next=${encodeURIComponent('/business-tools?tool=roi-calculator')}&mode=signup`);
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
    await waitFor(() => expect(st.signUp).toHaveBeenCalledWith('ada@example.test', 'a-long-password', 'Ada Lovelace', '', { signup_source: 'roi-calculator' }));
    expect(JSON.stringify(st.signUp.mock.calls[0])).not.toMatch(/marketing_consent/);
  });

  it('the sign-in form has no checkbox either', () => {
    st.user = null;
    render(<MemoryRouter initialEntries={['/auth']}><Auth /></MemoryRouter>);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('source: only one of the seven free tools, else "signup"', () => {
    expect(signupSourceFromNext('/business-tools?tool=cost-calculator')).toBe('cost-calculator');
    expect(signupSourceFromNext('/business-tools?tool=crm')).toBe('signup');
    expect(signupSourceFromNext('/settings')).toBe('signup');
    expect(signupSourceFromNext(null)).toBe('signup');
  });

  it('after sign-in the choice is recorded once on the server (errors ignored)', async () => {
    const { rerender } = render(<ConsentRecorder />);
    await waitFor(() => expect(st.rpc).toEqual([['marketing_consent_record_signup', undefined]]));
    rerender(<ConsentRecorder />);
    render(<ConsentRecorder />);
    expect(st.rpc).toHaveLength(1);
    st.missing = true; st.user = { id: 'u2' };
    expect(() => render(<ConsentRecorder />)).not.toThrow();
  });
});

describe('Settings → Notifications: the marketing switch', () => {
  it('starts from the saved choice, saves changes to the same record and announces them', async () => {
    render(<MarketingConsentSwitch />);
    const sw = screen.getByRole('switch');
    await waitFor(() => expect(sw).not.toBeDisabled());
    expect(sw).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    await waitFor(() => expect(screen.getByTestId('consent-announce')).toHaveTextContent("Saved: you'll get tips and offers by email (from 2 Nov 2026)."));
    expect(screen.getByTestId('consent-announce')).toHaveAttribute('aria-live', 'polite');
    expect(st.rpc).toEqual([['marketing_consent_set', { p_consented: true, p_source: 'settings' }]]);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(screen.getByTestId('consent-announce')).toHaveTextContent('Saved: no tips or offers by email. Emails about your account are not affected.'));
    expect(st.row?.consented).toBe(false);
  });

  it('before the database update: says so, and the switch is off and disabled', async () => {
    st.missing = true;
    render(<MarketingConsentSwitch />);
    await waitFor(() => expect(screen.getByTestId('consent-announce')).toHaveTextContent('Saving this choice needs a database update.'));
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
