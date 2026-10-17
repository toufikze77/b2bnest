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

/** The success message after a status change: says exactly what happened, and that no email was sent. */
export function statusChangeMessage(number: string, from: string | null, to: StatusTarget): string {
  if (to === 'paid') return `${number} marked as paid.`;
  if ((from || '').toLowerCase() === 'paid') return `${number} marked as unpaid. It is back to Sent.`;
  return `${number} marked as sent. No email was sent from B2BNEST. Download the PDF to send it yourself.`;
}

export interface DeleteWording { title: string; description: string; confirmLabel: string; strong: boolean }

/**
 * Delete confirmation wording. Invoices already marked sent or paid get a stronger warning
 * (UK businesses normally keep invoices for several years), but deleting is not blocked.
 */
export function deleteWording(kind: DocKind, number: string, doc: Doc): DeleteWording {
  const noun = kind === 'quote' ? 'quote' : 'invoice';
  const chip = kind === 'invoice' ? invoiceStatus(doc) : null;
  const strong = chip === 'sent' || chip === 'overdue' || chip === 'paid';
  return {
    title: `Delete ${noun} ${number}?`,
    description: strong
      ? 'This invoice has been marked as sent or paid. UK businesses normally keep invoices for several years for their records. Delete anyway? It can’t be undone.'
      : `This permanently deletes the ${noun}. It can’t be undone.`,
    confirmLabel: `Delete ${noun}`,
    strong,
  };
}
