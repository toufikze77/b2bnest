/**
 * Honest status changes and delete wording for quotes and invoices (Phase 3b).
 *
 * B2BNEST does not email documents. "Mark as sent" only records that the user sent it themselves;
 * the message says so. Nothing is marked sent or paid unless the user presses a button that says so.
 */
import { invoiceStatus, quoteStatus } from '@/lib/financeSummary';

export type DocKind = 'quote' | 'invoice';
export type StatusTarget = 'sent' | 'paid';
export interface StatusAction { to: StatusTarget; label: string }
interface Doc { status: string | null; due_date?: string | null }

/**
 * Status buttons offered for a document:
 *   draft quote or invoice → Mark as sent
 *   sent or overdue invoice → Mark as paid
 *   paid invoice → Mark as unpaid (back to sent, to undo a mistake)
 *   sent quote, cancelled invoice, other quote words → none
 */
export function statusActions(kind: DocKind, doc: Doc, today?: string): StatusAction[] {
  if (kind === 'quote') return quoteStatus(doc) === 'draft' ? [{ to: 'sent', label: 'Mark as sent' }] : [];
  const chip = invoiceStatus(doc, today);
  if (chip === 'draft') return [{ to: 'sent', label: 'Mark as sent' }];
  if (chip === 'sent' || chip === 'overdue') return [{ to: 'paid', label: 'Mark as paid' }];
  if (chip === 'paid') return [{ to: 'sent', label: 'Mark as unpaid' }];
  return [];
}

/**
 * What a status change writes (one update, filtered by id and user_id by the caller):
 *   Mark as paid   → status 'paid' and paid_at = now
 *   Mark as unpaid → status 'sent' and paid_at = null (the paid date is cleared)
 *   Mark as sent   → status 'sent' only
 * Quotes have no paid_at column, so a quote change is only ever { status }.
 */
export function statusPayload(kind: DocKind, from: string | null, to: StatusTarget, now = new Date()): { status: StatusTarget; paid_at?: string | null } {
  if (kind === 'quote') return { status: to };
  if (to === 'paid') return { status: 'paid', paid_at: now.toISOString() };
  if ((from || '').toLowerCase() === 'paid') return { status: 'sent', paid_at: null };
  return { status: 'sent' };
}

/** The success message after a status change: says exactly what happened, and that no email was sent. */
export function statusChangeMessage(number: string, from: string | null, to: StatusTarget): string {
  if (to === 'paid') return `${number} marked as paid.`;
  if ((from || '').toLowerCase() === 'paid') return `${number} marked as unpaid. It is back to Sent.`;
  return `${number} marked as sent. No email was sent from B2BNEST. Download the PDF to send it yourself.`;
}

export interface DeleteWording { title: string; description: string; confirmLabel: string; strong: boolean }

/* ---------- Archive (Phase 4) ---------- */

/** The light confirmation before archiving: nothing is lost, so one sentence. */
export function archiveWording(kind: DocKind, number: string) {
  return { title: `Move ${kind} ${number} to the archive?`, description: 'You can restore it from the Archive.', confirmLabel: 'Move to archive' };
}

/** Toast after archiving. A sent or paid invoice also says it now leaves the totals. */
export function archivedMessage(kind: DocKind, number: string, doc: Doc): string {
  const chip = kind === 'invoice' ? invoiceStatus(doc) : null;
  if (chip === 'sent' || chip === 'overdue' || chip === 'paid') return `Invoice ${number} archived. It is no longer included in totals.`;
  return `${kind === 'quote' ? 'Quote' : 'Invoice'} ${number} archived.`;
}

/** "Delete forever" (Archive view only): names the document, says it can't be undone. */
export function deleteForeverWording(kind: DocKind, number: string): DeleteWording {
  return {
    title: `Delete ${kind} ${number} forever?`,
    description: kind === 'invoice'
      ? 'This permanently deletes the invoice. It can’t be undone. UK businesses normally keep invoices for several years for their records.'
      : 'This permanently deletes the quote. It can’t be undone.',
    confirmLabel: 'Delete forever',
    strong: kind === 'invoice',
  };
}

