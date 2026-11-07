import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/data/StatusBadge';
import { useAccountCurrency } from '@/hooks/useAccountCurrency';
import { formatDueDate } from '@/lib/dashboardData';
import {
  CUSTOM_CATEGORY, CUSTOM_CATEGORY_MAX, EXPENSE_STATUSES, expenseCategoryOptions, filteredTotal, labelOf, resolveCustomCategory, supplierOptions, withStored,
} from '@/lib/moneyOut';
import type { MoneyOutApi } from '@/lib/moneyOutApi';
import { formatMoney } from '@/lib/money';
import {
  blankExpenseVat, EXPENSE_VAT_CHOOSE, EXPENSE_VAT_FIELDS, expenseVatForm, vatChosen, fromPence, moneyOutNeedsVat, MONEY_OUT_VAT_KEYS, prepareExpenseVat, VAT_ENTRY_OPTIONS,
  VAT_TREATMENT_LABELS, VAT_TREATMENTS, vatFromForm, withOptionalVatColumns, type VatColumns,
} from '@/lib/vat';
import { toast } from 'sonner';
import { VatNotRecordedBadge } from './VatBadges';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { RecordFormDialog } from './RecordFormDialog';
import { RecordsTable } from './RecordsTable';
import { useRecordEditor } from './useRecordEditor';

export interface ExpenseRow extends VatColumns { id: string; description: string; category: string; amount: number; date: string; supplier_id: string | null; status: string | null }
export interface SupplierRef { id: string; name: string; is_active: boolean | null }

const TONE: Record<string, 'warning' | 'info' | 'success'> = { pending: 'warning', approved: 'info', paid: 'success' };
const today = () => new Date().toISOString().slice(0, 10);

