import { useCallback, useEffect, useState } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { adminRpc, downloadCsv, logAdminAction } from '@/lib/adminApi';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Download, Search } from 'lucide-react';

const PAGE_SIZE = 25;

export default function AdminProjects() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminRpc<any>('admin_list_projects', {
        _search: search || null, _status: status, _limit: PAGE_SIZE, _offset: page * PAGE_SIZE,
      });
      setRows(data.rows ?? []);
      setTotal(Number(data.total ?? 0));
    } catch (e: any) {
      toast({ title: 'Failed to load projects', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search, status, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const exportCsv = async () => {
    const data = await adminRpc<any>('admin_list_projects', { _search: search || null, _status: status, _limit: 5000, _offset: 0 });
    downloadCsv('b2bnest-projects.csv', data.rows ?? []);
    await logAdminAction('export.projects', 'projects', null, { count: (data.rows ?? []).length });
  };

  return (
    <>
      <AdminPageHeader
        title="Projects"
        description="Project volume and health across every tenant. Task content stays private to its tenant."
        actions={<Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search project" value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} />
        </div>
        <Select value={status} onValueChange={(v) => { setPage(0); setStatus(v); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on-hold">On hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tasks</TableHead>
              <TableHead className="w-40">Progress</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No projects</TableCell></TableRow>
            ) : rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  {p.name}
                  {p.archived_at && <Badge variant="secondary" className="ml-2">Archived</Badge>}
                </TableCell>
                <TableCell>{p.company || '—'}</TableCell>
                <TableCell>{p.owner || '—'}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{p.status || 'active'}</Badge></TableCell>
                <TableCell className="tabular-nums">{Number(p.tasks ?? 0)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={Number(p.progress ?? 0)} className="h-2" />
                    <span className="w-9 text-right text-xs text-muted-foreground">{Number(p.progress ?? 0)}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.deadline ? new Date(p.deadline).toLocaleDateString() : '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString()} projects</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </>
  );
}
