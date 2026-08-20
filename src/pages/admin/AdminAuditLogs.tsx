import { useCallback, useEffect, useState } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { supabase } from '@/integrations/supabase/client';
import { downloadCsv } from '@/lib/adminApi';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Download, Search } from 'lucide-react';

const PAGE_SIZE = 30;

export default function AdminAuditLogs() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any)
      .from('admin_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (search) q = q.or(`action.ilike.%${search}%,admin_email.ilike.%${search}%,target_type.ilike.%${search}%`);
    const { data, error, count } = await q;
    if (error) toast({ title: 'Failed to load audit logs', description: error.message, variant: 'destructive' });
    setRows(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [search, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const exportCsv = async () => {
    const { data } = await (supabase as any)
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);
    downloadCsv('b2bnest-admin-audit-logs.csv', data ?? []);
  };

  return (
    <>
      <AdminPageHeader
        title="Audit Logs"
        description="Append-only record of every administrative action."
        actions={<Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search action, admin, target" value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} />
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No audit entries</TableCell></TableRow>
            ) : rows.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{new Date(l.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-sm">{l.admin_email || '—'}</TableCell>
                <TableCell className="font-medium">{l.action}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.target_type ? `${l.target_type}${l.target_id ? ` · ${String(l.target_id).slice(0, 8)}` : ''}` : '—'}</TableCell>
                <TableCell><Badge variant={l.status === 'success' ? 'outline' : 'destructive'}>{l.status}</Badge></TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{l.details ? JSON.stringify(l.details) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString()} entries</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </>
  );
}
