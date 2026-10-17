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
vi.mock('@/integrations/supabase/client', () => {
  const chain = (): Record<string, unknown> => new Proxy({}, {
    get(_t, k: string) {
      if (k === 'then') return (res: (v: unknown) => void) => res({ data: [], error: null });
      return () => chain();
    },
  });
  return { supabase: { from: () => chain(), functions: { invoke: functionsInvoke } } };
});

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});
beforeEach(() => localStorage.clear());

const renderPage = () => render(<MemoryRouter><BusinessOverview /></MemoryRouter>);
const summary = () => screen.getByRole('region', { name: 'Summary' });

describe('Business overview page', () => {
  it('every card opens the screen that manages it; none goes to the Dashboard; Bills is not a link', async () => {
    renderPage();
    await waitFor(() => expect(within(summary()).getAllByRole('link')[0]).toHaveAccessibleName(/^Money in: £0\. 0 paid invoices/));
    const href = (name: RegExp) => within(summary()).getByRole('link', { name }).getAttribute('href');
    const invoices = '/business-tools?tool=business-finance-assistant&tab=invoices';
    expect(href(/^Money in/)).toBe(invoices);
    expect(href(/^Outstanding invoices/)).toBe(invoices);
    expect(href(/^Overdue invoices/)).toBe(invoices);
    expect(href(/^Money out/)).toBe('/business-tools?tool=business-finance-assistant&tab=expenses');
    expect(href(/^Open pipeline/)).toBe('/crm?tab=deals');
    expect(href(/^CRM contacts/)).toBe('/crm');
    expect(href(/^Active projects/)).toBe('/project-management');
    expect(href(/^Open tasks/)).toBe('/project-management?view=list');
    const links = within(summary()).getAllByRole('link');
    expect(links).toHaveLength(8);
    for (const l of links) {
      expect(l.getAttribute('href')).not.toBe('/dashboard');
      expect(l.getAttribute('aria-label')).toMatch(/Opens .+\.$/);
    }
    expect(within(summary()).queryByRole('link', { name: /^Bills/ })).toBeNull();
    expect(within(summary()).getByText(/There is no screen to manage bills yet\./)).toBeInTheDocument();
    expect(functionsInvoke).not.toHaveBeenCalled();
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
