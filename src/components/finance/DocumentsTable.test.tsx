import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentsTable } from './DocumentsTable';

const doc = (id: string, status: string, total: number, currency: string | null, due: string | null, client: string) =>
  ({ id, invoice_number: `INV-${id}`, status, total_amount: total, currency, created_at: '2026-10-01T09:00:00Z', due_date: due, client_name: client });
const docs = [doc('1', 'sent', 100, 'GBP', '2000-01-01', 'Acme'), doc('2', 'paid', 50, 'USD', null, 'Beta'), doc('3', 'draft', 20, null, '2000-01-01', 'Gamma')];

const ui = (onSend = vi.fn(), onView = vi.fn()) => render(
  <DocumentsTable kind="invoice" docs={docs} numberOf={(d) => d.invoice_number} onNew={vi.fn()} onView={onView} onEdit={vi.fn()} onDownload={vi.fn()} onSend={onSend} />,
);

describe('DocumentsTable', () => {
  it('shows word chips with overdue worked out in the app, amounts in each document’s own currency', () => {
    ui();
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(rows.find((t) => t?.includes('INV-1'))).toMatch(/Overdue.*£100\.00/);
    expect(rows.find((t) => t?.includes('INV-2'))).toMatch(/Paid.*US\$50\.00/);
    // A draft past its due date stays a draft, and no currency prints a plain number.
    expect(rows.find((t) => t?.includes('INV-3'))).toMatch(/Draft.*20\.00/);
    expect(rows.find((t) => t?.includes('INV-3'))).not.toMatch(/\$/);
  });

  it('status chips filter with counts and aria-pressed; search narrows by number or client', () => {
    ui();
    const group = screen.getByRole('group', { name: 'Filter by status' });
    const overdue = within(group).getByRole('button', { name: 'Overdue 1' });
    fireEvent.click(overdue);
    expect(overdue).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Showing 1 of 3 invoices')).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('button', { name: 'All 3' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search invoices' }), { target: { value: 'beta' } });
    expect(screen.getByText('Showing 1 of 3 invoices')).toBeInTheDocument();
  });

  it('View opens the document and never sends it', () => {
    const onSend = vi.fn(), onView = vi.fn();
    ui(onSend, onView);
    fireEvent.click(screen.getAllByRole('button', { name: 'View invoice INV-1' })[0]);
    expect(onView).toHaveBeenCalledWith(docs[0]);
    expect(onSend).not.toHaveBeenCalled();
  });
});
