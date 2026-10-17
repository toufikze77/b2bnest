import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { FINANCE_TABS } from '@/lib/financeTabs';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast, Toaster: () => null }));
const authUser = vi.hoisted(() => ({ id: 'u1' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: authUser }) }));
vi.mock('@/hooks/useUserSettings', () => ({ useUserSettings: () => ({ settings: { currency_code: 'GBP' } }) }));
vi.mock('@/contexts/OrganizationContext', () => ({ useActiveOrganization: () => ({ organization: { name: 'Acme Trading Ltd' } }) }));
vi.mock('@/hooks/useDocumentTemplates', () => ({ useDocumentTemplates: () => ({ templateFor: () => 'classic' }) }));
// Heavy tabs not under test here: stand-ins that show what they were given.
vi.mock('@/components/QuoteInvoiceCreationSection', () => ({ default: (p: { documentType: string }) => <div data-testid="create-form">Create form: {p.documentType}</div> }));
vi.mock('@/components/payroll/PayrollUK', () => ({ default: () => <div>Payroll stand-in</div> }));
vi.mock('@/components/documents/DocumentTemplatePicker', () => ({ default: () => <div>Templates stand-in</div> }));
vi.mock('@/components/finance/FinanceAnalytics', () => ({ FinanceAnalytics: () => <div>Analytics stand-in</div> }));

/**
 * Supabase stand-in. Reads return the rows below; writes are recorded with their filters and can be
 * made to fail. Any call to functions (e.g. an email sender) is recorded so the test can prove none happen.
 */
const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  writes: [] as { table: string; op: string; payload: unknown; filters: unknown[][] }[],
  failWrites: false,
  functionCalls: [] as unknown[],
}));
vi.mock('@/integrations/supabase/client', () => {
  const from = (table: string) => {
    const calls: unknown[][] = [];
    const chain: Record<string, unknown> = new Proxy({}, {
      get(_t, k: string) {
        if (k === 'then') {
          return (res: (v: unknown) => void) => {
            const w = calls.find((c) => ['insert', 'update', 'delete'].includes(c[0] as string));
            if (!w) return res({ data: db.rows[table] ?? [], error: null });
            db.writes.push({ table, op: w[0] as string, payload: w[1], filters: calls.filter((c) => c[0] === 'eq').map((c) => c.slice(1)) });
            if (db.failWrites) return res({ data: null, error: { message: 'Simulated network error' } });
            const id = calls.find((c) => c[0] === 'eq' && c[1] === 'id')?.[2];
            if (w[0] === 'update') db.rows[table] = (db.rows[table] ?? []).map((r) => (r.id === id ? { ...r, ...(w[1] as object) } : r));
            if (w[0] === 'delete') db.rows[table] = (db.rows[table] ?? []).filter((r) => r.id !== id);
            return res({ data: null, error: null });
          };
        }
        return (...a: unknown[]) => { calls.push([k, ...a]); return chain; };
      },
    });
    return chain;
  };
  return {
    supabase: {
      from,
      rpc: () => Promise.resolve({ data: [], error: null }),
      functions: { invoke: (...a: unknown[]) => { db.functionCalls.push(a); return Promise.resolve({ data: null, error: null }); } },
    },
  };
});

import BusinessFinanceAssistant from './BusinessFinanceAssistant';

// Radix pieces used in the page need these in jsdom.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 864e5).toISOString();
const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const invoice = (id: string, status: string, total: number, due: string) => ({
  id, user_id: 'u1', invoice_number: `INV-${id}`, status, total_amount: total, subtotal: total, tax_rate: 0, tax_amount: 0, currency: 'GBP',
  created_at: iso(5), updated_at: iso(1), due_date: due, client_name: 'Acme', client_email: null, client_address: null,
  company_name: null, company_address: null, notes: null, items: [], logo_url: null,
});

function Probe() { const l = useLocation(); return <output data-testid="url">{l.search}</output>; }
const renderAt = (search: string) => render(
  <MemoryRouter initialEntries={[`/business-tools${search}`]}><BusinessFinanceAssistant /><Probe /></MemoryRouter>,
);
const activeTab = () => screen.getByRole('tablist', { name: 'Invoices and quotes sections' }).querySelector('[data-state="active"]')?.textContent;
const openMenu = (name: string) => fireEvent.pointerDown(screen.getAllByRole('button', { name })[0], { button: 0, pointerType: 'mouse' });
const fetchSpy = vi.fn();

