import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/data/StatusBadge';
import { useAccountCurrency } from '@/hooks/useAccountCurrency';
import { PRODUCT_FIELDS } from '@/lib/moneyOut';
import type { MoneyOutApi } from '@/lib/moneyOutApi';
import { formatMoney } from '@/lib/money';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { RecordFormDialog } from './RecordFormDialog';
import { RecordsTable } from './RecordsTable';
import { useRecordEditor } from './useRecordEditor';

export interface ProductRow {
  id: string; name: string; category: string; price: number; cost: number | null;
  stock_quantity: number | null; description: string | null; is_active: boolean | null;
}

/** A service is stored with no stock quantity; a product has one (0 or more). */
const isService = (r: ProductRow) => r.stock_quantity == null;

/** Products & services: add, edit, make inactive, delete. Prices are in the account currency (no currency column). */
export function ProductsTab({ rows, loading, error, onRetry, api, onChanged, onDownload }: {
  rows: ProductRow[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  api: MoneyOutApi;
  onChanged: () => void;
  onDownload: () => void;
}) {
  const currency = useAccountCurrency();
  const money = (n: number | null) => (n == null ? '—' : formatMoney(Number(n) || 0, currency, { cents: true }));
  const ed = useRecordEditor<ProductRow>({
    spec: PRODUCT_FIELDS, api, noun: 'item', nameOf: (r) => r.name, onChanged,
    blank: () => ({ kind: 'product', name: '', category: '', price: '', cost: '', stock_quantity: '0', description: '', is_active: true }),
    toForm: (r, base) => ({ ...base, kind: isService(r) ? 'service' : 'product' }),
    // Services have no stock; a product with an empty stock box is stored as 0, as before.
    prepare: (v) => ({ ...v, stock_quantity: v.kind === 'service' ? '' : (v.stock_quantity as string)?.trim() || '0' }),
  });
  const isActive = (r: ProductRow) => r.is_active !== false;
  const state = (r: ProductRow) => <StatusBadge value={isActive(r) ? 'Active' : 'Inactive'} tone={isActive(r) ? 'success' : 'neutral'} prefix="Status" />;
  const priceNote = currency ? `Prices are in your account currency (${currency}).` : 'No account currency set, so prices are shown as plain numbers.';

  return (
    <>
      <RecordsTable<ProductRow>
        id="products" title="Products & services" noun="item" nounPlural="items"
        description={`What you sell. ${priceNote}`}
        rows={rows} loading={loading} error={error} onRetry={onRetry}
        searchLabel="Search name, category or description"
        searchText={(r) => `${r.name} ${r.category} ${r.description ?? ''}`}
        filters={[
          { value: 'all', label: 'All', test: () => true },
          { value: 'active', label: 'Active', test: isActive },
          { value: 'inactive', label: 'Inactive', test: (r) => !isActive(r) },
          { value: 'products', label: 'Products', test: (r) => !isService(r) },
          { value: 'services', label: 'Services', test: isService },
        ]}
        rowName={(r) => r.name}
        onAdd={ed.openAdd} addLabel="Add product or service" onEdit={ed.openEdit} onDelete={ed.setDeleting}
        extraActions={(r) => [{ label: isActive(r) ? 'Make inactive' : 'Make active', onSelect: () => { void ed.setActive(r, !isActive(r)); } }]}
        headerActions={<Button variant="outline" className="min-h-touch md:min-h-0" onClick={onDownload}><Download className="h-4 w-4" aria-hidden="true" />Download catalogue</Button>}
        initialSort={{ id: 'name', dir: 'asc' }}
        columns={[
          { id: 'name', header: 'Name', sortValue: (r) => r.name, cell: (r) => <button type="button" onClick={() => ed.openEdit(r)} className="max-w-[16rem] truncate rounded-sm text-left font-semibold hover:text-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">{r.name}</button> },
          { id: 'type', header: 'Type', sortValue: (r) => (isService(r) ? 'Service' : 'Product'), cell: (r) => (isService(r) ? 'Service' : 'Product') },
          { id: 'category', header: 'Category', sortValue: (r) => r.category, cell: (r) => r.category || '—' },
          { id: 'price', header: 'Price', className: 'text-right', sortValue: (r) => Number(r.price) || 0, cell: (r) => <span className="whitespace-nowrap tabular-nums">{money(r.price)}</span> },
          { id: 'stock', header: 'Stock', className: 'text-right', sortValue: (r) => r.stock_quantity, cell: (r) => (isService(r) ? <span className="text-muted-foreground">—</span> : <span className="tabular-nums">{r.stock_quantity}</span>) },
          { id: 'status', header: 'Status', sortValue: (r) => (isActive(r) ? 0 : 1), cell: state },
        ]}
        card={(r) => ({ title: r.name, lines: [`${isService(r) ? 'Service' : 'Product'} · ${r.category || 'No category'}`, ...(isService(r) ? [] : [`Stock: ${r.stock_quantity}`])], chip: state(r), amount: money(r.price) })}
      />
      <RecordFormDialog
        open={ed.formOpen} onOpenChange={ed.setFormOpen}
        title={ed.editing ? `Edit “${ed.editing.name}”` : 'Add product or service'}
        description={priceNote}
        submitLabel={ed.editing ? 'Save changes' : 'Add'}
        initial={ed.initial} onSubmit={ed.submit}
        fields={[
          { key: 'kind', label: 'Type', type: 'select', required: true, options: [{ value: 'product', label: 'Product' }, { value: 'service', label: 'Service' }] },
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'category', label: 'Category', type: 'text', required: true, placeholder: 'e.g. Software, Consulting' },
          { key: 'price', label: `Price${currency ? ` (${currency})` : ''}`, type: 'number', required: true },
          { key: 'cost', label: `Cost${currency ? ` (${currency})` : ''}`, type: 'number' },
          { key: 'stock_quantity', label: 'Stock quantity', type: 'number', show: (v) => v.kind !== 'service' },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'is_active', label: 'Active', type: 'switch', hint: 'Inactive items stay on record but are marked as not for sale.', wide: true },
        ]}
      />
      <ConfirmDeleteDialog open={!!ed.deleting} onOpenChange={(o) => { if (!o) ed.setDeleting(null); }}
        noun="item" name={ed.deleting?.name ?? ''} onConfirm={ed.confirmDelete} />
    </>
  );
}
