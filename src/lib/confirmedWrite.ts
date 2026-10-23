import type { DbError } from '@/lib/moneyOut';

/**
 * Single-row writes must say how many rows they changed. Supabase returns no error when an update or delete matches
 * zero rows (wrong id, row-level security said no, already deleted), so "no error" alone is not success.
 */
export const NO_ROWS_MESSAGE = "Nothing was changed: the record wasn't found, or you don't have permission to change it. Refresh and try again.";
export const TOO_MANY_ROWS_MESSAGE = 'More than one record matched a change meant for one, so it was treated as a failure. Please refresh and contact support if it happens again.';

export type Confirmed = PromiseLike<{ data: unknown[] | null; error: DbError | null }>;

/** Runs a write that ends in `.select('id')`; only exactly one changed row counts as success. Thrown errors become results. */
export async function confirmOne(send: () => Confirmed): Promise<{ error: DbError | null }> {
  try {
    const { data, error } = await send();
    if (error) return { error };
    const n = data?.length ?? 0;
    if (n === 0) return { error: { code: 'NO_ROWS', message: NO_ROWS_MESSAGE } };
    if (n > 1) return { error: { code: 'TOO_MANY_ROWS', message: TOO_MANY_ROWS_MESSAGE } };
    return { error: null };
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : String(e) } };
  }
}
