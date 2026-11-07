// The Finance page keeps an open form through background reloads (a session refresh on refocus) and goes back to the
// matching list after a save. The Create form is a stand-in with its own typed state: if the page unmounts it, the
// typed value is lost.
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast, Toaster: () => null }));
const st = vi.hoisted(() => ({ user: { id: 'u1', email: 'owner@acme.example' } as { id: string; email: string }, reads: 0, hold: null as null | Promise<void> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: st.user }) }));
vi.mock('@/hooks/useUserSettings', () => ({ useUserSettings: () => ({ settings: { currency_code: 'GBP' } }) }));
vi.mock('@/contexts/OrganizationContext', () => ({ useActiveOrganization: () => ({ organization: { name: 'Acme Trading Ltd' } }) }));
vi.mock('@/hooks/useDocumentTemplates', () => ({ useDocumentTemplates: () => ({ templateFor: () => 'classic' }) }));
vi.mock('@/components/payroll/PayrollUK', () => ({ default: () => <div>Payroll stand-in</div> }));
vi.mock('@/components/documents/DocumentTemplatePicker', () => ({ default: () => <div>Templates stand-in</div> }));
vi.mock('@/components/finance/FinanceAnalytics', () => ({ FinanceAnalytics: () => <div>Analytics stand-in</div> }));
const rows = vi.hoisted(() => ({ invoices: [] as Record<string, unknown>[], quotes: [] as Record<string, unknown>[] }));
vi.mock('@/components/QuoteInvoiceCreationSection', () => ({
  default: function CreateStandIn(p: { documentType: 'invoice' | 'quote'; onDocumentSaved: () => void }) {
    const [client, setClient] = useState('');
    return (
      <div data-testid="create-form">
        <label>Client <input aria-label="Client" value={client} onChange={(e) => setClient(e.target.value)} /></label>
        <button type="button" onClick={() => {
          const table = p.documentType === 'invoice' ? rows.invoices : rows.quotes;
          table.unshift({ id: `new-${p.documentType}`, user_id: 'u1', [`${p.documentType}_number`]: p.documentType === 'invoice' ? 'INV-NEW' : 'Q-NEW', status: 'draft', total_amount: 12, currency: 'GBP', created_at: new Date().toISOString(), client_name: client, items: [] });
          p.onDocumentSaved();
        }}>Save {p.documentType}</button>
      </div>
    );
  },
}));
vi.mock('@/integrations/supabase/client', () => {
  const from = (table: string) => {
    const chain: Record<string, unknown> = new Proxy({}, {
      get(_t, k: string) {
        if (k === 'then') {
          return (res: (v: unknown) => void) => {
            st.reads++;
            const answer = () => res({ data: (rows as Record<string, unknown[]>)[table] ?? [], error: null });
            if (st.hold) void st.hold.then(answer); else answer();
          };
        }
        return () => chain;
      },
    });
    return chain;
  };
  return { supabase: { from, rpc: () => Promise.resolve({ data: [], error: null }), functions: { invoke: () => Promise.resolve({ data: { configured: false }, error: null }) } } };
});

import BusinessFinanceAssistant from './BusinessFinanceAssistant';

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

function Probe() { const l = useLocation(); return <output data-testid="url">{l.search}</output>; }
const ui = (search: string) => <MemoryRouter initialEntries={[`/business-tools${search}`]}><BusinessFinanceAssistant /><Probe /></MemoryRouter>;
const activeTab = () => screen.getByRole('tablist', { name: 'Invoices and quotes sections' }).querySelector('[data-state="active"]')?.textContent;

beforeEach(() => { st.user = { id: 'u1', email: 'owner@acme.example' }; st.reads = 0; st.hold = null; rows.invoices = []; rows.quotes = []; Object.values(toast).forEach((f) => f.mockClear()); });

describe('the Create form survives background reloads', () => {
  it('a session refresh (a new user object, same id) does not reload the page or reset the typed form', async () => {
    const view = render(ui('?tab=create&type=invoice'));
    fireEvent.change(await screen.findByLabelText('Client'), { target: { value: 'Half typed Ltd' } });
    await waitFor(() => expect(st.reads).toBeGreaterThan(0));
    const reads = st.reads;
    st.user = { id: 'u1', email: 'owner@acme.example' }; // what Supabase hands out after refreshing the token
    view.rerender(ui('?tab=create&type=invoice'));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(st.reads).toBe(reads);
    expect(screen.getByTestId('create-form')).toBeInTheDocument();
    expect(screen.getByLabelText('Client')).toHaveValue('Half typed Ltd');
  });

  it('while the data is loading, the Create form stays on screen and keeps what is typed', async () => {
    let release!: () => void;
    st.hold = new Promise<void>((r) => { release = r; });
    render(ui('?tab=create&type=invoice'));
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'Typed during load' } });
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
    await act(async () => { release(); await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.getByLabelText('Client')).toHaveValue('Typed during load');
  });
});

describe('after a save, back to the list', () => {
  it('saving an invoice lands on Invoices with the new row, and the page adds no second toast', async () => {
    render(ui('?tab=create&type=invoice'));
    fireEvent.change(await screen.findByLabelText('Client'), { target: { value: 'New Client Ltd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save invoice' }));
    await waitFor(() => expect(activeTab()).toBe('Invoices'));
    expect(screen.getByTestId('url')).toHaveTextContent('tab=invoices');
    expect((await screen.findAllByText('INV-NEW')).length).toBeGreaterThan(0);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('saving a quote lands on Quotes', async () => {
    render(ui('?tab=create&type=quote'));
    fireEvent.click(await screen.findByRole('button', { name: 'Save quote' }));
    await waitFor(() => expect(activeTab()).toBe('Quotes'));
    expect((await screen.findAllByText('Q-NEW')).length).toBeGreaterThan(0);
  });
});
