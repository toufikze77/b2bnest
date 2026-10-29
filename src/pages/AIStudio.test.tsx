import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked access and server only — nothing is sent.
const accessMock = vi.hoisted(() => ({ value: { loading: false, state: 'trial', planKey: null as string | null, via: 'self' } }));
const invoke = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useAccess', () => ({ useAccess: () => accessMock.value }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'sam@example.com' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock('@/components/Footer', () => ({ default: () => null }));
vi.mock('@/components/SubscriptionUpgrade', () => ({ default: () => <div data-testid="plans">plans</div> }));
vi.mock('@/integrations/supabase/client', () => {
  const q: Record<string, unknown> = {};
  Object.assign(q, { select: () => q, order: () => q, limit: () => Promise.resolve({ data: [], error: null }), single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }) });
  return { supabase: { from: () => q, functions: { invoke: (...a: unknown[]) => invoke(...a) }, auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) } } };
});

import AIStudio from './AIStudio';

// Radix pieces used in the page need these in jsdom.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
const pick = async (index: number, name: string) => {
  fireEvent.pointerDown(screen.getAllByRole('combobox')[index], { button: 0, pointerType: 'mouse' });
  fireEvent.click(await screen.findByRole('option', { name }));
};
import AIBusinessAdvisor from '@/components/ai/AIBusinessAdvisor';
import IntelligentAnalytics from '@/components/ai/IntelligentAnalytics';
import { AI_QUESTION_MAX_LENGTH } from '@/lib/aiStudio';

const set = (state: string, planKey: string | null = null, via = 'self') => { accessMock.value = { loading: false, state, planKey, via }; };
const httpError = (status: number, body: unknown) => Object.assign(new Error(`Edge function returned ${status}`), {
  name: 'FunctionsHttpError', context: new Response(JSON.stringify(body), { status }),
});
const page = () => render(<MemoryRouter><AIStudio /></MemoryRouter>);
const tab = async (name: RegExp) => { fireEvent.mouseDown(screen.getByRole('tab', { name })); fireEvent.click(screen.getByRole('tab', { name })); };

beforeEach(() => { invoke.mockReset(); toastMock.mockReset(); set('trial'); });

describe('AI Studio tabs and locks (Phase 20)', () => {
  it('Solo: only Workflows is marked, "Business"; its card says Business and Scale and links to plans and the guide', async () => {
    set('subscribed', 'starter');
    page();
    expect(screen.getByTestId('lock-workflows')).toHaveTextContent('Business');
    expect(screen.queryByTestId('lock-advisor')).toBeNull();
    expect(screen.queryByText('PREMIUM')).toBeNull();
    await tab(/Workflows/);
    const card = await screen.findByTestId('workflows-card-upgrade');
    expect(card).toHaveTextContent('Workflows are included in the Business and Scale plans.');
    expect(within(card).getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/pricing');
    expect(within(card).getByRole('link', { name: /How workflows work/ })).toHaveAttribute('href', '/knowledge-base/workflows');
  });

  it('Business: no marks; the Workflows card opens Workflows', async () => {
    set('subscribed', 'professional');
    page();
    expect(screen.queryByTestId('lock-workflows')).toBeNull();
    await tab(/Workflows/);
    const card = await screen.findByTestId('workflows-card');
    expect(within(card).getByRole('button', { name: 'Open Workflows' })).toBeInTheDocument();
    expect(card).toHaveTextContent('Business and Scale plans, and during the 14-day trial');
  });

  it('trial ended: every tab says "Plan needed" and the Advisor shows the plans, not the form', () => {
    set('trial_ended');
    page();
    for (const id of ['advisor', 'analytics', 'workflows', 'personalization']) expect(screen.getByTestId(`lock-${id}`)).toHaveTextContent('Plan needed');
    expect(screen.getByTestId('locked-panel')).toHaveTextContent('Your 14-day trial has ended');
    expect(screen.getByTestId('plans')).toBeInTheDocument();
  });

  it('suspended: no plans or payment wording, a contact link instead', () => {
    set('suspended');
    page();
    const panel = screen.getByTestId('locked-panel');
    expect(panel).toHaveTextContent('This account has been suspended');
    expect(within(panel).getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
    expect(screen.queryByTestId('plans')).toBeNull();
  });
});

describe('Advisor (Phase 20)', () => {
  const fill = () => {
    fireEvent.change(screen.getByLabelText('Your Question'), { target: { value: 'How can I cut costs?' } });
  };
  const choose = async () => { await pick(0, 'Retail'); await pick(1, 'Startup'); };

  it('shows the server\'s own reason in the toast (no credits left), not "Failed to get advice"', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(402, { error: 'insufficient_credits', message: "You've used all your AI credits for this month (250 a month on your plan)." }) });
    render(<AIBusinessAdvisor />);
    fill(); await choose();
    fireEvent.click(screen.getByRole('button', { name: /Ask AI Advisor/ }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: "You've used all your AI credits for this month (250 a month on your plan).", variant: 'destructive' })));
  });

  it('after an answer, shows the credits left; the question box has the server limit and a counter', async () => {
    invoke.mockResolvedValue({ data: { response: 'Cut software seats.', credits_remaining: 41, credits_limit: 250 }, error: null });
    render(<AIBusinessAdvisor />);
    const box = screen.getByLabelText('Your Question');
    expect(box).toHaveAttribute('maxLength', String(AI_QUESTION_MAX_LENGTH));
    fill();
    expect(screen.getByText(`20 / ${AI_QUESTION_MAX_LENGTH.toLocaleString('en-GB')} characters`)).toBeInTheDocument();
    await choose();
    fireEvent.click(screen.getByRole('button', { name: /Ask AI Advisor/ }));
    expect(await screen.findByTestId('credits-left')).toHaveTextContent('You have 41 of 250 AI credits left this month.');
    expect(screen.getByText('Cut software seats.')).toBeInTheDocument();
  });
});

describe('Intelligent Analytics (Phase 20)', () => {
  it('the example-figures label is on the screen; industry and stage must be chosen, then are sent as chosen', async () => {
    invoke.mockResolvedValue({ data: { insight: { id: 'i1' } }, error: null });
    render(<IntelligentAnalytics />);
    expect(screen.getByTestId('example-figures-banner')).toHaveTextContent('Based on example figures, not your business data');
    fireEvent.click(screen.getAllByText('Cost Forecasting')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Generate Insights/ }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Choose your industry and stage' })));
    expect(invoke).not.toHaveBeenCalled();
    await pick(0, 'Healthcare'); await pick(1, 'Established');
    fireEvent.click(screen.getByRole('button', { name: /Generate Insights/ }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke.mock.calls[0][1].body).toMatchObject({ analysisType: 'cost_forecast', industry: 'healthcare', businessStage: 'established' });
  });

  it('shows the server\'s reason when the AI gives no usable analysis', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(502, { error: 'ai_failed', message: "The AI service didn't return a usable analysis, so nothing was saved. No credit was used. Please try again." }) });
    render(<IntelligentAnalytics />);
    fireEvent.click(screen.getAllByText('Industry Trends')[0]);
    await pick(0, 'Retail'); await pick(1, 'Startup');
    fireEvent.click(screen.getByRole('button', { name: /Generate Insights/ }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringMatching(/nothing was saved. No credit was used/) })));
  });
});
