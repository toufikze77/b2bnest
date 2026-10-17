import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Captures what the form writes. Only insert/update are mocked: nothing is sent or emailed.
const writes: { op: string; table: string; payload: Record<string, unknown> }[] = [];
let accountCurrency = 'GBP';
const authUser = { id: 'u1' };
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: authUser }) }));
vi.mock('@/hooks/useUserSettings', () => ({ useUserSettings: () => ({ settings: { currency_code: accountCurrency } }) }));
vi.mock('@/components/ImageUpload', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => {
  const done = (op: string, table: string, payload: Record<string, unknown>) => {
    writes.push({ op, table, payload });
    const single = async () => ({ data: { id: 'new', ...payload }, error: null });
    return { select: () => ({ single }), eq: () => ({ select: () => ({ single }) }) };
  };
  return {
    supabase: {
      functions: { invoke: vi.fn(() => { throw new Error('No function may be called from this test'); }) },
      from: (table: string) => ({
        select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }), order: async () => ({ data: [], error: null }) }) }),
        insert: (rows: Record<string, unknown>[]) => done('insert', table, rows[0]),
        update: (row: Record<string, unknown>) => done('update', table, row),
      }),
    },
  };
});

import QuoteInvoiceCreationSection from './QuoteInvoiceCreationSection';

const fill = () => {
  fireEvent.change(screen.getByLabelText('Client Name *'), { target: { value: 'Acme Ltd' } });
  fireEvent.change(screen.getByLabelText('Description *'), { target: { value: 'Consulting' } });
};

beforeEach(() => { writes.length = 0; accountCurrency = 'GBP'; });

describe('QuoteInvoiceCreationSection currency', () => {
  it('a new invoice sends the account currency explicitly (never the database default)', async () => {
    const saved = vi.fn();
    render(<QuoteInvoiceCreationSection documentType="invoice" onDocumentSaved={saved} />);
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveTextContent('GBP');
    fill();
    fireEvent.click(screen.getByRole('button', { name: /Save as Draft/ }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ op: 'insert', table: 'invoices', payload: { currency: 'GBP', status: 'draft' } });
  });

  it('a new quote also sends it', async () => {
    accountCurrency = 'EUR';
    const saved = vi.fn();
    render(<QuoteInvoiceCreationSection documentType="quote" onDocumentSaved={saved} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: /Save as Draft/ }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(writes[0]).toMatchObject({ op: 'insert', table: 'quotes', payload: { currency: 'EUR' } });
  });

  it('editing keeps the document’s own currency, not the account one', async () => {
    const saved = vi.fn();
    const doc = { id: 'i1', invoice_number: 'INV-1', client_name: 'Acme Ltd', items: [{ id: '1', description: 'Work', quantity: 1, rate: 10, amount: 10 }], currency: 'USD', status: 'draft', tax_rate: 0 };
    render(<QuoteInvoiceCreationSection documentType="invoice" onDocumentSaved={saved} editingDocument={doc} />);
    fireEvent.click(screen.getByRole('button', { name: /Update Draft/ }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(writes[0]).toMatchObject({ op: 'update', table: 'invoices', payload: { currency: 'USD' } });
  });
});
