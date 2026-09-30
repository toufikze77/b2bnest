import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/contexts/OrganizationContext';

/**
 * Company security overview for owners/admins of the selected company.
 * Role counts are counted from real membership rows. There is no
 * company-scoped audit log yet, so it is reported as unavailable.
 */
const CompanySecurity = () => {
  const { organizationId, organization } = useActiveOrganization();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allowed = organization?.role === 'owner' || organization?.role === 'admin';

  useEffect(() => {
    if (!organizationId || !allowed) return;
    let live = true;
    setCounts(null); setError(null);
    supabase.from('organization_members').select('role').eq('organization_id', organizationId).eq('is_active', true)
      .then(({ data, error: e }) => {
        if (!live) return;
        if (e) return setError(e.message);
        const c: Record<string, number> = {};
        (data ?? []).forEach((r) => { c[r.role] = (c[r.role] ?? 0) + 1; });
        setCounts(c);
      });
    return () => { live = false; };
  }, [organizationId, allowed]);

  if (!organizationId) return <Card><CardContent className="py-6 text-sm text-muted-foreground">Choose a company in the top bar.</CardContent></Card>;
  if (!allowed) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">Only owners and admins of {organization?.name} can see company security.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">People by role · {organization?.name}</CardTitle>
          <CardDescription>Active members of this company only.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p role="alert" className="text-sm text-destructive">Could not load roles: {error}</p>}
          {!error && !counts && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>}
          {counts && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Object.entries(counts).sort().map(([role, n]) => (
                <div key={role} className="rounded-md border border-border p-3">
                  <dt className="text-xs capitalize text-muted-foreground">{role}</dt>
                  <dd className="text-lg font-semibold">{n}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company audit log</CardTitle>
          <CardDescription>Not available yet.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Activity is currently recorded per person, not per company, so we can't show a company-wide log without
          mixing in other companies. Each person can see their own activity under Settings → Security.
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanySecurity;
