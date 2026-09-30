/**
 * Durable duplicate protection (template_applications) — client-side logic.
 * Uses an in-memory fake of the three tables that enforces the same UNIQUE
 * (organization_id, idempotency_key) rule as the real database. Database RLS
 * and real concurrent inserts are covered separately in
 * scripts/staging/90_template_applications_tests.sql.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;
const db: Record<string, Row[]> = { template_applications: [], projects: [], todos: [] };
const faults = { todosInsertFails: 0, projectDeleteFails: false };
let seq = 0;

function query(table: string) {
  let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  let values: any = null;
  let returning = false;
  let single = false;
  const filters: Array<(r: Row) => boolean> = [];
  const q: any = {
    select: () => { returning = true; return q; },
    insert: (v: any) => { op = 'insert'; values = v; return q; },
    update: (v: any) => { op = 'update'; values = v; return q; },
    delete: () => { op = 'delete'; return q; },
    eq: (k: string, v: any) => { filters.push((r) => r[k] === v); return q; },
    in: (k: string, v: any[]) => { filters.push((r) => v.includes(r[k])); return q; },
    single: () => { single = true; return q; },
    maybeSingle: () => { single = true; return q; },
    then: (res: any, rej: any) => Promise.resolve().then(run).then(res, rej),
  };
  const run = () => {
    const rows = db[table];
    const match = () => rows.filter((r) => filters.every((f) => f(r)));
    if (op === 'insert') {
      if (table === 'todos' && faults.todosInsertFails > 0) { faults.todosInsertFails--; return { error: { message: 'task insert failed' } }; }
      const list = (Array.isArray(values) ? values : [values]).map((v) => ({ id: `${table}-${++seq}`, created_at: new Date().toISOString(), status: table === 'template_applications' ? 'pending' : v.status, ...v }));
      if (table === 'template_applications') {
        for (const v of list) {
          if (rows.some((r) => r.organization_id === v.organization_id && r.idempotency_key === v.idempotency_key)) {
            return { error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
          }
        }
      }
      rows.push(...list);
      return { data: single ? list[0] : returning ? list : null, error: null };
    }
    if (op === 'update') { const m = match(); m.forEach((r) => Object.assign(r, values)); return { data: returning ? m : null, error: null }; }
    if (op === 'delete') {
      if (table === 'projects' && faults.projectDeleteFails) return { data: null, error: { message: 'delete denied' } };
      const m = match(); db[table] = rows.filter((r) => !m.includes(r));
      return { data: returning ? m : null, error: null };
    }
    const m = match();
    return { data: single ? m[0] ?? null : m, error: null };
  };
  return q;
}

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => query(t) } }));
vi.mock('@/services/workspaceTemplateService', () => ({ logTemplateEvent: vi.fn() }));
let currentUser = 'user-1';
vi.mock('@/lib/activeOrganization', () => ({
  assertActiveOrganization: async (id: string) => ({ userId: currentUser, organizationId: id }),
}));

import {
  applyWorkspaceTemplate, DuplicateTemplateApplicationError, WorkspaceCreationIncompleteError, STALLED_ATTEMPT_MS,
} from './workspaceTemplateApply';

const board = (name: string) => ({ name, description: '', color: '#000', columns: [], statuses: [], views: [], groups: [{ name: 'G', tasks: [{ title: 't', status: 'todo', priority: 'low', dayOffset: 1 }] }] });
const template: any = { slug: 'crm', name: 'CRM', templateType: 'multi-component', automations: [], aiFeatures: [], boards: [board('A'), board('B')] };
const workspacesIn = (org: string) => new Set(db.projects.filter((p) => p.organization_id === org).map((p) => p.custom_fields.workspace.id));

beforeEach(() => {
  db.template_applications = []; db.projects = []; db.todos = [];
  faults.todosInsertFails = 0; faults.projectDeleteFails = false; currentUser = 'user-1';
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('durable workspace duplicate protection', () => {
  it('two tabs creating concurrently with the same key produce exactly one workspace', async () => {
    const opts = { organizationId: 'org-A', idempotencyKey: 'key-1' };
    const results = await Promise.allSettled([applyWorkspaceTemplate(template, opts), applyWorkspaceTemplate(template, opts)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(DuplicateTemplateApplicationError);
    expect(rejected.reason.reason).toBe('in_progress');
    expect(workspacesIn('org-A').size).toBe(1);
    expect(db.projects).toHaveLength(2);
    expect(db.template_applications).toHaveLength(1);
    expect(db.template_applications[0].status).toBe('done');
  });

  it('a repeated request after success returns the existing workspace and creates nothing', async () => {
    const opts = { organizationId: 'org-A', idempotencyKey: 'key-1' };
    const first = await applyWorkspaceTemplate(template, opts);
    const err = await applyWorkspaceTemplate(template, opts).catch((e) => e);
    expect(err).toBeInstanceOf(DuplicateTemplateApplicationError);
    expect(err.reason).toBe('already_created');
    expect(err.existing.workspaceId).toBe(first.workspaceId);
    expect(err.existing.primaryProjectId).toBe(first.primaryProjectId);
    expect(workspacesIn('org-A').size).toBe(1);
  });

  it('an intentional later copy (new key after success) creates a second workspace', async () => {
    const a = await applyWorkspaceTemplate(template, { organizationId: 'org-A', idempotencyKey: 'key-1' });
    const b = await applyWorkspaceTemplate(template, { organizationId: 'org-A', idempotencyKey: 'key-2' });
    expect(b.workspaceId).not.toBe(a.workspaceId);
    expect(workspacesIn('org-A').size).toBe(2);
    expect(db.template_applications.map((r) => r.status)).toEqual(['done', 'done']);
  });

  it('a clean failure releases the key so the same attempt can be retried', async () => {
    faults.todosInsertFails = 1;
    const opts = { organizationId: 'org-A', idempotencyKey: 'key-1' };
    await expect(applyWorkspaceTemplate(template, opts)).rejects.toThrow('task insert failed');
    expect(db.template_applications).toHaveLength(0);
    expect(db.projects).toHaveLength(0);
    const retry = await applyWorkspaceTemplate(template, opts);
    expect(retry.projects).toHaveLength(2);
    expect(workspacesIn('org-A').size).toBe(1);
  });

  it('incomplete cleanup keeps recovery info and blocks another accidental copy with the same key', async () => {
    faults.todosInsertFails = 1; faults.projectDeleteFails = true;
    const opts = { organizationId: 'org-A', idempotencyKey: 'key-1' };
    const err = await applyWorkspaceTemplate(template, opts).catch((e) => e);
    expect(err).toBeInstanceOf(WorkspaceCreationIncompleteError);
    expect(err.info.leftoverProjectIds.length).toBeGreaterThan(0);
    expect(db.template_applications[0].status).toBe('incomplete');
    expect(db.template_applications[0].workspace_id).toBe(err.info.workspaceId);

    faults.projectDeleteFails = false;
    const before = db.projects.length;
    const again = await applyWorkspaceTemplate(template, opts).catch((e) => e);
    expect(again).toBeInstanceOf(DuplicateTemplateApplicationError);
    expect(again.reason).toBe('incomplete');
    expect(again.workspaceId).toBe(err.info.workspaceId);
    expect(db.projects.length).toBe(before);
  });

  it('NOT SUPPORTED: two devices (different keys) creating at the same moment each get a workspace', async () => {
    // Each browser/device generates its own key, so the unique rule cannot link them.
    const results = await Promise.allSettled([
      applyWorkspaceTemplate(template, { organizationId: 'org-A', idempotencyKey: 'device-laptop-key' }),
      applyWorkspaceTemplate(template, { organizationId: 'org-A', idempotencyKey: 'device-phone-key' }),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(workspacesIn('org-A').size).toBe(2); // documents the limitation
  });

  it('the same key in a different company is independent (key is scoped per company)', async () => {
    await applyWorkspaceTemplate(template, { organizationId: 'org-A', idempotencyKey: 'key-1' });
    await applyWorkspaceTemplate(template, { organizationId: 'org-B', idempotencyKey: 'key-1' });
    expect(workspacesIn('org-A').size).toBe(1);
    expect(workspacesIn('org-B').size).toBe(1);
  });

  describe('stalled attempt recovery', () => {
    const stall = (createdBy: string, ageMs: number) => db.template_applications.push({
      id: 'stale', organization_id: 'org-A', idempotency_key: 'key-1', status: 'pending',
      created_by: createdBy, created_at: new Date(Date.now() - ageMs).toISOString(),
    });

    it('a stalled attempt by the same user (older than the limit) is replaced and creation proceeds', async () => {
      stall('user-1', STALLED_ATTEMPT_MS + 1000);
      const r = await applyWorkspaceTemplate(template, { organizationId: 'org-A', idempotencyKey: 'key-1' });
      expect(r.projects).toHaveLength(2);
      expect(db.template_applications).toHaveLength(1);
      expect(db.template_applications[0].status).toBe('done');
    });

    it('a recent pending attempt is still treated as in progress', async () => {
      stall('user-1', 1000);
      const err = await applyWorkspaceTemplate(template, { organizationId: 'org-A', idempotencyKey: 'key-1' }).catch((e) => e);
      expect(err.reason).toBe('in_progress');
      expect(db.projects).toHaveLength(0);
    });

    it("another user's stalled attempt is not taken over", async () => {
      stall('user-2', STALLED_ATTEMPT_MS + 1000);
      const err = await applyWorkspaceTemplate(template, { organizationId: 'org-A', idempotencyKey: 'key-1' }).catch((e) => e);
      expect(err.reason).toBe('in_progress');
      expect(db.projects).toHaveLength(0);
    });
  });
});
