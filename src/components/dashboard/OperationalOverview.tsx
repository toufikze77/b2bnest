import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckSquare2, CircleDollarSign, FolderKanban, Plus, Receipt, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';

interface ProjectRow { id: string; name: string; status: string; progress: number | null; deadline: string | null }
interface TaskRow { id: string; title: string; status: string; priority: string; due_date: string | null; project_id: string | null }
interface InvoiceRow { id: string; status: string | null; total_amount: number | null; currency: string | null; due_date: string | null }

export function OperationalOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organizationId, organization } = useActiveOrganization();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user || !organizationId) {
        if (active) setLoading(false);
        return;
      }
      setLoading(true);
      const [projectResult, taskResult, invoiceResult] = await Promise.all([
        supabase.from('projects').select('id,name,status,progress,deadline').eq('organization_id', organizationId).is('deleted_at', null).is('archived_at', null),
        supabase.from('todos').select('id,title,status,priority,due_date,project_id').eq('organization_id', organizationId).is('archived_at', null).order('due_date', { ascending: true, nullsFirst: false }).limit(8),
        supabase.from('invoices').select('id,status,total_amount,currency,due_date').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      ]);
      if (!active) return;
      setProjects((projectResult.data || []) as ProjectRow[]);
      setTasks((taskResult.data || []) as TaskRow[]);
      setInvoices((invoiceResult.data || []) as InvoiceRow[]);
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [organizationId, user]);

  const openTasks = tasks.filter((task) => !['done', 'completed'].includes(task.status));
  const overdue = openTasks.filter((task) => task.due_date && new Date(task.due_date) < new Date());
  const openInvoices = invoices.filter((invoice) => invoice.status !== 'paid');
  const pipelineValue = openInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
  const currency = openInvoices[0]?.currency || 'GBP';
  const money = useMemo(() => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }), [currency]);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow={organization?.name || 'Company workspace'}
        title="What needs your attention today?"
        description="A focused view of active work and outstanding company activity."
        actions={<Button onClick={() => navigate('/project-management?create=task')}><Plus className="h-4 w-4" />New task</Button>}
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Active projects', value: projects.filter((project) => project.status === 'active').length, icon: FolderKanban },
            { label: 'Open tasks', value: openTasks.length, icon: CheckSquare2 },
            { label: 'Overdue tasks', value: overdue.length, icon: CalendarDays },
            { label: 'Outstanding invoices', value: money.format(pipelineValue), icon: CircleDollarSign },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="shadow-none">
              <CardContent className="flex items-start justify-between p-4">
                <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p></div>
                <div className="rounded-md bg-muted p-2 text-muted-foreground"><Icon className="h-4 w-4" /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div><h2 className="text-base font-semibold">Priority work</h2><p className="text-xs text-muted-foreground">Open tasks ordered by due date</p></div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/project-management?view=list')}>View all</Button>
          </div>
          {openTasks.length === 0 ? (
            <EmptyState icon={CheckSquare2} title="No open tasks" description="Create the first task for this company to start organising work." action={<Button size="sm" onClick={() => navigate('/project-management?create=task')}>Create task</Button>} className="border-0" />
          ) : (
            <div className="divide-y divide-border">
              {openTasks.slice(0, 5).map((task) => (
                <button key={task.id} onClick={() => navigate(`/project-management?view=list&task=${task.id}`)} className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span>
                  <Badge variant={task.priority === 'urgent' || task.priority === 'high' ? 'warning' : 'neutral'}>{task.priority}</Badge>
                  <span className="hidden text-xs text-muted-foreground sm:block">{task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB') : 'No due date'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border border-border bg-card">
          <div className="border-b border-border px-4 py-3"><h2 className="text-base font-semibold">Company activity</h2><p className="text-xs text-muted-foreground">Live operational totals</p></div>
          <div className="space-y-1 p-2">
            <Button variant="ghost" className="h-12 w-full justify-between" onClick={() => navigate('/project-management')}><span className="flex items-center gap-2"><FolderKanban className="h-4 w-4" />Projects</span><span className="tabular-nums">{projects.length}</span></Button>
            <Button variant="ghost" className="h-12 w-full justify-between" onClick={() => navigate('/business-tools')}><span className="flex items-center gap-2"><Receipt className="h-4 w-4" />Invoices</span><span className="tabular-nums">{invoices.length}</span></Button>
            <Button variant="ghost" className="h-12 w-full justify-between" onClick={() => navigate('/business-overview')}><span className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Business overview</span><span>Open</span></Button>
          </div>
        </div>
      </div>
    </section>
  );
}