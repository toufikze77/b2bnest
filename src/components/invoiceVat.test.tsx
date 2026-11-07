// HMRC P4: per-line VAT on the invoice form. Supabase is mocked: nothing is sent or emailed.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({ user: { id: 'u1' }, writes: [] as { op: string; table: string; payload: Record<string, unknown> }[], failFirst: null as null | { code: string; message: string } }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
// A stable user object, as in the app (a new object each render would reload products forever).
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: st.user }) }));
vi.mock('@/hooks/useUserSettings', () => ({ useUserSettings: () => ({ settings: { currency_code: 'GBP' } }) }));
vi.mock('@/components/ImageUpload', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => {
  const done = (op: string, table: string, payload: Record<string, unknown>) => {
    st.writes.push({ op, table, payload });
    const err = st.failFirst; st.failFirst = null;
    const single = async () => (err ? { data: null, error: err } : { data: { id: 'new', ...payload }, error: null });
    return { select: () => ({ single }), eq: () => ({ select: () => ({ single }) }) };
  };
  return {
    supabase: {
      from: (table: string) => ({
        select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }), order: async () => ({ data: [], error: null }) }) }),
        insert: (rows: Record<string, unknown>[]) => done('insert', table, rows[0]),
        update: (row: Record<string, unknown>) => done('update', table, row),
      }),
    },
  };
});

import QuoteInvoiceCreationSection from './QuoteInvoiceCreationSection';
import { isRecordedInvoice } from '@/lib/vat';

beforeEach(() => { st.writes.length = 0; st.failFirst = null; });

const setLine = (n: number, desc: string, qty: string, rate: string, vat?: string) => {
  fireEvent.change(screen.getAllByLabelText('Description *')[n], { target: { value: desc } });
  fireEvent.change(screen.getAllByLabelText('Quantity')[n], { target: { value: qty } });
  fireEvent.change(screen.getAllByLabelText('Rate')[n], { target: { value: rate } });
  if (vat) fireEvent.change(screen.getAllByLabelText('VAT *')[n], { target: { value: vat } });
};

