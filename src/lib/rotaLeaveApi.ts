// Phase 32: the holiday requests' reads and writes. Requests are written only through the leave_* functions (the
// database checks who may ask, decide and cancel); allowances are table writes checked by RLS.
import { supabase } from '@/integrations/supabase/client';
import type { AwayEntry, Half, LeaveBalance, LeaveKind, LeaveRequest } from '@/lib/rotaLeave';

export type DbError = { code?: string; message?: string; details?: string } | null;
type Res<T> = { data: T | null; error: DbError; count?: number | null };

// The generated types predate Phase 32's tables and functions, so these calls are typed by hand.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<Res<unknown>> };

export interface LinkCandidate { user_id: string; role: string; name: string | null; email: string | null; linked_employee_id: string | null; suggested_employee_id: string | null }

export async function myEmployee(orgId: string, userId: string): Promise<Res<{ id: string; full_name: string }>> {
  return await db.from('rota_employees').select('id,full_name').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
}
export async function listRequests(orgId: string): Promise<Res<LeaveRequest[]>> {
  return await db.from('rota_leave_requests').select('*').eq('company_id', orgId).order('start_date', { ascending: false }).limit(500);
}
export async function pendingCount(orgId: string): Promise<Res<null>> {
  return await db.from('rota_leave_requests').select('id', { count: 'exact', head: true }).eq('company_id', orgId).eq('status', 'pending');
}
export async function allowances(orgId: string, year: number): Promise<Res<{ employee_id: string; days: number }[]>> {
  return await db.from('rota_leave_allowances').select('employee_id,days').eq('company_id', orgId).eq('leave_year', year);
}
export async function setAllowance(employeeId: string, year: number, days: number | null): Promise<Res<unknown>> {
  if (days === null) return await db.from('rota_leave_allowances').delete().eq('employee_id', employeeId).eq('leave_year', year);
  return await db.from('rota_leave_allowances').upsert({ employee_id: employeeId, leave_year: year, days }, { onConflict: 'employee_id,leave_year' });
}
export async function leaveYearStartMonth(orgId: string): Promise<number> {
  const { data } = await db.from('organizations').select('settings').eq('id', orgId).maybeSingle();
  const m = Number((data?.settings as Record<string, unknown> | null)?.leave_year_start_month);
  return Number.isInteger(m) && m >= 1 && m <= 12 ? m : 1;
}

export const createRequest = (a: { employeeId: string; start: string; end: string; startHalf: Half; endHalf: Half; kind: LeaveKind; note: string }) =>
  db.rpc('leave_request_create', { p_employee_id: a.employeeId, p_start: a.start, p_end: a.end, p_start_half: a.startHalf, p_end_half: a.endHalf, p_kind: a.kind, p_note: a.note || null });
export const decideRequest = (id: string, decision: 'approve' | 'decline' | 'change', note: string) =>
  db.rpc('leave_request_decide', { p_request_id: id, p_decision: decision, p_note: note || null });
export const cancelRequest = (id: string, note = '') => db.rpc('leave_request_cancel', { p_request_id: id, p_note: note || null });
export const balance = (employeeId: string, year: number | null = null) =>
  db.rpc('leave_balance', { p_employee_id: employeeId, p_leave_year: year }) as PromiseLike<Res<LeaveBalance>>;
export const calendar = (orgId: string, from: string, to: string) =>
  db.rpc('leave_calendar', { p_company_id: orgId, p_from: from, p_to: to }) as PromiseLike<Res<AwayEntry[]>>;
export const setLeaveYearStart = (orgId: string, month: number) => db.rpc('leave_settings_set', { p_company_id: orgId, p_start_month: month });
export const linkEmployee = (employeeId: string, userId: string | null) => db.rpc('rota_employee_link', { p_employee_id: employeeId, p_user_id: userId });
export const linkCandidates = (orgId: string) => db.rpc('leave_link_candidates', { p_company_id: orgId }) as PromiseLike<Res<LinkCandidate[]>>;
