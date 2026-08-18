import { supabase } from '@/integrations/supabase/client';

/** Thin wrapper around the security-definer admin RPCs. */
export async function adminRpc<T = any>(fn: string, args: Record<string, any> = {}): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export async function logAdminAction(
  action: string,
  targetType?: string,
  targetId?: string,
  details: Record<string, any> = {},
) {
  try {
    await adminRpc('admin_log_action', {
      _action: action,
      _target_type: targetType ?? null,
      _target_id: targetId ?? null,
      _details: details,
      _status: 'success',
    });
  } catch (e) {
    console.error('Failed to write audit log', e);
  }
}

export function formatBytes(bytes: number | null | undefined) {
  const b = Number(bytes ?? 0);
  if (!b) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), units.length - 1);
  return `${(b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatMoney(value: number | null | undefined, currency = 'GBP') {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join('\n').split('\n').join(','))].join('\n');
}

export function downloadCsv(filename: string, rows: Record<string, any>[]) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
