import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ActivationCounts, addDaysIso, CLOSED_STATUSES, DashTask, isoDay, UPCOMING_DAYS } from '@/lib/dashboardData';

export interface DashboardState {
  key: string | null;
  loading: boolean;
  tasks: DashTask[];
  tasksError: string | null;
  counts: ActivationCounts;
  countErrors: string[];
}

const emptyCounts: ActivationCounts = { contacts: null, projects: null, invoices: null, members: null };
const initial: DashboardState = { key: null, loading: true, tasks: [], tasksError: null, counts: emptyCounts, countErrors: [] };

/**
 * Loads dashboard data for exactly one (user, company). Every task/project/member
 * query is filtered by the selected company on top of RLS. Contacts and invoices
 * have no company column in the schema, so they are counted for the signed-in
 * user only. Responses for a previous company are discarded.
 */
export function useDashboardData(userId: string | null | undefined, organizationId: string | null | undefined) {
  const [state, setState] = useState<DashboardState>(initial);
  const seq = useRef(0);
  const key = userId && organizationId ? `${userId}:${organizationId}` : null;

  const load = useCallback(async () => {
    const mine = ++seq.current;
    if (!userId || !organizationId) { setState({ ...initial, loading: false }); return; }
    setState({ ...initial, key: `${userId}:${organizationId}`, loading: true });
    const today = isoDay(new Date());
    const horizon = addDaysIso(today, UPCOMING_DAYS);
    const count = (q: any) => q.then((r: any) => r, (e: any) => ({ error: e }));

    const [tasksRes, projRes, contactRes, invRes, memRes] = await Promise.all([
      count(supabase.from('todos').select('id,title,status,priority,due_date,project_id')
        .eq('organization_id', organizationId).is('archived_at', null)
        .not('due_date', 'is', null).lte('due_date', horizon)
        .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`)
        .order('due_date', { ascending: true }).limit(100)),
      count(supabase.from('projects').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).is('deleted_at', null)),
      count(supabase.from('crm_contacts').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
      count(supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
      count(supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('is_active', true)),
    ]);
    if (mine !== seq.current) return; // stale: company/user changed meanwhile

    const errors: string[] = [];
    const n = (r: any, label: string) => { if (r?.error) { errors.push(label); return null; } return typeof r?.count === 'number' ? r.count : null; };
    setState({
      key: `${userId}:${organizationId}`,
      loading: false,
      tasks: tasksRes?.error ? [] : ((tasksRes?.data || []) as DashTask[]),
      tasksError: tasksRes?.error ? (tasksRes.error.message || 'Could not load tasks.') : null,
      counts: { projects: n(projRes, 'projects'), contacts: n(contactRes, 'contacts'), invoices: n(invRes, 'invoices'), members: n(memRes, 'members') },
      countErrors: errors,
    });
  }, [userId, organizationId]);

  useEffect(() => { load(); return () => { seq.current++; }; }, [load]);

  // Never expose data that belongs to a different company than the one selected now.
  const current = state.key === key ? state : { ...initial, key, loading: !!key };
  return { ...current, reload: load };
}
