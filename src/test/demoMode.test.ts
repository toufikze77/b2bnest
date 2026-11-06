// Demo read-only: the one place failure messages are mapped. For anyone not in demo mode nothing changes.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEMO_READONLY_MESSAGE, demoAwareFetch, demoToastProps, friendlyError, installSonnerDemoMapping, isDemoReadonlyError,
  noteDemoRefusal, recentDemoRefusal, resetDemoMode,
} from '@/lib/demoMode';

afterEach(() => { resetDemoMode(); vi.useRealTimers(); });

describe('isDemoReadonlyError / friendlyError', () => {
  it('recognises the database guard and the Edge Function refusal', () => {
    expect(isDemoReadonlyError({ code: '42501', message: DEMO_READONLY_MESSAGE })).toBe(true);
    expect(isDemoReadonlyError({ ok: false, code: 'demo_readonly', error: DEMO_READONLY_MESSAGE })).toBe(true);
    expect(isDemoReadonlyError(new Error(DEMO_READONLY_MESSAGE))).toBe(true);
    expect(isDemoReadonlyError({ code: '42501', message: 'new row violates row-level security policy' })).toBe(false);
    expect(isDemoReadonlyError(null)).toBe(false);
  });
  it('friendlyError: the demo message for a demo refusal, otherwise the error unchanged', () => {
    expect(friendlyError({ code: '42501', message: `ERROR: ${DEMO_READONLY_MESSAGE}` })).toBe(DEMO_READONLY_MESSAGE);
    expect(friendlyError({ message: 'duplicate key' })).toBe('duplicate key');
    expect(friendlyError(undefined, 'Could not save')).toBe('Could not save');
  });
});

describe('demoAwareFetch', () => {
  it('notes a 403 that carries the demo message, and returns the response untouched', async () => {
    const res = new Response(JSON.stringify({ code: '42501', message: DEMO_READONLY_MESSAGE }), { status: 403 });
    const f = demoAwareFetch(async () => res);
    const out = await f('https://x.test/rest/v1/todos', { method: 'POST' });
    expect(out).toBe(res);
    expect(await out.json()).toEqual({ code: '42501', message: DEMO_READONLY_MESSAGE });
    expect(recentDemoRefusal()).toBe(true);
  });
  it('ignores every other response (normal people are never affected)', async () => {
    for (const r of [new Response('{}', { status: 200 }), new Response('{"message":"nope"}', { status: 403 }), new Response(DEMO_READONLY_MESSAGE, { status: 400 })]) {
      await demoAwareFetch(async () => r)('https://x.test');
    }
    expect(recentDemoRefusal()).toBe(false);
  });
});

describe('toast mapping', () => {
  it('normal mode: every toast passes unchanged', () => {
    const t = { title: 'Error', description: 'Failed to save task', variant: 'destructive' as const };
    expect(demoToastProps(t)).toBe(t);
    const ok = { title: 'Saved' };
    expect(demoToastProps(ok)).toBe(ok);
  });
  it('after a demo refusal, the failure toast says "view only" instead of a raw or generic error', () => {
    noteDemoRefusal();
    expect(demoToastProps({ title: 'Error', description: 'Failed to save task', variant: 'destructive' })).toEqual({
      title: 'View only', description: DEMO_READONLY_MESSAGE, variant: 'destructive',
    });
    expect(demoToastProps({ title: 'Saved' })).toEqual({ title: 'Saved' });
  });
  it('a toast that already carries the message is tidied too; the mapping stops after a few seconds', () => {
    vi.useFakeTimers();
    expect(demoToastProps({ title: 'Error', description: DEMO_READONLY_MESSAGE, variant: 'destructive' }).title).toBe('View only');
    noteDemoRefusal();
    vi.advanceTimersByTime(9000);
    const t = { title: 'Error', description: 'Network down', variant: 'destructive' as const };
    expect(demoToastProps(t)).toBe(t);
  });
  it('sonner toast.error is mapped the same way, and unchanged otherwise', () => {
    const calls: unknown[][] = [];
    const sonner = { error: (m: unknown, d?: unknown) => { calls.push([m, d]); return 1; } };
    installSonnerDemoMapping(sonner);
    installSonnerDemoMapping(sonner);
    sonner.error('Failed to create project');
    noteDemoRefusal();
    sonner.error('Failed to create project', { description: 'raw' });
    expect(calls).toEqual([['Failed to create project', undefined], [DEMO_READONLY_MESSAGE, { description: undefined }]]);
  });
});