beforeEach(() => {
  db.rows = { invoices: [invoice('1001', 'draft', 600, day(20)), invoice('1002', 'sent', 950, day(10))], quotes: [] };
  db.writes = []; db.failWrites = false; db.functionCalls = [];
  Object.values(toast).forEach((f) => f.mockClear());
  fetchSpy.mockClear();
  vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => {
  vi.unstubAllGlobals();
  // Nothing in these flows may email or call any server function.
  expect(db.functionCalls).toEqual([]);
  expect(fetchSpy).not.toHaveBeenCalled();
});

describe('Honest Sent and Paid', () => {
  it('Mark as sent writes status sent for this user only and says no email was sent', async () => {
    renderAt('?tool=business-finance-assistant&tab=invoices');
    await screen.findAllByText('INV-1001');
    openMenu('More actions for invoice INV-1001');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Mark as sent' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(db.writes).toEqual([{ table: 'invoices', op: 'update', payload: { status: 'sent' }, filters: [['id', '1001'], ['user_id', 'u1']] }]);
    expect(toast.success).toHaveBeenCalledWith('INV-1001 marked as sent. No email was sent from B2BNEST. Download the PDF to send it yourself.');
    // The old fake message is gone.
    expect(JSON.stringify(toast.success.mock.calls)).not.toMatch(/sent successfully/i);
    expect(document.body.textContent).not.toMatch(/sent successfully/i);
    const row = within(screen.getByRole('table')).getAllByRole('row').find((r) => r.textContent?.includes('INV-1001'));
    expect(row?.textContent).toContain('Sent');
  });

  it('Mark as paid shows at once, is saved, and is counted on the Overview "Paid last 30 days" tile', async () => {
    renderAt('?tool=business-finance-assistant&tab=invoices');
    await screen.findAllByText('INV-1002');
    openMenu('More actions for invoice INV-1002');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Mark as paid' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('INV-1002 marked as paid.'));
    expect(db.writes).toEqual([{ table: 'invoices', op: 'update', payload: { status: 'paid' }, filters: [['id', '1002'], ['user_id', 'u1']] }]);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    const tiles = await screen.findByLabelText('Invoice figures');
    await waitFor(() => expect(tiles).toHaveTextContent(/Paid last 30 days£950/));
    expect(tiles).toHaveTextContent('Based on invoice date. A paid date will be recorded once it is added.');
  });

  it('a failed status change rolls back and shows an error', async () => {
    db.failWrites = true;
    renderAt('?tool=business-finance-assistant&tab=invoices');
    await screen.findAllByText('INV-1002');
    openMenu('More actions for invoice INV-1002');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Mark as paid' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('INV-1002 wasn’t updated. Its status is unchanged. Please try again.'));
    const row = within(screen.getByRole('table')).getAllByRole('row').find((r) => r.textContent?.includes('INV-1002'));
    expect(row?.textContent).toContain('Sent');
    expect(row?.textContent).not.toContain('Paid');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('the document view has Mark as sent and Delete, and no Send button', async () => {
    renderAt('?tool=business-finance-assistant&tab=invoices');
    await screen.findAllByText('INV-1001');
    fireEvent.click(screen.getAllByRole('button', { name: 'View invoice INV-1001' })[0]);
    const view = await screen.findByRole('dialog');
    expect(within(view).getByRole('button', { name: 'Mark as sent' })).toBeInTheDocument();
    expect(within(view).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(within(view).queryByRole('button', { name: /^Send$/ })).not.toBeInTheDocument();
    expect(view).toHaveTextContent('B2BNEST doesn’t email documents.');
  });
});

describe('Delete quotes and invoices', () => {
  it('a sent invoice gets the stronger warning; delete happens only after confirming, for this user only', async () => {
    renderAt('?tool=business-finance-assistant&tab=invoices');
    await screen.findAllByText('INV-1002');
    openMenu('More actions for invoice INV-1002');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete invoice INV-1002?');
    expect(confirm).toHaveTextContent('UK businesses normally keep invoices for several years for their records. Delete anyway?');
    expect(db.writes).toEqual([]);
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete invoice' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(db.writes).toEqual([{ table: 'invoices', op: 'delete', payload: undefined, filters: [['id', '1002'], ['user_id', 'u1']] }]);
    await waitFor(() => expect(screen.queryAllByText('INV-1002')).toHaveLength(0));
    expect(toast.success).toHaveBeenCalledWith('Invoice INV-1002 deleted');
  });

  it('a failed delete keeps the row and shows the error in the dialog', async () => {
    db.failWrites = true;
    renderAt('?tool=business-finance-assistant&tab=invoices');
    await screen.findAllByText('INV-1001');
    openMenu('More actions for invoice INV-1001');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('This permanently deletes the invoice. It can’t be undone.');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete invoice' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('INV-1001 couldn’t be deleted. Nothing was changed.');
    expect(screen.getAllByText('INV-1001', { exact: true }).length).toBeGreaterThan(0);
  });
});

describe('The tab stays on refresh', () => {
  it('switching tab writes ?tab= (other params kept, type= dropped)', async () => {
    renderAt('?tool=business-finance-assistant&tab=dashboard&payroll=history');
    await screen.findByLabelText('Invoice figures');
    act(() => { fireEvent.mouseDown(screen.getByRole('tab', { name: 'Invoices' })); });
    fireEvent.click(screen.getByRole('tab', { name: 'Invoices' }));
    await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('?tool=business-finance-assistant&tab=invoices&payroll=history'));
  });

  it('a fresh load at any of the 13 tab values opens that tab', async () => {
    const label: Record<string, string> = { dashboard: 'Overview', payroll: 'Payroll (UK)' };
    for (const tab of FINANCE_TABS) {
      const { unmount } = renderAt(`?tool=business-finance-assistant&tab=${tab}`);
      expect(activeTab()).toBe(label[tab] ?? tab.charAt(0).toUpperCase() + tab.slice(1));
      unmount();
    }
  });

  it('a missing or unknown tab lands on Overview, never Create', () => {
    for (const q of ['?tool=business-finance-assistant', '?tool=business-finance-assistant&tab=nope']) {
      const { unmount } = renderAt(q);
      expect(activeTab()).toBe('Overview');
      unmount();
    }
  });

  it('"New invoice" (?type=invoice) still opens Create with invoice preselected', async () => {
    renderAt('?tool=business-finance-assistant&tab=create&type=invoice');
    expect(activeTab()).toBe('Create');
    expect(await screen.findByTestId('create-form')).toHaveTextContent('Create form: invoice');
  });

  it('after "New invoice", moving to another tab drops type= so a refresh no longer reopens Create', async () => {
    renderAt('?tool=business-finance-assistant&tab=dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));
    await waitFor(() => expect(screen.getByTestId('url').textContent).toContain('tab=create'));
    act(() => { fireEvent.mouseDown(screen.getByRole('tab', { name: 'Quotes' })); });
    fireEvent.click(screen.getByRole('tab', { name: 'Quotes' }));
    await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('?tool=business-finance-assistant&tab=quotes'));
  });
});
