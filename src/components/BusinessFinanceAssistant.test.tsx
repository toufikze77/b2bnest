import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { FINANCE_TABS } from '@/lib/financeTabs';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast, Toaster: () => null }));
const authUser = vi.hoisted(() => ({ id: 'u1', email: 'owner@acme.example' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: authUser }) }));
vi.mock('@/hooks/useUserSettings', () => ({ useUserSettings: () => ({ settings: { currency_code: 'GBP' } }) }));
vi.mock('@/contexts/OrganizationContext', () => ({ useActiveOrganization: () => ({ organization: { name: 'Acme Trading Ltd' } }) }));
vi.mock('@/hooks/useDocumentTemplates', () => ({ useDocumentTemplates: () => ({ templateFor: () => 'classic' }) }));
// Heavy tabs not under test here: stand-ins that show what they were given.
vi.mock('@/components/QuoteInvoiceCreationSection', () => ({ default: (p: { documentType: string }) => <div data-testid="create-form">Create form: {p.documentType}</div> }));
vi.mock('@/components/payroll/PayrollUK', () => ({ default: () => <div>Payroll stand-in</div> }));
vi.mock('@/components/documents/DocumentTemplatePicker', () => ({ default: () => <div>Templates stand-in</div> }));
vi.mock('@/components/finance/FinanceAnalytics', () => ({ FinanceAnalytics: () => <div>Analytics stand-in</div> }));
// The real PDF layout is not under test: a tiny stand-in PDF with the same output()/save() calls.
const pdfSave = vi.hoisted(() => vi.fn());
vi.mock('@/lib/documentTemplates', async (orig) => ({
  ...(await orig<object>()),
  renderDocumentPdf: () => ({ output: () => new TextEncoder().encode('%PDF-1.4 stand-in').buffer, save: pdfSave }),
}));

/**
 * Supabase stand-in. Reads return the rows below; writes are recorded with their filters and can be
 * made to fail. Every function call is recorded. The only function the page may call is send-document-email:
 * its GET "may this user send, and from which address?" check (answer: `emailAccess`), and a send only in tests that set
 * `sendReply` (a fake answer; nothing real is ever contacted).
 */
const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  writes: [] as { table: string; op: string; payload: unknown; filters: unknown[][] }[],
  failWrites: false,
  functionCalls: [] as { name: string; method: string; body?: Record<string, unknown> }[],
  emailAccess: { configured: false, reason: 'not_configured' } as Record<string, unknown>,
  sendReply: null as null | (() => Promise<{ data: unknown; error: unknown }>),
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
            db.writes.push({ table, op: w[0] as string, payload: w[1], filters: calls.filter((c) => c[0] === 'eq' || c[0] === 'not').map((c) => (c[0] === 'not' ? ['not', ...c.slice(1)] : c.slice(1))) });
            if (db.failWrites) return res({ data: null, error: { message: 'Simulated network error' } });
            const id = calls.find((c) => c[0] === 'eq' && c[1] === 'id')?.[2];
            // Like the database: a delete with `not archived_at is null` only removes archived rows.
            const onlyArchived = calls.some((c) => c[0] === 'not' && c[1] === 'archived_at');
            if (w[0] === 'update') db.rows[table] = (db.rows[table] ?? []).map((r) => (r.id === id ? { ...r, ...(w[1] as object) } : r));
            if (w[0] === 'delete') db.rows[table] = (db.rows[table] ?? []).filter((r) => r.id !== id || (onlyArchived && !r.archived_at));
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
      functions: {
        invoke: (name: string, opts?: { method?: string; body?: Record<string, unknown> }) => {
          const call = { name, method: opts?.method ?? 'POST', body: opts?.body };
          db.functionCalls.push(call);
          if (call.method === 'GET') return Promise.resolve({ data: db.emailAccess, error: null });
          return db.sendReply ? db.sendReply() : Promise.resolve({ data: null, error: { message: 'unexpected call' } });
        },
      },
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
  db.writes = []; db.failWrites = false; db.functionCalls = []; db.emailAccess = { configured: false, reason: 'not_configured' }; db.sendReply = null;
  Object.values(toast).forEach((f) => f.mockClear());
  fetchSpy.mockClear();
  vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => {
  vi.unstubAllGlobals();
  // Only send-document-email is ever called, never with a recipient address; nothing is sent unless the test fakes a send.
  for (const c of db.functionCalls) { expect(c.name).toBe('send-document-email'); expect(c.body ?? {}).not.toHaveProperty('to'); }
  if (!db.sendReply) expect(db.functionCalls.filter((c) => c.method !== 'GET')).toEqual([]);
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
    // Mark as paid records the paid date in the same update.
    expect(db.writes).toEqual([{ table: 'invoices', op: 'update', payload: { status: 'paid', paid_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) }, filters: [['id', '1002'], ['user_id', 'u1']] }]);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    const tiles = await screen.findByLabelText('Invoice figures');
    await waitFor(() => expect(tiles).toHaveTextContent(/Paid last 30 days£950/));
    // Marked paid now, so it has a paid date: no "no paid date recorded" note.
    expect(tiles).not.toHaveTextContent('no paid date recorded');
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

  it('the document view has Mark as sent and Move to archive, and no Send or Delete button', async () => {
    renderAt('?tool=business-finance-assistant&tab=invoices');
    await screen.findAllByText('INV-1001');
    fireEvent.click(screen.getAllByRole('button', { name: 'View invoice INV-1001' })[0]);
    const view = await screen.findByRole('dialog');
    expect(within(view).getByRole('button', { name: 'Mark as sent' })).toBeInTheDocument();
    expect(within(view).getByRole('button', { name: 'Move to archive' })).toBeInTheDocument();
    expect(within(view).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(within(view).queryByRole('button', { name: /^Send$/ })).not.toBeInTheDocument();
    expect(view).toHaveTextContent('B2BNEST doesn’t email documents yet.');
  });
});

