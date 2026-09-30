import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { batchGetUserDisplayInfo } from '@/utils/profileUtils';

export const COMPANY_ROLES = ['owner', 'admin', 'manager', 'member'] as const;

export interface MemberRow { id: string; user_id: string; role: string; name: string }

/** Which roles the current user may assign to a given member (mirrors RLS). */
export const assignableRoles = (myRole: string | undefined, target: MemberRow, myId: string | undefined) => {
  if (!myRole || target.user_id === myId) return [];
  if (myRole === 'owner') return [...COMPANY_ROLES];
  if (myRole === 'admin' && target.role !== 'owner') return COMPANY_ROLES.filter((r) => r !== 'owner');
  return [];
};

/**
 * Members & roles for the company selected in the top bar. Reads and writes
 * organization_members; the database only lets owners/admins change roles
 * and only owners touch owner rows.
 */
const CompanyMembers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { organizationId, organization } = useActiveOrganization();
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setRows(null); setError(null);
    const requested = organizationId;
    const { data, error: e } = await supabase.from('organization_members')
      .select('id, user_id, role').eq('organization_id', requested).eq('is_active', true);
    if (requested !== organizationId) return;
    if (e) { setError(e.message); return; }
    const profiles = await batchGetUserDisplayInfo((data ?? []).map((d) => d.user_id));
    setRows((data ?? []).map((d) => ({
      ...d, name: profiles.find((p) => p.id === d.user_id)?.display_name || 'Unnamed member',
    })));
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (row: MemberRow, role: string) => {
    setSavingId(row.id);
    const { data, error: e } = await supabase.from('organization_members')
      .update({ role }).eq('id', row.id).eq('organization_id', organizationId!).select('id');
    setSavingId(null);
    if (e || !data || data.length !== 1) {
      return toast({ title: 'Role not changed', description: e?.message ?? 'You are not allowed to change this member.', variant: 'destructive' });
    }
    toast({ title: 'Role updated', description: `${row.name} is now ${role}.` });
    load();
  };

  if (!organizationId) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">Choose a company in the top bar to see its members.</CardContent></Card>;
  }

  const canManage = organization?.role === 'owner' || organization?.role === 'admin';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Members & roles · {organization?.name}</CardTitle>
        <CardDescription>
          {canManage ? 'Owners can change any role. Admins can change roles other than owner.' : 'Only owners and admins can change roles.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
            Could not load members: {error}<Button size="sm" variant="outline" onClick={load}>Retry</Button>
          </div>
        )}
        {!error && !rows && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading members…</p>}
        {rows && rows.length === 0 && <p className="text-sm text-muted-foreground">No active members found.</p>}
        {rows && rows.length > 0 && (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const options = assignableRoles(organization?.role, r, user?.id);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="text-sm font-medium">{r.name}{r.user_id === user?.id && <span className="text-muted-foreground"> (you)</span>}</span>
                  {options.length > 0 ? (
                    <Select value={r.role} onValueChange={(v) => changeRole(r, v)} disabled={savingId === r.id}>
                      <SelectTrigger className="w-36" aria-label={`Role for ${r.name}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{options.map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <Badge variant="secondary" className="capitalize">{r.role}</Badge>}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyMembers;
