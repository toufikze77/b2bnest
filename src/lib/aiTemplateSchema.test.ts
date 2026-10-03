// Unit tests (no provider, no database): schema validation and preview-before-create mapping.
import { describe, it, expect } from 'vitest';
import { parseAiTemplate, toWorkspaceTemplate, LIMITS } from './aiTemplateSchema';
import { getTemplateKind } from './templateKind';

const task = { title: 'Call client', status: 'todo', priority: 'medium', dayOffset: 2 };
// Distinct titles per board so the usefulness gate (no repeats, >= 3 tasks) passes.
const board = (name = 'Tickets') => ({ name, description: 'Support work', views: ['table', 'board'], groups: [{ name: 'New', tasks: ['Call client', 'Log request', 'Send summary'].map((x) => ({ ...task, title: `${x} (${name})` })) }] });
const tpl = (o: Record<string, unknown> = {}) => ({ schemaVersion: 1, kind: 'workspace', name: 'Support desk', description: 'Handle tickets', boards: [board()], ...o });

describe('AI template schema v1', () => {
  it('accepts a project template', () => {
    const r = parseAiTemplate(tpl({ kind: 'project' }));
    expect(r.ok).toBe(true);
  });
  it('accepts a one-board workspace and keeps it a workspace', () => {
    const r = parseAiTemplate(JSON.stringify(tpl()));
    expect(r.ok).toBe(true);
    if (r.ok) expect(getTemplateKind(toWorkspaceTemplate(r.template, 'x'))).toBe('workspace');
  });
  it('accepts a multi-board workspace', () => {
    const r = parseAiTemplate(tpl({ boards: [board('A'), board('B'), board('C')] }));
    expect(r.ok && r.template.boards.length).toBe(3);
  });
  it('rejects a multi-board project', () => {
    expect(parseAiTemplate(tpl({ kind: 'project', boards: [board('A'), board('B')] })).ok).toBe(false);
  });
  it('rejects unsupported views, statuses and unknown fields', () => {
    expect(parseAiTemplate(tpl({ boards: [{ ...board(), views: ['dashboard'] }] })).ok).toBe(false);
    expect(parseAiTemplate(tpl({ boards: [{ ...board(), groups: [{ name: 'g', tasks: [{ ...task, status: 'blocked' }] }] }] })).ok).toBe(false);
    expect(parseAiTemplate(tpl({ automations: ['send email'] })).ok).toBe(false);
    expect(parseAiTemplate(tpl({ boards: [{ ...board(), sql: 'drop table x' }] })).ok).toBe(false);
  });
  it('rejects wrong schema version, malformed JSON and oversized output', () => {
    expect(parseAiTemplate(tpl({ schemaVersion: 2 })).ok).toBe(false);
    expect(parseAiTemplate('{not json').ok).toBe(false);
    expect(parseAiTemplate('x'.repeat(70000)).ok).toBe(false);
  });
  it('rejects markup/script injection in text', () => {
    expect(parseAiTemplate(tpl({ name: '<script>alert(1)</script>' })).ok).toBe(false);
    expect(parseAiTemplate(tpl({ description: 'click <img src=x onerror=alert(1)>' })).ok).toBe(false);
    expect(parseAiTemplate(tpl({ name: 'javascript:void(0)' })).ok).toBe(false);
  });
  it('enforces board, task and date bounds', () => {
    expect(parseAiTemplate(tpl({ boards: Array.from({ length: LIMITS.boards + 1 }, (_, i) => board(`B${i}`)) })).ok).toBe(false);
    const many = Array.from({ length: LIMITS.tasksPerBoard + 1 }, () => task);
    expect(parseAiTemplate(tpl({ boards: [{ ...board(), groups: [{ name: 'g', tasks: many }] }] })).ok).toBe(false);
    expect(parseAiTemplate(tpl({ boards: [{ ...board(), groups: [{ name: 'g', tasks: [{ ...task, dayOffset: 9999 }] }] }] })).ok).toBe(false);
    expect(parseAiTemplate(tpl({ boards: [{ ...board(), groups: [{ name: 'g', tasks: [{ ...task, dayOffset: -1 }] }] }] })).ok).toBe(false);
  });
  it('preview edits are re-validated before create', () => {
    const r = parseAiTemplate(tpl());
    if (!r.ok) throw new Error('setup');
    const edited = { ...r.template, name: 'Edited desk', boards: [{ ...r.template.boards[0], name: 'Renamed' }] };
    const again = parseAiTemplate(edited);
    expect(again.ok).toBe(true);
    if (again.ok) {
      const w = toWorkspaceTemplate(again.template, 'id1');
      expect(w.name).toBe('Edited desk');
      expect(w.boards[0].name).toBe('Renamed');
      expect(w.automations).toEqual([]);
    }
    expect(parseAiTemplate({ ...r.template, name: '' }).ok).toBe(false);
  });
});
