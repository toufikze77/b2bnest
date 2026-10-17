import { isClosedStage } from './dashboardWidgets';
import { isUsableEmail, extractLinkedIn } from './crmContactsExcel';

export type AudienceContact = { status?: string | null; source?: string | null; email?: string | null; notes?: string | null };
export type AudienceFilter = { status: string; source: string; reach: 'any' | 'email' | 'linkedin' };
export const DEFAULT_FILTER: AudienceFilter = { status: 'all', source: 'all', reach: 'any' };

/** Coerce a stored filter (jsonb) back into a safe AudienceFilter. */
export function parseFilter(raw: unknown): AudienceFilter {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const reach = r.reach === 'email' || r.reach === 'linkedin' ? r.reach : 'any';
  return { status: typeof r.status === 'string' ? r.status : 'all', source: typeof r.source === 'string' ? r.source : 'all', reach };
}

/** Pure audience filter over the signed-in user's own CRM contacts. */
export function filterAudience<T extends AudienceContact>(contacts: T[], f: AudienceFilter): T[] {
  return contacts.filter((c) =>
    (f.status === 'all' || (c.status || 'lead') === f.status) &&
    (f.source === 'all' || (c.source || '') === f.source) &&
    (f.reach === 'any' || (f.reach === 'email' ? isUsableEmail(c.email) : !!extractLinkedIn(c.notes))));
}

type DealLike = { value?: number | null; probability?: number | null; stage?: string | null; currency?: string | null };

/**
 * CRM summary metrics from recorded data only.
 * - Open deals only (won/lost excluded).
 * - Totals kept per stored currency; never converted.
 * - Deals without a probability are not weighted; their raw value is reported separately.
 */
export function crmSummary(contacts: AudienceContact[], deals: DealLike[]) {
  // Same open/closed rule as the Dashboard and the pipeline board.
  const open = deals.filter((d) => !isClosedStage(d.stage));
  const weighted: Record<string, number> = {};
  const unweighted: Record<string, number> = {};
  let noProbability = 0;
  for (const d of open) {
    const cur = (d.currency || 'UNKNOWN').toUpperCase();
    const v = Number(d.value) || 0;
    if (d.probability == null) { noProbability++; unweighted[cur] = (unweighted[cur] || 0) + v; }
    else weighted[cur] = (weighted[cur] || 0) + Math.round((v * d.probability) / 100);
  }
  const customers = contacts.filter((c) => c.status === 'customer').length;
  return {
    contacts: contacts.length,
    openDeals: open.length,
    weightedByCurrency: weighted,
    noProbabilityDeals: noProbability,
    unweightedByCurrency: unweighted,
    customerShare: contacts.length ? Math.round((customers / contacts.length) * 100) : null,
  };
}

/** Formats per-currency totals without converting between currencies. */
export function formatByCurrency(totals: Record<string, number>): string {
  const entries = Object.entries(totals);
  if (!entries.length) return '0';
  return entries.map(([cur, v]) => {
    try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v); }
    catch { return `${v.toLocaleString('en-GB')} (currency not set)`; }
  }).join(' + ');
}

/** Contacts a campaign can still show: drops IDs of deleted or inaccessible contacts. */
export function resolveSelected<T extends { id: string }>(ids: string[], contacts: T[]): { found: T[]; missing: number } {
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const found = ids.map((id) => byId.get(id)).filter(Boolean) as T[];
  return { found, missing: ids.length - found.length };
}
