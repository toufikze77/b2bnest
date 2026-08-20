import { useCallback, useEffect, useState } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminStatCard from '@/components/admin/AdminStatCard';
import { adminRpc, formatBytes } from '@/lib/adminApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { FileText, HardDrive, CalendarDays } from 'lucide-react';

const PAGE_SIZE = 25;

export default function AdminDocuments() {
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminRpc<any>('admin_documents_summary', { _limit: PAGE_SIZE, _offset: page * PAGE_SIZE }));
    } catch (e: any) {
      toast({ title: 'Failed to load documents', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => { load(); }, [load]);

  const total = Number(data?.total ?? 0);
  const rows = data?.rows ?? [];

  return (
    <>
      <AdminPageHeader title="Documents & Templates" description="Document volume, categories and storage footprint." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <AdminStatCard label="Total documents" value={total.toLocaleString()} icon={<FileText className="h-4 w-4" />} />
        <AdminStatCard label="Created this month" value={Number(data?.this_month ?? 0).toLocaleString()} icon={<CalendarDays className="h-4 w-4" />} />
        <AdminStatCard label="Storage used" value={formatBytes(data?.storage_bytes)} icon={<HardDrive className="h-4 w-4" />} />
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Top categories</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(data?.categories ?? []).length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
          {(data?.categories ?? []).map((c: any) => (
            <Badge key={c.category} variant="secondary" className="capitalize">
              {String(c.category).replace(/_/g, ' ')} · {Number(c.count)}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No documents</TableCell></TableRow>
            ) : rows.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.title || 'Untitled'}</TableCell>
                <TableCell>{d.owner || '—'}</TableCell>
                <TableCell className="capitalize">{d.category || 'uncategorised'}</TableCell>
                <TableCell>{formatBytes(d.file_size)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString()} documents</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </>
  );
}
