import { beforeEach, describe, expect, it, vi } from 'vitest';

// A small stand-in for the Supabase query builder: records the calls and answers with `next`.
const db = vi.hoisted(() => ({ calls: [] as unknown[][], next: { data: null as unknown, error: null as unknown }, throws: false }));
vi.mock('@/integrations/supabase/client', () => {
  const chain: Record<string, unknown> = new Proxy({}, {
    get: (_t, k) => (k === 'then'
      ? (ok: (v: unknown) => void, bad: (e: unknown) => void) => (db.throws ? bad(new Error('offline')) : ok(db.next))
      : (...a: unknown[]) => { db.calls.push([k, ...a]); return chain; }),
  });
  return { supabase: { from: (t: string) => { db.calls.push(['from', t]); return chain; } } };
});

import {
  byteSize, clearDraft, deleteItem, isSavableTool, itemError, LIMIT_MESSAGE, listItems, loadDraft, markMoveAnswered, MAX_DATA_BYTES,
  mergeById, moveAnswered, NEEDS_DB_UPDATE, saveDraft, saveItem, shortDate, signInUrl, signUpUrl, SUSPENDED_SAVE_MESSAGE, TOO_BIG_MESSAGE,
  validateItem,
} from './freeToolItems';

const MISSING = { code: 'PGRST205', message: "Could not find the table 'public.free_tool_items' in the schema cache" };
beforeEach(() => { db.calls = []; db.next = { data: null, error: null }; db.throws = false; localStorage.clear(); sessionStorage.clear(); });

