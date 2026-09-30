import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ActivationCounts, addDaysIso, CLOSED_STATUSES, GROUP_LIMIT, isoDay, TaskGroupData, UPCOMING_DAYS } from '@/lib/dashboardData';

export interface DashboardState {
  key: string | null;
  loading: boolean;
  groups: { overdue: TaskGroupData; dueToday: TaskGroupData; upcoming: TaskGroupData };
  tasksError: string | null;
  counts: ActivationCounts;
  countErrors: string[];
}

const emptyCounts: ActivationCounts = { contacts: null, projects: null, invoices: null, members: null };
const emptyGroup: TaskGroupData = { items: [], total: 0 };
const emptyGroups = { overdue: emptyGroup, dueToday: emptyGroup, upcoming: emptyGroup };
const initial: DashboardState = { key: null, loading: true, groups: emptyGroups, tasksError: null, counts: emptyCounts, countErrors: [] };

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

    // Each group is queried and bounded independently with an exact total, so a
    // large overdue backlog can never crowd out due-today or upcoming tasks.
    const taskQuery = (apply: (q: any) => any) => count(apply(
      supabase.from('todos').select('id,title,status,priority,due_date,project_id', { count: 'exact' })
        .eq('organization_id', organizationId).is('archived_at', null)
        .not('due_date', 'is', null)
        .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`)
    ).order('due_date', { ascending: true }).limit(GROUP_LIMIT));

    const [overRes, todayRes, upRes, projRes, contactRes, invRes, memRes] = await Promise.all([
      taskQuery((q) => q.lt('due_date', today)),
      taskQuery((q) => q.eq('due_date', today)),
      taskQuery((q) => q.gt('due_date', today).lte('due_date', horizon)),
      count(supabase.from('projects').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).is('deleted_at', null)),
      count(supabase.from('crm_contacts').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
      count(supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
      count(supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('is_active', true)),
    ]);
    if (mine !== seq.current) return; // stale: company/user changed meanwhile

    const errors: string[] = [];
    const n = (r: any, label: string) => { if (r?.error) { errors.push(label); return null; } return typeof r?.count === 'number' ? r.count : null; };
    const taskErr = overRes?.error || todayRes?.error || upRes?.error;
    const grp = (r: any): TaskGroupData => taskErr ? emptyGroup : { items: r?.data || [], total: typeof r?.count === 'number' ? r.count : null };
    setState({
      key: `${userId}:${organizationId}`,
      loading: false,
      groups: { overdue: grp(overRes), dueToday: grp(todayRes), upcoming: grp(upRes) },
      tasksError: taskErr ? (taskErr.message || 'Could not load tasks.') : null,
      counts: { projects: n(projRes, 'projects'), contacts: n(contactRes, 'contacts'), invoices: n(invRes, 'invoices'), members: n(memRes, 'members') },
      countErrors: errors,
    });
  }, [userId, organizationId]);

  useEffect(() => { load(); return () => { seq.current++; }; }, [load]);

  // Never expose data that belongs to a different company than the one selected now.
  const current = state.key === key ? state : { ...initial, key, loading: !!key };
  return { ...current, reload: load };
}
