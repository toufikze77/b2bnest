import { useEffect, useState } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminStatCard from '@/components/admin/AdminStatCard';
import { adminRpc, formatBytes, formatMoney, percentChange } from '@/lib/adminApi';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, UserCheck, UserPlus, Building2, CreditCard, Gift, BadgePoundSterling, Wallet,
  Brain, FolderKanban, FileText, HardDrive, LifeBuoy, MessagesSquare, TrendingUp,
} from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminRpc('admin_overview_stats').then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  if (!stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  const n = (k: string) => Number(stats[k] ?? 0);

  const cards = [
    { label: 'Total Users', value: n('total_users').toLocaleString(), icon: <Users className="h-4 w-4" />, change: percentChange(n('new_users_30d'), n('new_users_prev_30d')) },
    { label: 'Active Users', value: n('active_users').toLocaleString(), icon: <UserCheck className="h-4 w-4" /> },
    { label: 'New Users (30d)', value: n('new_users_30d').toLocaleString(), icon: <UserPlus className="h-4 w-4" />, change: percentChange(n('new_users_30d'), n('new_users_prev_30d')) },
    { label: 'Total Companies', value: n('total_companies').toLocaleString(), icon: <Building2 className="h-4 w-4" /> },
    { label: 'Active Subscriptions', value: n('active_subscriptions').toLocaleString(), icon: <CreditCard className="h-4 w-4" /> },
    { label: 'Free Users', value: n('free_users').toLocaleString(), icon: <Gift className="h-4 w-4" /> },
    { label: 'Paid Subscribers', value: n('active_subscriptions').toLocaleString(), icon: <BadgePoundSterling className="h-4 w-4" /> },
    { label: 'Monthly Recurring Revenue', value: formatMoney(n('mrr')), icon: <TrendingUp className="h-4 w-4" />, hint: 'From active plan pricing' },
    { label: 'Total Revenue', value: formatMoney(n('total_revenue')), icon: <Wallet className="h-4 w-4" />, change: percentChange(n('revenue_30d'), n('revenue_prev_30d')) },
    { label: 'AI Usage', value: n('ai_requests').toLocaleString(), icon: <Brain className="h-4 w-4" />, hint: `${n('ai_requests_30d').toLocaleString()} in last 30 days` },
    { label: 'Active Projects', value: n('active_projects').toLocaleString(), icon: <FolderKanban className="h-4 w-4" />, hint: `${n('total_projects').toLocaleString()} total` },
    { label: 'Documents Created', value: n('documents').toLocaleString(), icon: <FileText className="h-4 w-4" />, hint: `${n('documents_30d').toLocaleString()} in last 30 days` },
    { label: 'Storage Used', value: formatBytes(n('storage_bytes')), icon: <HardDrive className="h-4 w-4" /> },
    { label: 'Support Tickets', value: n('support_open').toLocaleString(), icon: <LifeBuoy className="h-4 w-4" />, hint: `${n('support_total').toLocaleString()} total` },
    { label: 'Social Activity', value: n('social_posts').toLocaleString(), icon: <MessagesSquare className="h-4 w-4" />, hint: `${n('social_posts_7d').toLocaleString()} posts in 7 days` },
  ];

  return (
    <>
      <AdminPageHeader title="Platform Overview" description="Live snapshot of B2BNest usage, revenue and activity." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <AdminStatCard key={c.label} {...c} />
        ))}
      </div>
    </>
  );
}
