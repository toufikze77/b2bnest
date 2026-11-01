// Phase 29: grouped categories, your own category, and an old entry whose category is in no list.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useUserSettings', () => ({ useUserSettings: () => ({ settings: { currency_code: 'GBP' } }) }));

import CashFlowTracker from './CashFlowTracker';

beforeEach(() => localStorage.clear());

describe('Cash Flow Tracker categories', () => {
  it('the drop-down is grouped and ends with "+ Add my own category…"', () => {
    render(<CashFlowTracker />);
    const select = document.getElementById('cf-new-category') as HTMLSelectElement;
    expect([...select.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['Sales', 'Funding', 'Other income']);
    expect(select.options[select.options.length - 1].textContent).toBe('+ Add my own category…');
    fireEvent.click(screen.getByRole('button', { name: /Expense/ }));
    const expense = document.getElementById('cf-new-category') as HTMLSelectElement;
    expect([...expense.options].map((o) => o.value)).toEqual(expect.arrayContaining(['HMRC: VAT', 'Employer NI & Pension', 'Fuel & Vehicle']));
  });

  it('a custom category is saved and shown in the list (and kept after a reload)', () => {
    const view = render(<CashFlowTracker />);
    fireEvent.change(document.getElementById('cf-new-category')!, { target: { value: '__add_custom__' } });
    const form = screen.getByTestId('custom-category-form');
    fireEvent.change(within(form).getByLabelText('New income category'), { target: { value: '  Tips  ' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add' }));
    const select = document.getElementById('cf-new-category') as HTMLSelectElement;
    expect(select.value).toBe('Tips');
    expect(select.querySelector('optgroup[label="Your categories"]')?.textContent).toBe('Tips');
    view.unmount();
    render(<CashFlowTracker />);
    expect((document.getElementById('cf-new-category') as HTMLSelectElement).querySelector('optgroup[label="Your categories"]')?.textContent).toBe('Tips');
  });

  it('an old entry whose category is in no list still shows, and editing keeps it', () => {
    localStorage.setItem('cashFlowTracker.entries.v1', JSON.stringify([
      { id: 'e1', type: 'expense', category: 'Courier Costs', description: 'Old parcel', amount: 12.5, date: '2026-01-10T00:00:00.000Z' },
    ]));
    render(<CashFlowTracker />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Recent Entries' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Recent Entries' }));
    expect(screen.getByText('Courier Costs')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit entry' }));
    const edit = document.getElementById('cf-edit-category-e1') as HTMLSelectElement;
    expect(edit.value).toBe('Courier Costs');
    expect(edit.querySelector('optgroup[label="Saved on this entry"]')?.textContent).toBe('Courier Costs');
  });
});