/** Expenses: add, edit, delete, search and filter. Expenses have no currency column: amounts are in the account currency. */
export function ExpensesTab({ rows, suppliers, loading, error, onRetry, api, onChanged, onDownload, initialFilter }: {
  rows: ExpenseRow[];
  suppliers: SupplierRef[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  api: MoneyOutApi;
  onChanged: () => void;
  onDownload: () => void;
  /** HMRC P4: open the list on a filter (the Finance page's VAT panel uses 'vat_missing'). */
  initialFilter?: string;
}) {
  const currency = useAccountCurrency();
  const money = (n: number) => formatMoney(n, currency, { cents: true });
  // Business headings plus any category already used on this user's expenses (legacy or typed).
  const categories = expenseCategoryOptions(rows.map((r) => r.category));
  // HMRC P4: every save of an expense records its VAT (standard scheme): a treatment is required, so an older expense
  // can't be saved until one is chosen. Before the database update the VAT columns are dropped from the save and the
  // expense stays "VAT not recorded".
  const vatApi = withOptionalVatColumns(api, MONEY_OUT_VAT_KEYS, () => toast.info('Saved without VAT details: they can be recorded after a database update.'));
  const ed = useRecordEditor<ExpenseRow>({
    spec: EXPENSE_VAT_FIELDS, api: vatApi, noun: 'expense', nameOf: (r) => r.description, onChanged,
    blank: () => ({ description: '', category: '', category_custom: '', amount: '', date: today(), supplier_id: '', status: 'pending', ...blankExpenseVat() }),
    toForm: (r, base) => expenseVatForm(r, base),
    // "Other (type your own)": the typed name becomes the category (an existing match is reused).
    validate: (v) => (v.category === CUSTOM_CATEGORY ? resolveCustomCategory(v.category_custom as string, categories).error ?? null : null)
      ?? (() => { const r = vatFromForm(v); return 'error' in r ? r.error : null; })(),
    prepare: (v) => prepareExpenseVat(v.category === CUSTOM_CATEGORY ? { ...v, category: resolveCustomCategory(v.category_custom as string, categories).value } : v),
  });
  const usedCategories = categories.filter((c) => rows.some((r) => r.category === c.value));
  const statuses = withStored(EXPENSE_STATUSES, rows.map((r) => r.status));
  const supplierName = (id: string | null) => (id ? suppliers.find((s) => s.id === id)?.name ?? 'Unknown supplier' : '—');
  const status = (r: ExpenseRow) => (
    <span className="inline-flex flex-wrap items-center gap-1">
      <StatusBadge value={labelOf(statuses, r.status || 'pending')} tone={TONE[r.status || 'pending'] ?? 'neutral'} prefix="Status" />
      {moneyOutNeedsVat(r) && <VatNotRecordedBadge />}
    </span>
  );
  const vatCell = (r: ExpenseRow) => (moneyOutNeedsVat(r) ? <span className="text-muted-foreground">—</span>
    : <span className="whitespace-nowrap tabular-nums">{money(Number(r.vat_amount) || 0)}{r.vat_reclaimable === false && <span className="block text-small text-muted-foreground">Not reclaimable</span>}</span>);
  const currencyNote = currency ? `in your account currency (${currency})` : 'no account currency set, so shown as plain numbers';

  const ExpensesTable = RecordsTable<ExpenseRow>;
  return (
    <>
      <ExpensesTable
        id="expenses" title="Expenses" noun="expense" nounPlural="expenses"
        description={`Track and categorise what your business spends. Amounts are ${currencyNote}.`}
        rows={rows} loading={loading} error={error} onRetry={onRetry}
        searchLabel="Search description, category or supplier"
        searchText={(r) => `${r.description} ${labelOf(categories, r.category)} ${supplierName(r.supplier_id)}`}
        filters={[{ value: 'all', label: 'All', test: () => true }, ...statuses.map((s) => ({ value: s.value, label: s.label, test: (r: ExpenseRow) => (r.status || 'pending') === s.value })),
          { value: 'vat_missing', label: 'VAT not recorded', test: (r: ExpenseRow) => moneyOutNeedsVat(r) }]}
        initialFilter={initialFilter}
        selectFilter={{ label: 'Category', allLabel: 'All categories', options: usedCategories.map((c) => ({ value: c.value, label: c.label, test: (r: ExpenseRow) => r.category === c.value })) }}
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
          { id: 'vat', header: 'VAT', className: 'text-right', sortValue: (r) => Number(r.vat_amount) || 0, cell: vatCell },
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
        summary={(v) => {
          if (!vatChosen(v)) return <p className="rounded-control border border-border bg-muted/40 p-3 text-body" data-testid="expense-vat-choose">{EXPENSE_VAT_CHOOSE}</p>;
          const r = vatFromForm(v);
          return r.ok ? (
            <p className="rounded-control border border-border bg-muted/40 p-3 text-body" data-testid="expense-vat-summary">
              Net <strong className="tabular-nums">{money(fromPence(r.net))}</strong> · VAT <strong className="tabular-nums">{money(fromPence(r.vat))}</strong> · Total <strong className="tabular-nums">{money(fromPence(r.gross))}</strong>
            </p>
          ) : null;
        }}
        fields={[
          { key: 'description', label: 'Description', type: 'text', required: true, wide: true },
          { key: 'amount', label: `Amount${currency ? ` (${currency})` : ''}`, type: 'number', required: true },
          { key: 'vat_entry', label: 'The amount entered is', type: 'select', required: true, options: VAT_ENTRY_OPTIONS },
          { key: 'vat_treatment', label: 'VAT treatment', type: 'select', required: true, options: VAT_TREATMENTS.map((t) => ({ value: t, label: VAT_TREATMENT_LABELS[t] })),
            hint: 'Every expense records its VAT. Choose Zero rate, Exempt or Outside the scope of VAT when there is none.' },
          { key: 'vat_override', label: 'VAT on the receipt (optional)', type: 'number', hint: 'Leave empty to use the calculated VAT. It can differ by 1p at most (supplier rounding).' },
          { key: 'vat_reclaimable', label: 'VAT can be reclaimed', type: 'switch', hint: 'Turn off for costs whose VAT you can’t reclaim, such as business entertainment.' },
          { key: 'date', label: 'Date (VAT tax point)', type: 'date', required: true },
          { key: 'category', label: 'Category', type: 'select', required: true, options: [...categories, { value: CUSTOM_CATEGORY, label: 'Other (type your own)', group: 'Other' }] },
          { key: 'category_custom', label: 'New category name', type: 'text', required: true, maxLength: CUSTOM_CATEGORY_MAX, show: (v) => v.category === CUSTOM_CATEGORY,
            hint: `Up to ${CUSTOM_CATEGORY_MAX} characters. It will be in the list next time.` },
          { key: 'status', label: 'Status', type: 'select', required: true, options: statuses },
          { key: 'supplier_id', label: 'Supplier', type: 'select', options: supplierOptions(suppliers, ed.editing?.supplier_id), hint: 'Inactive suppliers are hidden unless already chosen.', wide: true },
        ]}
      />
      <ConfirmDeleteDialog open={!!ed.deleting} onOpenChange={(o) => { if (!o) ed.setDeleting(null); }}
        noun="expense" name={ed.deleting?.description ?? ''} onConfirm={ed.confirmDelete} />
    </>
  );
}
