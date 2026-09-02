import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { adminRpc, downloadCsv, logAdminAction } from '@/lib/adminApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Download, Search } from 'lucide-react';

const PAGE_SIZE = 25;
const STATUSES = ['all', 'active', 'trial', 'suspended', 'cancelled'];
const PLANS = ['all', 'starter', 'professional', 'enterprise', 'free'];

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return <Badge variant="outline" className="text-emerald-500">Active</Badge>;
  if (status === 'trial') return <Badge variant="outline" className="text-amber-500">Trial</Badge>;
  if (status === 'suspended') return <Badge variant="destructive">Suspended</Badge>;
  return <Badge variant="secondary">Cancelled</Badge>;
}

export default function AdminCompanies() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [plan, setPlan] = useState('all');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<{ company: any; suspend: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminRpc<any>('admin_list_companies', {
        _search: search || null, _limit: PAGE_SIZE, _offset: page * PAGE_SIZE, _status: status, _plan: plan,
      });
      setRows(data.rows ?? []);
      setTotal(Number(data.total ?? 0));
    } catch (e: any) {
      toast({ title: 'Failed to load companies', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search, status, plan, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const applyStatus = async () => {
    if (!pending) return;
    try {
      await adminRpc('admin_set_company_status', {
        _org_id: pending.company.id,
        _status: pending.suspend ? 'suspended' : 'active',
        _reason: null,
      });
      toast({ title: pending.suspend ? 'Company suspended' : 'Company reactivated' });
      setPending(null);
      load();
    } catch (e: any) {
      toast({ title: 'Action failed', description: e.message, variant: 'destructive' });
    }
  };

  const exportCsv = async () => {
    const data = await adminRpc<any>('admin_list_companies', { _search: search || null, _limit: 5000, _offset: 0, _status: status, _plan: plan });
    downloadCsv('b2bnest-companies.csv', data.rows ?? []);
    await logAdminAction('export.companies', 'organizations', null, { count: (data.rows ?? []).length });
  };

  return (
    <>
      <AdminPageHeader
        title="Companies & Organisations"
        description="Tenant-level overview. Private company content stays inside each tenant."
        actions={<Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search company, owner or email" value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} />
        </div>
        <Select value={status} onValueChange={(v) => { setPage(0); setStatus(v); }}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={plan} onValueChange={(v) => { setPage(0); setPlan(v); }}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>{PLANS.map((p) => <SelectItem key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No data</TableCell></TableRow>
            ) : rows.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/admin/companies/${c.id}`)}>
                <TableCell>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.id}</div>
                </TableCell>
                <TableCell>
                  <div>{c.owner || '—'}</div>
                  <div className="text-xs text-muted-foreground">{c.owner_email || ''}</div>
                </TableCell>
                <TableCell>{c.members ?? 0}</TableCell>
                <TableCell><Badge variant="secondary">{c.subscription_plan || c.plan || 'free'}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.subscribed ? `Renews ${c.renewal_date ? new Date(c.renewal_date).toLocaleDateString() : '—'}` : c.status === 'trial' ? 'Trial' : 'No paid plan'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.last_activity ? new Date(c.last_activity).toLocaleDateString() : 'No data'}</TableCell>
                <TableCell><StatusBadge status={c.status || 'active'} /></TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/companies/${c.id}`)}>View</Button>
                    <Button
                      size="sm"
                      variant={c.status === 'suspended' ? 'default' : 'outline'}
                      onClick={() => setPending({ company: c, suspend: c.status !== 'suspended' })}
                    >
                      {c.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString()} companies</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.suspend ? 'Suspend this company?' : 'Reactivate this company?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.suspend
                ? 'The company is marked suspended. No customer data is deleted and the action can be reversed.'
                : 'The company returns to active status.'}
              {' '}This action is recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyStatus}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
