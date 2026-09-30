import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Call = { table: string; op: string; filters: unknown[][]; resolve?: (v: unknown) => void };
const calls: Call[] = [];
let auto: (c: Call) => unknown | undefined; // return undefined to hold the response

function builder(table: string) {
  const c: Call = { table, op: 'select', filters: [] };
  const chain: Record<string, unknown> = {};
  const add = (n: string) => (...a: unknown[]) => { c.filters.push([n, ...a]); return chain; };
  ['eq', 'is', 'order', 'select', 'in', 'not'].forEach((m) => { chain[m] = add(m); });
  chain.update = (v: unknown) => { c.op = 'update'; c.filters.push(['set', v]); return chain; };
  chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
    calls.push(c);
    const p = new Promise((r) => { c.resolve = r; });
    const v = auto(c);
    if (v !== undefined) c.resolve!(v);
    return p.then(res, rej);
  };
  return chain;
}

let org = { organizationId: 'org-1', organization: { name: 'Acme' } };
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => builder(t) } }));
vi.mock('@/contexts/OrganizationContext', () => ({ useActiveOrganization: () => org }));
const toastSpy = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({ toast: (...a: unknown[]) => toastSpy(...a) }));

import WorkspaceView from './WorkspaceView';

const eqVal = (c: Call, col: string) => c.filters.find((f) => f[0] === 'eq' && f[1] === col)?.[2];
const boardsFor = (orgId: string) => ({
  data: [
    { id: `${orgId}-b1`, name: 'Leads', color: null, custom_fields: { workspace: { id: 'ws', name: 'WS', board_index: 0 }, board_columns: ['Item', 'Owner', 'Status'], board_groups: ['New', 'Empty group'] } },
    { id: `${orgId}-b2`, name: 'Deals', color: null, custom_fields: { workspace: { id: 'ws', name: 'WS', board_index: 1 }, board_columns: [], board_groups: ['New'] } },
  ],
  error: null,
});
const task = (id: string, title: string) => ({ id, title, status: 'todo', priority: 'low', due_date: null, labels: ['New'], estimated_hours: null });

const ui = () => (
  <MemoryRouter initialEntries={['/workspaces/ws']}>
    <Routes><Route path="/workspaces/:workspaceId" element={<WorkspaceView />} /></Routes>
  </MemoryRouter>
);

beforeEach(() => {
  calls.length = 0; toastSpy.mockReset();
  org = { organizationId: 'org-1', organization: { name: 'Acme' } };
  auto = (c) => (c.table === 'projects' ? boardsFor(eqVal(c, 'organization_id') as string) : undefined);
});

const pendingTodos = (projectId: string) => calls.filter((c) => c.table === 'todos' && c.op === 'select' && eqVal(c, 'project_id') === projectId);

