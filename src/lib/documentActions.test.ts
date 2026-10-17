import { describe, expect, it } from 'vitest';
import { archivedMessage, archiveWording, deleteForeverWording, statusActions, statusChangeMessage, statusPayload } from './documentActions';

const today = '2026-10-17';

describe('statusActions', () => {
  it('drafts get Mark as sent; sent and overdue invoices get Mark as paid; paid gets Mark as unpaid', () => {
    expect(statusActions('invoice', { status: 'draft' }, today)).toEqual([{ to: 'sent', label: 'Mark as sent' }]);
    expect(statusActions('invoice', { status: null }, today)).toEqual([{ to: 'sent', label: 'Mark as sent' }]);
    expect(statusActions('invoice', { status: 'sent', due_date: '2026-11-01' }, today)).toEqual([{ to: 'paid', label: 'Mark as paid' }]);
    expect(statusActions('invoice', { status: 'sent', due_date: '2026-09-01' }, today)).toEqual([{ to: 'paid', label: 'Mark as paid' }]);
    expect(statusActions('invoice', { status: 'pending' }, today)).toEqual([{ to: 'paid', label: 'Mark as paid' }]);
    expect(statusActions('invoice', { status: 'paid' }, today)).toEqual([{ to: 'sent', label: 'Mark as unpaid' }]);
    expect(statusActions('invoice', { status: 'cancelled' }, today)).toEqual([]);
  });

  it('quotes only get Mark as sent while draft (no "Accepted" in this phase)', () => {
    expect(statusActions('quote', { status: 'draft' })).toEqual([{ to: 'sent', label: 'Mark as sent' }]);
    expect(statusActions('quote', { status: 'sent' })).toEqual([]);
    expect(statusActions('quote', { status: 'accepted' })).toEqual([]);
  });
});

describe('statusChangeMessage', () => {
  it('says exactly what happened, and that no email was sent', () => {
    expect(statusChangeMessage('INV-1001', 'draft', 'sent')).toBe('INV-1001 marked as sent. No email was sent from B2BNEST. Download the PDF to send it yourself.');
    expect(statusChangeMessage('INV-1001', 'sent', 'paid')).toBe('INV-1001 marked as paid.');
    expect(statusChangeMessage('INV-1001', 'paid', 'sent')).toBe('INV-1001 marked as unpaid. It is back to Sent.');
    expect(statusChangeMessage('Q-501', 'draft', 'sent')).not.toMatch(/sent successfully/i);
  });
});

describe('statusPayload', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  it('Mark as paid writes status and paid_at together; Mark as unpaid clears paid_at', () => {
    expect(statusPayload('invoice', 'sent', 'paid', now)).toEqual({ status: 'paid', paid_at: '2026-10-17T12:00:00.000Z' });
    expect(statusPayload('invoice', 'paid', 'sent', now)).toEqual({ status: 'sent', paid_at: null });
    expect(statusPayload('invoice', 'draft', 'sent', now)).toEqual({ status: 'sent' });
  });
  it('quotes have no paid_at, so only the status is written', () => {
    expect(statusPayload('quote', 'draft', 'sent', now)).toEqual({ status: 'sent' });
  });
});

describe('archive wording', () => {
  it('archiving is a light, one-sentence confirmation', () => {
    expect(archiveWording('invoice', 'INV-1')).toEqual({ title: 'Move invoice INV-1 to the archive?', description: 'You can restore it from the Archive.', confirmLabel: 'Move to archive' });
  });
  it('archiving a sent or paid invoice says it leaves the totals; drafts and quotes do not', () => {
    expect(archivedMessage('invoice', 'INV-2', { status: 'paid' })).toBe('Invoice INV-2 archived. It is no longer included in totals.');
    expect(archivedMessage('invoice', 'INV-3', { status: 'sent', due_date: '2020-01-01' })).toBe('Invoice INV-3 archived. It is no longer included in totals.');
    expect(archivedMessage('invoice', 'INV-4', { status: 'draft' })).toBe('Invoice INV-4 archived.');
    expect(archivedMessage('quote', 'Q-1', { status: 'sent' })).toBe('Quote Q-1 archived.');
  });
  it('delete forever names the document, cannot be undone, and invoices mention record keeping', () => {
    expect(deleteForeverWording('invoice', 'INV-1')).toEqual({
      title: 'Delete invoice INV-1 forever?',
      description: 'This permanently deletes the invoice. It can’t be undone. UK businesses normally keep invoices for several years for their records.',
      confirmLabel: 'Delete forever', strong: true,
    });
    expect(deleteForeverWording('quote', 'Q-1').description).toBe('This permanently deletes the quote. It can’t be undone.');
  });
});
