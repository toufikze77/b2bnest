import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Phase 22: Admin shows Solo / Business / Scale and real account states, never raw tier names or "Free".
// Mocked server rows, shaped like the Phase 22 admin_list_* / admin_overview_stats results.
const SUBS = [
  { id: 's1', email: 'admin@example.test', plan: 'Professional', plan_key: 'professional', status: 'active', access_state: 'subscribed', value: 59, value_basis: 'stripe_price', ai_credits_remaining: 900, ai_credits_limit: 1000 },
  { id: 's2', email: 'legacy@example.test', plan: 'Professional', plan_key: 'professional', status: 'active', access_state: 'subscribed', value: 35, value_basis: 'stripe_price' },
  { id: 's3', email: 'scale@example.test', plan: 'Enterprise', plan_key: 'enterprise', status: 'active', access_state: 'subscribed', value: 74.17, value_basis: 'estimate' },
  { id: 's4', email: 'solo@example.test', plan: 'Starter', plan_key: 'starter', status: 'cancelled', access_state: 'trial_ended', value: 0, value_basis: 'none' },
  { id: 's5', email: 'never@example.test', plan: 'Professional', plan_key: 'professional', status: 'not_completed', access_state: 'trial', value: 0, value_basis: 'none' },
  { id: 's6', email: 'none@example.test', plan: 'free', plan_key: null, status: 'no_plan', access_state: 'suspended', value: 0, value_basis: 'none' },
];
const USERS = [
  { id: 'u1', name: 'Biz Owner', email: 'biz@example.test', role: 'user', is_active: true, subscribed: true, plan: 'Professional', plan_key: 'professional', access_state: 'subscribed' },
  { id: 'u2', name: 'Scale Co', email: 'scale@example.test', role: 'user', is_active: true, subscribed: true, plan: 'Enterprise', plan_key: 'enterprise', access_state: 'subscribed' },
  { id: 'u3', name: 'Solo One', email: 'solo@example.test', role: 'user', is_active: true, subscribed: true, plan: 'Starter', plan_key: 'starter', access_state: 'subscribed' },
  { id: 'u4', name: 'New Trial', email: 'trial@example.test', role: 'user', is_active: true, subscribed: false, plan: 'free', access_state: 'trial' },
  { id: 'u5', name: 'Trial Over', email: 'ended@example.test', role: 'user', is_active: true, subscribed: false, access_state: 'trial_ended' },
  { id: 'u6', name: 'Paused Person', email: 'paused@example.test', role: 'user', is_active: false, subscribed: false, access_state: 'suspended' },
  { id: 'u7', name: 'Platform Owner', email: 'owner@example.test', role: 'super_admin', is_active: true, subscribed: false, access_state: 'owner' },
];
vi.mock('@/lib/adminApi', () => ({
  adminRpc: async (fn: string) => {
    if (fn === 'admin_overview_stats') return { total_subscribers: 6, active_subscriptions: 3, trials: 1, no_plan_users: 4, free_users: 4, mrr: 168.17, arr: 2018.04, mrr_estimated: 1 };
    if (fn === 'admin_list_subscriptions') return { rows: SUBS, total: SUBS.length };
    if (fn === 'admin_list_users') return { rows: USERS, total: USERS.length };
    if (fn === 'list_master_access') return [];
    return null;
  },
  logAdminAction: async () => undefined,
  downloadCsv: () => undefined,
  formatMoney: (n: number) => `£${n.toFixed(2)}`,
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: async () => ({ data: null, error: null }) } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, loading: false }) }));
vi.mock('@/hooks/useSuperAdmin', () => ({ useSuperAdmin: () => ({ isSuperAdmin: true, loading: false }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/admin/AdminPageHeader', () => ({ default: ({ title, description }: { title: string; description?: string }) => <div><h1>{title}</h1><p>{description}</p></div> }));

import AdminSubscriptions from './AdminSubscriptions';
import AdminUsers from './AdminUsers';

const RAW = /\b(Starter|Professional|Enterprise|Free|free)\b/;

describe('Admin → Subscriptions (Phase 22)', () => {
  it('plan names, statuses, account states, value basis and tiles; no raw tier names, no "Free"', async () => {
    render(<AdminSubscriptions />);
    const table = (await screen.findByText('admin@example.test')).closest('table')!;
    const row = (email: string) => within(within(table).getByText(email).closest('tr')!);
    expect(row('admin@example.test').getByText('Business')).toBeInTheDocument();
    expect(row('admin@example.test').getByText('Active')).toBeInTheDocument();
    expect(row('scale@example.test').getByText('Scale')).toBeInTheDocument();
    expect(row('scale@example.test').getByText("at today's price")).toBeInTheDocument();
    expect(row('solo@example.test').getByText('Solo')).toBeInTheDocument();
    expect(row('solo@example.test').getByText('Cancelled')).toBeInTheDocument();
    expect(row('solo@example.test').getByText('Trial ended')).toBeInTheDocument();
    expect(row('never@example.test').getByText('Checkout not completed')).toBeInTheDocument();
    expect(row('none@example.test').getAllByText('No plan').length).toBeGreaterThan(0);
    expect(row('none@example.test').getByText('Suspended')).toBeInTheDocument();
    expect(screen.getAllByText('No plan').length).toBeGreaterThan(1);  // tile + row
    expect(screen.getByText(/Includes 1 valued at today's price/)).toBeInTheDocument();
    expect(table.textContent).not.toMatch(RAW);
    expect(document.body.textContent).not.toMatch(/\bFree\b|\bFREE\b/);
  });
});

describe('Admin → Users (Phase 22)', () => {
  it('Plan column: Solo / Business / Scale for payers; Trial / Trial ended / Suspended / Full access for the rest', async () => {
    render(<AdminUsers />);
    const table = (await screen.findByText('Biz Owner')).closest('table')!;
    const plan = (name: string) => within(within(table).getByText(name).closest('tr')!);
    expect(plan('Biz Owner').getByText('Business')).toBeInTheDocument();
    expect(plan('Scale Co').getByText('Scale')).toBeInTheDocument();
    expect(plan('Solo One').getByText('Solo')).toBeInTheDocument();
    expect(plan('New Trial').getByText('Trial')).toBeInTheDocument();
    expect(plan('Trial Over').getByText('Trial ended')).toBeInTheDocument();
    expect(plan('Paused Person').getAllByText('Suspended').length).toBeGreaterThan(0);
    expect(plan('Platform Owner').getByText('Full access (owner)')).toBeInTheDocument();
    expect(table.textContent).not.toMatch(/\b(Starter|Professional|Enterprise|Free|Paid)\b/);
  });
});
