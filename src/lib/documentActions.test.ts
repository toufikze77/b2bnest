import { describe, expect, it } from 'vitest';
import { deleteWording, statusActions, statusChangeMessage } from './documentActions';

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

describe('deleteWording', () => {
  it('drafts get the simple confirmation', () => {
    expect(deleteWording('quote', 'Q-501', { status: 'draft' })).toEqual({
      title: 'Delete quote Q-501?', description: 'This permanently deletes the quote. It can’t be undone.', confirmLabel: 'Delete quote', strong: false,
    });
    expect(deleteWording('invoice', 'INV-1', { status: 'draft' }).strong).toBe(false);
    expect(deleteWording('quote', 'Q-502', { status: 'sent' }).strong).toBe(false);
  });

  it('sent, overdue or paid invoices get the stronger record-keeping warning, still deletable', () => {
    for (const doc of [{ status: 'sent' }, { status: 'paid' }, { status: 'sent', due_date: '2020-01-01' }]) {
      const w = deleteWording('invoice', 'INV-2', doc);
      expect(w.strong).toBe(true);
      expect(w.confirmLabel).toBe('Delete invoice');
      expect(w.description).toBe('This invoice has been marked as sent or paid. UK businesses normally keep invoices for several years for their records. Delete anyway? It can’t be undone.');
    }
  });
});
