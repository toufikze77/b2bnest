import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phase 39: these are the signed-out (browser only) behaviours; signed-in saving is in src/components/freeTools/*.test.tsx.
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/hooks/useAccess', () => ({ useAccess: () => ({ loading: false, trialEnded: false, suspended: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: new Proxy({}, { get: () => { throw new Error('signed out: no database call'); } }) }));
import { SCENARIOS_KEY } from '@/lib/roi';

vi.mock('recharts', async (orig) => {
  const m = await orig<typeof import('recharts')>();
  return { ...m, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div style={{ width: 600, height: 220 }}>{children}</div> };
});
import ROICalculator from './ROICalculator';

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe('ROI Calculator (Phase 38)', () => {
  it('with no input: an empty state, no NaN, no scenarios', () => {
    render(<ROICalculator />, { wrapper: MemoryRouter });
    expect(screen.getByTestId('roi-empty')).toBeInTheDocument();
    expect(screen.getByTestId('roi-no-scenarios')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|\$/);
  });

  it('shows results as you type, with the plain-words verdict, in an aria-live region', () => {
    render(<ROICalculator />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getByLabelText('Each month'));
    type('Initial investment (£)', '10,000');
    type('Ongoing monthly cost (£, optional)', '100');
    type('Expected monthly return (£)', '1200');
    type('Discount rate (% a year, optional)', '10');
    const results = screen.getByTestId('roi-results');
    expect(results).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('roi-verdict')).toHaveTextContent('Pays back in 10 months, with £3,200.00 profit over 12 months.');
    expect(results).toHaveTextContent('28.57%');
    expect(results).toHaveTextContent('9.1 months');
    expect(results).toHaveTextContent('£933.33');
    expect(results).toHaveTextContent('£2,540.54');
    expect(results).toHaveTextContent('not financial advice');
  });

  it('errors appear under the field in words (not only a toast)', () => {
    render(<ROICalculator />, { wrapper: MemoryRouter });
    type('Initial investment (£)', '-5');
    expect(screen.getByText("The initial investment can't be negative.")).toBeInTheDocument();
    expect(screen.getByLabelText('Initial investment (£)')).toHaveAttribute('aria-invalid', 'true');
    type('Timeframe (months)', '0');
    expect(screen.getByText('The timeframe must be at least 1 month.')).toBeInTheDocument();
  });

  it('signed out: the results are open; saving and the CSV ask for a free account (the tool keeps working)', () => {
    render(<ROICalculator />, { wrapper: MemoryRouter });
    type('Initial investment (£)', '5000');
    type('Expected total return (£)', '6000');
    expect(screen.getByTestId('roi-verdict')).toBeInTheDocument();
    fireEvent.submit(screen.getByRole('form', { name: 'ROI inputs' }));
    const prompt = screen.getByTestId('account-prompt');
    expect(prompt).toHaveTextContent('Create a free account to save and download');
    expect(within(prompt).getByRole('link', { name: 'Create a free account' })).toHaveAttribute('href', '/auth?next=%2Fbusiness-tools%3Ftool%3Droi-calculator&mode=signup');
    expect(within(prompt).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth?next=%2Fbusiness-tools%3Ftool%3Droi-calculator');
    expect(localStorage.getItem(SCENARIOS_KEY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('account-prompt')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/ }));
    expect(screen.getByTestId('account-prompt')).toBeInTheDocument();
    expect(screen.getByTestId('roi-verdict')).toBeInTheDocument(); // never blocks the tool
  });

  it('scenarios saved in this browser before (Phase 38) are still shown, compared and deletable when signed out', () => {
    const form = { name: '', investment: '5000', monthlyCost: '', mode: 'total', totalReturn: '6000', monthlyReturn: '', months: '12', residual: '', discountRate: '' };
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify([{ id: '1', name: 'Van', form, savedAt: '' }, { id: '2', name: 'Website', form: { ...form, totalReturn: '9000' }, savedAt: '' }]));
    render(<ROICalculator />, { wrapper: MemoryRouter });
    expect(within(screen.getByTestId('roi-compare')).getByText('Website (best ROI)')).toBeInTheDocument();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(JSON.parse(localStorage.getItem(SCENARIOS_KEY)!)).toEqual([]);
  });

  it('keeps the figures in progress for this tab, so they are still there after signing in', () => {
    const { unmount } = render(<ROICalculator />, { wrapper: MemoryRouter });
    type('Initial investment (£)', '5000');
    unmount();
    render(<ROICalculator />, { wrapper: MemoryRouter });
    expect(screen.getByLabelText('Initial investment (£)')).toHaveValue('5000');
  });
});
