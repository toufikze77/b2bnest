import { useCallback, useEffect, useRef, useState } from 'react';
import { ACTIVE_FILTER } from '@/lib/archive';
import { supabase } from '@/integrations/supabase/client';
import { isoDay } from '@/lib/dashboardData';
import { BillRow, DealRow, EmployeeRow, InvoiceRow, ShiftRow } from '@/lib/dashboardWidgets';
import { listTickets, NotEnabledError, Ticket } from '@/services/supportService';

export interface Loaded<T> { loading: boolean; error: string | null; notEnabled: boolean; data: T | null; reload: () => void }

/**
 * Runs `fn` once per scope (user + company) while `enabled`. A response for an
 * older scope is discarded, so a widget never shows another company's data.
 */
export function useScopedLoad<T>(scope: string | null, enabled: boolean, fn: () => Promise<T>): Loaded<T> {
  const [state, setState] = useState<{ scope: string | null; loading: boolean; error: string | null; notEnabled: boolean; data: T | null }>(
    { scope: null, loading: true, error: null, notEnabled: false, data: null },
  );
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(async () => {
    const mine = ++seq.current;
    if (!scope || !enabled) return;
    setState({ scope, loading: true, error: null, notEnabled: false, data: null });
    try {
      const data = await fnRef.current();
      if (mine === seq.current) setState({ scope, loading: false, error: null, notEnabled: false, data });
    } catch (e) {
      if (mine !== seq.current) return;
      setState({ scope, loading: false, error: e instanceof Error ? e.message : 'Could not load.', notEnabled: e instanceof NotEnabledError, data: null });
    }
  }, [scope, enabled]);

  useEffect(() => { const s = seq; load(); return () => { s.current++; }; }, [load]);

  const current = state.scope === scope ? state : { scope, loading: true, error: null, notEnabled: false, data: null };
  return { loading: current.loading, error: current.error, notEnabled: current.notEnabled, data: current.data, reload: load };
}

// Supabase builders resolve to { data, count, error }; turn an error into a thrown Error.
type Res<T> = { data?: T | null; count?: number | null; error?: { message?: string } | null };
const must = <T,>(r: Res<T>) => { if (r?.error) throw new Error(r.error.message || 'Could not load.'); return r; };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Upper bound on rows read for a widget total; the widget says so when the bound is hit. */
export const ROW_CAP = 2000;

export interface CustomersData { total: number | null; customer: number | null; prospect: number | null; lead: number | null }
/** CRM contacts are owned by the signed-in user (no company column). */
export async function loadCustomers(userId: string): Promise<CustomersData> {
  const head = (status?: string) => {
    let q = db.from('crm_contacts').select('id', { count: 'exact', head: true }).eq('user_id', userId);
    if (status) q = q.eq('status', status);
    return q;
  };
  const [all, c, p, l] = (await Promise.all([head(), head('customer'), head('prospect'), head('lead')])).map(must);
  return { total: all.count ?? null, customer: c.count ?? null, prospect: p.count ?? null, lead: l.count ?? null };
}

export interface CappedRows<T> { rows: T[]; total: number | null }

export async function loadDeals(userId: string): Promise<CappedRows<DealRow>> {
  const r = must<DealRow[]>(await db.from('crm_deals').select('stage,value,currency', { count: 'exact' }).eq('user_id', userId).limit(ROW_CAP));
  return { rows: r.data || [], total: r.count ?? null };
}

export interface MoneyData { invoices: CappedRows<InvoiceRow>; bills: CappedRows<BillRow> }
/** Invoices and bills are owned by the signed-in user (no company column). Archived invoices are excluded. */
export async function loadMoney(userId: string): Promise<MoneyData> {
  const [inv, bills] = await Promise.all([
    // Archived invoices are left out of every total (Phase 4, src/lib/archive.ts).
    db.from('invoices').select('status,total_amount,currency', { count: 'exact' }).eq('user_id', userId).is(...ACTIVE_FILTER).limit(ROW_CAP),
    db.from('bills').select('status,amount,currency', { count: 'exact' }).eq('user_id', userId).limit(ROW_CAP),
  ]);
  const i = must<InvoiceRow[]>(inv); const b = must<BillRow[]>(bills);
  return { invoices: { rows: i.data || [], total: i.count ?? null }, bills: { rows: b.data || [], total: b.count ?? null } };
}

export interface ExpenseItem { id: string; description: string; category: string; amount: number; date: string }
export async function loadPendingExpenses(userId: string): Promise<{ items: ExpenseItem[]; total: number | null }> {
  const r = must<ExpenseItem[]>(await db.from('expenses').select('id,description,category,amount,date', { count: 'exact' })
    .eq('user_id', userId).eq('status', 'pending').order('date', { ascending: false }).limit(5));
  return { items: r.data || [], total: r.count ?? null };
}

export async function loadTickets(orgId: string): Promise<Ticket[]> {
  return (await listTickets(orgId)) ?? [];
}

export interface RotaData { shifts: ShiftRow[]; employees: EmployeeRow[] }
export async function loadRotaToday(orgId: string, today = isoDay(new Date())): Promise<RotaData> {
  const s = must<ShiftRow[]>(await db.from('rota_shifts').select('id,employee_id,start_time,end_time,role,status')
    .eq('organization_id', orgId).eq('shift_date', today).order('start_time', { ascending: true }).limit(200));
  const shifts = s.data || [];
  const ids = [...new Set(shifts.map((x) => x.employee_id))];
  if (ids.length === 0) return { shifts, employees: [] };
  const e = must<EmployeeRow[]>(await db.from('rota_employees').select('id,full_name').eq('organization_id', orgId).in('id', ids));
  return { shifts, employees: e.data || [] };
}
