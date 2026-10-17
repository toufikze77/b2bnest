import type { DbError, Payload } from '@/lib/moneyOut';

export type MoneyOutTable = 'expenses' | 'outgoings' | 'suppliers' | 'products_services';
export type WriteResult = { error: DbError | null };

/** The slice of the Supabase client these writes use (kept narrow so tests can pass a fake). */
interface Writes {
  from: (table: string) => {
    insert: (rows: Payload[]) => PromiseLike<{ error: DbError | null }>;
    update: (row: Payload) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => PromiseLike<{ error: DbError | null }> } };
    delete: () => { eq: (c: string, v: string) => { eq: (c: string, v: string) => PromiseLike<{ error: DbError | null }> } };
  };
}

/**
 * Create, update and delete for the money-out tables. Every update and delete is scoped to the
 * row id AND the signed-in user's id (row-level security also enforces the owner, this is belt and braces).
 */
export function moneyOutApi(client: Writes, userId: string, table: MoneyOutTable) {
  // A network failure can throw instead of returning { error }; either way the caller gets a result.
  const run = async (send: () => PromiseLike<{ error: DbError | null }>): Promise<WriteResult> => {
    try { const { error } = await send(); return { error: error ?? null }; } catch (e) { return { error: { message: e instanceof Error ? e.message : String(e) } }; }
  };
  return {
    create: (payload: Payload) => run(() => client.from(table).insert([{ ...payload, user_id: userId }])),
    update: (id: string, payload: Payload) => run(() => client.from(table).update(payload).eq('id', id).eq('user_id', userId)),
    remove: (id: string) => run(() => client.from(table).delete().eq('id', id).eq('user_id', userId)),
  };
}
export type MoneyOutApi = ReturnType<typeof moneyOutApi>;
