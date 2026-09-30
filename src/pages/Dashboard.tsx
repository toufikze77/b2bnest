import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlarmClock, Building2, CalendarClock, CalendarDays, CheckCircle2, CheckSquare2, Circle, FolderPlus,
  LayoutTemplate, Plus, Receipt, UserPlus, Users, X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  buildActivationSteps, classifyTasks, DashTask, dismissKey, hasRole, isoDay, ROTA_ROLES, taskHref,
} from '@/lib/dashboardData';
import { PageContainer } from '@/components/ui/page-container';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState, LoadingRows } from '@/components/ui/states';

const fmtDate = (d: string) => new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function TaskGroup({ title, icon: Icon, tasks, tone }: { title: string; icon: typeof AlarmClock; tasks: DashTask[]; tone: 'danger' | 'warning' | 'neutral' }) {
  if (tasks.length === 0) return null;
  const headingId = `attn-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="flex items-center gap-2 px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />{title}
        <Badge variant={tone === 'danger' ? 'destructive' : tone === 'warning' ? 'warning' : 'neutral'} className="ml-1">{tasks.length}</Badge>
      </h3>
      <ul className="divide-y divide-border">
        {tasks.slice(0, 5).map((t) => (
          <li key={t.id}>
            <Link to={taskHref(t)} className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{t.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(t.due_date!)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {tasks.length > 5 && <p className="px-4 pb-2 pt-1 text-xs text-muted-foreground">+{tasks.length - 5} more in Projects &amp; tasks</p>}
    </section>
  );
}

const Dashboard = () => {
  const { user } = useAuth();
  const { organizationId, organization, loading: orgLoading } = useActiveOrganization();
  const data = useDashboardData(user?.id, organizationId);
  const role = organization?.role ?? null;
  const today = isoDay(new Date());
  const groups = useMemo(() => classifyTasks(data.tasks, today), [data.tasks, today]);
  const attentionCount = groups.overdue.length + groups.dueToday.length + groups.upcoming.length;

  const dKey = user && organizationId ? dismissKey(user.id, organizationId) : null;
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { setDismissed(dKey ? localStorage.getItem(dKey) === '1' : false); }, [dKey]);
  const steps = buildActivationSteps(data.counts, role);
  const openSteps = steps.filter((s) => s.state !== 'done');
  const doneCount = steps.length - openSteps.length;
  const showChecklist = !data.loading && !dismissed && openSteps.length > 0;

  const quickActions = [
    { label: 'New task', to: '/project-management?create=task', icon: Plus },
    { label: 'New project', to: '/project-management?create=project', icon: FolderPlus },
    { label: 'Use a template', to: '/template-center', icon: LayoutTemplate },
    { label: 'Add contact', to: '/crm', icon: UserPlus },
    { label: 'New invoice', to: '/business-tools?tool=business-finance-assistant&tab=invoices', icon: Receipt },
    ...(hasRole(role, ROTA_ROLES) ? [{ label: 'Plan the rota', to: '/rota/schedule', icon: Users }] : []),
  ];

  if (!orgLoading && !organizationId) {
    return (
      <PageContainer>
        <PageHeader title="Dashboard" description="Your company's work at a glance." />
        <EmptyState icon={Building2} title="Choose a company" description="Pick a company from the drop-down at the top of the page to see its work." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" aria-hidden="true" />{organization?.name || 'Company'}</span>}
        title="Today at a glance"
        description={`Work that needs attention in ${organization?.name || 'this company'}.`}
        actions={<Button asChild><Link to="/project-management?create=task"><Plus className="h-4 w-4" aria-hidden="true" />New task</Link></Button>}
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Needs attention — first on every screen size */}
        <section aria-labelledby="needs-attention" className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 id="needs-attention" className="text-base font-semibold">Needs attention</h2>
              <p className="text-xs text-muted-foreground">Open tasks overdue, due today and due in the next 7 days</p>
            </div>
            <Button variant="ghost" size="sm" asChild><Link to="/project-management?view=list">All tasks</Link></Button>
          </div>
          {data.loading ? (
            <LoadingRows rows={4} label="Loading tasks that need attention" />
          ) : data.tasksError ? (
            <ErrorState className="m-4" title="Couldn't load tasks" description="This is a loading problem, not an empty list." onRetry={data.reload} />
          ) : attentionCount === 0 ? (
            <EmptyState icon={CheckSquare2} className="border-0" title="Nothing needs attention" description="No open tasks are overdue or due in the next 7 days." action={<Button size="sm" asChild><Link to="/project-management?create=task">Create task</Link></Button>} />
          ) : (
            <div className="pb-2">
              <TaskGroup title="Overdue" icon={AlarmClock} tasks={groups.overdue} tone="danger" />
              <TaskGroup title="Due today" icon={CalendarClock} tasks={groups.dueToday} tone="warning" />
              <TaskGroup title="Upcoming" icon={CalendarDays} tasks={groups.upcoming} tone="neutral" />
            </div>
          )}
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Invoices aren't linked to a company yet, so overdue invoices aren't listed here.</p>
        </section>

        <div className="space-y-6">
          <section aria-labelledby="quick-actions" className="border border-border bg-card">
            <h2 id="quick-actions" className="border-b border-border px-4 py-3 text-base font-semibold">Quick actions</h2>
            <div className="grid grid-cols-2 gap-2 p-3">
              {quickActions.map(({ label, to, icon: Icon }) => (
                <Button key={label} variant="outline" className="h-11 justify-start" asChild>
                  <Link to={to}><Icon className="h-4 w-4" aria-hidden="true" />{label}</Link>
                </Button>
              ))}
            </div>
          </section>

          {showChecklist && (
            <section aria-labelledby="get-started" className="border border-border bg-card">
              <div className="flex items-start justify-between border-b border-border px-4 py-3">
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
              <ul className="divide-y divide-border">
                {openSteps.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 px-4 py-3">
                    {s.state === 'unknown' ? <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <Circle className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild><Link to={s.href}>{s.actionLabel}</Link></Button>
                  </li>
                ))}
              </ul>
              {doneCount > 0 && (
                <p className="flex items-center gap-1.5 border-t border-border px-4 py-2 text-xs text-muted-foreground">
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
