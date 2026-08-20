import { useState } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { adminRpc, downloadCsv, logAdminAction } from '@/lib/adminApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';

type Job = { key: string; title: string; description: string; run: () => Promise<any[]> };

const rowsOf = (d: any) => (Array.isArray(d) ? d : d?.rows ?? []);

const JOBS: Job[] = [
  {
    key: 'users',
    title: 'Users',
    description: 'All registered accounts with role, status and activity.',
    run: async () => rowsOf(await adminRpc('admin_list_users', { _search: null, _status: 'all', _limit: 5000, _offset: 0 })),
  },
  {
    key: 'companies',
    title: 'Companies',
    description: 'Organisations with owner, member count and plan.',
    run: async () => rowsOf(await adminRpc('admin_list_companies', { _search: null, _limit: 5000, _offset: 0 })),
  },
  {
    key: 'subscriptions',
    title: 'Subscriptions',
    description: 'Subscription records, plan tiers and billing status.',
    run: async () => rowsOf(await adminRpc('admin_list_subscriptions', { _status: 'all', _search: null, _limit: 5000, _offset: 0 })),
  },
  {
    key: 'projects',
    title: 'Projects',
    description: 'Projects with company, owner, status and progress.',
    run: async () => rowsOf(await adminRpc('admin_list_projects', { _search: null, _status: 'all', _limit: 5000, _offset: 0 })),
  },
  {
    key: 'documents',
    title: 'Documents',
    description: 'Document metadata and storage footprint.',
    run: async () => rowsOf(await adminRpc('admin_documents_summary', { _limit: 5000, _offset: 0 })),
  },
  {
    key: 'support',
    title: 'Support requests',
    description: 'Feedback, bugs and suggestions with status.',
    run: async () => rowsOf(await adminRpc('admin_support_overview', { _status: 'all', _limit: 5000, _offset: 0 })),
  },
  {
    key: 'analytics',
    title: 'Analytics (90 days)',
    description: 'Daily signups, activity and revenue series.',
    run: async () => rowsOf(await adminRpc('admin_analytics_series', { _days: 90 })),
  },
];

export default function AdminExport() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (job: Job) => {
    setBusy(job.key);
    try {
      const rows = await job.run();
      if (!rows.length) {
        toast({ title: 'Nothing to export', description: `No ${job.title.toLowerCase()} found.` });
        return;
      }
      downloadCsv(`b2bnest-${job.key}.csv`, rows);
      await logAdminAction(`export.${job.key}`, job.key, null, { count: rows.length });
      toast({ title: 'Export ready', description: `${rows.length} rows downloaded.` });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <AdminPageHeader title="Data Export" description="Download platform datasets as CSV. Every export is written to the audit log." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {JOBS.map((job) => (
          <Card key={job.key}>
            <CardHeader>
              <CardTitle className="text-base">{job.title}</CardTitle>
              <CardDescription>{job.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" disabled={busy === job.key} onClick={() => run(job)}>
                <Download className="mr-2 h-4 w-4" />
                {busy === job.key ? 'Preparing…' : 'Export CSV'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
