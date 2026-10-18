import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Call = { table: string; op: string; filters: [string, ...unknown[]][]; opts?: unknown; cols?: string };
const calls: Call[] = [];
let responder: (c: Call) => Promise<unknown>;
let authUser: { id: string } | null = { id: 'user-a' };

function builder(table: string) {
  const c: Call = { table, op: '', filters: [] };
  const chain: Record<string, unknown> = {};
  const add = (name: string) => (...args: unknown[]) => { c.filters.push([name, ...args]); return chain; };
  ['eq', 'or', 'in', 'order', 'limit'].forEach((m) => { chain[m] = add(m); });
  chain.select = (cols: string, opts?: unknown) => { c.op = 'select'; c.opts = opts; c.cols = cols; return chain; };
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

  it('a row with an in-app link is a link: clicking it marks it read, closes the panel and navigates', async () => {
    responder = async (c) => {
      if (c.op === 'update') return { error: null };
      if (isCount(c)) return { count: 1, error: null };
      return { data: [{ id: 'n1', title: 'Invoice INV-7 (1,250.00 GBP) is overdue', message: 'Acme Ltd.', read: false, created_at: new Date().toISOString(), type: 'invoice_overdue', link: '/business-tools?tool=business-finance-assistant&tab=invoices' }], error: null };
    };
    const Where = () => <div data-testid="where">{useLocation().pathname + useLocation().search}</div>;
    render(<MemoryRouter><NotificationsPanel /><Routes><Route path="*" element={<Where />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /1 unread/ }));
    const link = await screen.findByRole('link', { name: /Invoice INV-7/ });
    expect(link).toHaveAttribute('href', '/business-tools?tool=business-finance-assistant&tab=invoices');
    expect(within(link).getByText('Overdue invoice')).toBeInTheDocument();
    fireEvent.click(link);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/business-tools?tool=business-finance-assistant&tab=invoices'));
    await waitFor(() => expect(screen.queryByRole('link', { name: /Invoice INV-7/ })).not.toBeInTheDocument());
    const upd = calls.find((c) => c.op === 'update')!;
    expect(upd.filters).toContainEqual(['eq', 'id', 'n1']);
    expect(upd.filters).toContainEqual(['eq', 'user_id', 'user-a']);
  });

  it('never follows a link that leaves the app; the row stays a plain button', async () => {
    responder = async (c) => {
      if (c.op === 'update') return { error: null };
      if (isCount(c)) return { count: 1, error: null };
      return { data: [{ id: 'n1', title: 'Odd', message: 'm', read: false, created_at: new Date().toISOString(), type: 'info', link: '//evil.example/x' }], error: null };
    };
    render(ui());
    fireEvent.click(await screen.findByRole('button', { name: /1 unread/ }));
    expect(await screen.findByRole('button', { name: /Odd/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Odd/ })).not.toBeInTheDocument();
  });

  it('before the database change: a missing link column falls back to the old columns and still shows notifications', async () => {
    responder = async (c) => {
      if (isCount(c)) return { count: 1, error: null };
      if (c.cols?.includes('link')) return { data: null, error: { code: '42703', message: 'column notifications.link does not exist' } };
      return { data: [{ id: 'w1', title: 'Welcome to B2BNEST', message: 'Hello', read: false, created_at: new Date().toISOString(), type: 'welcome' }], error: null };
    };
    render(ui());
    fireEvent.click(await screen.findByRole('button', { name: /1 unread/ }));
    expect(await screen.findByRole('button', { name: /Welcome to B2BNEST/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const selects = calls.filter((c) => c.op === 'select' && !isCount(c)).map((c) => c.cols);
    expect(selects[0]).toContain('link');
    expect(selects).toContain('id,title,message,read,created_at,type');
  });

  it('groups rows under Today, Earlier this week and Older', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-22T12:00:00'), toFake: ['Date'] }); // a Thursday
    responder = async (c) => {
      if (isCount(c)) return { count: 0, error: null };
      return { data: [
        { id: 'a', title: 'From today', message: 'm', read: true, created_at: '2026-10-22T08:00:00', type: 'note_reminder', link: null },
        { id: 'b', title: 'From Monday', message: 'm', read: true, created_at: '2026-10-19T00:30:00', type: 'quote_update', link: null },
        { id: 'c', title: 'From Sunday', message: 'm', read: true, created_at: '2026-10-18T23:30:00', type: 'invoice_paid', link: null },
      ], error: null };
    };
    render(ui());
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    const today = await screen.findByRole('region', { name: 'Today' });
    expect(within(today).getByText('From today')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Earlier this week' })).getByText('From Monday')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Older' })).getByText('From Sunday')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('empty bell says so honestly', async () => {
    responder = async (c) => (isCount(c) ? { count: 0, error: null } : { data: [], error: null });
    render(ui());
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('Nothing needs your attention')).toBeInTheDocument();
  });

  it('load error shows Try again, which reloads', async () => {
    let fail = true;
    responder = async (c) => {
      if (fail) return isCount(c) ? { count: null, error: { message: 'boom' } } : { data: null, error: { message: 'boom' } };
      return isCount(c) ? { count: 0, error: null } : { data: [], error: null };
    };
    render(ui());
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText("Couldn't load notifications.")).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Nothing needs your attention')).toBeInTheDocument();
  });

  it('polls every 60 seconds while visible, refreshes on focus, and stops while the tab is hidden', async () => {
    vi.useFakeTimers();
    let visibility: DocumentVisibilityState = 'visible';
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    render(ui());
    await act(async () => { await Promise.resolve(); });
    const lists = () => calls.filter((c) => c.op === 'select' && !isCount(c)).length;
    const start = lists();
    await act(async () => { vi.advanceTimersByTime(60_000); await Promise.resolve(); });
    expect(lists()).toBe(start + 1);
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve(); });
    expect(lists()).toBe(start + 2);
    visibility = 'hidden';
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { vi.advanceTimersByTime(180_000); await Promise.resolve(); });
    expect(lists()).toBe(start + 2);
    visibility = 'visible';
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); });
    expect(lists()).toBe(start + 3);
    spy.mockRestore();
    vi.useRealTimers();
  });
});
