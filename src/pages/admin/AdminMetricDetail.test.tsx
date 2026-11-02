import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  superAdmin: true,
  assurance: { loading: false, needsCode: false },
  twoStep: { loading: false, mustSetUp: false },
  rpc: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me', email: 'me@example.test' }, loading: false }) }));
vi.mock('@/hooks/useSuperAdmin', () => ({ useSuperAdmin: () => ({ isSuperAdmin: h.superAdmin, loading: false }) }));
vi.mock('@/hooks/useAssurance', () => ({ useAssurance: () => h.assurance }));
vi.mock('@/hooks/useTwoStepRequirement', () => ({ useTwoStepRequirement: () => h.twoStep }));
vi.mock('@/components/twoStep/TwoStepCodeScreen', () => ({ default: () => <p>Enter your two-step code</p> }));
vi.mock('@/lib/adminApi', async (orig) => ({ ...(await orig<object>()), adminRpc: (...a: unknown[]) => h.rpc(...a) }));

import AdminLayout from './AdminLayout';
import AdminDashboard from './AdminDashboard';
import AdminMetricDetail from './AdminMetricDetail';
import { METRICS, NO_AI_USAGE } from '@/lib/adminMetrics';

const days = (n: number) => Array.from({ length: n }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, '0')}`, users: 0, projects: 0, documents: 0, social: 0, revenue: 0 }));
function emptyData(fn: string, args: Record<string, unknown> = {}) {
  const d = Number(args._days ?? 30);
  switch (fn) {
    case 'admin_overview_stats': return Promise.resolve({ total_users: 3, ai_requests: 2, ai_requests_30d: 1 });
    case 'admin_analytics_series': return Promise.resolve(days(d + 1));
    case 'admin_ai_ledger_summary': return Promise.resolve({ credits_spent: 0, credits_refunded: 0, net_credits: 0, requests: 0, cost_usd: 0, unpriced_calls: 0, refund_rate: null,
      by_feature: [], by_day: days(d).map((r) => ({ day: r.day, credits: 0, cost_usd: 0 })), top_users: [], documents_by_type: [] });
    case 'admin_overview_series': return Promise.reject(new Error('Could not find the function'));
    case 'admin_list_subscriptions': case 'admin_list_companies': case 'admin_list_projects': return Promise.resolve({ rows: [], total: 0 });
    default: return Promise.resolve({});
  }
}

const app = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="overview/:metric" element={<AdminMetricDetail />} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  h.superAdmin = true; h.assurance = { loading: false, needsCode: false }; h.twoStep = { loading: false, mustSetUp: false };
  h.rpc.mockReset(); h.rpc.mockImplementation(emptyData);
});

describe('Platform Overview cards (Phase 36)', () => {
  it('every card is a labelled link to its metric page; numbers unchanged', async () => {
    app('/admin');
    const links = await screen.findAllByRole('link', { name: /: open details$/ });
    expect(links).toHaveLength(21);
    expect(links.map((l) => l.getAttribute('href')).sort()).toEqual(METRICS.map((m) => `/admin/overview/${m.id}`).sort());
    expect(screen.getByRole('link', { name: 'Total Users: open details' })).toHaveTextContent('3');
  });

  it('AI card: falls back to conversations, labelled, while the ledger is empty', async () => {
    app('/admin');
    const ai = await screen.findByRole('link', { name: 'AI Usage: open details' });
    expect(ai).toHaveTextContent('2');
    expect(ai).toHaveTextContent('From conversations (no AI credits used yet) · 1 in last 30 days');
  });

  it('AI card: credits used in 30 days and OpenAI cost once the ledger has rows', async () => {
    h.rpc.mockImplementation((fn: string, args?: Record<string, unknown>) => fn === 'admin_ai_ledger_summary'
      ? Promise.resolve({ credits_spent: 45, credits_refunded: 5, net_credits: 40, requests: 6, cost_usd: 0.12 }) : emptyData(fn, args));
    app('/admin');
    const ai = await screen.findByRole('link', { name: 'AI Usage: open details' });
    await waitFor(() => expect(ai).toHaveTextContent('40 credits'));
    expect(ai).toHaveTextContent('Last 30 days · US$0.12 OpenAI cost · 2 conversations in total');
  });
});

describe('metric page', () => {
  it('AI usage with an empty ledger: "No AI usage yet", empty charts, three views, no NaN', async () => {
    app('/admin/overview/ai-usage');
    expect(await screen.findByRole('heading', { name: 'AI usage' })).toBeInTheDocument();
    expect(await screen.findByTestId('view-empty')).toHaveTextContent(NO_AI_USAGE);
    expect(screen.queryAllByTestId('chart-empty')).toHaveLength(0); // the message replaces the empty charts
    expect(screen.getAllByTestId('table-empty').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Management', 'Operations', 'Business development']);
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
    expect(screen.getByRole('link', { name: 'Back to Platform Overview' })).toHaveAttribute('href', '/admin');
  });

  it('date range: 30 days by default, 7 days on request', async () => {
    app('/admin/overview/users-new');
    await screen.findByRole('heading', { name: 'New users' });
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('admin_analytics_series', { _days: 60 }));
    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('admin_analytics_series', { _days: 14 }));
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('group', { name: 'Date range' })).getAllByRole('button')).toHaveLength(3);
  });

  it('a metric with one view shows no tabs', async () => {
    app('/admin/overview/storage');
    await screen.findByRole('heading', { name: 'Storage' });
    await screen.findByText('Storage by category');
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('unknown metric: says so, with the Back link', async () => {
    app('/admin/overview/everything');
    expect(await screen.findByRole('alert')).toHaveTextContent('There is no page for this metric.');
  });

  it('a failing RPC shows an error with Try again', async () => {
    h.rpc.mockImplementation((fn: string, args?: Record<string, unknown>) => (fn === 'admin_overview_stats' ? Promise.reject(new Error('boom')) : emptyData(fn, args)));
    app('/admin/overview/users-total');
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this page: boom");
    h.rpc.mockImplementation(emptyData);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});

describe('access (same guard as the rest of /admin)', () => {
  it('a user who is not a super admin (a normal admin or a master account) is refused; no data is asked for', async () => {
    h.superAdmin = false;
    app('/admin/overview/ai-usage');
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'AI usage' })).toBeNull();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('a super admin without the two-step code gets the code screen, not the page', async () => {
    h.assurance = { loading: false, needsCode: true };
    app('/admin/overview/mrr');
    expect(await screen.findByText('Enter your two-step code')).toBeInTheDocument();
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

describe('AI usage: top-ups (Phase 37)', () => {
  it('before Phase 37: says so, no invented numbers', async () => {
    h.rpc.mockImplementation((fn: string, args?: Record<string, unknown>) => (fn === 'admin_ai_topup_summary' ? Promise.reject(new Error('Could not find the function')) : emptyData(fn, args)));
    app('/admin/overview/ai-usage');
    await screen.findByRole('heading', { name: 'AI usage' });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Business development' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Business development' }));
    expect(await screen.findAllByText('Not available until the Phase 37 database update (docs/phase37) is applied.')).not.toHaveLength(0);
  });

  it('revenue, packs sold, credits sold vs used vs expired, and a needs-refund warning', async () => {
    h.rpc.mockImplementation((fn: string, args?: Record<string, unknown>) => (fn === 'admin_ai_topup_summary'
      ? Promise.resolve({ packs_sold: 7, revenue_pence: 18700, refunded_pence: 500, credits_sold: 5500, credits_used: 5, credits_unused: 5000, credits_expired: 395, credits_voided: 100, needs_refund: 1,
          by_pack: [{ pack_id: 'credits_100', credits: 100, amount_pence: 500, sold: 2, voided: 1 }, { pack_id: 'credits_300', credits: 300, amount_pence: 1200, sold: 0, voided: 0 }] })
      : emptyData(fn, args)));
    app('/admin/overview/ai-usage');
    await screen.findByRole('heading', { name: 'AI usage' });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Business development' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Business development' }));
    expect(await screen.findByText('£187.00')).toBeInTheDocument();
    const credits = screen.getByText('Top-up credits: sold, used, unused, expired').closest('div.rounded-lg, .rounded-xl, [class*="card"]') ?? document.body;
    expect(credits.textContent).toMatch(/5,500.*5.*5,000.*395.*100/);
    expect(screen.getByText('100 credits')).toBeInTheDocument();
    expect(screen.queryByText('300 credits')).toBeNull();
    expect(screen.getAllByRole('alert').some((a) => /could not be added/.test(a.textContent ?? ''))).toBe(true);
  });
});
