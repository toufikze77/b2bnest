import { describe, expect, it, vi } from 'vitest';
import { activeOnly, archivedNewestFirst, isArchived } from './archive';
import { documentApi, DocWrites } from './documentApi';

const docs = [
  { id: 'a', archived_at: null },
  { id: 'b', archived_at: '2026-10-01T10:00:00Z' },
  { id: 'c' },
  { id: 'd', archived_at: '2026-10-15T10:00:00Z' },
];

describe('archive helpers', () => {
  it('isArchived / activeOnly / archivedNewestFirst', () => {
    expect(docs.map(isArchived)).toEqual([false, true, false, true]);
    expect(activeOnly(docs).map((d) => d.id)).toEqual(['a', 'c']);
    expect(archivedNewestFirst(docs).map((d) => d.id)).toEqual(['d', 'b']);
  });
});

describe('documentApi', () => {
  const fake = (error: unknown = null) => {
    const calls: unknown[][] = [];
    const done = () => Promise.resolve({ error });
    const client = {
      from: (t: string) => {
        calls.push(['from', t]);
        return {
          update: (row: unknown) => { calls.push(['update', row]); return { eq: (c: string, v: string) => { calls.push(['eq', c, v]); return { eq: (c2: string, v2: string) => { calls.push(['eq', c2, v2]); return done(); } }; } }; },
          delete: () => { calls.push(['delete']); return { eq: (c: string, v: string) => { calls.push(['eq', c, v]); return { eq: (c2: string, v2: string) => { calls.push(['eq', c2, v2]); return { not: (c3: string, op: string, v3: null) => { calls.push(['not', c3, op, v3]); return done(); } }; } }; } }; },
        };
      },
    } as unknown as DocWrites;
    return { client, calls };
  };

  it('archive and restore set and clear archived_at, filtered by id and user', async () => {
    const { client, calls } = fake();
    const api = documentApi(client, 'u1', 'invoices');
    await api.archive('i1', '2026-10-17T12:00:00Z');
    await api.restore('i1');
    expect(calls).toEqual([
      ['from', 'invoices'], ['update', { archived_at: '2026-10-17T12:00:00Z' }], ['eq', 'id', 'i1'], ['eq', 'user_id', 'u1'],
      ['from', 'invoices'], ['update', { archived_at: null }], ['eq', 'id', 'i1'], ['eq', 'user_id', 'u1'],
    ]);
  });

  it('delete forever also requires archived_at to be set, so an active document can never be hard-deleted', async () => {
    const { client, calls } = fake();
    await documentApi(client, 'u1', 'quotes').deleteForever('q1');
    expect(calls).toEqual([['from', 'quotes'], ['delete'], ['eq', 'id', 'q1'], ['eq', 'user_id', 'u1'], ['not', 'archived_at', 'is', null]]);
  });

  it('errors come back as results, thrown errors too', async () => {
    expect(await documentApi(fake({ message: 'nope' }).client, 'u1', 'quotes').restore('q1')).toEqual({ error: { message: 'nope' } });
    const broken = { from: vi.fn(() => { throw new Error('offline'); }) } as unknown as DocWrites;
    expect(await documentApi(broken, 'u1', 'quotes').deleteForever('q1')).toEqual({ error: { message: 'offline' } });
  });
});
