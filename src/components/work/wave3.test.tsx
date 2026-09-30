import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { applyWorkFilters, readWorkFilters, writeWorkFilters, EMPTY_FILTERS, toDay } from '@/lib/workFilters';
import { DataTable } from '@/components/data/DataTable';
import { CalendarAgenda, groupAgenda } from '@/components/project-management/CalendarAgenda';
import { ViewSwitcher } from '@/components/work/ViewSwitcher';
import { TaskListView } from '@/components/work/TaskListView';
import { WorkFilterBar } from '@/components/work/WorkFilterBar';
import { StatusBadge } from '@/components/data/StatusBadge';

const d = (s: string) => new Date(`${s}T00:00:00`);
const tasks = [
  { id: '1', title: 'Write brief', description: 'client', status: 'todo', priority: 'high', assignee: 'Ana', dueDate: d('2026-10-05'), project: 'P' },
  { id: '2', title: 'Design logo', description: '', status: 'done', priority: 'low', assignee: 'Unassigned', dueDate: null, project: 'P' },
  { id: '3', title: 'Ship site', description: '', status: 'in-progress', priority: 'urgent', assignee: 'Ben', dueDate: d('2026-10-20'), project: 'Q' },
];

describe('work filters (URL-backed)', () => {
  it('round-trips through URL params and drops defaults', () => {
    const p = writeWorkFilters(new URLSearchParams('view=list&project=x'), { q: 'ship', status: 'all', from: '2026-10-01' });
    expect(p.get('view')).toBe('list');
    expect(p.get('project')).toBe('x');
    expect(p.has('status')).toBe(false);
    expect(readWorkFilters(p)).toMatchObject({ q: 'ship', from: '2026-10-01', status: 'all' });
  });
  it('rejects malformed dates', () => {
    expect(readWorkFilters(new URLSearchParams('from=yesterday')).from).toBe('');
  });
  it('filters by search, status, priority, assignee and date range', () => {
    expect(applyWorkFilters(tasks, { ...EMPTY_FILTERS, q: 'CLIENT' }).map((t) => t.id)).toEqual(['1']);
    expect(applyWorkFilters(tasks, { ...EMPTY_FILTERS, status: 'done' }).map((t) => t.id)).toEqual(['2']);
    expect(applyWorkFilters(tasks, { ...EMPTY_FILTERS, priority: 'urgent' }).map((t) => t.id)).toEqual(['3']);
    expect(applyWorkFilters(tasks, { ...EMPTY_FILTERS, assignee: 'unassigned' }).map((t) => t.id)).toEqual(['2']);
    expect(applyWorkFilters(tasks, { ...EMPTY_FILTERS, from: '2026-10-05', to: '2026-10-05' }).map((t) => t.id)).toEqual(['1']);
  });
  it('treats date-only values as calendar days', () => {
    expect(toDay(d('2026-10-05'))).toBe('2026-10-05');
    expect(toDay('2026-10-05T23:30:00Z')).toBe('2026-10-05');
  });
});

function Loc() { const l = useLocation(); return <output data-testid="loc">{l.search}</output>; }

describe('WorkFilterBar', () => {
  it('writes filters to the URL and keeps view/project', () => {
    render(
      <MemoryRouter initialEntries={['/pm?view=list&project=p1']}>
        <Routes><Route path="/pm" element={<><WorkFilterBar statuses={[{ value: 'todo', label: 'To do' }]} assignees={['Ana']} /><Loc /></>} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Search tasks'), { target: { value: 'brief' } });
    fireEvent.change(screen.getByLabelText('Due from'), { target: { value: '2026-10-01' } });
    const search = new URLSearchParams(screen.getByTestId('loc').textContent!);
    expect(search.get('q')).toBe('brief');
    expect(search.get('from')).toBe('2026-10-01');
    expect(search.get('view')).toBe('list');
    expect(search.get('project')).toBe('p1');
    fireEvent.click(screen.getByRole('button', { name: /Clear filters \(2\)/ }));
    expect(new URLSearchParams(screen.getByTestId('loc').textContent!).has('q')).toBe(false);
  });
});

describe('ViewSwitcher', () => {
  it('marks the URL view as current and skips no-op clicks', () => {
    const onChange = vi.fn();
    render(<ViewSwitcher active="kanban" onChange={onChange} />);
    const board = screen.getByRole('button', { name: 'Board' });
    expect(board).toHaveAttribute('aria-current', 'page');
    fireEvent.click(board);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(onChange).toHaveBeenCalledWith('list');
  });
  it('shows a More-menu tab as the active label', () => {
    render(<ViewSwitcher active="goals" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Goals/ })).toHaveAttribute('aria-current', 'page');
  });
});

describe('TaskListView', () => {
  it('opens the shared editor from the title and the Edit button', () => {
    const onEdit = vi.fn();
    render(<TaskListView tasks={tasks} onEdit={onEdit} onArchive={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write brief' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit task Ship site' }));
    expect(onEdit.mock.calls.map((c) => c[0].id)).toEqual(['1', '3']);
  });
  it('shows no-results with a clear action when filters hide everything', () => {
    const clear = vi.fn();
    render(<TaskListView tasks={[]} filtered onEdit={() => {}} onArchive={() => {}} onClearFilters={clear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(clear).toHaveBeenCalled();
  });
});

describe('DataTable', () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: `Contact ${String(i).padStart(2, '0')}`, value: 30 - i }));
  const cols = [
    { id: 'name', header: 'Name', sortValue: (r: any) => r.name, cell: (r: any) => r.name },
    { id: 'value', header: 'Value', sortValue: (r: any) => r.value, cell: (r: any) => String(r.value) },
  ];
  it('paginates at 25 rows and sorts by header', () => {
    render(<DataTable caption="t" rows={rows} columns={cols} rowKey={(r) => r.id} initialSort={{ id: 'name', dir: 'asc' }} />);
    expect(screen.getAllByRole('row')).toHaveLength(26);
    expect(screen.getByText('Showing 1–25 of 30')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText('Showing 26–30 of 30')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Value/ }));
    const first = screen.getAllByRole('row')[1];
    expect(within(first).getByText('1')).toBeInTheDocument(); // ascending by value, back on page 1
    expect(screen.getByRole('columnheader', { name: /Value/ })).toHaveAttribute('aria-sort', 'ascending');
  });
});

describe('CalendarAgenda', () => {
  const items = [
    { id: 'a', title: 'B task', day: '2026-10-05', type: 'task' as const, status: 'todo', priority: 'low' },
    { id: 'b', title: 'A event', day: '2026-10-05', type: 'event' as const },
    { id: 'c', title: 'Outside', day: '2026-11-01', type: 'task' as const, status: 'todo' },
  ];
  it('groups by day within the month, sorted', () => {
    expect(groupAgenda(items, '2026-10-01', '2026-10-31')).toEqual([['2026-10-05', [items[1], items[0]]]]);
  });
  it('renders day headings from date-only values and opens items', () => {
    const onOpen = vi.fn();
    render(<CalendarAgenda items={items} fromDay="2026-10-01" toDay="2026-10-31" today="2026-10-05" onOpen={onOpen} />);
    expect(screen.getByRole('heading', { name: /5 Oct 2026 · Today/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /B task/ }));
    expect(onOpen).toHaveBeenCalledWith(items[0]);
    expect(screen.queryByText('Outside')).toBeNull();
  });
});

describe('StatusBadge', () => {
  it('labels known statuses', () => {
    render(<StatusBadge value="in-progress" prefix="Status" />);
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });
});
