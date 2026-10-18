import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let account = 'GBP';
const toast = vi.fn();
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useAccountCurrency', () => ({ useAccountCurrency: () => account }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
// Charts draw with Recharts (needs layout); the sections, tables and states are what is under test.
vi.mock('@/components/charts', async (orig) => ({ ...(await orig<object>()), ColumnChart: () => null, TrendChart: () => null }));

import ReportsTab from './ReportsTab';
import { crmRecordSearch } from '@/lib/crmTab';

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.scrollIntoView ??= () => {};
});

// Labelled test fixtures (not shipped). "Today" is fixed: 18 Oct 2026.
const today = new Date(2026, 9, 18, 12);
const C = (id: string, o: Record<string, unknown> = {}) => ({ id, name: `Contact ${id}`, status: 'lead', source: 'Referral', created_at: '2026-10-01T09:00:00Z', last_contact: '2026-10-15', ...o });
const D = (id: string, o: Record<string, unknown> = {}) => ({
  id, title: `Deal ${id}`, stage: 'proposal', value: 1000, currency: 'GBP', probability: 50, close_date: '2026-12-01', contact_id: null,
  created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-10T09:00:00Z', ...o,
});
const contacts = [C('c1'), C('c2', { source: null, status: 'prospect', last_contact: null }), C('c3', { source: 'Web form' })];
const deals = [
  D('d1', { stage: 'proposal', value: 1000, probability: 50, contact_id: 'c1' }),
  D('d2', { stage: 'lead', value: 400, probability: null }),
  D('d3', { stage: 'won', value: 2500, close_date: '2026-10-05', contact_id: 'c1' }),
  D('d4', { stage: 'lost', value: 300, close_date: '2026-10-07' }),
  D('d5', { stage: 'proposal', value: 900, currency: 'USD' }),
  D('d6', { stage: 'proposal', title: 'Overdue deal', close_date: '2026-10-01', updated_at: '2026-08-01T00:00:00Z' }),
];
function Where() { const l = useLocation(); return <output data-testid="where">{l.search}</output>; }
const renderTab = (p: Partial<Parameters<typeof ReportsTab>[0]> = {}) =>
  render(<MemoryRouter initialEntries={['/crm?tab=reports']}><ReportsTab contacts={contacts} deals={deals} today={today} {...p} /><Where /></MemoryRouter>);
const section = (name: string) => screen.getByRole('region', { name });

const files: { name: string; text: Promise<string> }[] = [];
let click: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  localStorage.clear(); account = 'GBP'; toast.mockClear(); files.length = 0;
  let last: Blob | null = null;
  URL.createObjectURL = vi.fn((b: Blob) => { last = b; return 'blob:x'; }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    files.push({ name: this.download, text: last!.arrayBuffer().then((b) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(b)) });
  });
});
afterEach(() => click.mockRestore());

