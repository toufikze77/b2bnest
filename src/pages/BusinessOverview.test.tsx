import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BusinessOverview from './BusinessOverview';
import { sectionsKey } from '@/lib/businessOverview';

const auth = vi.hoisted(() => ({ user: { id: 'u1' } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/useAccountCurrency', () => ({ useAccountCurrency: () => 'GBP' }));
const org = vi.hoisted(() => ({ organizationId: 'o1', organization: { name: 'Acme Trading Ltd' } }));
vi.mock('@/contexts/OrganizationContext', () => ({ useActiveOrganization: () => org }));
vi.mock('@/components/SEOHead', () => ({ default: () => null }));
// Charts draw with Recharts (needs layout); the cards and drawer are what is under test.
vi.mock('@/components/charts', async (orig) => ({ ...(await orig<object>()), TrendChart: () => null, Donut: () => null, ColumnChart: () => null }));
const functionsInvoke = vi.hoisted(() => vi.fn());
// Rows per table; every table not listed reads as empty. `tables` records which tables were read.
const db = vi.hoisted(() => ({ rows: {} as Record<string, unknown[]>, tables: [] as string[] }));
vi.mock('@/integrations/supabase/client', () => {
  const chain = (table: string): Record<string, unknown> => new Proxy({}, {
    get(_t, k: string) {
      if (k === 'then') return (res: (v: unknown) => void) => res({ data: db.rows[table] ?? [], error: null });
      return () => chain(table);
    },
  });
  return { supabase: { from: (t: string) => { db.tables.push(t); return chain(t); }, functions: { invoke: functionsInvoke } } };
});

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});
beforeEach(() => { localStorage.clear(); db.rows = {}; db.tables = []; });

const renderPage = () => render(<MemoryRouter><BusinessOverview /></MemoryRouter>);
const summary = () => screen.getByRole('region', { name: 'Summary' });

describe('Business overview page', () => {
  it('every card opens the screen that manages it; none goes to the Dashboard', async () => {
    renderPage();
    await waitFor(() => expect(within(summary()).getAllByRole('link')[0]).toHaveAccessibleName(/^Money in: £0\. 0 paid invoices/));
    const href = (name: RegExp) => within(summary()).getByRole('link', { name }).getAttribute('href');
    const invoices = '/business-tools?tool=business-finance-assistant&tab=invoices';
    expect(href(/^Money in/)).toBe(invoices);
    expect(href(/^Outstanding invoices/)).toBe(invoices);
    expect(href(/^Overdue invoices/)).toBe(invoices);
    expect(href(/^Money out/)).toBe('/business-tools?tool=business-finance-assistant&tab=expenses');
    expect(href(/^Expenses to pay/)).toBe('/business-tools?tool=business-finance-assistant&tab=expenses');
    expect(href(/^Open pipeline/)).toBe('/crm?tab=deals');
    expect(href(/^CRM contacts/)).toBe('/crm');
    expect(href(/^Active projects/)).toBe('/project-management');
    expect(href(/^Open tasks/)).toBe('/project-management?view=list');
    const links = within(summary()).getAllByRole('link');
    expect(links).toHaveLength(9);
    for (const l of links) {
      expect(l.getAttribute('href')).not.toBe('/dashboard');
      expect(l.getAttribute('aria-label')).toMatch(/Opens .+\.$/);
    }
    expect(screen.queryByText(/bills/i)).toBeNull();
    expect(db.tables).not.toContain('bills');
    expect(functionsInvoke).not.toHaveBeenCalled();
  });

  it('Expenses to pay: pending and approved expenses count, paid ones do not', async () => {
    db.rows.expenses = [
      { amount: 45.99, date: '2026-09-28', status: 'pending', description: 'Mobile Bill' },
      { amount: 120, date: '2025-12-01', status: 'approved' },
      { amount: 500, date: '2026-10-01', status: 'paid' },
    ];
    renderPage();
    const card = await waitFor(() => within(summary()).getByRole('link', { name: /^Expenses to pay: £166\./ }));
    expect(card).toHaveAccessibleName('Expenses to pay: £166. 2 unpaid expenses, as of today. Pending or approved, any date. Opens Expenses.');
    expect(card.className).toMatch(/focus-visible:ring/);
    expect(within(summary()).getByRole('link', { name: /^Money out/ }).getAttribute('aria-label')).toMatch(/dated this month, paid or not\./);
  });

  it('Expenses to pay with no unpaid expenses shows £0 and 0 unpaid expenses', async () => {
    db.rows.expenses = [{ amount: 500, date: '2026-10-01', status: 'paid' }];
    renderPage();
    await waitFor(() => expect(within(summary()).getByRole('link', { name: /^Expenses to pay/ })).toHaveAccessibleName(/^Expenses to pay: £0\. 0 unpaid expenses, as of today\./));
  });

  it('shows the navy frame: breadcrumb, title, period, currency and Customise', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Business overview' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Acme Trading Ltd/Business overview');
    expect(screen.getByLabelText('Period')).toBeInTheDocument();
    expect(screen.getByLabelText('Currency')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Customise' })).toBeInTheDocument();
  });

  it('Customise: a switched-off section stays hidden after Save and a reload; Cancel changes nothing', async () => {
    const first = renderPage();
    expect(screen.getByRole('heading', { name: 'Sales pipeline by stage' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Customise' }));
    const pipeline = await screen.findByRole('switch', { name: 'Sales pipeline by stage' });
    expect(pipeline).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(pipeline);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Sales pipeline by stage' })).toBeNull());
    expect(JSON.parse(localStorage.getItem(sectionsKey('u1', 'o1'))!).pipeline).toBe(false);
    first.unmount();

    renderPage();
    expect(screen.queryByRole('heading', { name: 'Sales pipeline by stage' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Customise' }));
    fireEvent.click(await screen.findByRole('switch', { name: 'Tasks by status' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('heading', { name: 'Tasks by status' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(sectionsKey('u1', 'o1'))!).tasks).toBe(true);
  });
});
