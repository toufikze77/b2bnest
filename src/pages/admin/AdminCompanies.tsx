import { useCallback, useEffect, useState } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { adminRpc, downloadCsv, logAdminAction } from '@/lib/adminApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Download, Search } from 'lucide-react';

const PAGE_SIZE = 25;

export default function AdminCompanies() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminRpc<any>('admin_list_companies', { _search: search || null, _limit: PAGE_SIZE, _offset: page * PAGE_SIZE });
      setRows(data.rows ?? []);
      setTotal(Number(data.total ?? 0));
    } catch (e: any) {
      toast({ title: 'Failed to load companies', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const exportCsv = async () => {
    const data = await adminRpc<any>('admin_list_companies', { _search: search || null, _limit: 5000, _offset: 0 });
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

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search company" value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} />
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No data</TableCell></TableRow>
            ) : rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.owner || '—'}</TableCell>
                <TableCell>{c.members ?? 0}</TableCell>
                <TableCell><Badge variant="secondary">{c.plan || 'free'}</Badge></TableCell>
                <TableCell>{c.projects ?? 0}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.last_activity ? new Date(c.last_activity).toLocaleDateString() : 'No data'}</TableCell>
                <TableCell>{c.is_active ? <Badge variant="outline" className="text-emerald-500">Active</Badge> : <Badge variant="destructive">Inactive</Badge>}</TableCell>
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
    </>
  );
}
