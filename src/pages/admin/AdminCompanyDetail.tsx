import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { adminRpc, formatBytes, formatMoney } from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

const NOT_TRACKED = 'Not currently tracked';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'text-emerald-500',
    trial: 'text-amber-500',
    suspended: 'text-destructive',
    cancelled: 'text-muted-foreground',
  };
  return <Badge variant="outline" className={map[status] ?? ''}>{status}</Badge>;
}

function UsageRow({ label, used, limit }: { label: string; used: number | null; limit?: number | null }) {
  if (used === null || used === undefined) {
    return (
      <div className="flex items-center justify-between border-b border-border/50 py-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground italic">{NOT_TRACKED}</span>
      </div>
    );
  }
  const hasLimit = typeof limit === 'number' && limit > 0;
  return (
    <div className="border-b border-border/50 py-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {used.toLocaleString()}
          {hasLimit ? ` / ${limit!.toLocaleString()}` : ' / no plan limit'}
        </span>
      </div>
      {hasLimit && <Progress value={Math.min(100, (used / limit!) * 100)} className="mt-2 h-1.5" />}
    </div>
  );
}

export default function AdminCompanyDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await adminRpc<any>('admin_company_detail', { _org_id: id }));
    } catch (e: any) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (status: string) => {
    setBusy(true);
    try {
      await adminRpc('admin_set_company_status', { _org_id: id, _status: status, _reason: null });
      toast({ title: `Company marked ${status}` });
      await load();
    } catch (e: any) {
      toast({ title: 'Action failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const c = data.company ?? {};
  const sub = data.subscription ?? {};
  const plan = data.plan;
  const usage = data.usage ?? {};
  const suspended = c.status === 'suspended' || c.is_active === false;

  return (
    <>
      <AdminPageHeader
        title={c.name || 'Company'}
        description={`Company ID ${c.id ?? '—'} · Owner ${c.owner_name || c.owner_email || '—'}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/admin/companies"><ArrowLeft className="mr-2 h-4 w-4" /> Companies</Link></Button>
            {suspended ? (
              <Button size="sm" disabled={busy} onClick={() => setStatus('active')}>Reactivate</Button>
            ) : (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('suspended')}>Suspend</Button>
            )}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Status', statusBadge(suspended ? 'suspended' : c.status || 'active')],
          ['Users', (usage.users ?? 0).toLocaleString()],
          ['Plan', plan?.name || c.plan_key || 'free'],
          ['Registered', c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent className="text-lg font-semibold">{value as any}</CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap">
          {['overview', 'users', 'subscription', 'usage', 'activity', 'security'].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <Card><CardContent className="pt-6">
            <dl className="space-y-2 text-sm">
              {[
                ['Company name', c.name || '—'],
                ['Company ID', c.id || '—'],
                ['Slug', c.slug || '—'],
                ['Description', c.description || '—'],
                ['Owner', `${c.owner_name || '—'}${c.owner_email ? ` (${c.owner_email})` : ''}`],
                ['Registered', c.created_at ? new Date(c.created_at).toLocaleString() : '—'],
                ['Suspended at', c.suspended_at ? new Date(c.suspended_at).toLocaleString() : '—'],
                ['Suspension reason', c.suspension_reason || '—'],
                ['Projects', (usage.projects ?? 0).toLocaleString()],
                ['CRM records', `${(usage.crm_contacts ?? 0).toLocaleString()} contacts · ${(usage.crm_deals ?? 0).toLocaleString()} deals`],
                ['Invoices', `${(usage.invoices ?? 0).toLocaleString()} (${formatMoney(usage.invoice_total)})`],
                ['Storage', formatBytes(usage.storage_bytes)],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-4 border-b border-border/50 pb-2">
                  <dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v as string}</dd>
                </div>
              ))}
            </dl>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>User</TableHead><TableHead>Company role</TableHead>
                <TableHead>Joined</TableHead><TableHead>Last login</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(data.users ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No users</TableCell></TableRow>
                ) : data.users.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell><div className="font-medium">{u.name || '—'}</div><div className="text-xs text-muted-foreground">{u.email}</div></TableCell>
                    <TableCell><Badge variant="secondary">{u.company_role}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.joined_at ? new Date(u.joined_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</TableCell>
                    <TableCell>{u.is_active ? <Badge variant="outline" className="text-emerald-500">Active</Badge> : <Badge variant="destructive">Suspended</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="subscription">
          <Card><CardContent className="pt-6">
            <dl className="space-y-2 text-sm">
              {[
                ['Plan', plan?.name || sub.subscription_tier || 'Free'],
                ['Monthly price', plan ? formatMoney(plan.monthly_price, plan.currency || 'GBP') : NOT_TRACKED],
                ['Annual price', plan?.annual_price ? formatMoney(plan.annual_price, plan.currency || 'GBP') : NOT_TRACKED],
                ['Billing interval', sub.subscribed ? 'Monthly' : NOT_TRACKED],
                ['Subscription status', sub.subscribed ? 'Active' : sub.is_trial_active ? 'Trial' : 'Free'],
                ['Trial status', sub.is_trial_active ? `Trial until ${sub.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString() : '—'}` : 'Not on trial'],
                ['Renewal date', sub.renewal_date ? new Date(sub.renewal_date).toLocaleDateString() : '—'],
                ['Cancellation', c.status === 'cancelled' ? 'Cancelled' : 'Not cancelled'],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-4 border-b border-border/50 pb-2">
                  <dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v as string}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('cancelled')}>Mark cancelled</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('trial')}>Mark trial</Button>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="usage">
          <Card><CardContent className="pt-6">
            <UsageRow label="Users" used={usage.users ?? 0} limit={plan?.member_limit} />
            <UsageRow label="Projects" used={usage.projects ?? 0} limit={plan?.project_limit} />
            <UsageRow label="AI credits used" used={
              sub.ai_credits_limit != null && sub.ai_credits_remaining != null
                ? Number(sub.ai_credits_limit) - Number(sub.ai_credits_remaining) : null
            } limit={sub.ai_credits_limit} />
            <UsageRow label="Documents" used={usage.documents ?? 0} limit={plan?.document_limit} />
            <div className="flex items-center justify-between border-b border-border/50 py-2 text-sm">
              <span className="text-muted-foreground">Storage used</span>
              <span className="font-medium">{formatBytes(usage.storage_bytes)}{plan?.storage_limit_mb ? ` / ${plan.storage_limit_mb} MB` : ' / no plan limit'}</span>
            </div>
            <UsageRow label="CRM contacts" used={usage.crm_contacts ?? 0} />
            <UsageRow label="CRM deals" used={usage.crm_deals ?? 0} />
            <UsageRow label="Invoices" used={usage.invoices ?? 0} />
            <UsageRow label="Quotes" used={usage.quotes ?? 0} />
            <UsageRow label="Tasks" used={usage.tasks ?? 0} />
            <UsageRow label="AI conversations" used={usage.ai_conversations ?? 0} />
            <UsageRow label="AI workflows" used={usage.ai_workflows ?? 0} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card><CardContent className="space-y-3 pt-6 text-sm">
            {(data.activity ?? []).length === 0 && (data.admin_actions ?? []).length === 0 ? (
              <p className="text-muted-foreground">No recorded activity.</p>
            ) : (
              <>
                {(data.activity ?? []).map((a: any, i: number) => (
                  <div key={`a${i}`} className="flex justify-between gap-4 border-b border-border/50 pb-2">
                    <span>{a.action} · <span className="text-muted-foreground">{a.project_name}</span></span>
                    <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                ))}
                {(data.admin_actions ?? []).map((a: any, i: number) => (
                  <div key={`b${i}`} className="flex justify-between gap-4 border-b border-border/50 pb-2">
                    <span>Admin: {a.action} <span className="text-muted-foreground">by {a.admin_email}</span></span>
                    <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="security">
          <Card><CardContent className="space-y-3 pt-6 text-sm">
            {(data.security ?? []).length === 0 ? (
              <p className="text-muted-foreground">No security events recorded for this company.</p>
            ) : data.security.map((s: any, i: number) => (
              <div key={i} className="flex justify-between gap-4 border-b border-border/50 pb-2">
                <span>{s.event_type}</span>
                <span className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              Passwords, API secrets, payment secrets and keys are never exposed in this console.
            </p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
