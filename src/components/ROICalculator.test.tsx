import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCENARIOS_KEY } from '@/lib/roi';

vi.mock('recharts', async (orig) => {
  const m = await orig<typeof import('recharts')>();
  return { ...m, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div style={{ width: 600, height: 220 }}>{children}</div> };
});
import ROICalculator from './ROICalculator';

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => { localStorage.clear(); });

describe('ROI Calculator (Phase 38)', () => {
  it('with no input: an empty state, no NaN, no scenarios', () => {
    render(<ROICalculator />);
    expect(screen.getByTestId('roi-empty')).toBeInTheDocument();
    expect(screen.getByTestId('roi-no-scenarios')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|\$/);
  });

  it('shows results as you type, with the plain-words verdict, in an aria-live region', () => {
    render(<ROICalculator />);
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
    render(<ROICalculator />);
    type('Initial investment (£)', '-5');
    expect(screen.getByText("The initial investment can't be negative.")).toBeInTheDocument();
    expect(screen.getByLabelText('Initial investment (£)')).toHaveAttribute('aria-invalid', 'true');
    type('Timeframe (months)', '0');
    expect(screen.getByText('The timeframe must be at least 1 month.')).toBeInTheDocument();
  });

  it('saves scenarios to compare (browser only), marks the best ROI in text, and survives a reload', () => {
    const { unmount } = render(<ROICalculator />);
    type('Project name (optional)', 'Van');
    type('Initial investment (£)', '5000');
    type('Expected total return (£)', '6000');
    fireEvent.submit(screen.getByRole('form', { name: 'ROI inputs' }));
    type('Project name (optional)', 'Website');
    type('Expected total return (£)', '9000');
    fireEvent.submit(screen.getByRole('form', { name: 'ROI inputs' }));
    const table = screen.getByTestId('roi-compare');
    expect(within(table).getByText('Website (best ROI)')).toBeInTheDocument();
    expect(within(table).getByText('Van')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SCENARIOS_KEY)!)).toHaveLength(2);
    expect(screen.getByText('ROI by scenario')).toBeInTheDocument();
    unmount();
    render(<ROICalculator />);
    expect(within(screen.getByTestId('roi-compare')).getByText('Website (best ROI)')).toBeInTheDocument();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByTestId('roi-no-scenarios')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SCENARIOS_KEY)!)).toEqual([]);
  });
});
