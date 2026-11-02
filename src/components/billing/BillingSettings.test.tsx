// Phase 26: Settings → Billing for accounts with and without a paid plan; customer-portal errors in plain words.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
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
const lots = vi.hoisted(() => ({ found: [] as boolean[], asked: [] as string[] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  functions: { invoke: (...a: unknown[]) => st.invoke(...a) },
  // Phase 37: the Billing page looks for the customer's own new lot after Stripe sends them back.
  from: () => ({ select: () => ({ eq: (_c: string, v: string) => ({ maybeSingle: async () => {
    lots.asked.push(v); const hit = lots.found.shift() ?? false; return { data: hit ? { id: 'lot-1' } : null, error: null };
  } }) }) }),
} }));

import BillingSettings from './BillingSettings';
import { aiCreditsMock } from '@/test/aiCreditsMock';

const fnError = (status: number, body: unknown) => ({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { status, json: async () => body } } });
const show = (path = '/settings?tab=billing') => render(<MemoryRouter initialEntries={[path]}><BillingSettings /></MemoryRouter>);
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
    expect(within(screen.getByTestId('billing-no-plan')).getByRole('link', { name: 'View plans' })).toHaveAttribute('href', '/pricing');
    expect(screen.queryByRole('button', { name: /Manage billing/ })).toBeNull();
    expect(st.invoke).not.toHaveBeenCalledWith('customer-portal');
  });

  it('trial ended: says so, "View plans", no "Manage billing"', () => {
    st.access = { ...st.access, state: 'trial_ended', inTrial: false, trialEnded: true, daysLeft: 0 };
    show();
    expect(screen.getByText('Your 14-day trial has ended')).toBeInTheDocument();
    expect(within(screen.getByTestId('billing-no-plan')).getByRole('link', { name: 'View plans' })).toBeInTheDocument();
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
    expect(screen.getByText("Advisor answers use 1 credit, contracts and legal notices use 10. Unused monthly credits don't roll over; top-up credits last 12 months and are used after your monthly credits.")).toBeInTheDocument();
  });
});

describe('Settings → Billing: AI credit top-ups (Phase 37)', () => {
  const RULES = "Top-up credits last 12 months and are used after your monthly credits. Monthly credits don't roll over. For subscribers only. Prices as shown.";
  beforeEach(() => { lots.found = []; lots.asked = []; });

  it('a subscriber sees three packs with price and price per credit, the rules, and the top-up balance', () => {
    paid();
    aiCreditsMock.state.credits = { remaining: 342, limit: 250, resetDate: '2026-12-01T00:00:00Z', tier: 'Business', notStarted: false,
      monthlyRemaining: 42, topupCredits: 300, topupNextExpiry: '2027-11-02T10:00:00Z' };
    show();
    const card = screen.getByTestId('ai-topup-card');
    expect(within(card).getAllByRole('button', { name: /^Buy / }).map((b) => b.getAttribute('aria-label')))
      .toEqual(['Buy 100 credits for £5', 'Buy 300 credits for £12', 'Buy 1,000 credits for £35']);
    expect(card).toHaveTextContent('5p a credit'); expect(card).toHaveTextContent('4p a credit'); expect(card).toHaveTextContent('3.5p a credit');
    expect(card).toHaveTextContent(RULES);
    expect(card).toHaveTextContent('+ 300 top-up credits (expire from 2 November 2027)');
    expect(screen.getByTestId('ai-credits-card')).toHaveTextContent('42 of 250 AI credits left this month');
  });

  it('Buy sends only the pack id and goes to Stripe', async () => {
    paid();
    const assign = vi.fn();
    const orig = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...orig, assign } });
    st.invoke.mockResolvedValue({ data: { url: 'https://checkout.stripe.com/c/pay/cs_test_1' }, error: null });
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Buy 300 credits for £12' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1'));
    expect(st.invoke).toHaveBeenCalledWith('create-ai-topup-checkout', { body: { packId: 'credits_300' } });
    Object.defineProperty(window, 'location', { configurable: true, value: orig });
  });

  it("flag off / refused: the server's own words in a toast", async () => {
    paid();
    st.invoke.mockResolvedValue(fnError(503, { error: 'topups_disabled', message: "Top-ups aren't available yet." }));
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Buy 100 credits for £5' }));
    await waitFor(() => expect(st.toast).toHaveBeenCalled());
    expect((st.toast.mock.calls[0][0] as { description: string }).description).toBe("Top-ups aren't available yet.");
  });

  it('a trial user: "Choose a plan first. Top-ups are for subscribers." with View plans, no Buy', () => {
    show();
    const card = screen.getByTestId('ai-topup-card');
    expect(within(card).getByText('Choose a plan first. Top-ups are for subscribers.')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'View plans' })).toHaveAttribute('href', '/pricing');
    expect(within(card).queryByRole('button', { name: /^Buy / })).toBeNull();
  });

  it('a company member: no Buy (the company plan is not theirs)', () => {
    st.access = { state: 'subscribed', via: 'company', inTrial: false, trialEnded: false, daysLeft: 0, planKey: 'professional', ownerName: 'Alex Owner', loading: false };
    show();
    expect(screen.getByTestId('topup-company')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Buy / })).toBeNull();
  });

  it('an owner / master account (no plan) may buy, for testing', () => {
    st.access = { state: 'owner', via: 'self', inTrial: false, trialEnded: false, daysLeft: 0, planKey: null, ownerName: null, loading: false };
    show();
    expect(screen.getAllByRole('button', { name: /^Buy / })).toHaveLength(3);
  });

  it('back from Stripe: "Payment received…", then looks for the purchase until it appears', async () => {
    vi.useFakeTimers();
    try {
      paid(); lots.found = [false, true];
      show('/settings?tab=billing&topup=success&session_id=cs_test_abc');
      expect(screen.getByTestId('topup-waiting')).toHaveTextContent('Payment received. Your credits will appear in a moment.');
      await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
      expect(screen.getByTestId('topup-waiting')).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
      expect(screen.getByTestId('topup-arrived')).toHaveTextContent('Your top-up credits are ready.');
      expect(lots.asked).toEqual(['cs_test_abc', 'cs_test_abc']);
      expect(aiCreditsMock.refetch).toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it('back from Stripe, webhook late: stops after 5 tries and says so (never "failed")', async () => {
    vi.useFakeTimers();
    try {
      paid();
      show('/settings?tab=billing&topup=success&session_id=cs_test_late');
      for (let i = 0; i < 5; i++) await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
      expect(screen.getByTestId('topup-still-waiting')).toHaveTextContent("you won't be charged twice");
      expect(lots.asked).toHaveLength(5);
      await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
      expect(lots.asked).toHaveLength(5);
    } finally { vi.useRealTimers(); }
  });

  it('cancelled at Stripe: "Nothing was charged"', () => {
    paid();
    show('/settings?tab=billing&topup=cancelled');
    expect(screen.getByTestId('topup-cancelled')).toHaveTextContent('Payment cancelled. Nothing was charged.');
  });
});
