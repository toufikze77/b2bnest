import { describe, it, expect, vi, beforeEach } from 'vitest';

const result = { data: null as unknown, error: null as unknown };
const calls: string[] = [];
const chain: Record<string, unknown> = {};
['delete', 'eq', 'is'].forEach((m) => { chain[m] = (...a: unknown[]) => { calls.push(`${m}:${a.join(',')}`); return chain; }; });
chain.select = () => Promise.resolve(result);
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => chain } }));
import { deleteTaskConfirmed } from './deleteTask';

describe('deleteTaskConfirmed', () => {
  beforeEach(() => { calls.length = 0; result.data = null; result.error = null; });

  it('succeeds only when the database confirms one deleted row, scoped to the company', async () => {
    result.data = [{ id: 't1' }];
    await expect(deleteTaskConfirmed('t1', 'o1')).resolves.toBeUndefined();
    expect(calls).toEqual(['delete:', 'eq:id,t1', 'eq:organization_id,o1']);
  });

  it('fails on a zero-row delete (no permission or already gone)', async () => {
    result.data = [];
    await expect(deleteTaskConfirmed('t1', 'o1')).rejects.toThrow('was not deleted');
  });

  it('fails on a permission error', async () => {
    result.error = { message: 'permission denied for table todos' };
    await expect(deleteTaskConfirmed('t1', 'o1')).rejects.toThrow('permission denied');
  });
});
