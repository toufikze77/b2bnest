// Finance phase 3a follow-up: post waiting invoices straight away (docs/ledger-auto/README.md, "Instant posting").
// The database trigger still queues every invoice change and the pg_cron job still posts the queue (the safety net);
// this only runs the existing RPC ledger_auto_run sooner, for an owner or admin whose company has the switch on.
import { isDemoNow } from '@/lib/demoMode';
import { ledgerApi, type LedgerApi } from '@/lib/ledgerApi';

type AutoRunApi = Pick<LedgerApi, 'autoStatus' | 'autoRun'>;

/**
 * Posts this company's waiting invoices if, and only if, ledger_auto_status says the switch is on, the person may
 * manage it and something is waiting. At most `maxRuns` runs (each posts up to 200), stopping when nothing remains.
 * Returns how many runs posted something; never throws.
 */
export async function runWaitingPostings(api: AutoRunApi, org: string, maxRuns = 3): Promise<number> {
  try {
    const s = await api.autoStatus(org);
    if (!('data' in s) || !s.data) return 0;
    const { invoices_enabled, can_manage, waiting } = s.data;
    if (!invoices_enabled || !can_manage || !(waiting > 0)) return 0;
    let runs = 0;
    for (let i = 0; i < maxRuns; i++) {
      const r = await api.autoRun(org);
      if (!('data' in r) || !r.data) break;
      runs++;
      if (!(r.data.remaining > 0)) break;
    }
    return runs;
  } catch {
    return 0;
  }
}

export const AUTO_SOON_DELAY_MS = 1500;
export const AUTO_SOON_GAP_MS = 3000;
const scheduled = new Map<string, ReturnType<typeof setTimeout>>();
const lastRun = new Map<string, number>();

interface SoonDeps { api?: AutoRunApi; isDemo?: () => boolean; now?: () => number }

/**
 * After an invoice is created, edited, marked paid or unpaid, archived, restored or deleted: wait ~1.5 s (so the
 * database trigger has queued it), then post the company's waiting invoices once. Fire and forget: it returns at
 * once, never throws and never shows anything, so the invoice flow is never blocked, delayed or interrupted.
 * A burst of saves makes one call per company per 3 s. Demo accounts never call it; plain members, a switch that is
 * off, a plan that doesn't include the ledger or a missing database function end at the status check, silently.
 */
export function runLedgerAutoSoon(organizationId: string | null | undefined, deps: SoonDeps = {}): void {
  try {
    if (!organizationId) return;
    if ((deps.isDemo ?? isDemoNow)()) return;
    if (scheduled.has(organizationId)) return; // already on its way: this save is covered by it
    const now = (deps.now ?? Date.now)();
    const since = now - (lastRun.get(organizationId) ?? -Infinity);
    const delay = Math.max(AUTO_SOON_DELAY_MS, AUTO_SOON_GAP_MS - since);
    scheduled.set(organizationId, setTimeout(() => {
      scheduled.delete(organizationId);
      lastRun.set(organizationId, (deps.now ?? Date.now)());
      try {
        void runWaitingPostings(deps.api ?? ledgerApi(), organizationId, 1).catch(() => undefined);
      } catch { /* silent by design */ }
    }, delay));
  } catch { /* silent by design */ }
}

/** Tests only. */
export function resetLedgerAutoSoon() {
  for (const t of scheduled.values()) clearTimeout(t);
  scheduled.clear();
  lastRun.clear();
}
