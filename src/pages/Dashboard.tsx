import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlarmClock, Building2, CalendarDays, CheckCircle2, Circle, FileText, FolderKanban, FolderPlus, LayoutTemplate, ListTodo,
  Plus, Receipt, SlidersHorizontal, UserRound, Users, X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  ActivationStep, ADMIN_ROLES, buildActivationSteps, dismissKey, hasRole, projectDeadlines, ROTA_ROLES, summarizeProjects,
} from '@/lib/dashboardData';
import { DashboardLayout, loadLayout, saveLayout, WidgetId, widgetById } from '@/lib/dashboardLayout';
import { PageContainer } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/states';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ComingUpWidget, ProjectsWidget, RecentWidget, TasksWidget, WorkspacesWidget } from '@/components/dashboard/WorkWidgets';
import { CustomersWidget, ExpensesWidget, MoneyWidget, PipelineWidget, RotaWidget, SupportWidget } from '@/components/dashboard/DataWidgets';
import { CustomisePanel } from '@/components/dashboard/CustomisePanel';
import { textLink } from '@/components/dashboard/WidgetCard';

function Stat({ label, value, icon: Icon, tone, href, hint }: { label: string; value: number | null; icon: typeof ListTodo; tone: 'primary' | 'danger' | 'success'; href: string; hint: string }) {
  const toneCls = { primary: 'bg-primary/10 text-link', danger: 'bg-destructive/10 text-destructive', success: 'bg-success/10 text-success' }[tone];
  return (
    <Link to={href} className="group rounded-card border border-border bg-card p-4 shadow-[0_4px_16px_rgba(0,26,76,0.08)] transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2">
      <div className="flex items-center justify-between">
        <p className="text-small font-semibold text-muted-foreground">{label}</p>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-control', toneCls)}><Icon className="h-4 w-4" aria-hidden="true" /></span>
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">{value === null ? '—' : value.toLocaleString()}</p>
      <p className="mt-1 text-small text-muted-foreground">{value === null ? 'Unavailable' : hint}</p>
    </Link>
  );
}