describe('WorkspaceView', () => {
  it('ignores a delayed response for the previous board and never renders its tasks', async () => {
    render(ui());
    await screen.findByRole('heading', { name: 'Leads' });
    fireEvent.click(screen.getByRole('button', { name: /Deals/ }));
    await screen.findByRole('heading', { name: 'Deals' });
    expect(screen.getByText('Loading tasks…')).toBeInTheDocument();
    await act(async () => { pendingTodos('org-1-b2')[0].resolve!({ data: [task('d1', 'Deal task')], error: null }); });
    await screen.findByText('Deal task');
    // The old board's response arrives late — it must be ignored.
    await act(async () => { pendingTodos('org-1-b1')[0].resolve!({ data: [task('l1', 'Lead task')], error: null }); });
    expect(screen.queryByText('Lead task')).toBeNull();
    expect(screen.getByText('Deal task')).toBeInTheDocument();
  });

  it('ignores a delayed response from the previous company after switching', async () => {
    const { rerender } = render(ui());
    await screen.findByRole('heading', { name: 'Leads' });
    const oldReq = pendingTodos('org-1-b1')[0];
    org = { organizationId: 'org-2', organization: { name: 'Beta' } };
    rerender(ui());
    await waitFor(() => expect(pendingTodos('org-2-b1').length).toBe(1));
    await act(async () => { oldReq.resolve!({ data: [task('x', 'Acme secret task')], error: null }); });
    expect(screen.queryByText('Acme secret task')).toBeNull();
    await act(async () => { pendingTodos('org-2-b1')[0].resolve!({ data: [task('y', 'Beta task')], error: null }); });
    await screen.findByText('Beta task');
    expect(eqVal(pendingTodos('org-2-b1')[0], 'organization_id')).toBe('org-2');
  });

  it('renders template columns in order, marks unsupported ones, keeps empty groups', async () => {
    render(ui());
    await screen.findByRole('heading', { name: 'Leads' });
    await act(async () => { pendingTodos('org-1-b1')[0].resolve!({ data: [task('l1', 'Lead task')], error: null }); });
    const headers = (await screen.findAllByRole('columnheader')).map((h) => h.textContent);
    expect(headers).toEqual(['Item', 'Owner (not supported)', 'Status']);
    expect(screen.getByTestId('group-Empty group')).toHaveTextContent('No tasks in this group yet.');
  });

  it('shows Retry when boards fail to load, and retries', async () => {
    let fail = true;
    auto = (c) => (c.table === 'projects' ? (fail ? { data: null, error: { message: 'network down' } } : boardsFor('org-1')) : undefined);
    render(ui());
    await screen.findByText('network down');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { name: 'Leads' });
  });

  it('concurrent status edits: a failed older edit does not overwrite a newer one; zero-row update is a failure', async () => {
    render(ui());
    await screen.findByRole('heading', { name: 'Leads' });
    await act(async () => { pendingTodos('org-1-b1')[0].resolve!({ data: [task('l1', 'Lead task'), task('l2', 'Other task')], error: null }); });
    const sel = await screen.findByLabelText('Status of Lead task');
    fireEvent.change(sel, { target: { value: 'review' } }); // edit 1
    fireEvent.change(sel, { target: { value: 'done' } }); // edit 2
    fireEvent.change(screen.getByLabelText('Status of Other task'), { target: { value: 'backlog' } });
    await act(async () => {});
    const updates = calls.filter((c) => c.op === 'update');
    expect(updates).toHaveLength(3);
    for (const u of updates) {
      expect(eqVal(u, 'organization_id')).toBe('org-1');
      expect(eqVal(u, 'project_id')).toBe('org-1-b1');
    }
    await act(async () => { updates[1].resolve!({ data: [{ id: 'l1' }], error: null }); });
    await act(async () => { updates[0].resolve!({ data: [], error: null }); }); // older edit: RLS matched 0 rows
    expect((screen.getByLabelText('Status of Lead task') as HTMLSelectElement).value).toBe('done');
    expect(toastSpy).toHaveBeenCalledTimes(1);
    // Other task fails alone → only it rolls back.
    await act(async () => { updates[2].resolve!({ data: null, error: { message: 'denied' } }); });
    expect((screen.getByLabelText('Status of Other task') as HTMLSelectElement).value).toBe('todo');
    expect((screen.getByLabelText('Status of Lead task') as HTMLSelectElement).value).toBe('done');
  });

  it('a failed update after switching board does not touch the new board', async () => {
    render(ui());
    await screen.findByRole('heading', { name: 'Leads' });
    await act(async () => { pendingTodos('org-1-b1')[0].resolve!({ data: [task('l1', 'Lead task')], error: null }); });
    fireEvent.change(await screen.findByLabelText('Status of Lead task'), { target: { value: 'done' } });
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: /Deals/ }));
    await waitFor(() => expect(pendingTodos('org-1-b2').length).toBe(1));
    await act(async () => { pendingTodos('org-1-b2')[0].resolve!({ data: [task('l1', 'Same id elsewhere')], error: null }); });
    await act(async () => { calls.find((c) => c.op === 'update')!.resolve!({ data: null, error: { message: 'x' } }); });
    expect((screen.getByLabelText('Status of Same id elsewhere') as HTMLSelectElement).value).toBe('todo');
  });
});
