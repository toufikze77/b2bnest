import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentsTable } from './DocumentsTable';

const doc = (id: string, status: string, total: number, currency: string | null, due: string | null, client: string) =>
  ({ id, invoice_number: `INV-${id}`, status, total_amount: total, currency, created_at: '2026-10-01T09:00:00Z', due_date: due, client_name: client });
const docs = [doc('1', 'sent', 100, 'GBP', '2000-01-01', 'Acme'), doc('2', 'paid', 50, 'USD', null, 'Beta'), doc('3', 'draft', 20, null, '2000-01-01', 'Gamma')];

type Doc = (typeof docs)[number] & { archived_at?: string | null };
const handlers = () => ({ onStatus: vi.fn(), onView: vi.fn(), onArchive: vi.fn(), onRestore: vi.fn(), onDeleteForever: vi.fn() });
const ui = (onStatus = vi.fn(), onView = vi.fn(), h = handlers(), list: Doc[] = docs) => render(
  <DocumentsTable<Doc> kind="invoice" docs={list} numberOf={(d) => d.invoice_number} onNew={vi.fn()} onView={onView} onEdit={vi.fn()} onDownload={vi.fn()}
    onStatus={onStatus} onArchive={h.onArchive} onRestore={h.onRestore} onDeleteForever={h.onDeleteForever} />,
);
const openMenu = (n: string) => fireEvent.pointerDown(screen.getAllByRole('button', { name: `More actions for invoice ${n}` })[0], { button: 0, pointerType: 'mouse' });

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

  it('View opens the document and changes nothing', () => {
    const onStatus = vi.fn(), onView = vi.fn();
    ui(onStatus, onView);
    fireEvent.click(screen.getAllByRole('button', { name: 'View invoice INV-1' })[0]);
    expect(onView).toHaveBeenCalledWith(docs[0]);
    expect(onStatus).not.toHaveBeenCalled();
  });

  it('the row menu offers the honest status action for each status, and no "Send"', async () => {
    for (const [n, label, doc, to] of [['INV-3', 'Mark as sent', docs[2], 'sent'], ['INV-1', 'Mark as paid', docs[0], 'paid'], ['INV-2', 'Mark as unpaid', docs[1], 'sent']] as const) {
      const onStatus = vi.fn();
      const { unmount } = ui(onStatus);
      openMenu(n);
      fireEvent.click(await screen.findByRole('menuitem', { name: label }));
      expect(onStatus).toHaveBeenCalledWith(doc, to);
      expect(screen.queryByRole('menuitem', { name: /^Send/ })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('Move to archive is in the row menu (no plain Delete) and hands the document up', async () => {
    const h = handlers();
    ui(h.onStatus, vi.fn(), h);
    openMenu('INV-2');
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Move to archive' }));
    expect(h.onArchive).toHaveBeenCalledWith(docs[1]);
    expect(h.onStatus).not.toHaveBeenCalled();
  });

  it('Active | Archive switch: counts, aria-pressed, archived listed newest first with the date, View/Restore/Delete forever only', async () => {
    const list: Doc[] = [docs[0], { ...docs[1], archived_at: '2026-10-01T09:00:00Z' }, { ...docs[2], archived_at: '2026-10-15T09:00:00Z' }];
    const h = handlers();
    const { unmount } = ui(h.onStatus, vi.fn(), h, list);
    const group = screen.getByRole('group', { name: 'Show active or archived invoices' });
    const active = within(group).getByRole('button', { name: 'Active' });
    const archive = within(group).getByRole('button', { name: 'Archive (2)' });
    expect(active).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1 invoice')).toBeInTheDocument();
    fireEvent.click(archive);
    expect(archive).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('2 archived invoices')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Filter by status' })).not.toBeInTheDocument();
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(rows[0]).toContain('INV-3');
    expect(rows[1]).toContain('INV-2');
    expect(screen.getByRole('columnheader', { name: /Archived/ })).toBeInTheDocument();
    openMenu('INV-3');
    const items = (await screen.findAllByRole('menuitem')).map((m) => m.textContent);
    expect(items).toEqual(['Restore', 'Delete forever']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Restore' }));
    expect(h.onRestore).toHaveBeenCalledWith(list[2]);
    unmount();
    // Fresh render for the second menu (jsdom keeps the first menu's closing state).
    const h2 = handlers();
    ui(h2.onStatus, vi.fn(), h2, list);
    fireEvent.click(screen.getByRole('button', { name: 'Archive (2)' }));
    openMenu('INV-2');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete forever' }));
    expect(h2.onDeleteForever).toHaveBeenCalledWith(list[1]);
    expect(h.onStatus).not.toHaveBeenCalled();
  });

  it('an empty archive says so', () => {
    ui();
    fireEvent.click(screen.getByRole('button', { name: 'Archive (0)' }));
    expect(screen.getByText(/Nothing in the archive/)).toBeInTheDocument();
  });
});