function StepList({ heading, note, steps }: { heading: string; note?: string; steps: ActivationStep[] }) {
  if (steps.length === 0) return null;
  return (
    <div>
      <div className="border-b border-border bg-muted px-5 py-2">
        <h3 className="text-small font-bold uppercase tracking-wide text-muted-foreground">{heading}</h3>
        {note && <p className="text-small text-muted-foreground">{note}</p>}
      </div>
      <ul className="divide-y divide-border border-b border-border last:border-b-0">
        {steps.map((s) => (
          <li key={s.id} className="flex items-start gap-3 px-5 py-3">
            <Circle className={`mt-0.5 h-4 w-4 ${s.state === 'unknown' ? 'text-muted-foreground' : 'text-primary'}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{s.title}</p>
              <p className="text-small text-muted-foreground">{s.description}</p>
            </div>
            <Button size="sm" variant="outline" asChild><Link to={s.href}>{s.actionLabel}</Link></Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Buttons on the navy band: white text, focus ring offset against navy. */
const onNavy = 'min-h-touch focus-visible:ring-offset-brand-navy';

const Dashboard = () => {
  const { user } = useAuth();
  const { organizationId, organization, loading: orgLoading } = useActiveOrganization();
  const data = useDashboardData(user?.id, organizationId);
  const role = organization?.role ?? null;
  const groups = data.groups;
  const companyName = organization?.name || 'this company';
  const canManageProjects = hasRole(role, [...ADMIN_ROLES, 'manager']);

  const dKey = user && organizationId ? dismissKey(user.id, organizationId) : null;
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try { setDismissed(dKey ? localStorage.getItem(dKey) === '1' : false); } catch { setDismissed(false); }
  }, [dKey]);
  const steps = buildActivationSteps(data.counts, role);
  const openSteps = steps.filter((s) => s.state !== 'done');
  const doneCount = steps.length - openSteps.length;
  const showChecklist = !data.loading && !dismissed && openSteps.length > 0;

  // Per-person layout, stored on this device for this user and company.
  // Read synchronously so switched-off widgets never mount (or query) first.
  const layoutScope = `${user?.id ?? ''}:${organizationId ?? ''}`;
  const [stored, setStored] = useState(() => ({ scope: layoutScope, layout: loadLayout(user?.id, organizationId) }));
  const layout = stored.scope === layoutScope ? stored.layout : loadLayout(user?.id, organizationId);
  useEffect(() => {
    setStored((s) => (s.scope === layoutScope ? s : { scope: layoutScope, layout: loadLayout(user?.id, organizationId) }));
  }, [layoutScope, user?.id, organizationId]);
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const customiseBtn = useRef<HTMLButtonElement>(null);
  const save = (next: DashboardLayout) => {
    setStored({ scope: layoutScope, layout: next });
    setCustomiseOpen(false);
    if (saveLayout(user?.id, organizationId, next)) toast.success('Dashboard layout saved');
    else toast.warning("Your layout is showing now but couldn't be saved on this device.");
  };

  const { projects, workspaces } = useMemo(() => summarizeProjects(data.activeProjects, data.progressTasks), [data.activeProjects, data.progressTasks]);
  const deadlines = useMemo(() => projectDeadlines(data.activeProjects), [data.activeProjects]);
  const projectName = useMemo(() => new Map(data.activeProjects.map((p) => [p.id, p.name])), [data.activeProjects]);

  const quickAdd = [
    { label: 'New task', to: '/project-management?create=task', icon: FileText },
    { label: 'New project', to: '/project-management?create=project', icon: FolderPlus },
    { label: 'Calendar event', to: '/project-management?create=event&view=calendar', icon: CalendarDays },
    { label: 'Use a template', to: '/template-center', icon: LayoutTemplate },
    { label: 'Contact or deal', to: '/crm', icon: Users },
    { label: 'Invoice or quote', to: '/business-tools?tool=business-finance-assistant&tab=invoices', icon: Receipt },
    ...(hasRole(role, ROTA_ROLES) ? [{ label: 'Plan the rota', to: '/rota/schedule', icon: Users }] : []),
  ];

  if (!orgLoading && !organizationId) {
    return (
      <PageContainer width="full" className="space-y-6">
        <h1 className="text-page-title">Dashboard</h1>
        <EmptyState icon={Building2} title="Choose a company" description="Pick a company from the drop-down at the top of the page to see its work." />
      </PageContainer>
    );
  }

  const scope = user && organizationId ? { userId: user.id, orgId: organizationId } : null;
  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const renderWidget = (id: WidgetId): ReactNode => {
    switch (id) {
      case 'tasks': return <TasksWidget loading={data.loading} error={data.tasksError} groups={groups} projectName={projectName} onRetry={data.reload} />;
      case 'projects': return <ProjectsWidget loading={data.loading} error={data.projectsError} projects={projects} companyName={companyName} onRetry={data.reload} />;
      case 'comingUp': return <ComingUpWidget loading={data.loading} error={data.projectsError} deadlines={deadlines} activeProjects={data.activeProjects} canManage={canManageProjects} />;
      case 'workspaces': return <WorkspacesWidget loading={data.loading} error={data.projectsError} workspaces={workspaces} />;
      case 'recent': return <RecentWidget loading={data.loading} error={data.recentError} recent={data.recent} projectName={projectName} onRetry={data.reload} />;
      default:
        if (!scope) return null;
        switch (id) {
          case 'customers': return <CustomersWidget scope={scope} />;
          case 'pipeline': return <PipelineWidget scope={scope} />;
          case 'support': return <SupportWidget scope={scope} />;
          case 'money': return <MoneyWidget scope={scope} />;
          case 'expenses': return <ExpensesWidget scope={scope} />;
          case 'rota': return <RotaWidget scope={scope} />;
          default: return null;
        }
    }
  };

  return (
    <div className="min-w-0">
      {/* Navy header band */}
      <div className="bg-brand-navy text-brand-navy-foreground">
        <div className="mx-auto w-full max-w-[1760px] px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-small font-semibold text-brand-navy-muted"><Building2 className="h-4 w-4" aria-hidden="true" />{organization?.name || 'Company'}</p>
              <h1 className="mt-1 text-page-title text-white">Dashboard</h1>
              <p className="mt-1 text-body text-brand-navy-muted">{todayLabel} · today at a glance for {companyName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button ref={customiseBtn} variant="outline" className={cn(onNavy, 'border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white')} onClick={() => setCustomiseOpen(true)}>
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Customise dashboard
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button className={onNavy}><Plus className="h-4 w-4" aria-hidden="true" />Quick add</Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-60 rounded-card p-1">
                  <nav aria-label="Quick add">
                    <ul>
                      {quickAdd.map(({ label, to, icon: Icon }) => (
                        <li key={label}>
                          <Link to={to} className="flex min-h-touch items-center gap-2 rounded-control px-3 text-body font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      <PageContainer width="full" className="-mt-16 space-y-6 pt-0">
        {/* Summary row — selected company only */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Company summary">
          <Stat label="Active projects" value={data.loading ? null : data.summary.activeProjects} icon={FolderKanban} tone="primary" href="/project-management" hint="Not completed or cancelled" />
          <Stat label="Open tasks" value={data.loading ? null : data.summary.openTasks} icon={ListTodo} tone="primary" href="/project-management?view=list" hint="Across all projects" />
          <Stat label="Overdue tasks" value={data.loading || data.tasksError ? null : groups.overdue.total} icon={AlarmClock} tone="danger" href="/project-management?view=list" hint="Past their due date" />
          <Stat label="Due in next 7 days" value={data.loading || data.tasksError ? null : groups.upcoming.total} icon={CalendarDays} tone="success" href="/project-management?view=calendar" hint="Open tasks, after today" />
        </div>

        {showChecklist && (
          <section aria-labelledby="get-started" className="overflow-hidden rounded-card border border-border bg-card">
            <div className="flex items-start justify-between border-b border-border px-5 py-3">
              <div>
                <h2 id="get-started" className="text-card-title">Get started</h2>
                <p className="text-small text-muted-foreground">{doneCount} of {steps.length} done</p>
              </div>
              <Button variant="ghost" size="icon" className="min-h-touch min-w-touch" aria-label="Dismiss get started checklist" onClick={() => { try { if (dKey) localStorage.setItem(dKey, '1'); } catch { /* not stored; hidden for now */ } setDismissed(true); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {data.countErrors.length > 0 && (
              <ErrorState className="m-3 rounded-control" title="Couldn't check some steps" description="Some progress couldn't be loaded." onRetry={data.reload} />
            )}
            <StepList heading={`For ${organization?.name || 'this company'}`} steps={openSteps.filter((s) => s.scope === 'company')} />
            <StepList heading="For your account" note={`Counts your own records, not just ${organization?.name || 'this company'}'s.`} steps={openSteps.filter((s) => s.scope === 'personal')} />
            {doneCount > 0 && (
              <p className="flex items-center gap-1.5 border-t border-border px-5 py-2 text-small text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />Completed steps are hidden.
              </p>
            )}
          </section>
        )}

        {layout.widgets.length === 0 ? (
          <EmptyState icon={SlidersHorizontal} className="rounded-card bg-card" title="All widgets are switched off" description="Choose what to show on your dashboard."
            action={<Button onClick={() => setCustomiseOpen(true)}>Customise dashboard</Button>} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {layout.widgets.map((id) => (
              <div key={id} className={cn('min-w-0', widgetById(id).wide && 'lg:col-span-2')}>{renderWidget(id)}</div>
            ))}
          </div>
        )}

        {/* Personal records — kept visibly separate from company data */}
        <section aria-labelledby="your-records" className="rounded-card border border-dashed border-border p-4">
          <h2 id="your-records" className="flex items-center gap-2 font-bold"><UserRound className="h-4 w-4" aria-hidden="true" />Your records</h2>
          <p className="mt-0.5 text-small text-muted-foreground">Contacts, deals, invoices, bills and expenses belong to your account, not only to {companyName}.</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/crm" className={cn(textLink, 'inline-flex min-h-touch items-center gap-1.5 sm:min-h-0')}><Users className="h-4 w-4" aria-hidden="true" />Open CRM</Link>
            <Link to="/business-tools?tool=business-finance-assistant&tab=invoices" className={cn(textLink, 'inline-flex min-h-touch items-center gap-1.5 sm:min-h-0')}><Receipt className="h-4 w-4" aria-hidden="true" />Open invoices</Link>
          </div>
        </section>
      </PageContainer>

      <CustomisePanel open={customiseOpen} onOpenChange={setCustomiseOpen} layout={layout} onSave={save} returnFocusRef={customiseBtn} />
    </div>
  );
};

export default Dashboard;
