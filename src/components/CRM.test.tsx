import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let access = true;
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ canAccessFeature: () => access }) }));
vi.mock('@/contexts/OrganizationContext', () => ({ useActiveOrganization: () => ({ organization: { name: 'Acme' } }) }));
vi.mock('@/hooks/useUserSettings', () => ({ useUserSettings: () => ({ settings: { currency_code: 'GBP' } }) }));
vi.mock('./SubscriptionUpgrade', () => ({ default: () => <p>Upgrade to use CRM</p> }));
vi.mock('./crm/MarketingTab', () => ({ default: () => <p>Marketing panel</p> }));
vi.mock('./crm/ReportsTab', () => ({ default: () => <p>Reports panel</p> }));
vi.mock('./crm/AnalyticsTab', () => ({ default: () => <p>Analytics panel</p> }));
const rows: Record<string, unknown[]> = {
  crm_contacts: [{ id: 'c1', name: 'Priya Shah', email: null, phone: null, company: 'Acme', position: null, status: 'customer', value: 10, last_contact: null, source: null, user_id: 'u1', notes: null, tags: null, created_at: '', updated_at: '' }],
  crm_deals: [],
};
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => ({ select: () => ({ eq: async () => ({ data: rows[t], error: null }) }) }) } }));

import CRM from './CRM';

const Where = () => <p data-testid="where">{useLocation().search}</p>;
const ui = (band: boolean, url = '/crm') => (
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/crm" element={<><CRM band={band} /><Where /></>} /><Route path="/settings" element={<p>Settings page</p>} /></Routes>
  </MemoryRouter>
);

beforeEach(() => { access = true; });

describe('CRM page frame', () => {
  it('full page: light header (breadcrumb, title, actions) and the tabs on the navy strip only', async () => {
    render(ui(true));
    await screen.findAllByText('Priya Shah');
    const h1 = screen.getByRole('heading', { level: 1, name: 'CRM' });
    expect(h1.closest('.bg-brand-navy')).toBeNull(); // the title area is light
    const header = h1.closest('header') as HTMLElement;
    const h = within(header);
    expect(h.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Acme', 'Customers', 'CRM']);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(h.getByRole('button', { name: 'Import / Export' })).toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: 'CRM sections' });
    expect(tabs.closest('.bg-brand-navy')).not.toBeNull(); // navy holds only the tabs
    expect(within(tabs).getByRole('tab', { name: 'Contacts' })).toHaveAttribute('data-state', 'active');
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Contacts', 'Sales Pipeline', 'Marketing', 'Reports', 'Analytics']);
    // Add contact in the header opens the existing form.
    fireEvent.click(h.getByRole('button', { name: 'Add contact' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Add New Contact');
  });

  it('embedded (Business Tools): no band; toolbar actions stay inside the Contacts tab', async () => {
    render(ui(false));
    await screen.findAllByText('Priya Shah');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add Contact' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import / Export' })).toBeInTheDocument();
  });

  it('tab routing is unchanged: ?tab= selects the tab and choosing a tab writes it', async () => {
    render(ui(true, '/crm?tab=marketing'));
    expect(await screen.findByText('Marketing panel')).toBeInTheDocument();
    const deals = screen.getByRole('tab', { name: 'Sales Pipeline' });
    fireEvent.mouseDown(deals); fireEvent.click(deals);
    expect(screen.getByTestId('where')).toHaveTextContent('?tab=deals');
  });

  it('the old security deep link still redirects to company settings', async () => {
    render(ui(true, '/crm?tab=security'));
    expect(await screen.findByText('Settings page')).toBeInTheDocument();
  });

  it('plan check is unchanged: without CRM access the upgrade screen shows, with no tabs or actions', async () => {
    access = false;
    render(ui(true));
    expect(await screen.findByText('Upgrade to use CRM')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add contact' })).toBeNull();
  });
});
