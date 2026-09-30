import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ActivationCounts, addDaysIso, CLOSED_PROJECT_STATUSES, CLOSED_STATUSES, DashProject, GROUP_LIMIT, isoDay,
  ProgressTask, TaskGroupData, UPCOMING_DAYS, weekStartIso,
} from '@/lib/dashboardData';

export interface RecentTask { id: string; title: string; status: string; project_id: string | null; updated_at: string }

export interface DashboardState {
  key: string | null;
  loading: boolean;
  groups: { overdue: TaskGroupData; dueToday: TaskGroupData; upcoming: TaskGroupData };
  tasksError: string | null;
  counts: ActivationCounts;
  countErrors: string[];
  /** Summary figures for the selected company; null = unavailable (query failed). */
  summary: { activeProjects: number | null; openTasks: number | null; completedWeek: number | null };
  activeProjects: DashProject[];
  progressTasks: ProgressTask[];
  projectsError: string | null;
  recent: RecentTask[];
  recentError: string | null;
}

const emptyCounts: ActivationCounts = { contacts: null, projects: null, invoices: null, members: null };
const emptyGroup: TaskGroupData = { items: [], total: 0 };
const emptyGroups = { overdue: emptyGroup, dueToday: emptyGroup, upcoming: emptyGroup };
const initial: DashboardState = {
  key: null, loading: true, groups: emptyGroups, tasksError: null, counts: emptyCounts, countErrors: [],
  summary: { activeProjects: null, openTasks: null, completedWeek: null },
  activeProjects: [], progressTasks: [], projectsError: null, recent: [], recentError: null,
};

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
    const now = new Date();
    const today = isoDay(now);
    const horizon = addDaysIso(today, UPCOMING_DAYS);
    const weekStart = weekStartIso(now);
    const safe = (q: any) => q.then((r: any) => r, (e: any) => ({ error: e }));
    const openTodos = (sel: string, opts?: any) => supabase.from('todos').select(sel, opts)
      .eq('organization_id', organizationId).is('archived_at', null)
      .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`);

    // Each group is queried and bounded independently with an exact total, so a
    // large overdue backlog can never crowd out due-today or upcoming tasks.
    const taskQuery = (apply: (q: any) => any) => safe(apply(
      openTodos('id,title,status,priority,due_date,project_id', { count: 'exact' }).not('due_date', 'is', null)
    ).order('due_date', { ascending: true }).limit(GROUP_LIMIT));

    const [overRes, todayRes, upRes, projRes, contactRes, invRes, memRes, openRes, weekRes, activeRes, recentRes] = await Promise.all([
      taskQuery((q) => q.lt('due_date', today)),
      taskQuery((q) => q.eq('due_date', today)),
      taskQuery((q) => q.gt('due_date', today).lte('due_date', horizon)),
      safe(supabase.from('projects').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).is('deleted_at', null)),
      safe(supabase.from('crm_contacts').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
      safe(supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
      safe(supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('is_active', true)),
      safe(openTodos('id', { count: 'exact', head: true })),
      safe(supabase.from('todos').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).is('archived_at', null)
        .in('status', CLOSED_STATUSES.slice(0, 2)).gte('completed_at', `${weekStart}T00:00:00`)),
      safe(supabase.from('projects').select('id,name,color,status,deadline,custom_fields,updated_at', { count: 'exact' })
        .eq('organization_id', organizationId).is('deleted_at', null).is('archived_at', null)
        .not('status', 'in', `(${CLOSED_PROJECT_STATUSES.join(',')})`)
        .order('updated_at', { ascending: false }).limit(60)),
      safe(supabase.from('todos').select('id,title,status,project_id,updated_at').eq('organization_id', organizationId).is('archived_at', null)
        .order('updated_at', { ascending: false }).limit(6)),
    ]);
    if (mine !== seq.current) return;

    const activeProjects: DashProject[] = activeRes?.error ? [] : (activeRes?.data || []);
    let progressTasks: ProgressTask[] = [];
    let progressErr: any = null;
    if (activeProjects.length > 0) {
      const pr = await safe(supabase.from('todos').select('project_id,status,due_date')
        .eq('organization_id', organizationId).is('archived_at', null)
        .in('project_id', activeProjects.map((p) => p.id)).limit(5000));
      if (mine !== seq.current) return; // stale: company/user changed meanwhile
      progressErr = pr?.error;
      progressTasks = pr?.data || [];
    }

    const errors: string[] = [];
    const n = (r: any, label: string) => { if (r?.error) { errors.push(label); return null; } return typeof r?.count === 'number' ? r.count : null; };
    const num = (r: any) => (r?.error || typeof r?.count !== 'number' ? null : r.count);
    const taskErr = overRes?.error || todayRes?.error || upRes?.error;
    const grp = (r: any): TaskGroupData => taskErr ? emptyGroup : { items: r?.data || [], total: typeof r?.count === 'number' ? r.count : null };
    const projErr = activeRes?.error || progressErr;
    setState({
      key: `${userId}:${organizationId}`,
      loading: false,
      groups: { overdue: grp(overRes), dueToday: grp(todayRes), upcoming: grp(upRes) },
      tasksError: taskErr ? (taskErr.message || 'Could not load tasks.') : null,
      counts: { projects: n(projRes, 'projects'), contacts: n(contactRes, 'contacts'), invoices: n(invRes, 'invoices'), members: n(memRes, 'members') },
      countErrors: errors,
      summary: { activeProjects: num(activeRes), openTasks: num(openRes), completedWeek: num(weekRes) },
      activeProjects,
      progressTasks,
      projectsError: projErr ? (projErr.message || 'Could not load projects.') : null,
      recent: recentRes?.error ? [] : (recentRes?.data || []),
      recentError: recentRes?.error ? (recentRes.error.message || 'Could not load activity.') : null,
    });
  }, [userId, organizationId]);

  useEffect(() => { load(); return () => { seq.current++; }; }, [load]);

  // Never expose data that belongs to a different company than the one selected now.
  const current = state.key === key ? state : { ...initial, key, loading: !!key };
  return { ...current, reload: load };
}
