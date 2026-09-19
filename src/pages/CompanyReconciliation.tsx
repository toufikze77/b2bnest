import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// The reconciliation functions ship with the Wave 1 database package, so they
// are not present in the generated types yet.
const callRpc = supabase.rpc as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PendingProject {
  project_id: string;
  project_name: string;
  task_count: number;
  created_at: string;
}

/**
 * Owner-only queue for historical projects that were created before companies
 * existed. The company is NEVER inferred: the owner picks one of the companies
 * they are an active member of, confirms, and the database re-validates
 * everything before the project and its tasks are assigned together.
 */
export default function CompanyReconciliation() {
  const { memberships, loading: orgsLoading } = useActiveOrganization();
  const [projects, setProjects] = useState<PendingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<PendingProject | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await callRpc('wave1_list_reconcilable_projects');
    if (error) {
      // The reconciliation functions ship with the Wave 1 database package.
      setProjects([]);
    } else {
      setProjects((data as unknown as PendingProject[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmAssign = async () => {
    if (!confirming) return;
    const organizationId = choice[confirming.project_id];
    if (!organizationId) return;
    setSaving(true);
    const { error } = await callRpc('wave1_reconcile_project', {
      p_project_id: confirming.project_id,
      p_organization_id: organizationId,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message.replace(/_/g, ' ').toLowerCase());
      return;
    }
    toast.success(`${confirming.project_name} moved, with ${confirming.task_count} task(s).`);
    setConfirming(null);
    load();
  };

  const companyName = (id?: string) => memberships.find((m) => m.organizationId === id)?.name || '';

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Unassigned projects"
        description="These projects were created before companies existed. Choose the company each one belongs to — we never guess."
      />

      {loading || orgsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Nothing to review</p>
            <p className="text-sm text-muted-foreground">All of your projects already belong to a company.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <Card key={project.project_id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{project.project_name}</CardTitle>
                  <Badge variant="secondary">{project.task_count} task{project.task_count === 1 ? '' : 's'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Select
                  value={choice[project.project_id] || ''}
                  onValueChange={(v) => setChoice((prev) => ({ ...prev, [project.project_id]: v }))}
                >
                  <SelectTrigger className="w-full sm:w-72">
                    <SelectValue placeholder="Choose a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {memberships.map((m) => (
                      <SelectItem key={m.organizationId} value={m.organizationId}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button disabled={!choice[project.project_id]} onClick={() => setConfirming(project)}>
                  Review and move
                </Button>
              </CardContent>
            </Card>
          ))}
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Every task inside a project moves with it, so nothing is separated. You only see your own projects here.
          </p>
        </div>
      )}

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Confirm this move
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Project</span><span className="font-medium text-foreground">{confirming?.project_name}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Company</span><span className="font-medium text-foreground">{companyName(confirming ? choice[confirming.project_id] : undefined)}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Tasks affected</span><span className="font-medium text-foreground">{confirming?.task_count ?? 0}</span></div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmAssign(); }} disabled={saving}>
              {saving ? 'Moving…' : 'Move to this company'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
