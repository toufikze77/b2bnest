import { useEffect, useState } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminStatCard from '@/components/admin/AdminStatCard';
import { adminRpc } from '@/lib/adminApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Brain, Coins, MessageSquare, CalendarDays } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function AdminAI() {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    adminRpc<any>('admin_ai_stats', { _days: 30 })
      .then(setData)
      .catch((e) => toast({ title: 'Failed to load AI stats', description: e.message, variant: 'destructive' }));
  }, [toast]);

  const series = (data?.series ?? []).map((d: any) => ({ ...d, count: Number(d.count) }));

  return (
    <>
      <AdminPageHeader title="AI Management" description="Usage of AI features across the platform." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Total AI conversations" value={Number(data?.total ?? 0).toLocaleString()} icon={<Brain className="h-4 w-4" />} />
        <AdminStatCard label="Today" value={Number(data?.today ?? 0).toLocaleString()} icon={<CalendarDays className="h-4 w-4" />} />
        <AdminStatCard label="This month" value={Number(data?.this_month ?? 0).toLocaleString()} icon={<MessageSquare className="h-4 w-4" />} />
        <AdminStatCard label="AI credits used" value={Number(data?.credits_used ?? 0).toLocaleString()} icon={<Coins className="h-4 w-4" />} />
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">AI usage (last 30 days)</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Usage by feature</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.by_feature ?? []).length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
            {(data?.by_feature ?? []).map((f: any) => (
              <div key={f.feature} className="flex items-center justify-between text-sm">
                <span className="capitalize">{String(f.feature).replace(/_/g, ' ')}</span>
                <span className="tabular-nums text-muted-foreground">{Number(f.count).toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top AI users</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.by_user ?? []).length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
            {(data?.by_user ?? []).map((u: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="truncate">{u.user_name || 'Unknown'}</span>
                <span className="tabular-nums text-muted-foreground">{Number(u.count).toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
