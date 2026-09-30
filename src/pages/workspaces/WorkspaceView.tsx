import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, Info, Loader2, LayoutGrid } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  isSupportedColumn, resolveView, statusLabelsFor, TASK_STATUS_KEYS,
} from '@/lib/templateKind';

interface Board {
  id: string; name: string; color: string | null; index: number;
  columns: string[]; views: string[]; statuses: string[]; groups: string[]; workspaceName: string;
}
interface Task {
  id: string; title: string; status: string; priority: string;
  due_date: string | null; labels: string[] | null; estimated_hours: number | null;
}
type ViewKey = 'table' | 'board' | 'calendar';

const VIEW_LABEL: Record<ViewKey, string> = { table: 'Table', board: 'Board', calendar: 'Calendar' };

export default function WorkspaceView() {
  const { workspaceId } = useParams();
  const [params, setParams] = useSearchParams();
  const { organizationId, organization } = useActiveOrganization();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [boardsError, setBoardsError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Boards — always scoped to the company selected in the top bar.
  useEffect(() => {
    let cancelled = false;
    setBoards(null); setBoardsError(null);
    if (!organizationId || !workspaceId) { setBoards([]); return; }
    supabase
      .from('projects')
      .select('id, name, color, custom_fields')
      .eq('organization_id', organizationId)
      .eq('custom_fields->workspace->>id', workspaceId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setBoardsError(error.message); return; }
        const list = (data ?? []).map((p) => {
          const cf = (p.custom_fields ?? {}) as any;
          return {
            id: p.id, name: p.name, color: p.color,
            index: cf.workspace?.board_index ?? 0,
            workspaceName: cf.workspace?.name ?? 'Workspace',
            columns: cf.board_columns ?? [], views: cf.board_views ?? [],
            statuses: cf.board_statuses ?? [], groups: cf.board_groups ?? [],
          } as Board;
        }).sort((a, b) => a.index - b.index);
        setBoards(list);
      });
    return () => { cancelled = true; };
  }, [organizationId, workspaceId]);

  const board = useMemo(() => {
    if (!boards?.length) return null;
    return boards.find((b) => b.id === params.get('board')) ?? boards[0];
  }, [boards, params]);

  const supportedViews = useMemo<ViewKey[]>(() => {
    const set = new Set<ViewKey>(['table']);
    board?.views.forEach((v) => { const r = resolveView(v); if (r) set.add(r); });
    set.add('board'); set.add('calendar'); // always available from task data
    return ['table', 'board', 'calendar'].filter((v) => set.has(v as ViewKey)) as ViewKey[];
  }, [board]);
  const unsupportedViews = board?.views.filter((v) => !resolveView(v)) ?? [];
  const unsupportedColumns = board?.columns.filter((c) => !isSupportedColumn(c)) ?? [];
  const view = (supportedViews.includes(params.get('view') as ViewKey) ? params.get('view') : 'table') as ViewKey;
  const statusLabels = statusLabelsFor(board?.statuses);

  const loadTasks = useCallback(async () => {
    if (!board || !organizationId) return;
    setTasks(null); setTasksError(null);
    const { data, error } = await supabase
      .from('todos')
      .select('id, title, status, priority, due_date, labels, estimated_hours')
      .eq('project_id', board.id)
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .is('parent_id', null)
      .order('due_date', { ascending: true, nullsFirst: false });
    if (error) setTasksError(error.message);
    else setTasks((data ?? []) as Task[]);
  }, [board, organizationId]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  const updateStatus = async (task: Task, status: string) => {
    const prev = tasks;
    setTasks((t) => t?.map((x) => (x.id === task.id ? { ...x, status } : x)) ?? null);
    const { error } = await supabase.from('todos').update({ status }).eq('id', task.id).eq('organization_id', organizationId!);
    if (error) {
      setTasks(prev);
      toast({ title: 'Could not update status', description: error.message, variant: 'destructive' });
    }
  };

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params); next.set(key, value); setParams(next, { replace: key === 'view' });
  };

  if (!organizationId) {
    return <Shell><Empty title="Choose a company" text="Pick a company in the top bar to open this workspace." /></Shell>;
  }
  if (boardsError) return <Shell><ErrorBox text={boardsError} /></Shell>;
  if (boards === null) return <Shell><Loading text="Loading workspace…" /></Shell>;
  if (!boards.length || !board) {
    return (
      <Shell>
        <Empty
          title="Workspace not found in this company"
          text={`This workspace isn't part of ${organization?.name ?? 'the selected company'}. If it belongs to another company you're a member of, switch company in the top bar.`}
        />
      </Shell>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row">
      {/* Board navigation */}
      <aside className="border-b border-border bg-muted/30 md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="p-4">
          <Link to="/workspaces" className="text-xs text-muted-foreground hover:text-foreground">← All workspaces</Link>
          <h1 className="mt-2 flex items-center gap-2 text-lg font-semibold text-foreground">
            <LayoutGrid className="h-5 w-5 text-primary" />{board.workspaceName}
          </h1>
          <p className="text-xs text-muted-foreground">{organization?.name}</p>
        </div>
        <nav aria-label="Boards" className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible">
          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => setParam('board', b.id)}
              aria-current={b.id === board.id ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                b.id === board.id ? 'bg-primary/10 font-medium text-primary' : 'text-foreground hover:bg-muted',
              )}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: b.color ?? undefined }} />
              <span className="truncate">{b.name}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Selected board */}
      <section className="min-w-0 flex-1 p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">{board.name}</h2>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/project-management?project=${board.id}`}>Open in Projects &amp; tasks</Link>
          </Button>
        </div>

        <div role="tablist" aria-label="Board views" className="mb-4 flex flex-wrap items-center gap-1 border-b border-border">
          {supportedViews.map((v) => (
            <button
              key={v} role="tab" aria-selected={view === v}
              onClick={() => setParam('view', v)}
              className={cn('-mb-px border-b-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === v ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}
            >{VIEW_LABEL[v]}</button>
          ))}
          {unsupportedViews.map((v) => (
            <span key={v} title="Defined by the template — not yet supported" className="px-3 py-2 text-sm text-muted-foreground/60 line-through">{v}</span>
          ))}
        </div>

        {(unsupportedViews.length > 0 || unsupportedColumns.length > 0) && (
          <p className="mb-4 flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Saved from the template but not yet supported:
              {unsupportedViews.length > 0 && <> views <strong>{unsupportedViews.join(', ')}</strong>.</>}
              {unsupportedColumns.length > 0 && <> Columns <strong>{unsupportedColumns.join(', ')}</strong>.</>}
            </span>
          </p>
        )}

        {tasksError ? <ErrorBox text={tasksError} onRetry={loadTasks} />
          : tasks === null ? <Loading text="Loading tasks…" />
          : tasks.length === 0 ? <Empty title="No tasks on this board" text="Add tasks from Projects & tasks." />
          : view === 'table' ? <TableView tasks={tasks} groups={board.groups} statusLabels={statusLabels} onStatus={updateStatus} />
          : view === 'board' ? <KanbanView tasks={tasks} statusLabels={statusLabels} onStatus={updateStatus} />
          : <CalendarView tasks={tasks} />}
      </section>
    </div>
  );
}

function StatusSelect({ task, labels, onStatus }: { task: Task; labels: Record<string, string>; onStatus: (t: Task, s: string) => void }) {
  return (
    <Select value={task.status} onValueChange={(s) => onStatus(task, s)}>
      <SelectTrigger className="h-8 w-36 text-xs" aria-label={`Status of ${task.title}`}><SelectValue /></SelectTrigger>
      <SelectContent>
        {TASK_STATUS_KEYS.map((k) => <SelectItem key={k} value={k}>{labels[k]}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function TableView({ tasks, groups, statusLabels, onStatus }: { tasks: Task[]; groups: string[]; statusLabels: Record<string, string>; onStatus: (t: Task, s: string) => void }) {
  const byGroup = new Map<string, Task[]>();
  groups.forEach((g) => byGroup.set(g, []));
  tasks.forEach((t) => {
    const g = t.labels?.find((l) => byGroup.has(l)) ?? 'Other';
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(t);
  });
  return (
    <div className="space-y-6">
      {[...byGroup.entries()].filter(([, list]) => list.length).map(([group, list]) => (
        <div key={group} className="overflow-x-auto rounded-lg border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
            <span className="h-3 w-1 rounded bg-primary" />
            <h3 className="text-sm font-semibold text-foreground">{group}</h3>
            <Badge variant="secondary" className="text-[10px]">{list.length}</Badge>
          </div>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="px-3 py-2 font-medium">Task</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Priority</th><th className="px-3 py-2 font-medium">Due date</th><th className="px-3 py-2 font-medium">Est. hours</th></tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-3 py-2 text-foreground">{t.title}</td>
                  <td className="px-3 py-2"><StatusSelect task={t} labels={statusLabels} onStatus={onStatus} /></td>
                  <td className="px-3 py-2 capitalize text-muted-foreground">{t.priority}</td>
                  <td className="px-3 py-2 text-muted-foreground">{t.due_date ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{t.estimated_hours ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function KanbanView({ tasks, statusLabels, onStatus }: { tasks: Task[]; statusLabels: Record<string, string>; onStatus: (t: Task, s: string) => void }) {
  const [dragId, setDragId] = useState<string | null>(null);
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {TASK_STATUS_KEYS.map((status) => {
        const list = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { const t = tasks.find((x) => x.id === dragId); if (t && t.status !== status) onStatus(t, status); setDragId(null); }}
            className="w-64 shrink-0 rounded-lg border border-border bg-muted/30 p-2"
          >
            <p className="mb-2 flex items-center justify-between px-1 text-xs font-semibold text-foreground">
              {statusLabels[status]}<Badge variant="secondary" className="text-[10px]">{list.length}</Badge>
            </p>
            <div className="space-y-2">
              {list.map((t) => (
                <div key={t.id} draggable onDragStart={() => setDragId(t.id)} className="rounded-md border border-border bg-card p-2 text-sm shadow-sm">
                  <p className="text-foreground">{t.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.due_date ?? 'No due date'} · <span className="capitalize">{t.priority}</span></p>
                  <div className="mt-2"><StatusSelect task={t} labels={statusLabels} onStatus={onStatus} /></div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarView({ tasks }: { tasks: Task[] }) {
  const first = tasks.find((t) => t.due_date)?.due_date;
  const [month, setMonth] = useState(() => { const d = first ? new Date(first) : new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const start = new Date(month); start.setDate(1 - ((month.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const undated = tasks.filter((t) => !t.due_date).length;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
        <p className="min-w-40 text-center font-medium text-foreground">{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
        <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
        {undated > 0 && <span className="text-xs text-muted-foreground">{undated} without a due date</span>}
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[700px] grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="bg-muted px-2 py-1 font-medium text-muted-foreground">{d}</div>)}
          {days.map((d) => {
            const list = tasks.filter((t) => t.due_date === key(d));
            return (
              <div key={key(d)} className={cn('min-h-24 bg-card p-1', d.getMonth() !== month.getMonth() && 'bg-muted/40 text-muted-foreground')}>
                <p className="mb-1 text-right">{d.getDate()}</p>
                {list.map((t) => <p key={t.id} className="mb-1 truncate rounded bg-primary/10 px-1 py-0.5 text-primary" title={t.title}>{t.title}</p>)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const Shell = ({ children }: { children: React.ReactNode }) => <div className="mx-auto max-w-3xl p-6">{children}</div>;
const Loading = ({ text }: { text: string }) => <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{text}</p>;
const Empty = ({ title, text }: { title: string; text: string }) => (
  <div className="rounded-md border border-dashed border-border p-10 text-center">
    <p className="font-medium text-foreground">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p>
  </div>
);
const ErrorBox = ({ text, onRetry }: { text: string; onRetry?: () => void }) => (
  <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
    <AlertCircle className="h-4 w-4" />{text}{onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
  </div>
);
