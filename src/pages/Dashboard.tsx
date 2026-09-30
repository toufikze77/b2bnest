import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlarmClock, ArrowRight, Building2, CalendarClock, CalendarDays, CheckCircle2, CheckSquare2, Circle,
  FolderKanban, FolderPlus, LayoutGrid, LayoutTemplate, ListTodo, Plus, Receipt, UserRound, Users, X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  ActivationStep, buildActivationSteps, dismissKey, hasRole, isOpen, projectDeadlines, ROTA_ROLES,
  summarizeProjects, TaskGroupData, taskHref,
} from '@/lib/dashboardData';
import { PageContainer } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState, LoadingRows } from '@/components/ui/states';
import { cn } from '@/lib/utils';

const fmtDate = (d: string) => new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtRelative = (iso: string | null | undefined) => {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return fmtDate(iso);
};
const statusLabel = (s: string) => (s || 'todo').replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function Panel({ id, title, description, action, children, className }: { id: string; title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn('overflow-hidden rounded-lg border border-border bg-card shadow-sm', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, icon: Icon, tone, href, hint }: { label: string; value: number | null; icon: typeof ListTodo; tone: 'primary' | 'info' | 'danger' | 'success'; href: string; hint: string }) {
  const toneCls = { primary: 'bg-primary/10 text-primary', info: 'bg-info/10 text-info', danger: 'bg-destructive/10 text-destructive', success: 'bg-success/10 text-success' }[tone];
  return (
    <Link to={href} className="group rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-md', toneCls)}><Icon className="h-4 w-4" aria-hidden="true" /></span>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">{value === null ? '—' : value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-muted-foreground">{value === null ? 'Unavailable' : hint}</p>
    </Link>
  );
}

function TaskGroup({ title, icon: Icon, group, tone }: { title: string; icon: typeof AlarmClock; group: TaskGroupData; tone: 'danger' | 'warning' | 'neutral' }) {
  const tasks = group.items;
  if (tasks.length === 0) return null;
  const total = group.total ?? tasks.length;
  const hidden = total - tasks.length;
  const headingId = `attn-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const bar = tone === 'danger' ? 'bg-destructive' : tone === 'warning' ? 'bg-warning' : 'bg-border';
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="flex items-center gap-2 px-5 pb-1.5 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />{title}
        <Badge variant={tone === 'danger' ? 'destructive' : tone === 'warning' ? 'warning' : 'neutral'} className="ml-1" aria-label={`${total} in total`}>{total}</Badge>
      </h3>
      <ul className="divide-y divide-border">
        {tasks.map((t) => (
          <li key={t.id}>
            <Link to={taskHref(t)} className="flex min-h-12 items-center gap-3 px-5 py-2.5 text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <span className={cn('h-6 w-1 shrink-0 rounded-full', bar)} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{t.title}</span>
              <span className="hidden shrink-0 text-xs capitalize text-muted-foreground sm:inline">{t.priority}</span>
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{fmtDate(t.due_date!)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {(hidden > 0 || group.total === null) && (
        <p className="px-5 pb-2 pt-1 text-xs text-muted-foreground">
          {group.total === null ? `Showing ${tasks.length}. ` : `Showing ${tasks.length} of ${total}. `}
          <Link to="/project-management?view=list" className="underline underline-offset-2 hover:text-foreground">See all in Projects &amp; tasks</Link>
        </p>
      )}
    </section>
  );
}

function StepList({ heading, note, steps }: { heading: string; note?: string; steps: ActivationStep[] }) {
  if (steps.length === 0) return null;
  return (
    <div>
      <div className="border-b border-border bg-muted/40 px-5 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</h3>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      <ul className="divide-y divide-border border-b border-border last:border-b-0">
        {steps.map((s) => (
          <li key={s.id} className="flex items-start gap-3 px-5 py-3">
            <Circle className={`mt-0.5 h-4 w-4 ${s.state === 'unknown' ? 'text-muted-foreground' : 'text-primary'}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.description}</p>
            </div>
            <Button size="sm" variant="outline" asChild><Link to={s.href}>{s.actionLabel}</Link></Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const Dashboard = () => {
  const { user } = useAuth();
  const { organizationId, organization, loading: orgLoading } = useActiveOrganization();
  const data = useDashboardData(user?.id, organizationId);
  const role = organization?.role ?? null;
  const groups = data.groups;
  const attentionCount = groups.overdue.items.length + groups.dueToday.items.length + groups.upcoming.items.length;
  const companyName = organization?.name || 'this company';

  const dKey = user && organizationId ? dismissKey(user.id, organizationId) : null;
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { setDismissed(dKey ? localStorage.getItem(dKey) === '1' : false); }, [dKey]);
  const steps = buildActivationSteps(data.counts, role);
  const openSteps = steps.filter((s) => s.state !== 'done');
  const doneCount = steps.length - openSteps.length;
  const showChecklist = !data.loading && !dismissed && openSteps.length > 0;

  const { projects, workspaces } = useMemo(() => summarizeProjects(data.activeProjects, data.progressTasks), [data.activeProjects, data.progressTasks]);
  const deadlines = useMemo(() => projectDeadlines(data.activeProjects), [data.activeProjects]);
  const projectName = useMemo(() => new Map(data.activeProjects.map((p) => [p.id, p.name])), [data.activeProjects]);

  const quickActions = [
    { label: 'New project', to: '/project-management?create=project', icon: FolderPlus },
    { label: 'Use a template', to: '/template-center', icon: LayoutTemplate },
    { label: 'Calendar', to: '/project-management?view=calendar', icon: CalendarDays },
    ...(hasRole(role, ROTA_ROLES) ? [{ label: 'Plan the rota', to: '/rota/schedule', icon: Users }] : []),
  ];

  if (!orgLoading && !organizationId) {
    return (
      <PageContainer width="full" className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <EmptyState icon={Building2} title="Choose a company" description="Pick a company from the drop-down at the top of the page to see its work." />
      </PageContainer>
    );
  }

  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <PageContainer width="full" className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"><Building2 className="h-4 w-4" aria-hidden="true" />{organization?.name || 'Company'}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Today at a glance</h1>
          <p className="mt-1 text-sm text-muted-foreground">{todayLabel} · work that needs attention in {companyName}</p>
        </div>
        <Button asChild className="self-start sm:self-auto"><Link to="/project-management?create=task"><Plus className="h-4 w-4" aria-hidden="true" />New task</Link></Button>
      </header>

      {/* Summary row — selected company only */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Company summary">
        <Stat label="Active projects" value={data.loading ? null : data.summary.activeProjects} icon={FolderKanban} tone="primary" href="/project-management" hint="Not completed or cancelled" />
        <Stat label="Open tasks" value={data.loading ? null : data.summary.openTasks} icon={ListTodo} tone="info" href="/project-management?view=list" hint="Across all projects" />
        <Stat label="Overdue tasks" value={data.loading || data.tasksError ? null : groups.overdue.total} icon={AlarmClock} tone="danger" href="/project-management?view=list" hint="Past their due date" />
        <Stat label="Completed this week" value={data.loading ? null : data.summary.completedWeek} icon={CheckCircle2} tone="success" href="/project-management?view=list" hint="Since Monday" />
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        {/* Main column */}
        <div className="min-w-0 space-y-6 xl:col-span-8">
          <Panel id="needs-attention" title="Needs attention" description="Open tasks overdue, due today and due in the next 7 days"
            action={<Button variant="ghost" size="sm" asChild><Link to="/project-management?view=list">All tasks<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>}>
            {data.loading ? (
              <LoadingRows rows={4} label="Loading tasks that need attention" />
            ) : data.tasksError ? (
              <ErrorState className="m-4" title="Couldn't load tasks" description="This is a loading problem, not an empty list." onRetry={data.reload} />
            ) : attentionCount === 0 ? (
              <EmptyState icon={CheckSquare2} className="border-0" title="Nothing needs attention" description="No open tasks are overdue or due in the next 7 days." action={<Button size="sm" variant="outline" asChild><Link to="/project-management?create=task">Create task</Link></Button>} />
            ) : (
              <div className="pb-2">
                <TaskGroup title="Overdue" icon={AlarmClock} group={groups.overdue} tone="danger" />
                <TaskGroup title="Due today" icon={CalendarClock} group={groups.dueToday} tone="warning" />
                <TaskGroup title="Upcoming" icon={CalendarDays} group={groups.upcoming} tone="neutral" />
              </div>
            )}
          </Panel>

          <Panel id="active-projects" title="Active projects" description="Task progress and next open deadline"
            action={<Button variant="ghost" size="sm" asChild><Link to="/project-management">All projects<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>}>
            {data.loading ? (
              <LoadingRows rows={3} label="Loading projects" />
            ) : data.projectsError ? (
              <ErrorState className="m-4" title="Couldn't load projects" description="This is a loading problem, not an empty list." onRetry={data.reload} />
            ) : projects.length === 0 ? (
              <EmptyState icon={FolderKanban} className="border-0" title="No active projects" description={`${companyName} has no open projects outside workspaces.`} />
            ) : (
              <ul className="divide-y divide-border">
                {projects.slice(0, 6).map((p) => {
                  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
                  return (
                    <li key={p.id}>
                      <Link to={p.href} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[auto_minmax(0,1fr)_180px_110px]">
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">{p.name}</span>
                          <span className="block text-xs text-muted-foreground">{statusLabel(p.status)}</span>
                        </span>
                        <span className="col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto" aria-label={`${p.done} of ${p.total} tasks done`}>
                          <span className="flex items-center justify-between text-xs text-muted-foreground"><span>{p.done}/{p.total} tasks</span><span className="tabular-nums">{pct}%</span></span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></span>
                        </span>
                        <span className="col-start-3 row-start-1 text-right text-xs text-muted-foreground sm:col-start-auto sm:row-start-auto">
                          {p.nextDue ? <>Next due<br /><span className="font-medium text-foreground">{fmtDate(p.nextDue)}</span></> : 'No due tasks'}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {projects.length > 6 && <p className="border-t border-border px-5 py-2 text-xs text-muted-foreground">Showing 6 of {projects.length} loaded. <Link to="/project-management" className="underline underline-offset-2 hover:text-foreground">See all</Link></p>}
          </Panel>
        </div>

        {/* Secondary column */}
        <div className="min-w-0 space-y-6 xl:col-span-4">
          <Panel id="workspaces" title="Workspaces" description="Template boards for this company"
            action={<Button variant="ghost" size="sm" asChild><Link to="/workspaces">View all</Link></Button>}>
            {data.loading ? <LoadingRows rows={2} label="Loading workspaces" /> : data.projectsError ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">Workspaces couldn't be loaded.</p>
            ) : workspaces.length === 0 ? (
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <p className="text-sm text-muted-foreground">No workspaces yet.</p>
                <Button size="sm" variant="outline" asChild><Link to="/template-center">Browse templates</Link></Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {workspaces.slice(0, 5).map((w) => (
                  <li key={w.id}>
                    <Link to={w.href} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-info/10 text-info"><LayoutGrid className="h-4 w-4" aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{w.name}</span><span className="block text-xs text-muted-foreground">{w.boards} boards · {w.open} open tasks</span></span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel id="project-deadlines" title="Project deadlines">
            {data.loading ? <LoadingRows rows={2} label="Loading deadlines" /> : data.projectsError ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">Deadlines couldn't be loaded.</p>
            ) : deadlines.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">No active project has a deadline set.</p>
            ) : (
              <ul className="divide-y divide-border">
                {deadlines.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="shrink-0 text-xs font-medium tabular-nums">{fmtDate(p.deadline!)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel id="recent-activity" title="Recently updated tasks">
            {data.loading ? <LoadingRows rows={3} label="Loading recent activity" /> : data.recentError ? (
              <ErrorState className="m-4" title="Couldn't load activity" onRetry={data.reload} />
            ) : data.recent.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">No task activity yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recent.map((t) => (
                  <li key={t.id}>
                    <Link to={taskHref(t)} className="flex items-start gap-3 px-5 py-2.5 text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                      <Activity className={cn('mt-0.5 h-4 w-4 shrink-0', isOpen(t.status) ? 'text-muted-foreground' : 'text-success')} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{t.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{statusLabel(t.status)}{t.project_id && projectName.get(t.project_id) ? ` · ${projectName.get(t.project_id)}` : ''}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{fmtRelative(t.updated_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <section aria-labelledby="quick-actions" className="rounded-lg border border-border bg-surface-subtle p-4">
            <h2 id="quick-actions" className="mb-3 text-sm font-semibold">Quick actions</h2>
            <div className="flex flex-wrap gap-2">
              {quickActions.map(({ label, to, icon: Icon }) => (
                <Button key={label} variant="outline" size="sm" className="bg-card" asChild>
                  <Link to={to}><Icon className="h-4 w-4" aria-hidden="true" />{label}</Link>
                </Button>
              ))}
            </div>
          </section>

          {/* Personal records — kept visibly separate from company data */}
          <section aria-labelledby="your-records" className="rounded-lg border border-dashed border-border p-4">
            <h2 id="your-records" className="flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4" aria-hidden="true" />Your records</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Contacts and invoices belong to your account, not only to {companyName}.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" asChild><Link to="/crm"><Users className="h-4 w-4" aria-hidden="true" />Open CRM</Link></Button>
              <Button variant="ghost" size="sm" asChild><Link to="/business-tools?tool=business-finance-assistant&tab=invoices"><Receipt className="h-4 w-4" aria-hidden="true" />Open invoices</Link></Button>
            </div>
          </section>

          {showChecklist && (
            <section aria-labelledby="get-started" className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex items-start justify-between border-b border-border px-5 py-3">
                <div>
                  <h2 id="get-started" className="text-base font-semibold">Get started</h2>
                  <p className="text-xs text-muted-foreground">{doneCount} of {steps.length} done</p>
                </div>
                <Button variant="ghost" size="icon" aria-label="Dismiss get started checklist" onClick={() => { if (dKey) localStorage.setItem(dKey, '1'); setDismissed(true); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {data.countErrors.length > 0 && (
                <ErrorState className="m-3" title="Couldn't check some steps" description="Some progress couldn't be loaded." onRetry={data.reload} />
              )}
              <StepList heading={`For ${organization?.name || 'this company'}`} steps={openSteps.filter((s) => s.scope === 'company')} />
              <StepList heading="For your account" note={`Counts your own records, not just ${organization?.name || 'this company'}'s.`} steps={openSteps.filter((s) => s.scope === 'personal')} />
              {doneCount > 0 && (
                <p className="flex items-center gap-1.5 border-t border-border px-5 py-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />Completed steps are hidden.
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default Dashboard;
