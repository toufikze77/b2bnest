import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_SOON_DELAY_MS, resetLedgerAutoSoon, runLedgerAutoSoon, runWaitingPostings } from './ledgerAutoRun';
import { ledgerSectionFromSearch, searchWithLedgerSection } from './financeTabs';

const status = (o: Record<string, unknown> = {}) => ({ ok: true as const, data: { access: 'ok', can_manage: true, set_up: true, invoices_enabled: true, enabled_at: null, waiting: 2, open_issues: 0, ...o } });
const run = (remaining = 0) => ({ ok: true as const, data: { processed: 2, failed: 0, dropped: 0, remaining } });
const fakeApi = (s = status(), r = run()) => ({ autoStatus: vi.fn((_org: string) => Promise.resolve(s)), autoRun: vi.fn((_org: string) => Promise.resolve(r)) });

describe('runWaitingPostings', () => {
  it('runs only for a manager with the switch on and something waiting', async () => {
    const yes = fakeApi();
    expect(await runWaitingPostings(yes as never, 'o')).toBe(1);
    expect(yes.autoRun).toHaveBeenCalledWith('o');
    for (const s of [status({ can_manage: false }), status({ invoices_enabled: false }), status({ waiting: 0 }), { ok: false as const, code: 'NOT_AVAILABLE' }]) {
      const api = fakeApi(s as never);
      expect(await runWaitingPostings(api as never, 'o')).toBe(0);
      expect(api.autoRun).not.toHaveBeenCalled();
    }
  });
  it('loops at most three times while invoices remain, and stops when none remain', async () => {
    const many = fakeApi(status(), run(500));
    expect(await runWaitingPostings(many as never, 'o')).toBe(3);
    expect(many.autoRun).toHaveBeenCalledTimes(3);
    const once = fakeApi(status(), run(0));
    await runWaitingPostings(once as never, 'o');
    expect(once.autoRun).toHaveBeenCalledTimes(1);
  });
  it('never throws (a refusal or a rejected call ends quietly)', async () => {
    const refused = { autoStatus: vi.fn(() => Promise.resolve(status())), autoRun: vi.fn(() => Promise.resolve({ ok: false as const, code: 'AUTO_OFF' })) };
    expect(await runWaitingPostings(refused as never, 'o')).toBe(0);
    const broken = { autoStatus: vi.fn(() => Promise.reject(new Error('network'))), autoRun: vi.fn() };
    expect(await runWaitingPostings(broken as never, 'o')).toBe(0);
  });
});

describe('runLedgerAutoSoon (after an invoice save)', () => {
  beforeEach(() => { vi.useFakeTimers(); resetLedgerAutoSoon(); });
  afterEach(() => { resetLedgerAutoSoon(); vi.useRealTimers(); });
  const deps = (api = fakeApi()) => ({ api: api as never, isDemo: () => false, now: () => Date.now() });

  it('waits about 1.5 s, then runs once', async () => {
    const api = fakeApi();
    expect(runLedgerAutoSoon('o', deps(api))).toBeUndefined();
    expect(api.autoStatus).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(AUTO_SOON_DELAY_MS - 1);
    expect(api.autoStatus).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(api.autoStatus).toHaveBeenCalledTimes(1);
    expect(api.autoRun).toHaveBeenCalledTimes(1);
  });

  it('a burst of saves makes one call per company per 3 s; other companies are separate', async () => {
    const api = fakeApi();
    const d = deps(api);
    for (let i = 0; i < 5; i++) runLedgerAutoSoon('o', d);
    runLedgerAutoSoon('other', d);
    await vi.advanceTimersByTimeAsync(1500);
    expect(api.autoRun).toHaveBeenCalledTimes(2);
    expect(api.autoRun.mock.calls.map((c) => c[0]).sort()).toEqual(['o', 'other']);
    runLedgerAutoSoon('o', d); // straight after the last run: waits until 3 s have passed since it
    await vi.advanceTimersByTimeAsync(2999);
    expect(api.autoRun).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.autoRun).toHaveBeenCalledTimes(3);
  });

  it('never for the demo account or without a company', async () => {
    const api = fakeApi();
    runLedgerAutoSoon('o', { ...deps(api), isDemo: () => true });
    runLedgerAutoSoon(null, deps(api));
    runLedgerAutoSoon(undefined, deps(api));
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.autoStatus).not.toHaveBeenCalled();
  });

  it('a plain member never calls ledger_auto_run', async () => {
    const api = fakeApi(status({ can_manage: false }));
    runLedgerAutoSoon('o', deps(api));
    await vi.advanceTimersByTimeAsync(2000);
    expect(api.autoRun).not.toHaveBeenCalled();
  });

  it('fails silently: the invoice flow carries on and nothing is unhandled when the call rejects', async () => {
    const api = { autoStatus: vi.fn(() => Promise.reject(new Error('network down'))), autoRun: vi.fn(() => Promise.reject(new Error('boom'))) };
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const saveInvoice = async () => { const saved = 'INV-1 saved'; runLedgerAutoSoon('o', deps(api as never)); return saved; };
    await expect(saveInvoice()).resolves.toBe('INV-1 saved');
    await vi.advanceTimersByTimeAsync(2000);
    expect(api.autoStatus).toHaveBeenCalledTimes(1);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    const throwing = { autoStatus: vi.fn(() => { throw new Error('sync'); }), autoRun: vi.fn() };
    expect(() => runLedgerAutoSoon('p', deps(throwing as never))).not.toThrow();
    await vi.advanceTimersByTimeAsync(2000);
  });
});

describe('the Ledger section in the URL', () => {
  it('reads ?ledger= and falls back to journals', () => {
    expect(ledgerSectionFromSearch('?ledger=trial-balance')).toBe('trial-balance');
    expect(ledgerSectionFromSearch('?ledger=automatic&tab=ledger')).toBe('automatic');
    expect(ledgerSectionFromSearch('?ledger=nope')).toBe('journals');
    expect(ledgerSectionFromSearch('')).toBe('journals');
  });
  it('writes it and keeps every other param', () => {
    expect(searchWithLedgerSection('?tool=x&tab=ledger', 'accounts')).toBe('tool=x&tab=ledger&ledger=accounts');
    expect(searchWithLedgerSection('?tab=ledger&ledger=accounts', 'journals')).toBe('tab=ledger&ledger=journals');
  });
});
