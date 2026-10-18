import { supabase } from '@/integrations/supabase/client';
import { IN_APP_TYPES, isMissingTableError, type InAppType } from '@/lib/notifications';

// notification_type_prefs arrives with the Phase 7 database proposal and is not in the generated types yet.
type Result<T> = Promise<{ data: T | null; error: { code?: string; message?: string } | null }>;
interface PrefsTable {
  select(cols: string): { eq(col: string, v: string): Result<{ type: string; in_app: boolean }[]> };
  upsert(row: Record<string, unknown>, opts: { onConflict: string }): Result<unknown>;
}
const table = () => (supabase as unknown as { from(t: string): PrefsTable }).from('notification_type_prefs');

export type TypePrefs = Record<InAppType, boolean>;
export type LoadResult = { status: 'ok'; prefs: TypePrefs } | { status: 'not-enabled' } | { status: 'error' };

/** No row means "on". Returns not-enabled while the table does not exist (proposal not applied). */
export async function loadTypePrefs(userId: string): Promise<LoadResult> {
  const { data, error } = await table().select('type,in_app').eq('user_id', userId);
  if (error) return isMissingTableError(error) ? { status: 'not-enabled' } : { status: 'error' };
  const prefs = Object.fromEntries(IN_APP_TYPES.map((t) => [t, true])) as TypePrefs;
  for (const row of data ?? []) if ((IN_APP_TYPES as readonly string[]).includes(row.type)) prefs[row.type as InAppType] = row.in_app !== false;
  return { status: 'ok', prefs };
}

export async function saveTypePref(userId: string, type: InAppType, inApp: boolean): Promise<boolean> {
  const { error } = await table().upsert({ user_id: userId, type, in_app: inApp, updated_at: new Date().toISOString() }, { onConflict: 'user_id,type' });
  return !error;
}
