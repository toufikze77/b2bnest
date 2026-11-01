// Phase 26: Settings → Billing for accounts with and without a paid plan; customer-portal errors in plain words.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const st = vi.hoisted(() => ({
  access: { state: 'trial', via: 'self', inTrial: true, trialEnded: false, daysLeft: 9, planKey: null, ownerName: null, loading: false } as Record<string, unknown>,
  stored: { subscribed: false, subscription_tier: 'free', subscription_end: null as string | null, loading: false },
  invoke: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/hooks/useAccess', () => ({ useAccess: () => st.access }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => st.stored }));
vi.mock('@/hooks/useBillingStatus', () => ({ useBillingStatus: () => ({ status: null, reload: vi.fn() }), poundsText: (p: number) => `£${(p / 100).toFixed(2)}` }));
vi.mock('@/hooks/use-toast', () => ({ toast: (...a: unknown[]) => st.toast(...a) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => st.invoke(...a) } } }));

import BillingSettings from './BillingSettings';
import { aiCreditsMock } from '@/test/aiCreditsMock';

const fnError = (status: number, body: unknown) => ({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { status, json: async () => body } } });
const show = () => render(<MemoryRouter><BillingSettings /></MemoryRouter>);
const paid = () => {
  st.access = { state: 'subscribed', via: 'self', inTrial: false, trialEnded: false, daysLeft: 0, planKey: 'professional', ownerName: null, loading: false };
  st.stored = { subscribed: true, subscription_tier: 'Professional', subscription_end: '2026-12-01T00:00:00Z', loading: false };
};

beforeEach(() => {
  st.access = { state: 'trial', via: 'self', inTrial: true, trialEnded: false, daysLeft: 9, planKey: null, ownerName: null, loading: false };
  st.stored = { subscribed: false, subscription_tier: 'free', subscription_end: null, loading: false };
  st.invoke.mockReset(); st.toast.mockReset();
});

describe('Settings → Billing: no paid plan', () => {
  it('trial: "View plans" (to /pricing), the trial line, and NO "Manage billing"; the portal is never called', () => {
    show();
    expect(screen.getByText('No plan yet')).toBeInTheDocument();
    expect(screen.getByText('Free trial: 9 days left')).toBeInTheDocument();
    expect(screen.getByText("You don't have a paid plan yet.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View plans' })).toHaveAttribute('href', '/pricing');
    expect(screen.queryByRole('button', { name: /Manage billing/ })).toBeNull();
    expect(st.invoke).not.toHaveBeenCalledWith('customer-portal');
  });

  it('trial ended: says so, "View plans", no "Manage billing"', () => {
    st.access = { ...st.access, state: 'trial_ended', inTrial: false, trialEnded: true, daysLeft: 0 };
    show();
    expect(screen.getByText('Your 14-day trial has ended')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View plans' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Manage billing/ })).toBeNull();
  });

  it('a stale "subscribed" row does not bring Manage billing back: the access state decides', () => {
    st.stored = { ...st.stored, subscribed: true };
    show();
    expect(screen.queryByRole('button', { name: /Manage billing/ })).toBeNull();
  });

  it('a member of a paying company: told who pays, no Manage billing', () => {
    st.access = { state: 'subscribed', via: 'company', inTrial: false, trialEnded: false, daysLeft: 0, planKey: 'professional', ownerName: 'Alex Owner', loading: false };
    show();
    expect(screen.getByText(/paid by Alex Owner/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Manage billing/ })).toBeNull();
  });
});

describe('Settings → Billing: paid plan', () => {
  it('shows Manage billing and Change plan as before, and opens the portal', async () => {
    paid();
    st.invoke.mockResolvedValue({ data: { url: 'https://billing.stripe.com/p/session/x' }, error: null });
    show();
    expect(screen.queryByText("You don't have a paid plan yet.")).toBeNull();
    expect(screen.getByRole('button', { name: 'Change plan' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Manage billing/ }));
    await waitFor(() => expect(st.invoke).toHaveBeenCalledWith('customer-portal'));
  });

  it('portal 404 no_customer: "You don\'t have a billing account yet. Choose a plan first." with a View plans action', async () => {
    paid();
    st.invoke.mockResolvedValue(fnError(404, { error: 'No verified billing account found for this user. Please contact support.', reason: 'no_customer' }));
    show();
    fireEvent.click(screen.getByRole('button', { name: /Manage billing/ }));
    await waitFor(() => expect(st.toast).toHaveBeenCalled());
    const t = st.toast.mock.calls[0][0] as { title: string; description: string; variant?: string; action?: { props: { children: string } } };
    expect(t.description).toBe("You don't have a billing account yet. Choose a plan first.");
    expect(t.variant).toBeUndefined();
    expect(t.action?.props.children).toBe('View plans');
  });

  it('portal 409: a plain error with the function\'s own text, never "non-2xx"', async () => {
    paid();
    st.invoke.mockResolvedValue(fnError(409, { error: "We couldn't link your billing account. Please contact support.", reason: 'unverified' }));
    show();
    fireEvent.click(screen.getByRole('button', { name: /Manage billing/ }));
    await waitFor(() => expect(st.toast).toHaveBeenCalled());
    const t = st.toast.mock.calls[0][0] as { title: string; description: string; variant?: string };
    expect([t.title, t.description, t.variant]).toEqual(['Billing portal unavailable', "We couldn't link your billing account. Please contact support.", 'destructive']);
  });

  it('portal 500: plain error, first line only (no stack trace), never "non-2xx"', async () => {
    paid();
    st.invoke.mockResolvedValue(fnError(500, { error: 'Stripe is not reachable right now\n    at Object.create (stripe.js:1:1)' }));
    show();
    fireEvent.click(screen.getByRole('button', { name: /Manage billing/ }));
    await waitFor(() => expect(st.toast).toHaveBeenCalled());
    const t = st.toast.mock.calls[0][0] as { description: string; variant?: string };
    expect(t.description).toBe('Stripe is not reachable right now');
    expect(t.variant).toBe('destructive');
  });

  it('portal error with no readable body: "Please try again later.", not the client\'s "non-2xx" text', async () => {
    paid();
    st.invoke.mockResolvedValue({ data: null, error: { message: 'Edge Function returned a non-2xx status code' } });
    show();
    fireEvent.click(screen.getByRole('button', { name: /Manage billing/ }));
    await waitFor(() => expect(st.toast).toHaveBeenCalled());
    expect((st.toast.mock.calls[0][0] as { description: string }).description).toBe('Please try again later.');
  });
});

describe('Settings → Billing: AI credits (Phase 30c)', () => {
  it('shows the credit card with what features cost', () => {
    aiCreditsMock.state.credits = { remaining: 42, limit: 250, resetDate: '2026-12-01T00:00:00Z', tier: 'Business', notStarted: false };
    show();
    expect(screen.getByTestId('ai-credits-card')).toHaveTextContent('42 of 250 AI credits left');
    expect(screen.getByText('Resets 1 December 2026')).toBeInTheDocument();
    expect(screen.getByText("Advisor answers use 1 credit, contracts and legal notices use 2. Unused credits don't roll over.")).toBeInTheDocument();
  });
});
