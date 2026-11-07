import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useDemoMode } from '@/contexts/demoModeState';
import { invoiceNeedsVat, moneyOutNeedsVat, type InvoiceVatColumns, type VatColumns } from '@/lib/vat';
import { hasCompanyColumn, type CompanyColumn } from '@/lib/financeCompany';

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
type CountRow = { record_type?: string; needing?: number | string; scope?: string };
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
type Counts = { invoices: number; expenses: number; bills: number };

function sentence({ invoices, expenses, bills }: Counts): string | null {
  const parts = [invoices ? plural(invoices, 'invoice') : null, expenses ? plural(expenses, 'expense') : null, bills ? plural(bills, 'bill') : null].filter(Boolean) as string[];
  if (!parts.length) return null;
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  return `${text} ${invoices + expenses + bills === 1 ? 'needs' : 'need'} VAT details.`;
}

/**
 * HMRC P4: "N invoices, N expenses and N bills need VAT details". Records without a full VAT breakdown are left out of
 * any VAT figure until fixed; this panel never blocks anything. Invoices and expenses are counted from the lists already
 * loaded on this page; bills (no screen yet) come from vat_records_needing_attention() when the database has it.
 * HMRC P4b: with an active company (and the company column in the database) the counts are split: that company's
 * records, and the person's records with no company yet, labelled separately. Records of other companies are not counted.
 */
export function VatAttentionPanel({ invoices, expenses, onOpenInvoices, onOpenExpenses, organizationId, companyName, onOpenCompanyRecords }: {
  invoices: (InvoiceVatColumns & CompanyColumn & { status?: string | null })[];
  expenses: (VatColumns & CompanyColumn & { amount?: number | string | null })[];
  onOpenInvoices: () => void;
  onOpenExpenses: () => void;
  organizationId?: string | null;
  companyName?: string;
  onOpenCompanyRecords?: () => void;
}) {
  const { isDemo } = useDemoMode();
  const [bills, setBills] = useState<{ all: number | null; company: number; unassigned: number }>({ all: null, company: 0, unassigned: 0 });
  useEffect(() => {
    let live = true;
    const rpc = supabase.rpc as unknown as Rpc;
    const read = (data: unknown) => (Array.isArray(data) ? (data as CountRow[]) : null);
    const billsOf = (rows: CountRow[], scope?: string) => Number(rows.find((r) => r.record_type === 'bills' && (!scope || r.scope === scope))?.needing) || 0;
    // Before the database update the function doesn't exist: no bills count, nothing else changes. Before the P4b update
    // the company argument doesn't exist: the old call is used.
    (async () => {
      try {
        if (organizationId) {
          const res = await rpc('vat_records_needing_attention', { p_organization_id: organizationId });
          const rows = res && !res.error ? read(res.data) : null;
          if (rows && rows.some((r) => r.scope === 'company')) {
            if (live) setBills({ all: billsOf(rows, 'company') + billsOf(rows, 'unassigned'), company: billsOf(rows, 'company'), unassigned: billsOf(rows, 'unassigned') });
            return;
          }
        }
        const res = await rpc('vat_records_needing_attention');
        const rows = res && !res.error ? read(res.data) : null;
        if (!live || !rows) return;
        const row = rows.find((r) => r.record_type === 'bills');
        setBills({ all: row ? Number(row.needing) || 0 : null, company: 0, unassigned: row ? Number(row.needing) || 0 : 0 });
      } catch { /* no bills count */ }
    })();
    return () => { live = false; };
  }, [organizationId]);

  const needI = invoices.filter(invoiceNeedsVat);
  const needE = expenses.filter(moneyOutNeedsVat);
  const split = !!organizationId && hasCompanyColumn([...invoices, ...expenses]);
  const company: Counts = split
    ? { invoices: needI.filter((r) => r.organization_id === organizationId).length, expenses: needE.filter((r) => r.organization_id === organizationId).length, bills: bills.company }
    : { invoices: 0, expenses: 0, bills: 0 };
  const unassigned: Counts = split
    ? { invoices: needI.filter((r) => !r.organization_id).length, expenses: needE.filter((r) => !r.organization_id).length, bills: bills.unassigned }
    : { invoices: needI.length, expenses: needE.length, bills: bills.all ?? 0 };
  const nInvoices = company.invoices + unassigned.invoices;
  const nExpenses = company.expenses + unassigned.expenses;
  const nBills = company.bills + unassigned.bills;
  if (!nInvoices && !nExpenses && !nBills) return null;
  const act = isDemo ? 'Show' : 'Add VAT details to';
  const companyLine = sentence(company);
  const unassignedLine = sentence(unassigned);
  return (
    <section aria-label="VAT details" data-testid="vat-attention" className="flex flex-col gap-3 rounded-card border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-2 text-body">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {split ? (
          <div className="space-y-1">
            {companyLine && <p data-testid="vat-attention-company"><strong>{companyName || 'This company'}: {companyLine}</strong></p>}
            {unassignedLine && <p data-testid="vat-attention-unassigned"><strong>With no company yet: {unassignedLine}</strong></p>}
            <p>Until then they are left out of VAT figures. Nothing else is affected.</p>
          </div>
        ) : (
          <span><strong>{unassignedLine}</strong> Until then they are left out of VAT figures. Nothing else is affected.</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {nInvoices > 0 && <Button variant="outline" size="sm" className="min-h-touch md:min-h-9" onClick={onOpenInvoices}>{act} invoices</Button>}
        {nExpenses > 0 && <Button variant="outline" size="sm" className="min-h-touch md:min-h-9" onClick={onOpenExpenses}>{act} expenses</Button>}
        {split && onOpenCompanyRecords && (unassigned.invoices + unassigned.expenses + unassigned.bills) > 0 && (
          <Button variant="outline" size="sm" className="min-h-touch md:min-h-9" onClick={onOpenCompanyRecords}>{isDemo ? 'Show records with no company' : 'Review records with no company'}</Button>
        )}
        {nBills > 0 && <span className="self-center text-small" data-testid="vat-attention-bills">Bills have no screen in B2BNEST yet.</span>}
      </div>
    </section>
  );
}
