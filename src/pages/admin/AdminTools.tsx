import { useCallback, useEffect, useState } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { adminRpc, logAdminAction } from '@/lib/adminApi';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

export default function AdminTools() {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminRpc<any[]>('admin_tools_overview'));
    } catch (e: any) {
      toast({ title: 'Failed to load tools', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (tool: any, value: boolean) => {
    const { error } = await (supabase as any).from('platform_tools').update({ is_active: value }).eq('id', tool.id);
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    setRows((r) => r.map((t) => (t.id === tool.id ? { ...t, is_active: value } : t)));
    await logAdminAction('tool.toggle', 'platform_tools', tool.id, { key: tool.key, is_active: value });
  };

  return (
    <>
      <AdminPageHeader
        title="Business Tools"
        description="Tool adoption across all tenants, and platform-wide availability."
        actions={<Button variant="outline" size="sm" onClick={load}>Refresh</Button>}
      />

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Records created</TableHead>
              <TableHead>Unique users</TableHead>
              <TableHead>Availability</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No tools registered</TableCell></TableRow>
            ) : rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{t.category || 'general'}</Badge></TableCell>
                <TableCell className="tabular-nums">{Number(t.usage ?? 0).toLocaleString()}</TableCell>
                <TableCell className="tabular-nums">{Number(t.users ?? 0).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!t.is_active} onCheckedChange={(v) => toggle(t, v)} />
                    <span className="text-sm text-muted-foreground">{t.is_active ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
