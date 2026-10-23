import type { DbError, Payload } from '@/lib/moneyOut';
import { confirmOne, type Confirmed } from '@/lib/confirmedWrite';

export type MoneyOutTable = 'expenses' | 'outgoings' | 'suppliers' | 'products_services';
/** Quotes and invoices use the same owner-filtered writes (status changes and delete). */
export type OwnedTable = MoneyOutTable | 'quotes' | 'invoices';
export type WriteResult = { error: DbError | null };

/** The slice of the Supabase client these writes use (kept narrow so tests can pass a fake). */
interface Writes {
  from: (table: string) => {
    insert: (rows: Payload[]) => PromiseLike<{ error: DbError | null }>;
    update: (row: Payload) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { select: (cols: 'id') => Confirmed } } };
    delete: () => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { select: (cols: 'id') => Confirmed } } };
  };
}

/**
 * Create, update and delete for the money-out tables. Every update and delete is scoped to the
 * row id AND the signed-in user's id (row-level security also enforces the owner, this is belt and braces), and
 * asks for the changed rows: zero or more than one is a failure (src/lib/confirmedWrite.ts).
 */
export function moneyOutApi(client: Writes, userId: string, table: OwnedTable) {
  // A network failure can throw instead of returning { error }; either way the caller gets a result.
  const run = async (send: () => PromiseLike<{ error: DbError | null }>): Promise<WriteResult> => {
    try { const { error } = await send(); return { error: error ?? null }; } catch (e) { return { error: { message: e instanceof Error ? e.message : String(e) } }; }
  };
  return {
    create: (payload: Payload) => run(() => client.from(table).insert([{ ...payload, user_id: userId }])),
    update: (id: string, payload: Payload) => confirmOne(() => client.from(table).update(payload).eq('id', id).eq('user_id', userId).select('id')),
    remove: (id: string) => confirmOne(() => client.from(table).delete().eq('id', id).eq('user_id', userId).select('id')),
  };
}
export type MoneyOutApi = ReturnType<typeof moneyOutApi>;
