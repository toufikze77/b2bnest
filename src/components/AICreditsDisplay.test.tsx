import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { aiCreditsMock } from '@/test/aiCreditsMock';

const access = vi.hoisted(() => ({ value: { inTrial: false } as Record<string, unknown> }));
vi.mock('@/hooks/useAccess', () => ({ useAccess: () => access.value }));

import AICreditsDisplay from '@/components/AICreditsDisplay';

const set = (remaining: number, limit: number, extra: Record<string, unknown> = {}) => {
  aiCreditsMock.state.credits = { remaining, limit, resetDate: '2026-12-01T00:00:00Z', tier: 'Business', notStarted: false, ...extra };
};

describe('AICreditsDisplay', () => {
  it('normal: "42 of 250 AI credits left", the en-GB reset date and a labelled bar', () => {
    set(200, 250);
    render(<AICreditsDisplay />);
    expect(screen.getByText('200 of 250 AI credits left')).toBeInTheDocument();
    expect(screen.getByText('Resets 1 December 2026')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'AI credits left this month' });
    expect(bar).toHaveAttribute('aria-valuenow', '200');
    expect(bar).toHaveAttribute('aria-valuemax', '250');
    expect(screen.getByTestId('ai-credits-card')).toHaveAttribute('data-level', 'ok');
    expect(screen.queryByText(/Running low/)).toBeNull();
  });

  it('low (<20%) is amber, critical (<10%) is red', () => {
    set(42, 250);
    const { unmount } = render(<AICreditsDisplay />);
    expect(screen.getByTestId('ai-credits-card')).toHaveAttribute('data-level', 'low');
    expect(screen.getByRole('progressbar').firstElementChild).toHaveClass('bg-warning');
    expect(screen.getByText(/Running low/)).toBeInTheDocument();
    unmount();
    set(20, 250);
    render(<AICreditsDisplay />);
    expect(screen.getByTestId('ai-credits-card')).toHaveAttribute('data-level', 'critical');
    expect(screen.getByRole('progressbar').firstElementChild).toHaveClass('bg-destructive');
  });

  it('limit 0: "No AI credits on this plan", no bar, no division by zero', () => {
    set(0, 0);
    render(<AICreditsDisplay />);
    expect(screen.getByText('No AI credits on this plan')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it('loading: a skeleton, not nothing (no layout jump)', () => {
    aiCreditsMock.state = { credits: null, loading: true, error: null };
    render(<AICreditsDisplay />);
    expect(screen.getByTestId('ai-credits-loading')).toBeInTheDocument();
  });

  it('error: a quiet line with Retry', () => {
    aiCreditsMock.state = { credits: null, loading: false, error: new Error('boom') };
    render(<AICreditsDisplay />);
    expect(screen.getByTestId('ai-credits-error')).toHaveTextContent("Couldn't load your credits");
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(aiCreditsMock.refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('compact variant: one line', () => {
    set(42, 250);
    render(<AICreditsDisplay variant="compact" />);
    expect(screen.getByTestId('ai-credits-compact')).toHaveTextContent('42 of 250 AI credits left · Resets 1 December 2026');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('no subscribers row yet, in the trial: the real 10, "Included in your free trial", no invented reset date', () => {
    access.value = { inTrial: true };
    aiCreditsMock.state.credits = { remaining: 50, limit: 50, resetDate: null, tier: 'free', notStarted: true };
    render(<AICreditsDisplay variant="compact" />);
    const line = screen.getByTestId('ai-credits-compact');
    expect(line).toHaveTextContent('50 of 50 AI credits left · Included in your free trial. Your 50 credits start counting from your first AI request.');
    expect(line).not.toHaveTextContent('Resets');
    access.value = { inTrial: false };
  });
});
