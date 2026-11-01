// Phase 29: the coupon generator's tabs, the Import CSV button (it did nothing) and the bulk cap.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

import CouponGenerator from './CouponGenerator';

const tab = (name: RegExp | string) => { const t = screen.getByRole('tab', { name }); fireEvent.mouseDown(t); fireEvent.click(t); };
const SAVED = { coupons: [
  { id: '1', code: 'SPRING-1234', discountType: 'percentage', value: 10, tags: [], isStackable: false, isActive: true },
  { id: '2', code: 'OLD-0001', discountType: 'percentage', value: 10, tags: [], isStackable: false, isActive: true, endDate: '2020-01-01' },
  { id: '3', code: 'MAXED-0001', discountType: 'percentage', value: 10, tags: [], isStackable: false, isActive: true, maxUses: 1, uses: 1 },
  { id: '4', code: 'OFF-0001', discountType: 'percentage', value: 10, tags: [], isStackable: false, isActive: false },
  { id: '5', code: 'LATER-0001', discountType: 'percentage', value: 10, tags: [], isStackable: false, isActive: true, startDate: '2099-01-01' },
] };

beforeEach(() => { toast.mockReset(); localStorage.clear(); });

describe('CouponGenerator', () => {
  it('a real tab row instead of the four badges, and the browser-only note', () => {
    render(<CouponGenerator />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Generate', 'Validate', 'Manage (0)', 'Import / Export']);
    expect(screen.getByTestId('coupon-storage-note')).toHaveTextContent('Coupons are saved in this browser only.');
    expect(screen.queryByText('Bulk generation')).toBeNull();
  });

  it('Import CSV: the button opens the file input, the file is imported, the result is shown, the input is reset', async () => {
    render(<CouponGenerator />);
    tab('Import / Export');
    const input = screen.getByTestId('coupon-import-input') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: /Import CSV/ }));
    expect(click).toHaveBeenCalledOnce();
    const csv = 'code,discountType,value\nWINTER-0001,percentage,15\nAB,percentage,10\n';
    const file = new File([csv], 'coupons.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: async () => csv });
    fireEvent.change(input, { target: { files: [file] } });
    const result = await screen.findByTestId('coupon-import-result');
    expect(result).toHaveTextContent('1 imported, 1 rejected.');
    expect(result).toHaveTextContent('Line 3: Code must be at least 4 characters.');
    expect(input.value).toBe('');
    expect(screen.getByRole('tab', { name: 'Manage (1)' })).toBeInTheDocument();
  });

  it.each([
    ['SPRING-1234', 'Valid: this code can be used.'],
    ['NOPE-9999', 'Unknown: no saved coupon has this code.'],
    ['LATER-0001', 'Not started yet'],
    ['OLD-0001', 'Expired'],
    ['MAXED-0001', 'Used up'],
    ['OFF-0001', 'Deactivated'],
  ])('Validate tab: %s → %s', async (code, text) => {
    localStorage.setItem('coupon_generator_state_v1', JSON.stringify(SAVED));
    render(<CouponGenerator />);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Manage (5)' })).toBeInTheDocument());
    tab('Validate');
    fireEvent.change(screen.getByLabelText('Coupon code'), { target: { value: code } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByTestId('coupon-check-result')).toHaveTextContent(text);
  });

  it('bulk cap: more than 10,000 shows a clear message and generates nothing', () => {
    render(<CouponGenerator />);
    fireEvent.change(screen.getByLabelText(/Quantity/), { target: { value: '10001' } });
    expect(screen.getByRole('alert')).toHaveTextContent('You can generate up to 10,000 codes at a time.');
    fireEvent.click(screen.getByRole('button', { name: /Generate$/ }));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Too many codes', description: 'You can generate up to 10,000 codes at a time.' }));
    expect(screen.getByRole('tab', { name: 'Manage (0)' })).toBeInTheDocument();
  });

  it('generate makes the codes and every input has a label', () => {
    render(<CouponGenerator />);
    fireEvent.change(screen.getByLabelText(/Quantity/), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate$/ }));
    expect(screen.getByRole('tab', { name: 'Manage (25)' })).toBeInTheDocument();
    const unlabeled = [...document.querySelectorAll('input:not([type=hidden]):not([type=file]), textarea')].filter((el) => !el.id || !document.querySelector(`label[for="${el.id}"]`));
    expect(unlabeled).toEqual([]);
  });
});
