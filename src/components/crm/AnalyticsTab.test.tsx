import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let account = 'GBP';
const toast = vi.fn();
const authUser = { id: 'u1' };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: authUser }) }));
vi.mock('@/hooks/useAccountCurrency', () => ({ useAccountCurrency: () => account }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

import AnalyticsTab from './AnalyticsTab';
import ReportsTab from './ReportsTab';

const day = (o: number) => { const d = new Date(); d.setDate(d.getDate() + o); return d.toISOString().slice(0, 10); };
const contacts = [
  { status: 'customer', source: 'Referral', created_at: new Date().toISOString() },
  { status: 'lead', source: 'Web', created_at: new Date().toISOString() },
  { status: 'lead', source: null, created_at: new Date().toISOString() },
];
const deals = [
  { stage: 'won', value: 1000, currency: 'GBP', close_date: day(-1) },
  { stage: 'won', value: 3000, currency: 'GBP', close_date: null },
  { stage: 'lost', value: 500, currency: 'GBP', close_date: day(-2) },
  { stage: 'proposal', value: 2000, currency: 'GBP', close_date: day(5) },
  { stage: 'won', value: 700, currency: 'USD', close_date: day(-3) },
  { stage: 'won', value: 700, currency: 'USD', close_date: day(-3) },
];
const FAKE = /1,247|156 calls|342|100,000|47,200|1,840|24\.5%|32\.5K|45 days|12% vs|Connected|Looker|BigQuery|Metabase/;

beforeEach(() => { localStorage.clear(); account = 'GBP'; toast.mockClear(); });

describe('Analytics', () => {
  it('shows real figures only, in the account currency, with other currencies listed, never converted', () => {
    render(<MemoryRouter><AnalyticsTab contacts={contacts} deals={deals} /></MemoryRouter>);
    expect(document.body.textContent).not.toMatch(FAKE);
    const figures = within(screen.getByLabelText('Key figures'));
    // Win rate: 4 won (any currency) of 5 won or lost.
    expect(figures.getByText('80%')).toBeInTheDocument();
    // Average won deal in GBP: (1000 + 3000) / 2.
    expect(figures.getByText('£2,000')).toBeInTheDocument();
    expect(screen.getByText(/2 deals in USD are not included/)).toBeInTheDocument();
    expect(screen.getByText(/1 won deal has no close date/)).toBeInTheDocument();
    expect(screen.getByText('Contacts added and how many became customers')).toBeInTheDocument();
    expect(screen.queryByText(/conversion rate over time/i)).toBeNull();
  });

  it('every chart can be read as a real table', () => {
    render(<MemoryRouter><AnalyticsTab contacts={contacts} deals={deals} /></MemoryRouter>);
    const lead = screen.getByRole('region', { name: 'Lead sources' });
    fireEvent.click(within(lead).getByRole('button', { name: 'View as table' }));
    const t = within(lead).getByRole('table', { name: 'Lead sources' });
    expect(within(t).getByRole('rowheader', { name: 'Not set' })).toBeInTheDocument();
    expect(within(t).getAllByText('33.3%')).toHaveLength(3);
  });

  it('a hand-picked currency is remembered and can be reset to the account currency', () => {
    localStorage.setItem('b2bnest.crm.reportCurrency.u1', 'USD');
    render(<MemoryRouter><AnalyticsTab contacts={contacts} deals={deals} /></MemoryRouter>);
    expect(within(screen.getByLabelText('Key figures')).getByText('US$700')).toBeInTheDocument();
    expect(screen.getByText(/2 deals in GBP are not included/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to account currency (GBP)' }));
    expect(localStorage.getItem('b2bnest.crm.reportCurrency.u1')).toBeNull();
    expect(within(screen.getByLabelText('Key figures')).getByText('£2,000')).toBeInTheDocument();
  });

  it('empty and error states, never sample numbers', () => {
    const { unmount } = render(<MemoryRouter><AnalyticsTab contacts={[]} deals={[]} onOpenTab={() => {}} /></MemoryRouter>);
    expect(screen.getByText('No contacts yet, so there are no lead sources to show.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add your first deal' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(FAKE);
    unmount();
    render(<MemoryRouter><AnalyticsTab contacts={[]} deals={[]} error onRetry={() => {}} /></MemoryRouter>);
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  it('no account currency: says so instead of showing $', () => {
    account = '';
    render(<MemoryRouter><AnalyticsTab contacts={contacts} deals={deals} /></MemoryRouter>);
    expect(screen.getByRole('note')).toHaveTextContent('no currency set');
    expect(document.body.textContent).not.toContain('$');
  });
});

describe('Reports', () => {
  it('shows the same real figures, no fake integrations, and exports a real CSV without delay', async () => {
    const created: Blob[] = [];
    const origCreate = URL.createObjectURL; const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((b: Blob) => { created.push(b); return 'blob:x'; }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<MemoryRouter><ReportsTab contacts={contacts} deals={deals} /></MemoryRouter>);
    expect(document.body.textContent).not.toMatch(FAKE);
    expect(screen.getByRole('link', { name: 'Integrations' })).toHaveAttribute('href', '/business-tools?tool=integrations');
    expect(screen.getByText('£4,000')).toBeInTheDocument(); // won value in GBP
    fireEvent.click(screen.getByRole('button', { name: /Export detailed report/ }));
    expect(click).toHaveBeenCalledTimes(1);
    const text = await created[0].text();
    expect(text).toContain('Pipeline,Won value,GBP,4000,2,All time');
    expect(text).toContain('Pipeline,Won value,USD,1400,2,All time');
    expect(text).not.toMatch(/24\.5|32500|47200/);
    URL.createObjectURL = origCreate; URL.revokeObjectURL = origRevoke; click.mockRestore();
  });
});