describe('invoice form: VAT per line', () => {
  it('a mixed-rate invoice saves VAT per line, a tax point, and "recorded"; totals reconcile', async () => {
    const saved = vi.fn();
    render(<QuoteInvoiceCreationSection documentType="invoice" onDocumentSaved={saved} />);
    expect(screen.queryByLabelText('Tax Rate (%)')).toBeNull();
    expect((screen.getAllByLabelText('VAT *')[0] as HTMLSelectElement).value).toBe('standard');
    fireEvent.change(screen.getByLabelText('Client Name *'), { target: { value: 'Acme Ltd' } });
    setLine(0, 'Consulting', '3', '19.99');
    fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));
    setLine(1, 'Books', '1', '10.10', 'zero');
    fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));
    setLine(2, 'Fuel', '1', '10.10', 'reduced');
    fireEvent.change(screen.getByLabelText('Tax point date (VAT) *'), { target: { value: '2026-11-07' } });
    const groups = screen.getByTestId('invoice-vat-groups');
    expect(groups).toHaveTextContent('Standard 20%: net £59.97');
    expect(groups).toHaveTextContent('VAT £11.99');
    expect(groups).toHaveTextContent('Zero rate: net £10.10');
    expect(groups).toHaveTextContent('Reduced 5%: net £10.10');
    expect(groups).toHaveTextContent('VAT total (mixed rates):');
    fireEvent.click(screen.getByRole('button', { name: /Save as Draft/ }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    const p = st.writes[0].payload as Record<string, unknown> & { items: Record<string, unknown>[] };
    expect(p).toMatchObject({ subtotal: 80.17, tax_amount: 12.5, total_amount: 92.67, tax_rate: 0, vat_status: 'recorded', vat_scheme: 'standard', tax_point_date: '2026-11-07', currency: 'GBP' });
    expect(p.items[0]).toMatchObject({ vat_treatment: 'standard', vat_rate: 20, net: 59.97, vat: 11.99, gross: 71.96, amount: 59.97 });
    expect(p.items[1]).toMatchObject({ vat_treatment: 'zero', vat_rate: 0, net: 10.1, vat: 0, gross: 10.1 });
    expect(p.items[2]).toMatchObject({ vat_treatment: 'reduced', vat_rate: 5, net: 10.1, vat: 0.51, gross: 10.61 });
    expect(isRecordedInvoice(p)).toBe(true); // the same rule the database checks
  });

  it('one treatment on every line keeps tax_rate for older screens', async () => {
    const saved = vi.fn();
    render(<QuoteInvoiceCreationSection documentType="invoice" onDocumentSaved={saved} />);
    fireEvent.change(screen.getByLabelText('Client Name *'), { target: { value: 'Acme Ltd' } });
    setLine(0, 'Work', '1', '100');
    fireEvent.click(screen.getByRole('button', { name: /Save as Draft/ }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(st.writes[0].payload).toMatchObject({ subtotal: 100, tax_amount: 20, total_amount: 120, tax_rate: 20 });
  });

  it('an older invoice shows a note, needs a treatment per line, and becomes recorded when saved', async () => {
    const saved = vi.fn();
    const doc = { id: 'i1', invoice_number: 'INV-1', client_name: 'Acme', items: [{ description: 'Old work', quantity: 1, rate: 50, amount: 50 }], currency: 'GBP', status: 'sent', tax_rate: 20, created_at: '2026-10-02T09:00:00Z' };
    render(<QuoteInvoiceCreationSection documentType="invoice" onDocumentSaved={saved} editingDocument={doc} />);
    expect(screen.getByTestId('invoice-vat-not-recorded')).toBeInTheDocument();
    expect((screen.getByLabelText('Tax point date (VAT) *') as HTMLInputElement).value).toBe('2026-10-02');
    fireEvent.click(screen.getByRole('button', { name: /Update/ }));
    await new Promise((r) => setTimeout(r, 20));
    expect(st.writes).toHaveLength(0); // nothing guessed: a treatment must be chosen
    fireEvent.change(screen.getByLabelText('VAT *'), { target: { value: 'exempt' } });
    fireEvent.click(screen.getByRole('button', { name: /Update/ }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(st.writes[0].payload).toMatchObject({ subtotal: 50, tax_amount: 0, total_amount: 50, vat_status: 'recorded', tax_point_date: '2026-10-02' });
  });

  it('before the database update the VAT columns are dropped and the save still works', async () => {
    st.failFirst = { code: 'PGRST204', message: "Could not find the 'vat_status' column of 'invoices' in the schema cache" };
    const saved = vi.fn();
    render(<QuoteInvoiceCreationSection documentType="invoice" onDocumentSaved={saved} />);
    fireEvent.change(screen.getByLabelText('Client Name *'), { target: { value: 'Acme Ltd' } });
    setLine(0, 'Work', '1', '10');
    fireEvent.click(screen.getByRole('button', { name: /Save as Draft/ }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(st.writes).toHaveLength(2);
    expect(st.writes[1].payload).not.toHaveProperty('vat_status');
    expect(st.writes[1].payload).not.toHaveProperty('tax_point_date');
    expect(st.writes[1].payload).toMatchObject({ subtotal: 10, tax_amount: 2 });
  });

  it('a non-GBP invoice says it is left out of VAT returns; quotes keep their single tax rate', () => {
    const doc = { id: 'i2', invoice_number: 'INV-2', client_name: 'Acme', items: [], currency: 'USD', status: 'draft' };
    const view = render(<QuoteInvoiceCreationSection documentType="invoice" onDocumentSaved={vi.fn()} editingDocument={doc} />);
    expect(screen.getByTestId('invoice-not-gbp')).toHaveTextContent('left out of VAT returns');
    view.unmount();
    render(<QuoteInvoiceCreationSection documentType="quote" onDocumentSaved={vi.fn()} />);
    expect(screen.getByLabelText('Tax Rate (%)')).toBeInTheDocument();
    expect(screen.queryByLabelText('VAT *')).toBeNull();
    expect(within(document.body).queryByTestId('invoice-vat-groups')).toBeNull();
  });
});