describe('free tool items (Phase 39)', () => {
  it('the seven free tools that save, and nothing else (the database CHECK says the same)', () => {
    for (const t of ['roi-calculator', 'goal-tracker', 'customer-survey-builder', 'cost-calculator', 'setup-checklist', 'compliance', 'best-practices']) expect(isSavableTool(t)).toBe(true);
    for (const t of ['notepro', 'business-finance-assistant', 'crm', '', null]) expect(isSavableTool(t)).toBe(false);
  });

  it('validates before sending: name 1 to 120 characters, an object or list, at most 64 KB', () => {
    expect(validateItem('roi-calculator', 'Van', { a: 1 })).toBeNull();
    expect(validateItem('crm', 'Van', {})).toMatch(/can’t save/);
    expect(validateItem('roi-calculator', '   ', {})).toMatch(/1 to 120/);
    expect(validateItem('roi-calculator', 'x'.repeat(121), {})).toMatch(/1 to 120/);
    expect(validateItem('roi-calculator', 'Van', 'text' as unknown)).toBe('There is nothing to save.');
    const big = { notes: 'x'.repeat(MAX_DATA_BYTES) };
    expect(byteSize(big)).toBeGreaterThan(MAX_DATA_BYTES);
    expect(validateItem('roi-calculator', 'Big', big)).toBe(TOO_BIG_MESSAGE);
    expect(byteSize({ s: '£' })).toBe(10); // counted in bytes (UTF-8), not characters
  });

  it('database errors in plain words: limit, missing table, suspended, two-step, size', () => {
    expect(itemError({ message: 'FREE_TOOL_ITEM_LIMIT' })).toBe(LIMIT_MESSAGE);
    expect(LIMIT_MESSAGE).toBe('You can save up to 50 items in each tool. Delete one first.');
    expect(itemError(MISSING)).toBe(NEEDS_DB_UPDATE);
    expect(itemError({ code: '42P01', message: 'relation "public.free_tool_items" does not exist' })).toBe(NEEDS_DB_UPDATE);
    expect(NEEDS_DB_UPDATE).toMatch(/^Saving to your account needs a database update\./);
    expect(itemError({ code: '42501', message: 'new row violates row-level security policy for table "free_tool_items"' })).toBe(SUSPENDED_SAVE_MESSAGE);
    expect(itemError({ message: 'MFA_REQUIRED' })).toMatch(/two-step/);
    expect(itemError({ message: 'violates check constraint "fti_data"' })).toBe(TOO_BIG_MESSAGE);
  });

  it('save inserts your own row for the tool; with an id it updates; list is newest first; delete by id', async () => {
    db.next = { data: { id: 'i1', tool: 'roi-calculator', name: 'Van', data: { a: 1 }, created_at: '', updated_at: '' }, error: null };
    const r = await saveItem('u1', 'roi-calculator', '  Van ', { a: 1 });
    expect(r.ok).toBe(true);
    expect(db.calls).toContainEqual(['insert', { name: 'Van', data: { a: 1 }, user_id: 'u1', tool: 'roi-calculator' }]);
    db.calls = [];
    await saveItem('u1', 'roi-calculator', 'Van 2', { a: 2 }, 'i1');
    expect(db.calls).toContainEqual(['update', { name: 'Van 2', data: { a: 2 } }]);
    expect(db.calls).toContainEqual(['eq', 'id', 'i1']);
    db.calls = []; db.next = { data: [], error: null };
    expect((await listItems('goal-tracker')).ok).toBe(true);
    expect(db.calls).toContainEqual(['eq', 'tool', 'goal-tracker']);
    expect(db.calls).toContainEqual(['order', 'updated_at', { ascending: false }]);
    db.calls = []; db.next = { data: null, error: null };
    expect((await deleteItem('i1')).ok).toBe(true);
    expect(db.calls).toContainEqual(['eq', 'id', 'i1']);
  });

  it('the 51st item: the limit message; nothing is sent when the browser check fails', async () => {
    db.next = { data: null, error: { code: 'P0001', message: 'FREE_TOOL_ITEM_LIMIT' } };
    expect(await saveItem('u1', 'goal-tracker', 'Goals', [])).toMatchObject({ ok: false, error: LIMIT_MESSAGE });
    db.calls = [];
    expect(await saveItem('u1', 'goal-tracker', '', [])).toMatchObject({ ok: false });
    expect(db.calls).toEqual([]);
  });

  it('before the SQL is applied, and offline: a clear message, never a crash', async () => {
    db.next = { data: null, error: MISSING };
    expect(await listItems('roi-calculator')).toEqual({ ok: false, error: NEEDS_DB_UPDATE, missing: true });
    expect(await saveItem('u1', 'roi-calculator', 'Van', {})).toMatchObject({ ok: false, missing: true, error: NEEDS_DB_UPDATE });
    db.throws = true;
    expect((await listItems('roi-calculator')).ok).toBe(false);
  });

  it('drafts for this tab (sessionStorage), validated when read back; storage errors are ignored', () => {
    const isObj = (v: unknown): v is { n: number } => !!v && typeof (v as { n?: unknown }).n === 'number';
    saveDraft('cost-calculator', { n: 1 });
    expect(loadDraft('cost-calculator', isObj)).toEqual({ n: 1 });
    sessionStorage.setItem('b2bnest.freeToolDraft.cost-calculator', '{"n":"x"}');
    expect(loadDraft('cost-calculator', isObj)).toBeNull();
    sessionStorage.setItem('b2bnest.freeToolDraft.cost-calculator', 'not json');
    expect(loadDraft('cost-calculator', isObj)).toBeNull();
    clearDraft('cost-calculator');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => saveDraft('cost-calculator', { n: 1 })).not.toThrow();
    vi.restoreAllMocks();
  });

  it('the one-time move is answered per account and tool; merging keeps the account and adds what is new', () => {
    expect(moveAnswered('goal-tracker', 'u1')).toBe(false);
    markMoveAnswered('goal-tracker', 'u1');
    expect(moveAnswered('goal-tracker', 'u1')).toBe(true);
    expect(moveAnswered('goal-tracker', 'u2')).toBe(false);
    expect(mergeById([{ id: 'a', v: 1 }], [{ id: 'a', v: 2 }, { id: 'b', v: 3 }])).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 3 }]);
  });

  it('prompts go back to the same tool after creating an account or signing in; dates as 2 Nov 2026', () => {
    expect(signUpUrl('cost-calculator')).toBe('/auth?next=%2Fbusiness-tools%3Ftool%3Dcost-calculator&mode=signup');
    expect(signInUrl('cost-calculator')).toBe('/auth?next=%2Fbusiness-tools%3Ftool%3Dcost-calculator');
    expect(shortDate('2026-11-02T10:00:00Z')).toBe('2 Nov 2026');
  });
});
