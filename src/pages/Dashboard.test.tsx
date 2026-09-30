import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isoDay, addDaysIso } from '@/lib/dashboardData';

type Call = { table: string; filters: unknown[][]; resolve?: (v: unknown) => void };
const calls: Call[] = [];
let auto: (c: Call) => unknown | undefined; // undefined = hold response

function builder(table: string) {
  const c: Call = { table, filters: [] };
  const chain: Record<string, unknown> = {};
  const add = (n: string) => (...a: unknown[]) => { c.filters.push([n, ...a]); return chain; };
  ['eq', 'is', 'not', 'lte', 'lt', 'gt', 'order', 'limit', 'select'].forEach((m) => { chain[m] = add(m); });
  chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
    calls.push(c);
    const p = new Promise((r) => { c.resolve = r; });
    const v = auto(c);
    if (v !== undefined) c.resolve!(v);
    return p.then(res, rej);
  };
  return chain;
}

let org: any;
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => builder(t) } }));
vi.mock('@/contexts/OrganizationContext', () => ({ useActiveOrganization: () => org }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import Dashboard from './Dashboard';

const today = isoDay(new Date());
const eqVal = (c: Call, col: string) => c.filters.find((f) => f[0] === 'eq' && f[1] === col)?.[2];
const isGroup = (c: Call, g: 'overdue' | 'today' | 'upcoming') =>
  g === 'overdue' ? c.filters.some((f) => f[0] === 'lt') : g === 'upcoming' ? c.filters.some((f) => f[0] === 'gt') : c.filters.some((f) => f[0] === 'eq' && f[1] === 'due_date');
const counts = (n: number) => ({ count: n, error: null });
const ui = () => <MemoryRouter><Dashboard /></MemoryRouter>;

beforeEach(() => {
  calls.length = 0; localStorage.clear();
  org = { organizationId: 'org-1', organization: { name: 'Acme', role: 'member' }, loading: false };
  auto = (c) => (c.table === 'todos' ? { data: [], error: null } : counts(0));
});

describe('Dashboard', () => {
  it('scopes company data to the selected company', async () => {
    render(ui());
    await screen.findByText('Nothing needs attention');
    for (const tbl of ['todos', 'projects', 'organization_members']) {
      expect(eqVal(calls.find((c) => c.table === tbl)!, 'organization_id')).toBe('org-1');
    }
  });

  it('shows a retryable error — not an empty state — when the task query fails', async () => {
    auto = (c) => (c.table === 'todos' ? { data: null, error: { message: 'boom' } } : counts(0));
    render(ui());
    expect(await screen.findByText("Couldn't load tasks")).toBeInTheDocument();
    expect(screen.queryByText('Nothing needs attention')).toBeNull();
    auto = (c) => (c.table === 'todos' ? (isGroup(c, 'overdue') ? { data: [{ id: 't1', title: 'Late task', status: 'todo', priority: 'high', due_date: addDaysIso(today, -1), project_id: 'p1' }], count: 1, error: null } : { data: [], count: 0, error: null }) : counts(0));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Late task')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Late task/ })).toHaveAttribute('href', '/project-management?view=list&project=p1');
  });

  it('shows the empty state with one clear action when there is truly nothing due', async () => {
    render(ui());
    expect(await screen.findByText('Nothing needs attention')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create task' })).toBeInTheDocument();
  });

  it('checklist uses real records, hides completed steps and can be dismissed per company', async () => {
    auto = (c) => (c.table === 'todos' ? { data: [], error: null } : c.table === 'crm_contacts' ? counts(3) : counts(0));
    render(ui());
    expect(await screen.findByText('1 of 3 done')).toBeInTheDocument();
    expect(screen.queryByText('Add your first contact')).toBeNull();
    expect(screen.getByText('For your account')).toBeInTheDocument();
    expect(screen.getByText(/Counts your own records/)).toBeInTheDocument();
    expect(screen.getByText('For Acme')).toBeInTheDocument();
    expect(screen.getByText('Create your first invoice')).toBeInTheDocument();
    expect(screen.queryByText('Invite a teammate')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss get started checklist' }));
    expect(screen.queryByText('Get started')).toBeNull();
    expect(localStorage.getItem('b2bnest.activation.dismissed.u1.org-1')).toBe('1');
  });

  it('a failed checklist count is reported, not shown as done or zero', async () => {
    auto = (c) => (c.table === 'todos' ? { data: [], error: null } : c.table === 'invoices' ? { error: { message: 'denied' } } : counts(0));
    render(ui());
    expect(await screen.findByText("Couldn't check some steps")).toBeInTheDocument();
  });

  it('hides the checklist when every step is complete', async () => {
    auto = (c) => (c.table === 'todos' ? { data: [], error: null } : counts(2));
    render(ui());
    await screen.findByText('Nothing needs attention');
    expect(screen.queryByText('Get started')).toBeNull();
  });

  it('shows rota quick action only to owner/admin/manager', async () => {
    const { unmount } = render(ui());
    await screen.findByText('Nothing needs attention');
    expect(screen.queryByRole('link', { name: 'Plan the rota' })).toBeNull();
    unmount();
    org = { ...org, organization: { name: 'Acme', role: 'manager' } };
    render(ui());
    expect(await screen.findByRole('link', { name: 'Plan the rota' })).toBeInTheDocument();
  });

  it('never shows the previous company\'s tasks after switching, even if its response arrives late', async () => {
    auto = (c) => (c.table === 'todos' ? (isGroup(c, 'today') ? undefined : { data: [], count: 0, error: null }) : counts(0)); // hold due-today responses
    const { rerender } = render(ui());
    await waitFor(() => expect(calls.some((c) => c.table === 'todos' && isGroup(c, 'today') && eqVal(c, 'organization_id') === 'org-1')).toBe(true));
    org = { organizationId: 'org-2', organization: { name: 'Beta', role: 'member' }, loading: false };
    rerender(ui());
    await waitFor(() => expect(calls.some((c) => c.table === 'todos' && isGroup(c, 'today') && eqVal(c, 'organization_id') === 'org-2')).toBe(true));
    const old = calls.find((c) => c.table === 'todos' && isGroup(c, 'today') && eqVal(c, 'organization_id') === 'org-1')!;
    await act(async () => { old.resolve!({ data: [{ id: 'x', title: 'Acme secret task', status: 'todo', priority: 'low', due_date: today, project_id: 'p' }], error: null }); });
    expect(screen.queryByText('Acme secret task')).toBeNull();
    const cur = calls.find((c) => c.table === 'todos' && isGroup(c, 'today') && eqVal(c, 'organization_id') === 'org-2')!;
    await act(async () => { cur.resolve!({ data: [{ id: 'y', title: 'Beta task', status: 'todo', priority: 'low', due_date: today, project_id: 'q' }], error: null }); });
    expect(await screen.findByText('Beta task')).toBeInTheDocument();
    expect(screen.queryByText('Acme secret task')).toBeNull();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('150 overdue tasks never crowd out due-today and upcoming tasks; totals differ from items shown', async () => {
    const mk = (n: number, day: string, p: string) => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}`, title: `${p} task ${i}`, status: 'todo', priority: 'low', due_date: day, project_id: 'p' }));
    const overdueAll = mk(150, addDaysIso(today, -3), 'Over');
    auto = (c) => {
      if (c.table !== 'todos') return counts(1);
      const lim = (c.filters.find((f) => f[0] === 'limit')?.[1] as number) ?? 1000;
      if (isGroup(c, 'overdue')) return { data: overdueAll.slice(0, lim), count: 150, error: null };
      if (isGroup(c, 'today')) return { data: mk(2, today, 'Today'), count: 2, error: null };
      return { data: mk(3, addDaysIso(today, 4), 'Soon'), count: 3, error: null };
    };
    render(ui());
    expect(await screen.findByText('Today task 0')).toBeInTheDocument();
    expect(screen.getByText('Today task 1')).toBeInTheDocument();
    expect(screen.getByText('Soon task 2')).toBeInTheDocument();
    expect(screen.getByLabelText('150 in total')).toBeInTheDocument();
    expect(screen.getByText(/Showing 5 of 150/)).toBeInTheDocument();
    expect(screen.getAllByText(/^Over task/)).toHaveLength(5);
    const todos = calls.filter((c) => c.table === 'todos');
    expect(todos).toHaveLength(3);
    for (const c of todos) expect(eqVal(c, 'organization_id')).toBe('org-1');
  });

  it('quick actions are labelled for where they go', async () => {
    render(ui());
    await screen.findByText('Nothing needs attention');
    const qa = within(screen.getByRole('region', { name: 'Quick actions' }));
    expect(qa.getByRole('link', { name: 'Open CRM' })).toHaveAttribute('href', '/crm');
    expect(qa.getByRole('link', { name: 'Open invoices' })).toHaveAttribute('href', '/business-tools?tool=business-finance-assistant&tab=invoices');
    expect(screen.queryByText(/Add contact|New invoice|linked to a company/)).toBeNull();
  });

  it('asks to choose a company when none is selected, and loads nothing', async () => {
    org = { organizationId: null, organization: null, loading: false };
    render(ui());
    expect(await screen.findByText('Choose a company')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
