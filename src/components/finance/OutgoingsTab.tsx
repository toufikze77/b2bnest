import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/data/StatusBadge';
import { useAccountCurrency } from '@/hooks/useAccountCurrency';
import { formatDueDate } from '@/lib/dashboardData';
import { EXPENSE_CATEGORIES, FREQUENCIES, labelOf, monthlyOutgoings, OUTGOING_FIELDS, supplierOptions, withStored } from '@/lib/moneyOut';
import type { MoneyOutApi } from '@/lib/moneyOutApi';
import { formatMoney } from '@/lib/money';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import type { SupplierRef } from './ExpensesTab';
import { RecordFormDialog } from './RecordFormDialog';
import { RecordsTable } from './RecordsTable';
import { useRecordEditor } from './useRecordEditor';

export interface OutgoingRow { id: string; name: string; category: string; amount: number; frequency: string; next_payment_date: string; supplier_id: string | null; is_active: boolean | null }

const today = () => new Date().toISOString().slice(0, 10);

/** Recurring outgoings: add, edit, pause/resume, delete. Amounts are in the account currency (no currency column). */
export function OutgoingsTab({ rows, suppliers, loading, error, onRetry, api, onChanged, onDownload }: {
  rows: OutgoingRow[];
  suppliers: SupplierRef[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  api: MoneyOutApi;
  onChanged: () => void;
  onDownload: () => void;
}) {
  const currency = useAccountCurrency();
  const money = (n: number) => formatMoney(n, currency, { cents: true });
  const ed = useRecordEditor<OutgoingRow>({
    spec: OUTGOING_FIELDS, api, noun: 'recurring payment', nameOf: (r) => r.name, onChanged, stateWords: ['active again', 'paused'],
    blank: () => ({ name: '', category: '', amount: '', frequency: 'monthly', next_payment_date: today(), supplier_id: '', is_active: true }),
  });
  const categories = withStored(EXPENSE_CATEGORIES, rows.map((r) => r.category));
  const frequencies = withStored(FREQUENCIES, rows.map((r) => r.frequency));
  const supplierName = (id: string | null) => (id ? suppliers.find((s) => s.id === id)?.name ?? 'Unknown supplier' : '—');
  const state = (r: OutgoingRow) => <StatusBadge value={r.is_active === false ? 'Paused' : 'Active'} tone={r.is_active === false ? 'neutral' : 'success'} prefix="Status" />;
  const currencyNote = currency ? `in your account currency (${currency})` : 'no account currency set, so shown as plain numbers';
  const isActive = (r: OutgoingRow) => r.is_active !== false;

  const summary = (visible: OutgoingRow[]) => {
    const m = monthlyOutgoings(visible);
    return (
      <span>
        Total per month <strong className="tabular-nums text-foreground">{money(m.perMonth)}</strong> {currencyNote}
        {' '}(active payments; weekly × 52 ÷ 12, quarterly ÷ 3, yearly ÷ 12)
        {m.unknown.map((u) => <span key={u.frequency} className="block">Not converted: {u.count} {u.frequency} {u.count === 1 ? 'payment' : 'payments'} totalling {money(u.total)}.</span>)}
      </span>
    );
  };

  return (
    <>
      <RecordsTable<OutgoingRow>
        id="outgoings" title="Recurring outgoings" noun="recurring payment" nounPlural="recurring payments"
        description={`Scheduled payments and subscriptions. Amounts are ${currencyNote}.`}
        rows={rows} loading={loading} error={error} onRetry={onRetry}
        searchLabel="Search name, category or supplier"
        searchText={(r) => `${r.name} ${labelOf(categories, r.category)} ${supplierName(r.supplier_id)}`}
        filters={[
          { value: 'all', label: 'All', test: () => true },
          { value: 'active', label: 'Active', test: isActive },
          { value: 'paused', label: 'Paused', test: (r) => !isActive(r) },
        ]}
        rowName={(r) => r.name}
        onAdd={ed.openAdd} addLabel="Add recurring payment" onEdit={ed.openEdit} onDelete={ed.setDeleting}
        extraActions={(r) => [{ label: isActive(r) ? 'Pause' : 'Resume', onSelect: () => { void ed.setActive(r, !isActive(r)); } }]}
        headerActions={<Button variant="outline" className="min-h-touch md:min-h-0" onClick={onDownload}><Download className="h-4 w-4" aria-hidden="true" />Download schedule</Button>}
        summary={summary}
        initialSort={{ id: 'next', dir: 'asc' }}
        columns={[
          { id: 'name', header: 'Name', sortValue: (r) => r.name, cell: (r) => <button type="button" onClick={() => ed.openEdit(r)} className="max-w-[16rem] truncate rounded-sm text-left font-semibold hover:text-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">{r.name}</button> },
          { id: 'category', header: 'Category', sortValue: (r) => labelOf(categories, r.category), cell: (r) => labelOf(categories, r.category) },
          { id: 'frequency', header: 'Frequency', sortValue: (r) => r.frequency, cell: (r) => labelOf(frequencies, r.frequency) },
          { id: 'next', header: 'Next payment', sortValue: (r) => r.next_payment_date, cell: (r) => <span className="whitespace-nowrap">{r.next_payment_date ? formatDueDate(r.next_payment_date) : '—'}</span> },
          { id: 'status', header: 'Status', sortValue: (r) => (isActive(r) ? 0 : 1), cell: state },
          { id: 'amount', header: 'Amount', className: 'text-right', sortValue: (r) => Number(r.amount) || 0, cell: (r) => <span className="whitespace-nowrap tabular-nums">{money(Number(r.amount) || 0)}</span> },
        ]}
        card={(r) => ({ title: r.name, lines: [`${labelOf(frequencies, r.frequency)} · next ${r.next_payment_date ? formatDueDate(r.next_payment_date) : '—'}`, labelOf(categories, r.category)], chip: state(r), amount: money(Number(r.amount) || 0) })}
      />
      <RecordFormDialog
        open={ed.formOpen} onOpenChange={ed.setFormOpen}
        title={ed.editing ? `Edit recurring payment “${ed.editing.name}”` : 'Add recurring payment'}
        description={`Amount ${currencyNote}.`}
        submitLabel={ed.editing ? 'Save changes' : 'Add payment'}
        initial={ed.initial} onSubmit={ed.submit}
        fields={[
          { key: 'name', label: 'Name', type: 'text', required: true, wide: true },
          { key: 'amount', label: `Amount${currency ? ` (${currency})` : ''}`, type: 'number', required: true },
          { key: 'frequency', label: 'Frequency', type: 'select', required: true, options: frequencies },
          { key: 'category', label: 'Category', type: 'select', required: true, options: categories },
          { key: 'next_payment_date', label: 'Next payment date', type: 'date', required: true },
          { key: 'supplier_id', label: 'Supplier', type: 'select', options: supplierOptions(suppliers, ed.editing?.supplier_id), wide: true },
          { key: 'is_active', label: 'Active', type: 'switch', hint: 'Turn off to pause this payment. Paused payments are left out of the monthly total.', wide: true },
        ]}
      />
      <ConfirmDeleteDialog open={!!ed.deleting} onOpenChange={(o) => { if (!o) ed.setDeleting(null); }}
        noun="recurring payment" name={ed.deleting?.name ?? ''} onConfirm={ed.confirmDelete} />
    </>
  );
}