describe('Reports: date range', () => {
  it('defaults to All time, is a labelled group with aria-pressed, and is remembered per user', () => {
    const first = renderTab();
    const group = screen.getByRole('group', { name: 'Date range' });
    expect(within(group).getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(group).getByRole('button', { name: 'Last 30 days' }));
    expect(localStorage.getItem('b2bnest.crm.reportRange.u1')).toBe('30d');
    expect(section('Pipeline by stage')).toHaveTextContent('Filtered by created date: Last 30 days.');
    expect(section('Win and loss')).toHaveTextContent('Filtered by close date: Last 30 days.');
    expect(section('Lead sources')).toHaveTextContent('Filtered by the date each contact was added: Last 30 days.');
    expect(section('Needs attention')).toHaveTextContent('As of today. Not filtered by the date range.');
    first.unmount();
    renderTab();
    expect(within(screen.getByRole('group', { name: 'Date range' })).getByRole('button', { name: 'Last 30 days' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Pipeline by stage', () => {
  it('data: stages, totals, weighted forecast, no-probability rule, other currency listed', () => {
    renderTab();
    const s = section('Pipeline by stage');
    const table = within(s).getByRole('table', { name: 'Open deals by stage in GBP' });
    const rows = within(table).getAllByRole('row').map((r) => r.textContent);
    expect(rows).toEqual(['StageDealsTotal value (GBP)Weighted forecast (GBP)No probability', 'Lead1£400—1', 'Proposal2£2,000£1,0000', 'Total3£2,400£1,0001']);
    expect(s).toHaveTextContent('1 open deal has no probability, so it is left out of the weighted forecast (not counted as 0% or 100%).');
    expect(s).toHaveTextContent('1 deal in USD is not included');
  });
  it('empty: no deals', () => {
    renderTab({ deals: [] });
    expect(section('Pipeline by stage')).toHaveTextContent('No deals yet, so there is no pipeline to report.');
  });
  it('only other currencies (production today: 4 USD deals at 50%)', () => {
    renderTab({ deals: ['a', 'b', 'c', 'd'].map((id) => D(id, { currency: 'USD', probability: 50 })) });
    expect(section('Pipeline by stage')).toHaveTextContent('None of the 4 open deals created at any time is stored in GBP. 4 deals in USD are not included');
  });
  it('error: a loading problem with Try again, never zero', () => {
    const retry = vi.fn();
    renderTab({ error: true, onRetry: retry });
    const s = section('Pipeline by stage');
    expect(within(s).getByRole('alert')).toHaveTextContent("couldn't be loaded. This is a loading problem, not missing data.");
    expect(s).not.toHaveTextContent('£0');
    fireEvent.click(within(s).getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
    expect(within(s).getByRole('button', { name: 'Download Pipeline by stage as CSV' })).toBeDisabled();
  });
  it('loading', () => {
    renderTab({ loading: true });
    expect(within(section('Pipeline by stage')).getByRole('status', { name: 'Loading Pipeline by stage' })).toBeInTheDocument();
  });
});

describe('Win and loss', () => {
  it('data: counts (every currency), win rate, sales cycle, values in GBP', () => {
    renderTab();
    const s = section('Win and loss');
    expect(s).toHaveTextContent('Won1');
    expect(s).toHaveTextContent('Lost1');
    expect(s).toHaveTextContent('Win rate50%');
    expect(s).toHaveTextContent('Average sales cycle4 days'); // 1 Oct → 5 Oct
  });
  it('empty: nothing won or lost in the range', () => {
    renderTab({ deals: [D('x')] });
    expect(section('Win and loss')).toHaveTextContent('No deals were marked won or lost with a close date at any time.');
  });
  it('other currency only: counts shown, values not charted, deals listed as not included', () => {
    renderTab({ deals: [D('x', { stage: 'won', close_date: '2026-10-05', currency: 'USD' })] });
    const s = section('Win and loss');
    expect(s).toHaveTextContent('Won1');
    expect(s).toHaveTextContent('None of the deals won or lost at any time is stored in GBP, so there are no values to chart. 1 deal in USD is not included');
  });
  it('error', () => {
    renderTab({ error: true });
    expect(within(section('Win and loss')).getByRole('alert')).toBeInTheDocument();
  });
});

describe('Lead sources', () => {
  it('data: per source, joined to deals; under 5 contacts shows counts only; no source grouped', () => {
    renderTab();
    const s = section('Lead sources');
    const rows = within(within(s).getByRole('table')).getAllByRole('row').map((r) => r.textContent);
    expect(rows).toEqual([
      'SourceContactsWith a dealWith a won dealWon value (GBP)Won rate',
      'Referral111£2,500Counts only', 'Web form100£0Counts only', 'No source recorded100£0Counts only',
    ]);
    expect(s).toHaveTextContent('It is not shown for sources with fewer than 5 contacts');
    expect(s).toHaveTextContent('4 deals are not linked to a contact'); // d1 and d3 belong to Contact c1
  });
  it('empty: no contacts; and none added in the range', () => {
    const first = renderTab({ contacts: [] });
    expect(section('Lead sources')).toHaveTextContent('No contacts yet');
    first.unmount();
    localStorage.setItem('b2bnest.crm.reportRange.u1', '30d');
    renderTab({ contacts: [C('old', { created_at: '2025-01-01' })] });
    expect(section('Lead sources')).toHaveTextContent('No contacts were added in the last 30 days.');
  });
  it('won deal in another currency: counted, value not added, explained', () => {
    renderTab({ deals: [D('u', { stage: 'won', currency: 'USD', contact_id: 'c1' })] });
    expect(section('Lead sources')).toHaveTextContent('1 won deal is in another currency, so it is counted in "With a won deal" but not in the won value.');
  });
  it('error', () => {
    renderTab({ error: true });
    expect(within(section('Lead sources')).getByRole('alert')).toBeInTheDocument();
  });
});

describe('Needs attention', () => {
  it('three lists with counts; rows link to the deal or contact in the CRM', () => {
    renderTab();
    const s = section('Needs attention');
    // The overdue deal was also last updated in August, so it is in both deal lists.
    for (const link of within(s).getAllByRole('link', { name: /Overdue deal/ })) expect(link).toHaveAttribute('href', '/crm?tab=deals&deal=d6');
    expect(within(s).getByRole('link', { name: /Contact c2/ })).toHaveAttribute('href', '/crm?contact=c2');
    expect(s).toHaveTextContent('Close date has passed1 item');
    expect(s).toHaveTextContent('Not updated for 30 days or more1 item');
    expect(s).toHaveTextContent('no contact recorded');
  });
  it('caps each list at 10 with "Show all"', () => {
    const many = Array.from({ length: 12 }, (_, i) => C(`p${i}`, { status: 'lead', last_contact: null }));
    renderTab({ contacts: many, deals: [] });
    const s = section('Needs attention');
    const list = within(s).getAllByRole('list')[0];
    expect(within(list).getAllByRole('link')).toHaveLength(10);
    fireEvent.click(within(s).getByRole('button', { name: 'Show all (12)' }));
    expect(within(within(s).getAllByRole('list')[0]).getAllByRole('link')).toHaveLength(12);
  });
  it('empty and error', () => {
    const first = renderTab({ contacts: [], deals: [] });
    expect(section('Needs attention')).toHaveTextContent('No contacts or deals yet, so nothing needs attention.');
    first.unmount();
    renderTab({ error: true });
    expect(within(section('Needs attention')).getByRole('alert')).toBeInTheDocument();
  });
  it('record links keep other params (embedded CRM)', () => {
    expect(crmRecordSearch('?tool=crm&tab=reports', 'deal', 'd1')).toBe('?tool=crm&tab=deals&deal=d1');
    expect(crmRecordSearch('?tool=crm&tab=reports&deal=old', 'contact', 'c9')).toBe('?tool=crm&contact=c9');
  });
});

describe('Exports', () => {
  it('one CSV per section, named crm-<section>-<date>.csv, UTF-8 with BOM, header first', async () => {
    renderTab();
    for (const name of ['Pipeline by stage', 'Win and loss', 'Lead sources', 'Needs attention']) {
      fireEvent.click(within(section(name)).getByRole('button', { name: `Download ${name} as CSV` }));
    }
    expect(files.map((f) => f.name)).toEqual(['crm-pipeline-2026-10-18.csv', 'crm-win-loss-2026-10-18.csv', 'crm-lead-sources-2026-10-18.csv', 'crm-needs-attention-2026-10-18.csv']);
    const texts = await Promise.all(files.map((f) => f.text));
    for (const t of texts) expect(t.charCodeAt(0)).toBe(0xfeff);
    expect(texts[0].slice(1).split('\r\n')[0]).toBe('Stage,Currency,Open deals,Total value,Weighted forecast,Deals with no probability,Date range,Filtered by');
    expect(texts[0]).toContain('Proposal,USD,1,900,450,0,All time,Created date');
  });
  it('the existing detailed CSV still downloads', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /Export detailed report/ }));
    expect(files[0].name).toBe('crm-report-2026-10-18.csv');
    expect(await files[0].text).toContain('Pipeline,Won value,GBP,2500,1,All time');
  });
  it('Print this page prints only the report', () => {
    const print = vi.fn(() => { expect(document.body.classList.contains('print-crm-report')).toBe(true); });
    window.print = print;
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Print this page' }));
    expect(print).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('afterprint'));
    expect(document.body.classList.contains('print-crm-report')).toBe(false);
  });
});
