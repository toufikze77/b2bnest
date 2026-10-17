import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/data/StatusBadge';
import { useAccountCurrency } from '@/hooks/useAccountCurrency';
import { formatDueDate } from '@/lib/dashboardData';
import { EXPENSE_CATEGORIES, EXPENSE_FIELDS, EXPENSE_STATUSES, filteredTotal, labelOf, supplierOptions, withStored } from '@/lib/moneyOut';
import type { MoneyOutApi } from '@/lib/moneyOutApi';
import { formatMoney } from '@/lib/money';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { RecordFormDialog } from './RecordFormDialog';
import { RecordsTable } from './RecordsTable';
import { useRecordEditor } from './useRecordEditor';

export interface ExpenseRow { id: string; description: string; category: string; amount: number; date: string; supplier_id: string | null; status: string | null }
export interface SupplierRef { id: string; name: string; is_active: boolean | null }

const TONE: Record<string, 'warning' | 'info' | 'success'> = { pending: 'warning', approved: 'info', paid: 'success' };
const today = () => new Date().toISOString().slice(0, 10);

/** Expenses: add, edit, delete, search and filter. Expenses have no currency column: amounts are in the account currency. */
export function ExpensesTab({ rows, suppliers, loading, error, onRetry, api, onChanged, onDownload }: {
  rows: ExpenseRow[];
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
  const ed = useRecordEditor<ExpenseRow>({
    spec: EXPENSE_FIELDS, api, noun: 'expense', nameOf: (r) => r.description, onChanged,
    blank: () => ({ description: '', category: '', amount: '', date: today(), supplier_id: '', status: 'pending' }),
  });
  const categories = withStored(EXPENSE_CATEGORIES, rows.map((r) => r.category));
  const statuses = withStored(EXPENSE_STATUSES, rows.map((r) => r.status));
  const supplierName = (id: string | null) => (id ? suppliers.find((s) => s.id === id)?.name ?? 'Unknown supplier' : '—');
  const status = (r: ExpenseRow) => <StatusBadge value={labelOf(statuses, r.status || 'pending')} tone={TONE[r.status || 'pending'] ?? 'neutral'} prefix="Status" />;
  const currencyNote = currency ? `in your account currency (${currency})` : 'no account currency set, so shown as plain numbers';

  return (
    <>
      <RecordsTable<ExpenseRow>
        id="expenses" title="Expenses" noun="expense" nounPlural="expenses"
        description={`Track and categorise what your business spends. Amounts are ${currencyNote}.`}
        rows={rows} loading={loading} error={error} onRetry={onRetry}
        searchLabel="Search description, category or supplier"
        searchText={(r) => `${r.description} ${labelOf(categories, r.category)} ${supplierName(r.supplier_id)}`}
        filters={[{ value: 'all', label: 'All', test: () => true }, ...statuses.map((s) => ({ value: s.value, label: s.label, test: (r: ExpenseRow) => (r.status || 'pending') === s.value }))]}
        rowName={(r) => r.description}
        onAdd={ed.openAdd} addLabel="Add expense" onEdit={ed.openEdit} onDelete={ed.setDeleting}
        headerActions={<Button variant="outline" className="min-h-touch md:min-h-0" onClick={onDownload}><Download className="h-4 w-4" aria-hidden="true" />Download report</Button>}
        summary={(visible) => <span>Total <strong className="tabular-nums text-foreground">{money(filteredTotal(visible))}</strong> {currencyNote}</span>}
        initialSort={{ id: 'date', dir: 'desc' }}
        columns={[
          { id: 'description', header: 'Description', sortValue: (r) => r.description, cell: (r) => <button type="button" onClick={() => ed.openEdit(r)} className="max-w-[18rem] truncate rounded-sm text-left font-semibold hover:text-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">{r.description}</button> },
          { id: 'category', header: 'Category', sortValue: (r) => labelOf(categories, r.category), cell: (r) => labelOf(categories, r.category) },
          { id: 'supplier', header: 'Supplier', sortValue: (r) => supplierName(r.supplier_id), cell: (r) => supplierName(r.supplier_id) },
          { id: 'date', header: 'Date', sortValue: (r) => r.date, cell: (r) => <span className="whitespace-nowrap">{r.date ? formatDueDate(r.date) : '—'}</span> },
          { id: 'status', header: 'Status', sortValue: (r) => r.status, cell: status },
          { id: 'amount', header: 'Amount', className: 'text-right', sortValue: (r) => Number(r.amount) || 0, cell: (r) => <span className="whitespace-nowrap tabular-nums">{money(Number(r.amount) || 0)}</span> },
        ]}
        card={(r) => ({ title: r.description, lines: [`${labelOf(categories, r.category)} · ${r.date ? formatDueDate(r.date) : 'no date'}`, ...(r.supplier_id ? [supplierName(r.supplier_id)] : [])], chip: status(r), amount: money(Number(r.amount) || 0) })}
      />
      <RecordFormDialog
        open={ed.formOpen} onOpenChange={ed.setFormOpen}
        title={ed.editing ? `Edit expense “${ed.editing.description}”` : 'Add expense'}
        description={`Amount ${currencyNote}.`}
        submitLabel={ed.editing ? 'Save changes' : 'Add expense'}
        initial={ed.initial} onSubmit={ed.submit}
        fields={[
          { key: 'description', label: 'Description', type: 'text', required: true, wide: true },
          { key: 'amount', label: `Amount${currency ? ` (${currency})` : ''}`, type: 'number', required: true },
          { key: 'date', label: 'Date', type: 'date', required: true },
          { key: 'category', label: 'Category', type: 'select', required: true, options: categories },
          { key: 'status', label: 'Status', type: 'select', required: true, options: statuses },
          { key: 'supplier_id', label: 'Supplier', type: 'select', options: supplierOptions(suppliers, ed.editing?.supplier_id), hint: 'Inactive suppliers are hidden unless already chosen.', wide: true },
        ]}
      />
      <ConfirmDeleteDialog open={!!ed.deleting} onOpenChange={(o) => { if (!o) ed.setDeleting(null); }}
        noun="expense" name={ed.deleting?.description ?? ''} onConfirm={ed.confirmDelete} />
    </>
  );
}
