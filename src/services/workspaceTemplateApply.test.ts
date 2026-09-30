import { beforeEach, describe, expect, it, vi } from 'vitest';

type Call = { table: string; op: string; filters: unknown[][] };
const calls: Call[] = [];
let responder: (c: Call) => Promise<unknown>;

function builder(table: string) {
  const c: Call = { table, op: 'select', filters: [] };
  const chain: Record<string, unknown> = {};
  const add = (n: string) => (...a: unknown[]) => { c.filters.push([n, ...a]); return chain; };
  ['eq', 'in', 'select', 'single'].forEach((m) => { chain[m] = add(m); });
  chain.insert = (v: unknown) => { c.op = 'insert'; c.filters.push(['values', v]); return chain; };
  chain.delete = () => { c.op = 'delete'; return chain; };
  chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => { calls.push(c); return responder(c).then(res, rej); };
  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => builder(t) } }));
vi.mock('@/services/workspaceTemplateService', () => ({ logTemplateEvent: vi.fn() }));
vi.mock('@/lib/activeOrganization', () => ({
  assertActiveOrganization: async (id: string) => ({ userId: 'u1', organizationId: id }),
}));

import { applyWorkspaceTemplate, WorkspaceCreationIncompleteError } from './workspaceTemplateApply';

const board = (name: string) => ({ name, description: '', color: '#000', columns: [], statuses: [], views: [], groups: [{ name: 'G', tasks: [{ title: 't', status: 'todo', priority: 'low', dayOffset: 1 }] }] });
const template: any = { slug: 's', name: 'T', templateType: 'multi-component', automations: [], aiFeatures: [], boards: [board('A'), board('B')] };

let projectN = 0;
beforeEach(() => {
  calls.length = 0; projectN = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('applyWorkspaceTemplate cleanup', () => {
  it('stamps every row with the selected company and a shared workspace id', async () => {
    responder = async (c) => (c.table === 'projects' ? { data: { id: `p${++projectN}`, name: 'x' }, error: null } : { error: null });
    const r = await applyWorkspaceTemplate(template, { organizationId: 'org-1' });
    expect(r.kind).toBe('workspace');
    const inserts = calls.filter((c) => c.op === 'insert');
    for (const c of inserts) {
      const v = (c.filters.find((f) => f[0] === 'values')![1]) as any;
      const rows = Array.isArray(v) ? v : [v];
      rows.forEach((row) => expect(row.organization_id).toBe('org-1'));
      if (c.table === 'projects') expect(v.custom_fields.workspace.id).toBe(r.workspaceId);
    }
  });

  it('rethrows the original error when cleanup verifiably removed everything', async () => {
    responder = async (c) => {
      if (c.table === 'projects' && c.op === 'insert') return { data: { id: `p${++projectN}`, name: 'x' }, error: null };
      if (c.table === 'todos' && c.op === 'insert') return projectN === 2 ? { error: { message: 'task insert failed' } } : { error: null };
      if (c.table === 'projects' && c.op === 'delete') return { data: [{ id: 'p1' }, { id: 'p2' }], error: null };
      return { error: null };
    };
    await expect(applyWorkspaceTemplate(template, { organizationId: 'org-1' })).rejects.toThrow('task insert failed');
    const del = calls.find((c) => c.table === 'projects' && c.op === 'delete')!;
    expect(del.filters).toContainEqual(['in', 'id', ['p1', 'p2']]);
    expect(del.filters).toContainEqual(['eq', 'organization_id', 'org-1']);
  });

  it('reports incomplete creation with recovery info when cleanup deletes fewer rows than created', async () => {
    responder = async (c) => {
      if (c.table === 'projects' && c.op === 'insert') return { data: { id: `p${++projectN}`, name: 'x' }, error: null };
      if (c.table === 'todos' && c.op === 'insert') return projectN === 2 ? { error: { message: 'boom' } } : { error: null };
      if (c.table === 'projects' && c.op === 'delete') return { data: [{ id: 'p1' }], error: null }; // RLS silently skipped p2
      return { error: null };
    };
    const err = await applyWorkspaceTemplate(template, { organizationId: 'org-1' }).catch((e) => e);
    expect(err).toBeInstanceOf(WorkspaceCreationIncompleteError);
    expect(err.info.leftoverProjectIds).toEqual(['p2']);
    expect(err.info.organizationId).toBe('org-1');
    expect(err.info.workspaceId).toBeTruthy();
  });

  it('reports incomplete creation when a cleanup delete returns an error', async () => {
    responder = async (c) => {
      if (c.table === 'projects' && c.op === 'insert') return { data: { id: `p${++projectN}`, name: 'x' }, error: null };
      if (c.table === 'todos' && c.op === 'insert') return { error: { message: 'boom' } };
      if (c.table === 'todos' && c.op === 'delete') return { error: { message: 'delete denied' } };
      if (c.table === 'projects' && c.op === 'delete') return { data: [], error: null };
      return { error: null };
    };
    const err = await applyWorkspaceTemplate(template, { organizationId: 'org-1' }).catch((e) => e);
    expect(err).toBeInstanceOf(WorkspaceCreationIncompleteError);
    expect(err.info.cleanupError).toBe('delete denied');
    expect(err.info.leftoverProjectIds).toEqual(['p1']);
  });
});
