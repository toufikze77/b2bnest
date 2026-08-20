import { useCallback, useEffect, useState } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminStatCard from '@/components/admin/AdminStatCard';
import { adminRpc, formatBytes } from '@/lib/adminApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Activity, Database, HardDrive, Plug, Users } from 'lucide-react';

export default function AdminSystemHealth() {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminRpc<any>('admin_system_health'));
    } catch (e: any) {
      toast({ title: 'Failed to load system health', description: e.message, variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const checks = [
    { label: 'Database', ok: data?.database === 'healthy', detail: data?.database ?? 'unknown' },
    { label: 'Payments', ok: !!data?.payments_configured, detail: data?.payments_configured ? 'Transactions recorded' : 'No transactions yet' },
    { label: 'AI services', ok: !!data?.ai_configured, detail: data?.ai_configured ? 'In use' : 'No usage recorded' },
    { label: 'Admin errors (7d)', ok: Number(data?.recent_admin_errors ?? 0) === 0, detail: `${Number(data?.recent_admin_errors ?? 0)} failed admin actions` },
  ];

  return (
    <>
      <AdminPageHeader
        title="System Health"
        description={data?.checked_at ? `Last checked ${data.checked_at} UTC` : 'Live platform status.'}
        actions={<Button variant="outline" size="sm" onClick={load}><Activity className="mr-2 h-4 w-4" /> Re-check</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Auth profiles" value={Number(data?.auth_users ?? 0).toLocaleString()} icon={<Users className="h-4 w-4" />} />
        <AdminStatCard label="Connected integrations" value={Number(data?.integrations_connected ?? 0).toLocaleString()} icon={<Plug className="h-4 w-4" />} />
        <AdminStatCard label="Document storage" value={formatBytes(data?.storage_bytes)} icon={<HardDrive className="h-4 w-4" />} />
        <AdminStatCard label="Database" value={<span className="capitalize">{data?.database ?? '—'}</span>} icon={<Database className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Service checks</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.detail}</p>
              </div>
              <Badge variant={c.ok ? 'outline' : 'destructive'} className={c.ok ? 'text-emerald-500' : ''}>
                {c.ok ? 'Healthy' : 'Attention'}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
