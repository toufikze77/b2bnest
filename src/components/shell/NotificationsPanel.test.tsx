import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Call = { table: string; op: string; filters: [string, ...unknown[]][]; opts?: unknown };
const calls: Call[] = [];
let responder: (c: Call) => Promise<unknown>;
let authUser: { id: string } | null = { id: 'user-a' };

function builder(table: string) {
  const c: Call = { table, op: '', filters: [] };
  const chain: Record<string, unknown> = {};
  const add = (name: string) => (...args: unknown[]) => { c.filters.push([name, ...args]); return chain; };
  ['eq', 'or', 'in', 'order', 'limit'].forEach((m) => { chain[m] = add(m); });
  chain.select = (_cols: string, opts?: unknown) => { c.op = 'select'; c.opts = opts; return chain; };
  chain.update = (v: unknown) => { c.op = 'update'; c.filters.push(['set', v]); return chain; };
  chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => { calls.push(c); return responder(c).then(res, rej); };
  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => builder(t) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: authUser }) }));

import { NotificationsPanel } from './NotificationsPanel';

const rows = (uid: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${uid}-${i}`, title: `${uid} note ${i}`, message: 'm', read: false, created_at: new Date().toISOString() }));
const isCount = (c: Call) => (c.opts as { head?: boolean } | undefined)?.head === true;
const uidOf = (c: Call) => c.filters.find((f) => f[0] === 'eq' && f[1] === 'user_id')?.[2] as string;

const ui = () => <MemoryRouter><NotificationsPanel /></MemoryRouter>;

beforeEach(() => {
  calls.length = 0;
  authUser = { id: 'user-a' };
  responder = async (c) => {
    if (c.op === 'update') return { error: null };
    if (isCount(c)) return { count: 57, error: null };
    return { data: rows(uidOf(c), 20), error: null };
  };
});

describe('NotificationsPanel', () => {
  it('shows the full unread count, not the 20-row preview size', async () => {
    render(ui());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications, 57 unread' })).toBeInTheDocument());
    const countCall = calls.find(isCount)!;
    expect(countCall.filters).toContainEqual(['or', 'read.is.null,read.eq.false']);
    expect(countCall.filters.some((f) => f[0] === 'limit')).toBe(false);
  });

  it('mark all read updates every unread row for the user (no id list, no limit)', async () => {
    render(ui());
    fireEvent.click(await screen.findByRole('button', { name: /57 unread/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Mark all read/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument());
    const upd = calls.find((c) => c.op === 'update')!;
    expect(upd.filters).toContainEqual(['eq', 'user_id', 'user-a']);
    expect(upd.filters).toContainEqual(['or', 'read.is.null,read.eq.false']);
    expect(upd.filters.some((f) => f[0] === 'in' || f[0] === 'limit')).toBe(false);
  });

  it('shows an explicit error when marking read fails and keeps the count', async () => {
    responder = async (c) => {
      if (c.op === 'update') return { error: { message: 'denied' } };
      if (isCount(c)) return { count: 3, error: null };
      return { data: rows('user-a', 3), error: null };
    };
    render(ui());
    fireEvent.click(await screen.findByRole('button', { name: /3 unread/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Mark all read/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't mark notifications as read");
    expect(screen.getByRole('button', { name: /3 unread/ })).toBeInTheDocument();
  });

  it('clears on sign-out and ignores a stale response from the previous user', async () => {
    let releaseA: () => void = () => {};
    responder = (c) => {
      const uid = uidOf(c);
      const val = isCount(c) ? { count: uid === 'user-a' ? 9 : 2, error: null } : { data: rows(uid, 2), error: null };
      if (uid === 'user-a') return new Promise((r) => { releaseA = () => r(val); });
      return Promise.resolve(val);
    };
    const { rerender } = render(ui());
    authUser = null;
    rerender(ui());
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    authUser = { id: 'user-b' };
    rerender(ui());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument());
    await act(async () => { releaseA(); await Promise.resolve(); });
    expect(screen.getByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument();
    expect(screen.queryByText(/user-a note/)).not.toBeInTheDocument();
  });
});
