import { describe, expect, it, vi } from 'vitest';

// Records the query chain for each table and answers with no rows.
const calls = vi.hoisted(() => [] as unknown[][]);
vi.mock('@/integrations/supabase/client', () => {
  const from = (table: string) => {
    const chain: Record<string, unknown> = new Proxy({}, {
      get(_t, k: string) {
        if (k === 'then') return (res: (v: unknown) => void) => res({ data: [], error: null, count: 0 });
        return (...a: unknown[]) => { calls.push([table, k, ...a]); return chain; };
      },
    });
    return chain;
  };
  return { supabase: { from } };
});

import { loadMoney } from './useDashboardWidgets';

describe('Dashboard money widget data', () => {
  it('reads only invoices that are not archived (archived_at is null)', async () => {
    await loadMoney('u1');
    const invoiceCalls = calls.filter((c) => c[0] === 'invoices');
    expect(invoiceCalls).toContainEqual(['invoices', 'eq', 'user_id', 'u1']);
    expect(invoiceCalls).toContainEqual(['invoices', 'is', 'archived_at', null]);
  });

  it('reads the user’s unpaid expenses (pending, approved or no status), capped, and never the bills table', async () => {
    calls.length = 0;
    await loadMoney('u1');
    const exp = calls.filter((c) => c[0] === 'expenses');
    expect(exp).toContainEqual(['expenses', 'select', 'amount,status', { count: 'exact' }]);
    expect(exp).toContainEqual(['expenses', 'eq', 'user_id', 'u1']);
    expect(exp).toContainEqual(['expenses', 'or', 'status.is.null,status.neq.paid']);
    expect(exp).toContainEqual(['expenses', 'limit', 2000]);
    expect(calls.some((c) => c[0] === 'bills')).toBe(false);
  });
});