describe('Archive, restore, delete forever', () => {
  const archivedPaid = { ...invoice('1003', 'paid', 400, day(-30)), paid_at: iso(3), archived_at: iso(1) };

  it('Move to archive: light confirmation, sets archived_at for this user only, toast with Undo, row moves to Archive', async () => {
    renderAt('?tool=business-finance-assistant&tab=invoices');
    await screen.findAllByText('INV-1002');
    openMenu('More actions for invoice INV-1002');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Move to archive' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Move invoice INV-1002 to the archive?');
    expect(confirm).toHaveTextContent('You can restore it from the Archive.');
    expect(db.writes).toEqual([]);
    fireEvent.click(within(confirm).getByRole('button', { name: 'Move to archive' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(db.writes).toEqual([{ table: 'invoices', op: 'update', payload: { archived_at: expect.stringMatching(/^\d{4}-/) }, filters: [['id', '1002'], ['user_id', 'u1']] }]);
    expect(db.rows.invoices.find((r) => r.id === '1002')?.status).toBe('sent'); // status kept
    const [msg, opts] = toast.success.mock.calls.at(-1) as [string, { action: { label: string; onClick: () => void } }];
    expect(msg).toBe('Invoice INV-1002 archived. It is no longer included in totals.');
    expect(opts.action.label).toBe('Undo');
    expect(screen.getByRole('button', { name: 'Archive (1)' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('INV-1002')).not.toBeInTheDocument();
    // Undo restores it.
    await act(async () => { opts.action.onClick(); });
    await waitFor(() => expect(db.writes.at(-1)).toEqual({ table: 'invoices', op: 'update', payload: { archived_at: null }, filters: [['id', '1002'], ['user_id', 'u1']] }));
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('INV-1002')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Archive (0)' })).toBeInTheDocument();
  });

  it('a failed archive rolls back: the row stays active and the dialog explains', async () => {
    db.failWrites = true;
    renderAt('?tool=business-finance-assistant&tab=invoices');
    await screen.findAllByText('INV-1001');
    openMenu('More actions for invoice INV-1001');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Move to archive' }));
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Move to archive' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('INV-1001 wasn’t moved to the archive. Nothing was changed.');
    // The open dialog marks the page aria-hidden, hence `hidden: true`.
    expect(screen.getByRole('button', { name: 'Archive (0)', hidden: true })).toBeInTheDocument();
    expect(within(screen.getByRole('table', { hidden: true })).getByText('INV-1001')).toBeInTheDocument();
  });

  it('Delete forever is only in the Archive view, names the document, and deletes only archived rows for this user', async () => {
    db.rows.invoices.push(archivedPaid);
    renderAt('?tool=business-finance-assistant&tab=invoices');
    await screen.findAllByText('INV-1001');
    expect(screen.queryAllByText('INV-1003')).toHaveLength(0); // not in the Active list
    fireEvent.click(screen.getByRole('button', { name: 'Archive (1)' }));
    openMenu('More actions for invoice INV-1003');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete forever' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete invoice INV-1003 forever?');
    expect(confirm).toHaveTextContent('It can’t be undone. UK businesses normally keep invoices for several years for their records.');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete forever' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(db.writes).toEqual([{ table: 'invoices', op: 'delete', payload: undefined, filters: [['id', '1003'], ['user_id', 'u1'], ['not', 'archived_at', 'is', null]] }]);
    expect(toast.success).toHaveBeenCalledWith('Invoice INV-1003 deleted forever');
    expect(screen.getByRole('button', { name: 'Archive (0)' })).toBeInTheDocument();
  });

  it('a failed delete forever keeps the archived row and explains', async () => {
    db.rows.invoices.push(archivedPaid);
    db.failWrites = true;
    renderAt('?tool=business-finance-assistant&tab=invoices');
    await screen.findAllByText('INV-1001');
    fireEvent.click(screen.getByRole('button', { name: 'Archive (1)' }));
    openMenu('More actions for invoice INV-1003');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete forever' }));
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete forever' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('INV-1003 couldn’t be deleted. Nothing was changed.');
    expect(screen.getByRole('button', { name: 'Archive (1)', hidden: true })).toBeInTheDocument();
  });

  it('Restore from the Archive view clears archived_at; a failed restore rolls back with an error', async () => {
    db.rows.invoices.push(archivedPaid);
    renderAt('?tool=business-finance-assistant&tab=invoices');
    await screen.findAllByText('INV-1001');
    fireEvent.click(screen.getByRole('button', { name: 'Archive (1)' }));
    openMenu('More actions for invoice INV-1003');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Restore' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('INV-1003 restored.'));
    expect(db.writes).toEqual([{ table: 'invoices', op: 'update', payload: { archived_at: null }, filters: [['id', '1003'], ['user_id', 'u1']] }]);
    expect(screen.getByRole('button', { name: 'Archive (0)' })).toBeInTheDocument();
  });

  it('a failed restore keeps it in the archive', async () => {
    db.rows.invoices.push(archivedPaid);
    db.failWrites = true;
    renderAt('?tool=business-finance-assistant&tab=invoices');
    await screen.findAllByText('INV-1001');
    fireEvent.click(screen.getByRole('button', { name: 'Archive (1)' }));
    openMenu('More actions for invoice INV-1003');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Restore' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('INV-1003 wasn’t restored. It is still in the archive. Please try again.'));
    expect(screen.getByRole('button', { name: 'Archive (1)' })).toBeInTheDocument();
  });

  it('an archived invoice opened from the Archive offers Restore only (no edit or status changes)', async () => {
    db.rows.invoices.push(archivedPaid);
    renderAt('?tool=business-finance-assistant&tab=invoices');
    await screen.findAllByText('INV-1001');
    fireEvent.click(screen.getByRole('button', { name: 'Archive (1)' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'View invoice INV-1003' })[0]);
    const view = await screen.findByRole('dialog');
    const names = within(view).getAllByRole('button').map((b) => b.textContent?.trim()).filter(Boolean);
    expect(names).toContain('Restore');
    expect(names).not.toContain('Mark as unpaid');
    expect(names).not.toContain('Move to archive');
    expect(view).toHaveTextContent('Archived documents are left out of all totals.');
  });

  it('archived invoices are left out of the Overview tiles', async () => {
    db.rows.invoices.push(archivedPaid);
    renderAt('?tool=business-finance-assistant&tab=dashboard');
    const tiles = await screen.findByLabelText('Invoice figures');
    await waitFor(() => expect(tiles).toHaveTextContent('Outstanding£950'));
    expect(tiles).toHaveTextContent('Paid last 30 days—');
    expect(tiles).not.toHaveTextContent('£400');
  });
});

describe('Email to customer', () => {
  const emailable = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
    ...invoice(id, status, 1250, '2026-11-01'), client_email: 'accounts@client.example', client_name: 'Priya Shah', company_name: 'Acme Trading Ltd', ...extra,
  });
  const ok = () => Promise.resolve({ data: { success: true, status: 'accepted_by_provider', sent: 'accepted', recipient: 'accounts@client.example' }, error: null });
  const fails = (body: Record<string, unknown>) => () => Promise.resolve({ data: null, error: { context: { json: async () => body } } });
  const menuItem = async (number: string, name: RegExp) => {
    await screen.findAllByText(number);
    await waitFor(() => expect(db.functionCalls.some((c) => c.method === 'GET')).toBe(true));
    openMenu(`More actions for invoice ${number}`);
    return screen.findByRole('menuitem', { name });
  };
  const openDialog = async (number = 'INV-1001', label = /^Email to customer/) => {
    fireEvent.click(await menuItem(number, label));
    const dialog = await screen.findByRole('dialog', { name: new RegExp(`invoice ${number}$`) });
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Send email' })).toBeEnabled());
    return dialog;
  };
  const SENDER = 'notifications@b2bnest.online';
  beforeEach(() => { db.emailAccess = { configured: true, sender: SENDER }; db.rows = { invoices: [emailable('1001', 'draft')], quotes: [] }; pdfSave.mockClear(); });

  it('not configured: the menu says "not available yet" with the reason, and choosing it sends nothing', async () => {
    db.emailAccess = { configured: false, reason: 'not_configured' };
    renderAt('?tool=business-finance-assistant&tab=invoices');
    const item = await menuItem('INV-1001', /Email to customer \(not available yet\)/);
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveTextContent('isn’t switched on yet. Download the PDF and send it yourself.');
    fireEvent.click(item);
    expect(screen.queryByRole('dialog', { name: /Email to customer: invoice/ })).toBeNull();
    expect(db.functionCalls.map((c) => c.method)).toEqual(['GET']);
  });

  it('not on the allowlist: the same "not available yet" item, with the account reason; nothing sent', async () => {
    db.emailAccess = { configured: false, reason: 'not_allowed' };
    renderAt('?tool=business-finance-assistant&tab=invoices');
    const item = await menuItem('INV-1001', /Email to customer \(not available yet\)/);
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveTextContent('isn’t switched on for your account yet. Download the PDF and send it yourself.');
    fireEvent.click(item);
    expect(screen.queryByRole('dialog', { name: /Email to customer: invoice/ })).toBeNull();
    expect(db.functionCalls.map((c) => c.method)).toEqual(['GET']);
  });

  it('email address not verified: "not available yet" with "Verify your email address to use this."', async () => {
    db.emailAccess = { configured: false, reason: 'email_not_verified' };
    renderAt('?tool=business-finance-assistant&tab=invoices');
    const item = await menuItem('INV-1001', /Email to customer \(not available yet\)/);
    expect(item).toHaveTextContent('Verify your email address to use this.');
    fireEvent.click(item);
    expect(db.functionCalls.map((c) => c.method)).toEqual(['GET']);
  });

  it('the sender line uses the address the server reported; with none, no address is invented', async () => {
    db.emailAccess = { configured: true, sender: 'billing-test@b2bnest.example' };
    const first = renderAt('?tool=business-finance-assistant&tab=invoices');
    let dialog = await openDialog();
    expect(dialog).toHaveTextContent('This email is sent from billing-test@b2bnest.example on your behalf.');
    first.unmount();
    db.emailAccess = { configured: true };
    renderAt('?tool=business-finance-assistant&tab=invoices');
    dialog = await openDialog();
    expect(dialog).toHaveTextContent('This email is sent from the B2BNEST sending address on your behalf. Replies go to owner@acme.example.');
    expect(dialog).not.toHaveTextContent(/info@/);
  });

  it('no customer email: disabled with the reason', async () => {
    db.rows.invoices = [emailable('1001', 'draft', { client_email: null })];
    renderAt('?tool=business-finance-assistant&tab=invoices');
    const item = await menuItem('INV-1001', /^Email to customer/);
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveTextContent('Add the customer’s email address first (Edit the invoice).');
  });

  it('paid invoice: disabled with the reason', async () => {
    db.rows.invoices = [emailable('1001', 'paid', { paid_at: iso(1) })];
    renderAt('?tool=business-finance-assistant&tab=invoices');
    const item = await menuItem('INV-1001', /^Email to customer/);
    expect(item).toHaveTextContent('This invoice is paid, so it isn’t emailed.');
  });

  it('the preview shows To (read-only), subject, message, attachment and who it is from', async () => {
    renderAt('?tool=business-finance-assistant&tab=invoices');
    const dialog = await openDialog();
    expect(within(dialog).getByLabelText('To')).toHaveValue('accounts@client.example');
    expect(within(dialog).getByLabelText('To')).toHaveAttribute('readonly');
    expect(within(dialog).getByLabelText('Subject')).toHaveValue('Invoice INV-1001 from Acme Trading Ltd');
    expect(within(dialog).getByLabelText('Message')).toHaveValue('Hello Priya Shah,\n\nPlease find invoice INV-1001 attached, total 1,250.00 GBP, due 1 Nov 2026.\n\nSent by Acme Trading Ltd using B2BNEST.');
    expect(dialog).toHaveTextContent('Attachment: INV-1001.pdf');
    expect(dialog).toHaveTextContent('This email is sent from notifications@b2bnest.online on your behalf. Replies go to owner@acme.example.');
    expect(within(dialog).getByRole('button', { name: 'Edit customer' })).toBeInTheDocument();
  });

  it('success: status becomes Sent only after the server says the provider accepted it; no address is sent', async () => {
    let answer!: (v: { data: unknown; error: unknown }) => void;
    db.sendReply = () => new Promise((r) => { answer = r; });
    renderAt('?tool=business-finance-assistant&tab=invoices');
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText('Message'), { target: { value: 'Hi Priya, invoice attached.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send email' }));
    expect(await within(dialog).findByRole('button', { name: 'Sending…' })).toBeDisabled();
    expect(db.writes).toEqual([]);
    const post = db.functionCalls.find((c) => c.method === 'POST')!;
    expect(Object.keys(post.body!).sort()).toEqual(['id', 'kind', 'message', 'pdf_base64', 'subject']);
    expect(post.body).toMatchObject({ kind: 'invoice', id: '1001', subject: 'Invoice INV-1001 from Acme Trading Ltd', message: 'Hi Priya, invoice attached.' });
    expect(atob(post.body!.pdf_base64 as string)).toBe('%PDF-1.4 stand-in');
    await act(async () => { answer((await ok())); });
    await waitFor(() => expect(db.writes).toEqual([{ table: 'invoices', op: 'update', payload: { status: 'sent' }, filters: [['id', '1001'], ['user_id', 'u1']] }]));
    expect(toast.success).toHaveBeenCalledWith('Email sent to accounts@client.example. Your mail provider accepted it.');
    expect(JSON.stringify(toast.success.mock.calls)).not.toMatch(/deliver/i);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /invoice INV-1001$/ })).toBeNull());
  });

  it('failure: the plain reason, the dialog stays open, the invoice is unchanged, and the PDF can be downloaded instead', async () => {
    db.sendReply = fails({ success: false, code: 'provider_auth_rejected', sent: 'not_sent', error: 'The B2BNEST sending account couldn’t sign in to the mail server (wrong password or sign-in blocked). Nothing was sent.' });
    renderAt('?tool=business-finance-assistant&tab=invoices');
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send email' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('The email wasn’t sent');
    expect(alert).toHaveTextContent('couldn’t sign in to the mail server (wrong password or sign-in blocked). Nothing was sent.');
    expect(alert).toHaveTextContent('The invoice is unchanged.');
    expect(db.writes).toEqual([]);
    expect(toast.success).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole('button', { name: 'Download PDF and send it yourself' }));
    await waitFor(() => expect(pdfSave).toHaveBeenCalledWith('invoice_INV-1001.pdf'));
    expect(within(dialog).getByRole('button', { name: 'Send email' })).toBeEnabled(); // can retry
  });

  it('uncertain outcome: told to check before retrying, nothing recorded', async () => {
    db.sendReply = fails({ success: false, code: 'uncertain', sent: 'unknown', error: 'The connection to the email provider was lost after the message was handed over, so it may or may not have been sent.' });
    renderAt('?tool=business-finance-assistant&tab=invoices');
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send email' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Not sure the email was sent');
    expect(db.writes).toEqual([]);
  });

  it('sent, but the status could not be saved: says exactly that', async () => {
    db.sendReply = ok; db.failWrites = true;
    renderAt('?tool=business-finance-assistant&tab=invoices');
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send email' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The email was sent, but the status could not be saved. Mark it as sent manually.'));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('already sent: "Email again" with the extra line, and the status is not written again', async () => {
    db.rows.invoices = [emailable('1002', 'sent')];
    db.sendReply = ok;
    renderAt('?tool=business-finance-assistant&tab=invoices');
    const dialog = await openDialog('INV-1002', /^Email again/);
    expect(dialog).toHaveTextContent('This invoice was already sent. Your customer will receive it again.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send email' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Email sent to accounts@client.example. Your mail provider accepted it.'));
    expect(db.writes).toEqual([]);
  });

  it('"Edit customer" opens the edit form for this invoice', async () => {
    renderAt('?tool=business-finance-assistant&tab=invoices');
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit customer' }));
    expect(await screen.findByTestId('create-form')).toHaveTextContent('Create form: invoice');
    expect(screen.queryByRole('dialog', { name: /invoice INV-1001$/ })).toBeNull();
  });

  it('the document view offers Email to customer; an archived invoice offers no email', async () => {
    const first = renderAt('?tool=business-finance-assistant&tab=invoices');
    await screen.findAllByText('INV-1001');
    fireEvent.click(screen.getAllByRole('button', { name: 'View invoice INV-1001' })[0]);
    const view = await screen.findByRole('dialog');
    await waitFor(() => expect(within(view).getByRole('button', { name: 'Email to customer' })).toBeEnabled());
    first.unmount();
    db.rows.invoices = [emailable('1003', 'draft', { archived_at: iso(1) })];
    renderAt('?tool=business-finance-assistant&tab=invoices&archive=invoices');
    await screen.findAllByText('INV-1003');
    fireEvent.click(screen.getAllByRole('button', { name: 'View invoice INV-1003' })[0]);
    const archivedView = await screen.findByRole('dialog');
    expect(within(archivedView).queryByRole('button', { name: /Email/ })).toBeNull();
  });
});

