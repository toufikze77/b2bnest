import { describe, expect, it } from 'vitest';
import { documentApi, DocWrites } from './documentApi';
import { moneyOutApi } from './moneyOutApi';
import { notesApi, NotesWrites } from './notesApi';
import { NO_ROWS_MESSAGE, TOO_MANY_ROWS_MESSAGE } from './confirmedWrite';

// A fake Supabase query: every filter returns the same builder; awaiting it (with or without .select) resolves to
// what the database would say. `rows` is how many rows the write matched.
function fakeClient(rows: number) {
  const calls: string[] = [];
  const result = { data: Array.from({ length: rows }, (_, i) => ({ id: `r${i}` })), error: null };
  const builder: Record<string, unknown> = {};
  for (const m of ['update', 'delete', 'eq', 'not', 'select', 'insert']) {
    builder[m] = (...args: unknown[]) => { calls.push(`${m}(${args.map((a) => JSON.stringify(a)).join(',')})`); return builder; };
  }
  builder.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result).then(ok, bad);
  return { client: { from: (t: string) => { calls.push(`from(${t})`); return builder; } }, calls };
}

type Op = { name: string; run: (rows: number) => Promise<{ error: { message?: string } | null }> };
const ops: Op[] = [
  { name: 'invoice update', run: (n) => documentApi(fakeClient(n).client as unknown as DocWrites, 'u1', 'invoices').update('i1', { status: 'paid' }) },
  { name: 'quote archive', run: (n) => documentApi(fakeClient(n).client as unknown as DocWrites, 'u1', 'quotes').archive('q1', '2026-10-23T10:00:00Z') },
  { name: 'invoice restore', run: (n) => documentApi(fakeClient(n).client as unknown as DocWrites, 'u1', 'invoices').restore('i1') },
  { name: 'quote delete forever', run: (n) => documentApi(fakeClient(n).client as unknown as DocWrites, 'u1', 'quotes').deleteForever('q1') },
  { name: 'expense update', run: (n) => moneyOutApi(fakeClient(n).client as never, 'u1', 'expenses').update('e1', { amount: 1 }) },
  { name: 'supplier delete', run: (n) => moneyOutApi(fakeClient(n).client as never, 'u1', 'suppliers').remove('s1') },
  { name: 'invoice status via moneyOutApi', run: (n) => moneyOutApi(fakeClient(n).client as never, 'u1', 'invoices').update('i1', { status: 'sent' }) },
  { name: 'note update', run: (n) => notesApi(fakeClient(n).client as unknown as NotesWrites, 'u1').update('n1', { title: 'T' }) },
  { name: 'note delete', run: (n) => notesApi(fakeClient(n).client as unknown as NotesWrites, 'u1').remove('n1') },
];

describe.each(ops)('$name', ({ run }) => {
  it('zero rows changed is a failure with a clear message (not "success")', async () => {
    const r = await run(0);
    expect(r.error?.message).toBe(NO_ROWS_MESSAGE);
  });
  it('more than one row for a single-id write is a failure', async () => {
    const r = await run(2);
    expect(r.error?.message).toBe(TOO_MANY_ROWS_MESSAGE);
  });
  it('exactly one row is success', async () => {
    expect((await run(1)).error).toBeNull();
  });
});

describe('writes ask the database which rows changed, scoped to the row and the signed-in user', () => {
  it('documentApi delete forever: id, user, archived only, then select id', async () => {
    const { client, calls } = fakeClient(1);
    await documentApi(client as unknown as DocWrites, 'u1', 'quotes').deleteForever('q1');
    expect(calls).toEqual(['from(quotes)', 'delete()', 'eq("id","q1")', 'eq("user_id","u1")', 'not("archived_at","is",null)', 'select("id")']);
  });
  it('notesApi update: id and user, then select id', async () => {
    const { client, calls } = fakeClient(1);
    await notesApi(client as unknown as NotesWrites, 'u1').update('n1', { is_pinned: true });
    expect(calls).toEqual(['from(notes)', 'update({"is_pinned":true})', 'eq("id","n1")', 'eq("user_id","u1")', 'select("id")']);
  });
});

describe('Note Pro uses the confirmed writes', () => {
  it('has no raw notes update/delete left (they reported success when nothing changed)', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('src/components/NotePro.tsx', 'utf8').replace(/\s+/g, ' ');
    expect(src).not.toMatch(/from\("notes"\) ?\.(update|delete)\(/);
    expect(src).toMatch(/noteWrites\.update\(/);
    expect(src).toMatch(/noteWrites\.remove\(/);
  });
});
