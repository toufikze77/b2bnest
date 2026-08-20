import { useCallback, useEffect, useState } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { supabase } from '@/integrations/supabase/client';
import { logAdminAction, formatMoney } from '@/lib/adminApi';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

export default function AdminPlans() {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('platform_plans')
      .select('*')
      .order('monthly_price', { ascending: true });
    if (error) toast({ title: 'Failed to load plans', description: error.message, variant: 'destructive' });
    setRows(data ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (plan: any, field: 'is_active' | 'is_featured', value: boolean) => {
    const { error } = await (supabase as any).from('platform_plans').update({ [field]: value }).eq('id', plan.id);
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    setRows((r) => r.map((p) => (p.id === plan.id ? { ...p, [field]: value } : p)));
    await logAdminAction(`plan.${field}`, 'platform_plans', plan.id, { value });
  };

  return (
    <>
      <AdminPageHeader
        title="Plans & Limits"
        description="Subscription tiers, pricing and per-plan usage limits."
        actions={<Button variant="outline" size="sm" onClick={load}>Refresh</Button>}
      />

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Monthly</TableHead>
              <TableHead>Annual</TableHead>
              <TableHead>AI credits</TableHead>
              <TableHead>Storage</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No plans configured</TableCell></TableRow>
            ) : rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.description || p.key}</div>
                </TableCell>
                <TableCell>{formatMoney(p.monthly_price, p.currency || 'GBP')}</TableCell>
                <TableCell>{formatMoney(p.annual_price, p.currency || 'GBP')}</TableCell>
                <TableCell>{p.ai_credit_limit ?? '—'}</TableCell>
                <TableCell>{p.storage_limit_mb ? `${p.storage_limit_mb} MB` : '—'}</TableCell>
                <TableCell>{p.member_limit ?? '—'}</TableCell>
                <TableCell>{p.project_limit ?? '—'}</TableCell>
                <TableCell><Switch checked={!!p.is_featured} onCheckedChange={(v) => toggle(p, 'is_featured', v)} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!p.is_active} onCheckedChange={(v) => toggle(p, 'is_active', v)} />
                    <Badge variant={p.is_active ? 'outline' : 'secondary'}>{p.is_active ? 'Live' : 'Hidden'}</Badge>
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
