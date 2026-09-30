import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { PageContainer } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';

interface WorkspaceSummary { id: string; name: string; boards: number; template: string }

export default function WorkspacesIndex() {
  const { organizationId, organization } = useActiveOrganization();
  const [items, setItems] = useState<WorkspaceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    if (!organizationId) { setItems([]); return; }
    supabase
      .from('projects')
      .select('id, custom_fields, created_at')
      .eq('organization_id', organizationId)
      .not('custom_fields->workspace->>id', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setError(error.message); return; }
        const map = new Map<string, WorkspaceSummary>();
        for (const row of data ?? []) {
          const cf = (row.custom_fields ?? {}) as any;
          const ws = cf.workspace;
          if (!ws?.id) continue;
          const cur = map.get(ws.id);
          if (cur) cur.boards += 1;
          else map.set(ws.id, { id: ws.id, name: ws.name, boards: 1, template: cf.source_template_name ?? '' });
        }
        setItems([...map.values()]);
      });
    return () => { cancelled = true; };
  }, [organizationId]);

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Workspaces</h1>
          <p className="text-sm text-muted-foreground">
            Workspaces created from templates in {organization?.name ?? 'the selected company'}.
          </p>
        </div>
        <Button asChild><Link to="/template-center">Browse workspace templates</Link></Button>
      </div>

      {!organizationId ? (
        <p className="rounded-md border border-border p-6 text-sm text-muted-foreground">Choose a company in the top bar to see its workspaces.</p>
      ) : error ? (
        <p role="alert" className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</p>
      ) : items === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading workspaces…</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center">
          <LayoutGrid className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium text-foreground">No workspaces yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Use a workspace template to create one. Your existing projects stay in Projects &amp; tasks.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((w) => (
            <Link key={w.id} to={`/workspaces/${w.id}`} className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <p className="font-semibold text-foreground">{w.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{w.boards} {w.boards === 1 ? 'board' : 'boards'}{w.template ? ` · from ${w.template}` : ''}</p>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
