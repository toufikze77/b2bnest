import { Link } from 'react-router-dom';
import { Activity, AlarmClock, ArrowRight, CalendarClock, CalendarDays, CalendarPlus, CheckSquare2, ChevronDown, FolderKanban, FolderPlus, LayoutGrid } from 'lucide-react';
import type { RecentTask } from '@/hooks/useDashboardData';
import { DashProject, formatDueDate, isOpen, ProjectSummary, TaskGroupData, taskHref, WorkspaceSummary } from '@/lib/dashboardData';
import { usePhone } from '@/hooks/use-media-query';
import { PriorityBadge } from '@/components/data/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState, LoadingRows } from '@/components/ui/states';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { rowLink, textLink, WidgetCard } from './WidgetCard';

const statusLabel = (s: string) => (s || 'todo').replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const fmtRelative = (iso: string | null | undefined) => {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return formatDueDate(iso);
};
const allTasksLink = <Button variant="ghost" size="sm" className="min-h-touch text-link sm:min-h-0" asChild><Link to="/project-management?view=list">All tasks<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>;

type Tone = 'danger' | 'warning' | 'neutral';

function TaskGroup({ title, icon: Icon, group, tone, projectName, phone }: { title: string; icon: typeof AlarmClock; group: TaskGroupData; tone: Tone; projectName: Map<string, string>; phone: boolean }) {
  const tasks = group.items;
  if (tasks.length === 0) return null;
  const total = group.total ?? tasks.length;
  const hidden = total - tasks.length;
  const headingId = `attn-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const bar = tone === 'danger' ? 'bg-priority-urgent' : tone === 'warning' ? 'bg-priority-medium' : 'bg-border';
  const dueCls = tone === 'danger' ? 'font-semibold text-destructive' : 'text-foreground';
  return (
    <section aria-labelledby={headingId} className="border-b border-border last:border-b-0">
      <h3 id={headingId} className="flex items-center gap-2 px-5 pb-2 pt-4 text-small font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />{title}
        <Badge variant={tone === 'danger' ? 'destructive' : tone === 'warning' ? 'warning' : 'neutral'} className="ml-1" aria-label={`${total} in total`}>{total}</Badge>
      </h3>
      {phone ? (
        <ul className="space-y-2 px-4 pb-3">
          {tasks.map((t) => (
            <li key={t.id} className="relative rounded-control border border-border bg-card">
              <span className={cn('absolute inset-y-2 left-0 w-1 rounded-r-full', bar)} aria-hidden="true" />
              <Link to={taskHref(t)} className="block min-h-touch rounded-control px-4 py-3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                <span className="block font-semibold text-foreground">{t.title}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-2 text-small text-muted-foreground">
                  <PriorityBadge value={t.priority} />
                  <span className={dueCls}>Due {formatDueDate(t.due_date!)}</span>
                  {t.project_id && projectName.get(t.project_id) && <span className="truncate">· {projectName.get(t.project_id)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full table-fixed text-body">
          <caption className="sr-only">{title} tasks</caption>
          <thead>
            <tr className="text-left text-small text-muted-foreground">
              <th scope="col" className="px-5 py-1.5 font-semibold">Task</th>
              <th scope="col" className="hidden w-[22%] px-3 py-1.5 font-semibold lg:table-cell">Project</th>
              <th scope="col" className="w-28 px-3 py-1.5 font-semibold">Priority</th>
              <th scope="col" className="w-28 px-5 py-1.5 text-right font-semibold">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-muted">
                <td className="px-5 py-2.5">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={cn('h-6 w-1 shrink-0 rounded-full', bar)} aria-hidden="true" />
                    <Link to={taskHref(t)} className="truncate font-semibold text-foreground underline-offset-2 hover:text-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring rounded-sm">{t.title}</Link>
                  </span>
                </td>
                <td className="hidden truncate px-3 py-2.5 text-muted-foreground lg:table-cell">{(t.project_id && projectName.get(t.project_id)) || '—'}</td>
                <td className="px-3 py-2.5"><PriorityBadge value={t.priority} /></td>
                <td className={cn('px-5 py-2.5 text-right tabular-nums', dueCls)}>{formatDueDate(t.due_date!)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(hidden > 0 || group.total === null) && (
        <p className="px-5 pb-3 pt-1 text-small text-muted-foreground">
          {group.total === null ? `Showing ${tasks.length}. ` : `Showing ${tasks.length} of ${total}. `}
          <Link to="/project-management?view=list" className={textLink}>See all in Projects &amp; tasks</Link>
        </p>
      )}
    </section>
  );
}

export function TasksWidget({ loading, error, groups, projectName, onRetry }: {
  loading: boolean; error: string | null; groups: { overdue: TaskGroupData; dueToday: TaskGroupData; upcoming: TaskGroupData };
  projectName: Map<string, string>; onRetry: () => void;
}) {
  const phone = usePhone();
  const count = groups.overdue.items.length + groups.dueToday.items.length + groups.upcoming.items.length;
  return (
    <WidgetCard id="needs-attention" title="Tasks needing attention" description="Open tasks overdue, due today and due in the next 7 days" action={allTasksLink}>
      {loading ? (
        <LoadingRows rows={4} label="Loading tasks that need attention" />
      ) : error ? (
        <ErrorState className="m-4 rounded-control" title="Couldn't load tasks" description="This is a loading problem, not an empty list." onRetry={onRetry} />
      ) : count === 0 ? (
        <EmptyState icon={CheckSquare2} className="min-h-0 border-0 bg-transparent py-8" title="Nothing needs attention" description="No open tasks are overdue or due in the next 7 days." action={<Button size="sm" variant="outline" asChild><Link to="/project-management?create=task">Create task</Link></Button>} />
      ) : (
        <div>
          <TaskGroup title="Overdue" icon={AlarmClock} group={groups.overdue} tone="danger" projectName={projectName} phone={phone} />
          <TaskGroup title="Due today" icon={CalendarClock} group={groups.dueToday} tone="warning" projectName={projectName} phone={phone} />
          <TaskGroup title="Next 7 days" icon={CalendarDays} group={groups.upcoming} tone="neutral" projectName={projectName} phone={phone} />
        </div>
      )}
    </WidgetCard>
  );
}

export function ProjectsWidget({ loading, error, projects, companyName, onRetry }: { loading: boolean; error: string | null; projects: ProjectSummary[]; companyName: string; onRetry: () => void }) {
  return (
    <WidgetCard id="active-projects" title="Project progress" description="Task progress and next open due date"
      action={<Button variant="ghost" size="sm" className="text-link" asChild><Link to="/project-management">All projects<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>}>
      {loading ? (
        <LoadingRows rows={3} label="Loading projects" />
      ) : error ? (
        <ErrorState className="m-4 rounded-control" title="Couldn't load projects" description="This is a loading problem, not an empty list." onRetry={onRetry} />
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} className="min-h-0 border-0 bg-transparent py-8" title="No active projects" description={`${companyName} has no open projects outside workspaces.`} />
      ) : (
        <>
          <ul className="divide-y divide-border">
            {projects.slice(0, 6).map((p) => {
              const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <li key={p.id}>
                  <Link to={p.href} className="grid min-h-touch grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 px-5 py-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[auto_minmax(0,1fr)_200px_110px]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-control bg-primary/10 text-sm font-bold text-link" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-foreground">{p.name}</span>
                      <span className="block text-small text-muted-foreground">{statusLabel(p.status)}</span>
                    </span>
                    <span className="col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto" aria-label={`${p.done} of ${p.total} tasks done`}>
                      <span className="flex items-center justify-between text-small text-muted-foreground"><span>{p.done}/{p.total} tasks</span><span className="font-semibold tabular-nums text-foreground">{pct}%</span></span>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></span>
                    </span>
                    <span className="col-start-3 row-start-1 text-right text-small text-muted-foreground sm:col-start-auto sm:row-start-auto">
                      {p.nextDue ? <>Next due<br /><span className="font-semibold text-foreground">{formatDueDate(p.nextDue)}</span></> : 'No due tasks'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {projects.length > 6 && <p className="border-t border-border px-5 py-2 text-small text-muted-foreground">Showing 6 of {projects.length} loaded. <Link to="/project-management" className={textLink}>See all</Link></p>}
        </>
      )}
    </WidgetCard>
  );
}

const projectHref = (id: string) => `/project-management?view=list&project=${id}`;
const editDeadlineHref = (id: string) => `/project-management?view=list&project=${id}&edit=${id}`;

function DeadlineEmpty({ canManage, projects }: { canManage: boolean; projects: { id: string; name: string }[] }) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body text-muted-foreground">{canManage ? 'No projects yet. Create one, then set its deadline.' : 'No projects yet. A company owner, admin or manager can create one.'}</p>
        {canManage && <Button size="sm" variant="outline" asChild><Link to="/project-management?create=project"><FolderPlus className="h-4 w-4" aria-hidden="true" />Create project</Link></Button>}
      </div>
    );
  }
  if (!canManage) {
    return <p className="px-5 py-4 text-body text-muted-foreground">No active project has a deadline yet. Ask a company owner, admin or manager to add one.</p>;
  }
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-body text-muted-foreground">No active project has a deadline yet.</p>
      {projects.length === 1 ? (
        <Button size="sm" variant="outline" asChild><Link to={editDeadlineHref(projects[0].id)}><CalendarPlus className="h-4 w-4" aria-hidden="true" />Add project deadline</Link></Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline"><CalendarPlus className="h-4 w-4" aria-hidden="true" />Add project deadline<ChevronDown className="h-4 w-4" aria-hidden="true" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto">
            <DropdownMenuLabel>Choose a project</DropdownMenuLabel>
            {projects.map((p) => (
              <DropdownMenuItem key={p.id} asChild><Link to={editDeadlineHref(p.id)} className="truncate">{p.name}</Link></DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function ComingUpWidget({ loading, error, deadlines, activeProjects, canManage }: { loading: boolean; error: string | null; deadlines: DashProject[]; activeProjects: DashProject[]; canManage: boolean }) {
  return (
    <WidgetCard id="coming-up" title="Coming up" description="Active project deadlines, soonest first">
      {loading ? <LoadingRows rows={2} label="Loading deadlines" /> : error ? (
        <p className="px-5 py-4 text-body text-muted-foreground">Deadlines couldn't be loaded.</p>
      ) : deadlines.length === 0 ? (
        <DeadlineEmpty canManage={canManage} projects={activeProjects} />
      ) : (
        <ul className="divide-y divide-border">
          {deadlines.map((p) => (
            <li key={p.id}>
              <Link to={projectHref(p.id)} className={rowLink}>
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">{formatDueDate(p.deadline!)}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

export function WorkspacesWidget({ loading, error, workspaces }: { loading: boolean; error: string | null; workspaces: WorkspaceSummary[] }) {
  return (
    <WidgetCard id="workspaces" title="Workspaces" description="Template boards for this company"
      action={<Button variant="ghost" size="sm" className="text-link" asChild><Link to="/workspaces">View all</Link></Button>}>
      {loading ? <LoadingRows rows={2} label="Loading workspaces" /> : error ? (
        <p className="px-5 py-4 text-body text-muted-foreground">Workspaces couldn't be loaded.</p>
      ) : workspaces.length === 0 ? (
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <p className="text-body text-muted-foreground">No workspaces yet.</p>
          <Button size="sm" variant="outline" asChild><Link to="/template-center">Browse templates</Link></Button>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {workspaces.slice(0, 5).map((w) => (
            <li key={w.id}>
              <Link to={w.href} className={rowLink}>
                <span className="flex h-8 w-8 items-center justify-center rounded-control bg-primary/10 text-link"><LayoutGrid className="h-4 w-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{w.name}</span><span className="block text-small text-muted-foreground">{w.boards} {w.boards === 1 ? 'board' : 'boards'} · {w.open} open {w.open === 1 ? 'task' : 'tasks'}</span></span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

export function RecentWidget({ loading, error, recent, projectName, onRetry }: { loading: boolean; error: string | null; recent: RecentTask[]; projectName: Map<string, string>; onRetry: () => void }) {
  return (
    <WidgetCard id="recent-activity" title="Recently updated tasks">
      {loading ? <LoadingRows rows={3} label="Loading recent activity" /> : error ? (
        <ErrorState className="m-4 rounded-control" title="Couldn't load activity" onRetry={onRetry} />
      ) : recent.length === 0 ? (
        <p className="px-5 py-4 text-body text-muted-foreground">No task activity yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {recent.map((t) => (
            <li key={t.id}>
              <Link to={taskHref(t)} className={cn(rowLink, 'items-start')}>
                <Activity className={cn('mt-0.5 h-4 w-4 shrink-0', isOpen(t.status) ? 'text-muted-foreground' : 'text-success')} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{t.title}</span>
                  <span className="block truncate text-small text-muted-foreground">{statusLabel(t.status)}{t.project_id && projectName.get(t.project_id) ? ` · ${projectName.get(t.project_id)}` : ''}</span>
                </span>
                <span className="shrink-0 text-small text-muted-foreground">{fmtRelative(t.updated_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
