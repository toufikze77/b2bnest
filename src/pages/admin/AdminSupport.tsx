import { useCallback, useEffect, useState } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminStatCard from '@/components/admin/AdminStatCard';
import { adminRpc, logAdminAction } from '@/lib/adminApi';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { LifeBuoy, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

const PAGE_SIZE = 25;

export default function AdminSupport() {
  const { toast } = useToast();
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<any>(null);
  const [response, setResponse] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminRpc<any>('admin_support_overview', { _status: status, _limit: PAGE_SIZE, _offset: page * PAGE_SIZE }));
    } catch (e: any) {
      toast({ title: 'Failed to load support requests', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [status, page, toast]);

  useEffect(() => { load(); }, [load]);

  const save = async (newStatus: string) => {
    if (!active) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from('feedback_requests')
      .update({ admin_response: response || null, status: newStatus })
      .eq('id', active.id);
    setSaving(false);
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    await logAdminAction('support.respond', 'feedback_requests', active.id, { status: newStatus });
    toast({ title: 'Request updated' });
    setActive(null);
    setResponse('');
    load();
  };

  const total = Number(data?.total ?? 0);
  const rows = data?.rows ?? [];

  return (
    <>
      <AdminPageHeader title="Support" description="Feedback, bug reports and suggestions submitted by users." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Open" value={Number(data?.open ?? 0)} icon={<LifeBuoy className="h-4 w-4" />} />
        <AdminStatCard label="Pending" value={Number(data?.pending ?? 0)} icon={<Clock className="h-4 w-4" />} />
        <AdminStatCard label="Resolved" value={Number(data?.resolved ?? 0)} icon={<CheckCircle2 className="h-4 w-4" />} />
        <AdminStatCard label="High priority" value={Number(data?.urgent ?? 0)} icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      <div className="mb-4">
        <Select value={status} onValueChange={(v) => { setPage(0); setStatus(v); }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All requests</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No requests</TableCell></TableRow>
            ) : rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-xs truncate font-medium">{r.title || '—'}</TableCell>
                <TableCell>{r.requester || '—'}</TableCell>
                <TableCell className="capitalize">{r.type || r.category || '—'}</TableCell>
                <TableCell>
                  <Badge variant={['urgent', 'high'].includes(r.priority) ? 'destructive' : 'secondary'} className="capitalize">
                    {r.priority || 'normal'}
                  </Badge>
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{r.status || 'open'}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => { setActive(r); setResponse(r.admin_response || ''); }}>Respond</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString()} requests</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{active?.title || 'Support request'}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">From {active?.requester || 'Unknown'} · {active?.type || active?.category}</p>
          <Textarea rows={6} placeholder="Write a response…" value={response} onChange={(e) => setResponse(e.target.value)} />
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={saving} onClick={() => save('pending')}>Save as pending</Button>
            <Button disabled={saving} onClick={() => save('resolved')}>Mark resolved</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
