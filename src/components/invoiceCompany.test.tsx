// HMRC P4b: the invoice form saves the company (organization_id). Supabase is mocked: nothing is sent or emailed.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({ user: { id: 'u1' }, writes: [] as { op: string; payload: Record<string, unknown> }[], missingColumn: false,
  org: { memberships: [{ organizationId: 'org-x', name: 'Company X', role: 'owner' }, { organizationId: 'org-y', name: 'Company Y', role: 'member' }], organizationId: 'org-x' as string | null } }));
const toast = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ toast }));
// A stable user object, as in the app (a new object each render would reload products forever).
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: st.user }) }));
vi.mock('@/hooks/useUserSettings', () => ({ useUserSettings: () => ({ settings: { currency_code: 'GBP' } }) }));
vi.mock('@/contexts/OrganizationContext', () => ({ useOptionalActiveOrganization: () => st.org }));
vi.mock('@/components/ImageUpload', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => {
  const done = (op: string, payload: Record<string, unknown>) => {
    st.writes.push({ op, payload });
    const missing = st.missingColumn && 'organization_id' in payload;
    const single = async () => (missing ? { data: null, error: { code: 'PGRST204', message: "Could not find the 'organization_id' column of 'invoices' in the schema cache" } } : { data: { id: 'new', ...payload }, error: null });
    return { select: () => ({ single }), eq: () => ({ select: () => ({ single }) }) };
  };
  return {
    supabase: {
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }), order: async () => ({ data: [], error: null }) }) }),
        insert: (rows: Record<string, unknown>[]) => done('insert', rows[0]),
        update: (row: Record<string, unknown>) => done('update', row),
      }),
    },
  };
});

import QuoteInvoiceCreationSection from './QuoteInvoiceCreationSection';

beforeEach(() => { st.writes.length = 0; st.missingColumn = false; st.org.organizationId = 'org-x'; toast.mockClear(); });
const fill = () => {
  fireEvent.change(screen.getByLabelText('Client Name *'), { target: { value: 'Acme Ltd' } });
  fireEvent.change(screen.getAllByLabelText('Description *')[0], { target: { value: 'Work' } });
  fireEvent.change(screen.getAllByLabelText('Rate')[0], { target: { value: '100' } });
};

describe('invoice form: company', () => {
  it('a new invoice is saved with the active company; only the person\'s companies are offered', async () => {
    const saved = vi.fn();
    render(<QuoteInvoiceCreationSection documentType="invoice" onDocumentSaved={saved} />);
    const select = screen.getByLabelText('Company *') as HTMLSelectElement;
    expect(select.value).toBe('org-x');
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Choose a company', 'Company X', 'Company Y']);
    fill();
    fireEvent.click(screen.getByRole('button', { name: /Save as Draft/ }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(st.writes[0].payload).toMatchObject({ organization_id: 'org-x', vat_status: 'recorded' });
  });

  it('before the database update the invoice is saved again without the company', async () => {
    st.missingColumn = true;
    const saved = vi.fn();
    render(<QuoteInvoiceCreationSection documentType="invoice" onDocumentSaved={saved} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: /Save as Draft/ }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(st.writes).toHaveLength(2);
    expect(st.writes[1].payload).not.toHaveProperty('organization_id');
    expect(st.writes[1].payload).toMatchObject({ vat_status: 'recorded', subtotal: 100 });
  });

  it('an older invoice with no company must have one chosen; a linked invoice and quotes are not asked', async () => {
    const saved = vi.fn();
    const doc = { id: 'i1', invoice_number: 'INV-1', client_name: 'Acme', items: [{ description: 'Old', quantity: 1, rate: 50, amount: 50, vat_treatment: 'standard' }], currency: 'GBP', status: 'sent', created_at: '2026-10-02T09:00:00Z', organization_id: null };
    const view = render(<QuoteInvoiceCreationSection documentType="invoice" onDocumentSaved={saved} editingDocument={doc} />);
    const select = screen.getByLabelText('Company *') as HTMLSelectElement;
    expect(select.value).toBe(''); // never chosen for the person
    fireEvent.click(screen.getByRole('button', { name: /Update/ }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Choose the company this invoice belongs to.' })));
    expect(st.writes).toHaveLength(0);
    fireEvent.change(select, { target: { value: 'org-y' } });
    fireEvent.click(screen.getByRole('button', { name: /Update/ }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(st.writes[0].payload).toMatchObject({ organization_id: 'org-y', vat_status: 'recorded' });
    view.unmount();
    const v2 = render(<QuoteInvoiceCreationSection documentType="invoice" onDocumentSaved={vi.fn()} editingDocument={{ ...doc, id: 'i2', organization_id: 'org-x' }} />);
    expect(screen.queryByLabelText('Company *')).toBeNull();
    v2.unmount();
    render(<QuoteInvoiceCreationSection documentType="quote" onDocumentSaved={vi.fn()} />);
    expect(screen.queryByLabelText('Company *')).toBeNull();
  });
});
