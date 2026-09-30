import { describe, expect, it } from 'vitest';
import { buildColumns, groupTasks } from './workspaceBoard';

describe('buildColumns', () => {
  it('keeps template order and marks unsupported columns explicitly', () => {
    const cols = buildColumns(['Deal', 'Owner', 'Stage', 'Value', 'Due date', 'Priority']);
    expect(cols.map((c) => c.label)).toEqual(['Task', 'Deal', 'Owner', 'Stage', 'Value', 'Due date', 'Priority']);
    expect(cols.map((c) => c.field)).toEqual(['title', null, null, 'status', null, 'due_date', 'priority']);
  });

  it('does not add a Task column when the template already has one, in its own position', () => {
    const cols = buildColumns(['Status', 'Item', 'Owner']);
    expect(cols.map((c) => c.label)).toEqual(['Status', 'Item', 'Owner']);
  });

  it('shows a field once when two template columns map to it', () => {
    const cols = buildColumns(['Task', 'Status', 'Stage']);
    expect(cols.map((c) => c.label)).toEqual(['Task', 'Status']);
  });
});

describe('groupTasks', () => {
  const t = (id: string, labels: string[] | null) => ({ id, labels });
  it('preserves template group order including empty groups', () => {
    const out = groupTasks([t('1', ['Won']), t('2', ['New'])], ['New', 'Contacted', 'Won']);
    expect(out.map((g) => [g.name, g.tasks.length])).toEqual([['New', 1], ['Contacted', 0], ['Won', 1]]);
  });
  it('puts unmatched tasks in Other only when there are some', () => {
    expect(groupTasks([t('1', null)], ['A']).map((g) => g.name)).toEqual(['A', 'Other']);
    expect(groupTasks([], ['A']).map((g) => g.name)).toEqual(['A']);
  });
});
