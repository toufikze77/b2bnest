import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/data/StatusBadge';
import { PAYMENT_TERMS, SUPPLIER_FIELDS, supplierDeleteMessage, withStored } from '@/lib/moneyOut';
import type { MoneyOutApi } from '@/lib/moneyOutApi';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { RecordFormDialog } from './RecordFormDialog';
import { RecordsTable } from './RecordsTable';
import { useRecordEditor } from './useRecordEditor';

export interface SupplierRow {
  id: string; name: string; contact_person: string | null; email: string | null; phone: string | null;
  website: string | null; payment_terms: string | null; address: string | null; is_active: boolean | null;
}

/**
 * Suppliers: add, edit, make inactive, delete. A supplier still used by an expense or recurring
 * payment can't be deleted (the database refuses), so the delete dialog offers "Make inactive".
 */
export function SuppliersTab({ rows, loading, error, onRetry, api, onChanged, onDownload }: {
  rows: SupplierRow[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  api: MoneyOutApi;
  onChanged: () => void;
  onDownload: () => void;
}) {
  const ed = useRecordEditor<SupplierRow>({
    spec: SUPPLIER_FIELDS, api, noun: 'supplier', nameOf: (r) => r.name, onChanged,
    blank: () => ({ name: '', contact_person: '', email: '', phone: '', website: '', payment_terms: 'Net 30', address: '', is_active: true }),
    deleteProblem: (r, e) => supplierDeleteMessage(r.name, e),
  });
  const terms = withStored(PAYMENT_TERMS, rows.map((r) => r.payment_terms));
  const isActive = (r: SupplierRow) => r.is_active !== false;
  const state = (r: SupplierRow) => <StatusBadge value={isActive(r) ? 'Active' : 'Inactive'} tone={isActive(r) ? 'success' : 'neutral'} prefix="Status" />;
  const contact = (r: SupplierRow) => [r.contact_person, r.email, r.phone].filter(Boolean).join(' · ') || '—';

  return (
    <>
      <RecordsTable<SupplierRow>
        id="suppliers" title="Suppliers" noun="supplier" nounPlural="suppliers"
        description="The companies you buy from. Inactive suppliers stay on old records but aren’t offered for new ones."
        rows={rows} loading={loading} error={error} onRetry={onRetry}
        searchLabel="Search name, contact or email"
        searchText={(r) => `${r.name} ${r.contact_person ?? ''} ${r.email ?? ''} ${r.phone ?? ''}`}
        filters={[
          { value: 'all', label: 'All', test: () => true },
          { value: 'active', label: 'Active', test: isActive },
          { value: 'inactive', label: 'Inactive', test: (r) => !isActive(r) },
        ]}
        rowName={(r) => r.name}
        onAdd={ed.openAdd} addLabel="Add supplier" onEdit={ed.openEdit} onDelete={ed.setDeleting}
        extraActions={(r) => [{ label: isActive(r) ? 'Make inactive' : 'Make active', onSelect: () => { void ed.setActive(r, !isActive(r)); } }]}
        headerActions={<Button variant="outline" className="min-h-touch md:min-h-0" onClick={onDownload}><Download className="h-4 w-4" aria-hidden="true" />Download list</Button>}
        initialSort={{ id: 'name', dir: 'asc' }}
        columns={[
          { id: 'name', header: 'Name', sortValue: (r) => r.name, cell: (r) => <button type="button" onClick={() => ed.openEdit(r)} className="max-w-[16rem] truncate rounded-sm text-left font-semibold hover:text-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">{r.name}</button> },
          { id: 'contact', header: 'Contact', sortValue: (r) => contact(r), cell: (r) => <span className="block max-w-[20rem] truncate">{contact(r)}</span> },
          { id: 'terms', header: 'Payment terms', sortValue: (r) => r.payment_terms, cell: (r) => r.payment_terms || '—' },
          { id: 'status', header: 'Status', sortValue: (r) => (isActive(r) ? 0 : 1), cell: state },
        ]}
        card={(r) => ({ title: r.name, lines: [contact(r), r.payment_terms || 'No payment terms'], chip: state(r) })}
      />
      <RecordFormDialog
        open={ed.formOpen} onOpenChange={ed.setFormOpen}
        title={ed.editing ? `Edit supplier “${ed.editing.name}”` : 'Add supplier'}
        submitLabel={ed.editing ? 'Save changes' : 'Add supplier'}
        initial={ed.initial} onSubmit={ed.submit}
        fields={[
          { key: 'name', label: 'Company name', type: 'text', required: true },
          { key: 'contact_person', label: 'Contact person', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'phone', label: 'Phone', type: 'text' },
          { key: 'website', label: 'Website', type: 'text', placeholder: 'https://' },
          { key: 'payment_terms', label: 'Payment terms', type: 'select', options: terms },
          { key: 'address', label: 'Address', type: 'textarea' },
          { key: 'is_active', label: 'Active', type: 'switch', hint: 'Inactive suppliers stay on existing expenses but aren’t offered for new ones.', wide: true },
        ]}
      />
      <ConfirmDeleteDialog open={!!ed.deleting} onOpenChange={(o) => { if (!o) ed.setDeleting(null); }}
        noun="supplier" name={ed.deleting?.name ?? ''} onConfirm={ed.confirmDelete}
        onMakeInactive={() => (ed.deleting ? ed.setActive(ed.deleting, false) : Promise.resolve(null))} />
    </>
  );
}
