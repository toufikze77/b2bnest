import { useCallback, useEffect, useState } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminStatCard from '@/components/admin/AdminStatCard';
import { adminRpc, downloadCsv, formatMoney, logAdminAction } from '@/lib/adminApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Download, Search } from 'lucide-react';

const PAGE_SIZE = 25;
const STATUSES = ['all', 'free', 'trial', 'active', 'cancelled'];

export default function AdminSubscriptions() {
  const { toast } = useToast();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminRpc('admin_overview_stats').then(setStats).catch(() => setStats(null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminRpc<any>('admin_list_subscriptions', { _status: status, _search: search || null, _limit: PAGE_SIZE, _offset: page * PAGE_SIZE });
      setRows(data.rows ?? []);
      setTotal(Number(data.total ?? 0));
    } catch (e: any) {
      toast({ title: 'Failed to load subscriptions', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [status, search, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const exportCsv = async () => {
    const data = await adminRpc<any>('admin_list_subscriptions', { _status: status, _search: search || null, _limit: 5000, _offset: 0 });
    downloadCsv('b2bnest-subscriptions.csv', data.rows ?? []);
    await logAdminAction('export.subscriptions', 'subscribers', null, { count: (data.rows ?? []).length });
  };

  const mrr = Number(stats?.mrr ?? 0);

  return (
    <>
      <AdminPageHeader
        title="Subscription Management"
        description="Synchronised with the existing billing records — no synthetic billing data."
        actions={<Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <AdminStatCard label="Total subscribers" value={Number(stats?.total_subscribers ?? 0).toLocaleString()} />
        <AdminStatCard label="Active" value={Number(stats?.active_subscriptions ?? 0).toLocaleString()} />
        <AdminStatCard label="Trials" value={Number(stats?.trials ?? 0).toLocaleString()} />
        <AdminStatCard label="Free" value={Number(stats?.free_users ?? 0).toLocaleString()} />
        <AdminStatCard label="MRR" value={formatMoney(mrr)} />
        <AdminStatCard label="ARR" value={formatMoney(mrr * 12)} />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search customer email" value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} />
        </div>
        <Select value={status} onValueChange={(v) => { setPage(0); setStatus(v); }}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Renews / ends</TableHead>
              <TableHead>AI credits</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No data</TableCell></TableRow>
            ) : rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.email}</TableCell>
                <TableCell>{s.company || '—'}</TableCell>
                <TableCell>{s.plan || 'free'}</TableCell>
                <TableCell>
                  <Badge variant={s.status === 'active' ? 'default' : s.status === 'cancelled' ? 'destructive' : 'secondary'}>{s.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.subscription_end ? new Date(s.subscription_end).toLocaleDateString() : 'No data'}</TableCell>
                <TableCell className="text-sm">{s.ai_credits_remaining ?? 0}/{s.ai_credits_limit ?? 0}</TableCell>
                <TableCell className="text-right">{formatMoney(Number(s.value ?? 0))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString()} records</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </>
  );
}
