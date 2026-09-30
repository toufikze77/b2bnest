import { describe, expect, it } from 'vitest';
import { buildActivationSteps, classifyTasks, hasRole, ROTA_ROLES, taskHref } from './dashboardData';

const t = (id: string, due: string | null, status = 'todo') => ({ id, title: id, status, priority: 'low', due_date: due, project_id: 'p1' });

describe('classifyTasks', () => {
  it('splits open tasks into overdue, due today and upcoming (7 days) and ignores closed/undated/far tasks', () => {
    const r = classifyTasks([
      t('late', '2026-09-28'), t('today', '2026-09-30T09:00:00'), t('soon', '2026-10-07'), t('far', '2026-10-08'),
      t('done-late', '2026-09-01', 'done'), t('completed', '2026-09-30', 'Completed'), t('nodate', null),
    ], '2026-09-30');
    expect(r.overdue.map((x) => x.id)).toEqual(['late']);
    expect(r.dueToday.map((x) => x.id)).toEqual(['today']);
    expect(r.upcoming.map((x) => x.id)).toEqual(['soon']);
  });
  it('links each task to the project view that contains it', () => {
    expect(taskHref({ project_id: 'abc' })).toBe('/project-management?view=list&project=abc');
    expect(taskHref({ project_id: null })).toBe('/project-management?view=list');
  });
});

describe('buildActivationSteps', () => {
  const zero = { contacts: 0, projects: 0, invoices: 0, members: 1 };
  it('marks steps done only from real counts', () => {
    const s = buildActivationSteps({ contacts: 2, projects: 0, invoices: 1, members: 1 }, 'member');
    expect(Object.fromEntries(s.map((x) => [x.id, x.state]))).toEqual({ contact: 'done', project: 'todo', invoice: 'done' });
  });
  it('a failed count is "unknown", never treated as zero or done', () => {
    const s = buildActivationSteps({ ...zero, contacts: null }, 'member');
    expect(s.find((x) => x.id === 'contact')!.state).toBe('unknown');
  });
  it('omits the invite step while no company-invitation flow exists, for every role', () => {
    for (const role of ['owner', 'admin', 'member']) expect(buildActivationSteps(zero, role).some((x) => x.id === 'invite')).toBe(false);
  });
  it('when invitations are available, only owners/admins see the invite step', () => {
    expect(buildActivationSteps(zero, 'owner', { canInvite: true }).some((x) => x.id === 'invite')).toBe(true);
    expect(buildActivationSteps(zero, 'member', { canInvite: true }).some((x) => x.id === 'invite')).toBe(false);
    expect(buildActivationSteps({ ...zero, members: 3 }, 'admin', { canInvite: true }).find((x) => x.id === 'invite')!.state).toBe('done');
  });
  it('rota access follows company role', () => {
    expect(hasRole('manager', ROTA_ROLES)).toBe(true);
    expect(hasRole('member', ROTA_ROLES)).toBe(false);
    expect(hasRole(null, ROTA_ROLES)).toBe(false);
  });
});

import { summarizeProjects, weekStartIso, projectDeadlines } from './dashboardData';
describe('project summaries', () => {
  const base = { color: null, status: 'active', deadline: null, updated_at: '' };
  it('computes real progress, next open due date and separates workspaces', () => {
    const r = summarizeProjects(
      [{ ...base, id: 'p1', name: 'Site', custom_fields: null }, { ...base, id: 'b1', name: 'Board', custom_fields: { workspace: { id: 'w1', name: 'Sales' } } }, { ...base, id: 'b2', name: 'Board 2', custom_fields: { workspace: { id: 'w1', name: 'Sales' } } }],
      [{ project_id: 'p1', status: 'done', due_date: '2026-01-01' }, { project_id: 'p1', status: 'todo', due_date: '2026-02-03' }, { project_id: 'p1', status: 'todo', due_date: '2026-02-01' }, { project_id: 'b2', status: 'todo', due_date: null }],
    );
    expect(r.projects).toEqual([expect.objectContaining({ id: 'p1', done: 1, total: 3, nextDue: '2026-02-01', href: '/project-management?view=list&project=p1' })]);
    expect(r.workspaces).toEqual([{ id: 'w1', name: 'Sales', boards: 2, open: 1, href: '/workspaces/w1' }]);
  });
  it('week starts on Monday', () => {
    expect(weekStartIso(new Date(2026, 8, 30))).toBe('2026-09-28');
    expect(weekStartIso(new Date(2026, 8, 28))).toBe('2026-09-28');
    expect(weekStartIso(new Date(2026, 9, 4))).toBe('2026-09-28');
  });
  it('deadlines sorted soonest first, undated skipped', () => {
    const d = projectDeadlines([{ ...base, id: 'a', name: 'a', custom_fields: null, deadline: '2026-12-01' }, { ...base, id: 'b', name: 'b', custom_fields: null }, { ...base, id: 'c', name: 'c', custom_fields: null, deadline: '2026-10-01' }]);
    expect(d.map((p) => p.id)).toEqual(['c', 'a']);
  });
});
