import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PendingPlanChange } from './BillingSettings';

describe('PendingPlanChange', () => {
  it('shows plan, start date, next price and a keep-plan control', () => {
    const onKeep = vi.fn();
    render(<PendingPlanChange pending={{ plan: 'Starter', interval: 'month', price: 1900, effectiveDate: '2026-11-04T00:00:00Z' }} busy={false} onKeep={onKeep} />);
    expect(screen.getByText('Starter')).toBeTruthy();
    expect(screen.getByText('4 November 2026')).toBeTruthy();
    expect(screen.getByText('£19.00 per month')).toBeTruthy();
    expect(screen.getByText(/no automatic refund or credit/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep current plan' }));
    expect(onKeep).toHaveBeenCalledOnce();
  });
});
