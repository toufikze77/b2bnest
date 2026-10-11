import { isUsableEmail, extractLinkedIn } from './crmContactsExcel';

export type AudienceContact = { status?: string | null; source?: string | null; email?: string | null; notes?: string | null };
export type AudienceFilter = { status: string; source: string; reach: 'any' | 'email' | 'linkedin' };

/** Pure audience filter over the signed-in user's own CRM contacts. */
export function filterAudience<T extends AudienceContact>(contacts: T[], f: AudienceFilter): T[] {
  return contacts.filter((c) =>
    (f.status === 'all' || (c.status || 'lead') === f.status) &&
    (f.source === 'all' || (c.source || '') === f.source) &&
    (f.reach === 'any' || (f.reach === 'email' ? isUsableEmail(c.email) : !!extractLinkedIn(c.notes))));
}

/** CRM summary metrics from recorded data only. */
export function crmSummary(contacts: AudienceContact[], deals: { value?: number | null; probability?: number | null; stage?: string | null }[]) {
  const open = deals.filter((d) => !['closed-won', 'closed-lost', 'won', 'lost'].includes((d.stage || '').toLowerCase()));
  const weighted = open.reduce((s, d) => s + (Number(d.value) || 0) * (d.probability ?? 0) / 100, 0);
  const customers = contacts.filter((c) => c.status === 'customer').length;
  return {
    contacts: contacts.length,
    openDeals: open.length,
    weightedPipeline: Math.round(weighted),
    customerShare: contacts.length ? Math.round((customers / contacts.length) * 100) : null,
  };
}
