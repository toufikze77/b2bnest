/**
 * Writes for quotes and invoices (Phase 4): status changes, archive, restore and delete forever.
 * Every write is filtered by the row id AND the signed-in user's id. "Delete forever" is also
 * filtered by `archived_at is not null`, so an active document can never be hard-deleted this way.
 */
import type { DbError } from '@/lib/moneyOut';

export type DocTable = 'quotes' | 'invoices';
export type DocWrite = { error: DbError | null };
type Res = PromiseLike<{ error: DbError | null }>;

/** The slice of the Supabase client used here (narrow so tests can pass a fake). */
export interface DocWrites {
  from: (table: string) => {
    update: (row: Record<string, unknown>) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Res } };
    delete: () => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { not: (c: string, op: string, v: null) => Res } } };
  };
}

export function documentApi(client: DocWrites, userId: string, table: DocTable) {
  const run = async (send: () => Res): Promise<DocWrite> => {
    try { const { error } = await send(); return { error: error ?? null }; } catch (e) { return { error: { message: e instanceof Error ? e.message : String(e) } }; }
  };
  const update = (id: string, row: Record<string, unknown>) => run(() => client.from(table).update(row).eq('id', id).eq('user_id', userId));
  return {
    update,
    /** Move to archive: sets archived_at, keeps the status as it was. */
    archive: (id: string, at: string) => update(id, { archived_at: at }),
    restore: (id: string) => update(id, { archived_at: null }),
    /** Hard delete, archived documents only. */
    deleteForever: (id: string) => run(() => client.from(table).delete().eq('id', id).eq('user_id', userId).not('archived_at', 'is', null)),
  };
}
export type DocumentApi = ReturnType<typeof documentApi>;
