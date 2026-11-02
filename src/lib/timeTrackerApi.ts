// Phase 31: the Time Tracker's reads and writes. Timer changes go through the time_* RPCs (the server clock decides
// every timestamp); manual entries, edits and deletes are table writes checked by RLS and the table's trigger.
import { supabase } from '@/integrations/supabase/client';
import type { ProjectOption, Range, TimeEntry } from '@/lib/timeTracker';

export type DbError = { code?: string; message?: string; details?: string } | null;
type Res<T> = { data: T | null; error: DbError };

// The generated types predate Phase 31's columns, so these calls are typed by hand.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<Res<unknown>> };

export const ENTRY_COLUMNS = 'id,user_id,project_id,company_id,description,start_time,end_time,paused_seconds,paused_at,is_billable,hourly_rate_pence';
const TABLE = 'project_time_entries';

export async function loadRunning(userId: string): Promise<Res<TimeEntry>> {
  return await db.from(TABLE).select(ENTRY_COLUMNS).eq('user_id', userId).is('end_time', null).maybeSingle();
}
export async function loadEntries(userId: string, range: Range): Promise<Res<TimeEntry[]>> {
  return await db.from(TABLE).select(ENTRY_COLUMNS).eq('user_id', userId).not('end_time', 'is', null)
    .gte('start_time', range.from.toISOString()).lt('start_time', range.to.toISOString())
    .order('start_time', { ascending: false }).limit(1000);
}
export async function loadProjects(): Promise<Res<ProjectOption[]>> {
  return await db.from('projects').select('id,name,organization_id').is('deleted_at', null).is('archived_at', null).order('name').limit(500);
}
export async function loadSettings(userId: string): Promise<Res<{ default_rate_pence: number | null; default_billable: boolean }>> {
  return await db.from('time_tracker_settings').select('default_rate_pence,default_billable').eq('user_id', userId).maybeSingle();
}
export async function saveSettings(userId: string, rate: number | null, billable: boolean): Promise<Res<unknown>> {
  return await db.from('time_tracker_settings').upsert({ user_id: userId, default_rate_pence: rate, default_billable: billable, updated_at: new Date().toISOString() });
}

export const timeStart = (a: { projectId: string | null; description: string; billable: boolean; ratePence: number | null; companyId: string | null }) =>
  db.rpc('time_start', { p_project_id: a.projectId, p_description: a.description, p_billable: a.billable, p_hourly_rate_pence: a.ratePence, p_company_id: a.companyId });
export const timePause = () => db.rpc('time_pause');
export const timeResume = () => db.rpc('time_resume');
export const timeStop = (confirmShort = false, endedAt: string | null = null) => db.rpc('time_stop', { p_confirm_short: confirmShort, p_ended_at: endedAt });
export const timeSummary = (range: Range) => db.rpc('time_summary', { p_from: range.from.toISOString(), p_to: range.to.toISOString() });

export type EntryFields = Pick<TimeEntry, 'project_id' | 'description' | 'start_time' | 'end_time' | 'is_billable' | 'hourly_rate_pence'> & { paused_seconds?: number };
export async function createEntry(userId: string, companyId: string | null, f: EntryFields): Promise<Res<unknown>> {
  return await db.from(TABLE).insert({ ...f, user_id: userId, company_id: f.project_id ? null : companyId, paused_seconds: 0 });
}
export async function updateEntry(id: string, f: Partial<EntryFields>): Promise<Res<unknown>> {
  return await db.from(TABLE).update(f).eq('id', id);
}
export async function deleteEntry(id: string): Promise<Res<unknown>> {
  return await db.from(TABLE).delete().eq('id', id);
}
