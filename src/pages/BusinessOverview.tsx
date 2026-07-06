import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, FileText, Receipt, FolderKanban, CheckSquare, Users, DollarSign, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Footer from '@/components/Footer';
import SEOHead from '@/components/SEOHead';

interface OrgInfo {
  id: string;
  name: string;
  memberIds: string[];
}

interface Overview {
  revenue: number;
  pendingInvoices: number;
  pendingInvoicesCount: number;
  expensesTotal: number;
  billsDue: number;
  billsDueCount: number;
  activeProjects: number;
  openTasks: number;
  overdueTasks: number;
  crmContacts: number;
  pipelineValue: number;
  dealsCount: number;
  currency: string;
}

const fmt = (n: number, c = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n || 0);

const BusinessOverview: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      // Ensure the user has an org and get it
      const { data: orgId } = await supabase.rpc('ensure_user_has_org', { p_user_id: user!.id });
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', orgId as string)
        .maybeSingle();
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', orgId as string)
        .eq('is_active', true);

      const memberIds = (members || []).map((m: any) => m.user_id);
      const orgInfo: OrgInfo = { id: orgId as string, name: orgRow?.name || 'Your Organization', memberIds };
      setOrg(orgInfo);

      // Per-user finance data (RLS scopes to current user only)
      const [invRes, expRes, billRes, dealRes, contRes, projRes, taskRes] = await Promise.all([
        supabase.from('invoices').select('status,total_amount,currency'),
        supabase.from('expenses').select('amount,status'),
        supabase.from('bills').select('status,amount,due_date,currency'),
        supabase.from('crm_deals').select('value,stage,currency'),
        supabase.from('crm_contacts').select('id', { count: 'exact', head: true }),
        supabase
          .from('projects')
          .select('id,status,archived_at,deleted_at')
          .eq('organization_id', orgInfo.id)
          .is('archived_at', null)
          .is('deleted_at', null),
        supabase
          .from('todos')
          .select('id,status,due_date,archived_at')
          .eq('organization_id', orgInfo.id)
          .is('archived_at', null),
      ]);

      const invoices = invRes.data || [];
      const expenses = expRes.data || [];
      const bills = billRes.data || [];
      const deals = dealRes.data || [];
      const projects = projRes.data || [];
      const tasks = taskRes.data || [];

      const revenue = invoices
        .filter((i: any) => i.status === 'paid')
        .reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
      const pendingInvoicesArr = invoices.filter((i: any) => i.status !== 'paid' && i.status !== 'cancelled');
      const pendingInvoices = pendingInvoicesArr.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);

      const expensesTotal = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

      const dueBills = bills.filter((b: any) => b.status !== 'paid');
      const billsDue = dueBills.reduce((s: number, b: any) => s + Number(b.amount || 0), 0);

      const openPipelineStages = ['lead', 'qualified', 'proposal', 'negotiation'];
      const pipelineValue = deals
        .filter((d: any) => openPipelineStages.includes((d.stage || '').toLowerCase()))
        .reduce((s: number, d: any) => s + Number(d.value || 0), 0);

      const now = new Date();
      const openTasks = tasks.filter((t: any) => t.status !== 'done' && t.status !== 'completed').length;
      const overdueTasks = tasks.filter(
        (t: any) =>
          t.status !== 'done' &&
          t.status !== 'completed' &&
          t.due_date &&
          new Date(t.due_date) < now
      ).length;

      const currency = (invoices[0] as any)?.currency || 'GBP';

      setData({
        revenue,
        pendingInvoices,
        pendingInvoicesCount: pendingInvoicesArr.length,
        expensesTotal,
        billsDue,
        billsDueCount: dueBills.length,
        activeProjects: projects.length,
        openTasks,
        overdueTasks,
        crmContacts: contRes.count || 0,
        pipelineValue,
        dealsCount: deals.length,
        currency,
      });
    } catch (e) {
      console.error('Overview load error', e);
    } finally {
      setLoading(false);
    }
  };

  const stats = data
    ? [
        { label: 'Revenue (paid)', value: fmt(data.revenue, data.currency), icon: TrendingUp, tone: 'text-green-600', to: '/dashboard' },
        { label: 'Pending invoices', value: fmt(data.pendingInvoices, data.currency), sub: `${data.pendingInvoicesCount} open`, icon: FileText, tone: 'text-blue-600', to: '/dashboard' },
        { label: 'Expenses', value: fmt(data.expensesTotal, data.currency), icon: TrendingDown, tone: 'text-rose-600', to: '/dashboard' },
        { label: 'Bills to pay', value: fmt(data.billsDue, data.currency), sub: `${data.billsDueCount} open`, icon: Receipt, tone: 'text-amber-600', to: '/dashboard' },
        { label: 'Pipeline value', value: fmt(data.pipelineValue, data.currency), sub: `${data.dealsCount} deals`, icon: DollarSign, tone: 'text-purple-600', to: '/crm' },
        { label: 'CRM contacts', value: String(data.crmContacts), icon: Users, tone: 'text-indigo-600', to: '/crm' },
        { label: 'Active projects', value: String(data.activeProjects), icon: FolderKanban, tone: 'text-cyan-600', to: '/business-tools/project-management' },
        { label: 'Open tasks', value: String(data.openTasks), sub: data.overdueTasks ? `${data.overdueTasks} overdue` : 'on track', icon: CheckSquare, tone: data.overdueTasks ? 'text-red-600' : 'text-slate-700', to: '/business-tools/project-management' },
      ]
    : [];

  const netCash = data ? data.revenue - data.expensesTotal - data.billsDue : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <SEOHead title="Business Overview | B2BNest" description="Unified overview of revenue, expenses, projects, tasks and CRM across your organization." canonicalUrl="https://b2bnest.online/business-overview" />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => navigate(-1)} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Business Overview</h1>
            <p className="text-gray-600">
              Unified view across {org?.name || 'your organization'} · {org?.memberIds.length || 1} member(s)
            </p>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Multi-tenant · private to your org
          </Badge>
        </div>

        {/* Net cash banner */}
        <Card className="mb-6 border-l-4 border-l-primary">
          <CardContent className="py-5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Wallet className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Net position (revenue − expenses − bills due)</p>
                {loading ? (
                  <Skeleton className="h-8 w-40 mt-1" />
                ) : (
                  <p className={`text-3xl font-bold ${netCash >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {fmt(netCash, data?.currency)}
                  </p>
                )}
              </div>
            </div>
            {data && data.overdueTasks > 0 && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-2 rounded-md">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{data.overdueTasks} overdue task{data.overdueTasks > 1 ? 's' : ''} need attention</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}><CardContent className="p-5"><Skeleton className="h-20" /></CardContent></Card>
              ))
            : stats.map((s) => {
                const Icon = s.icon;
                return (
                  <Card
                    key={s.label}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(s.to)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm text-muted-foreground">{s.label}</span>
                        <Icon className={`w-5 h-5 ${s.tone}`} />
                      </div>
                      <div className="text-2xl font-bold">{s.value}</div>
                      {s.sub && <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>}
                    </CardContent>
                  </Card>
                );
              })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data scoping</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• <strong>Shared org-wide:</strong> Projects, Tasks (visible to all members of {org?.name || 'your organization'}).</p>
            <p>• <strong>Per user:</strong> Invoices, Quotes, Bills, Expenses, CRM contacts &amp; deals are private to each member by design (RLS).</p>
            <p>• Tenants are isolated at the database layer — no other organization can access your data.</p>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default BusinessOverview;
