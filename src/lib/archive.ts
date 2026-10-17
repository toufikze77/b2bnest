/**
 * Archive (Phase 4). Archived quotes and invoices (`archived_at` set) are kept for the record but
 * left out of every list, total, chart, export and widget. Use these helpers wherever invoices or
 * quotes are counted, so the rule lives in one place.
 */
export interface Archivable { archived_at?: string | null }

export const isArchived = (d: Archivable) => !!d.archived_at;

/** The documents that are not archived. Every figure on every page is worked out from these. */
export const activeOnly = <D extends Archivable>(docs: D[]): D[] => docs.filter((d) => !isArchived(d));

/** Archived documents, most recently archived first (the Archive view). */
export const archivedNewestFirst = <D extends Archivable>(docs: D[]): D[] =>
  docs.filter(isArchived).sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? ''));

/** For Supabase reads: add `.is('archived_at', null)` so archived rows never leave the database. */
export const ACTIVE_FILTER = ['archived_at', null] as const;
