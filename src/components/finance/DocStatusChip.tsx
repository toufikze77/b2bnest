import { StatusBadge } from '@/components/data/StatusBadge';
import { CHIP_LABEL, InvoiceChip, invoiceStatus, quoteStatus } from '@/lib/financeSummary';

const TONE = { draft: 'neutral', sent: 'info', overdue: 'danger', paid: 'success', cancelled: 'neutral', other: 'neutral' } as const;

/** Word chip for an invoice (Draft, Sent, Overdue, Paid, Cancelled). Overdue is worked out in the app. */
export function InvoiceStatusChip({ doc, today }: { doc: { status: string | null; due_date?: string | null }; today?: string }) {
  const chip: InvoiceChip = invoiceStatus(doc, today);
  return <StatusBadge value={CHIP_LABEL[chip]} tone={TONE[chip]} prefix="Status" />;
}

/** Word chip for a quote: Draft, Sent, or the stored word for anything else (e.g. "Accepted"). */
export function QuoteStatusChip({ doc }: { doc: { status: string | null } }) {
  const chip = quoteStatus(doc);
  return <StatusBadge value={chip === 'other' ? doc.status : CHIP_LABEL[chip]} tone={TONE[chip]} prefix="Status" />;
}