describe('The Archive view stays on refresh', () => {
  const quote = (id: string, extra: Record<string, unknown> = {}) => ({ ...invoice(id, 'sent', 300, day(10)), invoice_number: undefined, quote_number: `Q-${id}`, valid_until: day(10), ...extra });
  const BASE = '?tool=business-finance-assistant';
  const pressed = (name: RegExp) => screen.getByRole('button', { name }).getAttribute('aria-pressed');
  beforeEach(() => {
    db.rows = {
      invoices: [invoice('1001', 'draft', 600, day(20)), { ...invoice('1009', 'sent', 70, day(5)), archived_at: iso(1) }],
      quotes: [quote('501'), quote('509', { archived_at: iso(2) })],
    };
  });

  it('switching to Archive writes ?archive=invoices, keeps tool and tab, and replaces history', async () => {
    renderAt(`${BASE}&tab=invoices`);
    fireEvent.click(await screen.findByRole('button', { name: /^Archive \(1\)$/ }));
    await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('?tool=business-finance-assistant&tab=invoices&archive=invoices'));
    expect(pressed(/^Archive \(1\)$/)).toBe('true');
    expect(await screen.findAllByText('INV-1009')).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Active' }));
    await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('?tool=business-finance-assistant&tab=invoices'));
  });

  it('a fresh load at ?archive=invoices opens the invoices Archive; quotes stay Active', async () => {
    renderAt(`${BASE}&tab=invoices&archive=invoices`);
    expect(await screen.findAllByText('INV-1009')).not.toHaveLength(0);
    expect(pressed(/^Archive \(1\)$/)).toBe('true');
    expect(screen.queryByText('INV-1001')).toBeNull();
  });

  it('a fresh load at ?archive=quotes opens the quotes Archive, and the invoices tab is not forced into Archive', async () => {
    const first = renderAt(`${BASE}&tab=quotes&archive=quotes`);
    expect(await screen.findAllByText('Q-509')).not.toHaveLength(0);
    expect(pressed(/^Archive \(1\)$/)).toBe('true');
    first.unmount();
    renderAt(`${BASE}&tab=invoices&archive=quotes`);
    expect(await screen.findAllByText('INV-1001')).not.toHaveLength(0);
    expect(pressed(/^Active$/)).toBe('true');
  });

  it('both tabs can be in Archive at once; moving between tabs keeps each view', async () => {
    renderAt(`${BASE}&tab=quotes&archive=quotes%2Cinvoices`);
    expect(await screen.findAllByText('Q-509')).not.toHaveLength(0);
    fireEvent.mouseDown(screen.getByRole('tab', { name: /^Invoices$/ }));
    fireEvent.click(screen.getByRole('tab', { name: /^Invoices$/ }));
    expect(await screen.findAllByText('INV-1009')).not.toHaveLength(0);
    expect(screen.getByTestId('url').textContent).toBe('?tool=business-finance-assistant&tab=invoices&archive=quotes%2Cinvoices');
  });

  it('an invalid ?archive= value falls back to Active', async () => {
    renderAt(`${BASE}&tab=invoices&archive=1`);
    expect(await screen.findAllByText('INV-1001')).not.toHaveLength(0);
    expect(pressed(/^Active$/)).toBe('true');
    expect(screen.queryByText('INV-1009')).toBeNull();
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
