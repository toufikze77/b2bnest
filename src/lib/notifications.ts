import { isSameDay, startOfWeek } from 'date-fns';

/** Types written by the Phase 7 database proposal (docs/phase7-notifications). Older rows use other types, or none. */
export const IN_APP_TYPES = ['invoice_overdue', 'invoice_paid', 'quote_update', 'note_reminder'] as const;
export type InAppType = (typeof IN_APP_TYPES)[number];

export const IN_APP_TYPE_COPY: Record<InAppType, { label: string; description: string }> = {
  invoice_overdue: { label: 'Overdue invoices', description: 'When a sent invoice passes its due date and is not marked paid' },
  invoice_paid: { label: 'Invoice paid', description: 'When an invoice is marked paid in B2BNEST' },
  quote_update: { label: 'Quote status changes', description: 'When a quote moves to a new status, such as sent or accepted' },
  note_reminder: { label: 'Note reminders', description: 'When a reminder time you set on a note passes' },
};

export type NotificationKind = InAppType | 'shared' | 'support' | 'welcome' | 'general';

/** Groups any stored `type` (including old and unknown ones) into a kind with its own icon and label. */
export function notificationKind(type: string | null | undefined): NotificationKind {
  const t = (type ?? '').trim().toLowerCase();
  if ((IN_APP_TYPES as readonly string[]).includes(t)) return t as InAppType;
  if (t.endsWith('_shared') || t === 'shared') return 'shared';
  if (t.startsWith('support')) return 'support';
  if (t === 'welcome') return 'welcome';
  return 'general';
}

export const KIND_LABEL: Record<NotificationKind, string> = {
  invoice_overdue: 'Overdue invoice',
  invoice_paid: 'Invoice paid',
  quote_update: 'Quote update',
  note_reminder: 'Note reminder',
  shared: 'Shared with you',
  support: 'Support',
  welcome: 'Welcome',
  general: 'Notification',
};

/** Only in-app paths are followed: "/x", never "//host", "/\host", "https://…" or anything with spaces. */
export function safeInAppLink(link: string | null | undefined): string | null {
  if (!link || link.length > 500) return null;
  if (!/^\/([^/\\]|$)/.test(link) || /[\s\p{Cc}]/u.test(link)) return null;
  return link;
}

export type NotificationGroup = 'Today' | 'Earlier this week' | 'Older';

/** Today = the viewer's calendar day. Earlier this week = from Monday 00:00 (local) up to today. Everything else is Older. */
export function notificationGroup(createdAt: string | null | undefined, now: Date = new Date()): NotificationGroup {
  if (!createdAt) return 'Older';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return 'Older';
  if (isSameDay(d, now)) return 'Today';
  if (d >= startOfWeek(now, { weekStartsOn: 1 }) && d < now) return 'Earlier this week';
  return 'Older';
}

export function groupNotifications<T extends { created_at: string | null }>(items: T[], now: Date = new Date()) {
  const order: NotificationGroup[] = ['Today', 'Earlier this week', 'Older'];
  const buckets = new Map<NotificationGroup, T[]>(order.map((g) => [g, []]));
  for (const item of items) buckets.get(notificationGroup(item.created_at, now))!.push(item);
  return order.map((label) => ({ label, items: buckets.get(label)! })).filter((g) => g.items.length > 0);
}

type PgError = { code?: string; message?: string } | null | undefined;

/** The Phase 7 columns (link, dedupe_key) are not there yet: the proposal has not been applied. */
export function isMissingColumnError(e: PgError): boolean {
  if (!e) return false;
  return e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist/i.test(e.message ?? '');
}

/** The table (e.g. notification_type_prefs) is not there yet. */
export function isMissingTableError(e: PgError): boolean {
  if (!e) return false;
  return e.code === '42P01' || e.code === 'PGRST205' || /(relation|table) .* does not exist|could not find the table/i.test(e.message ?? '');
}
