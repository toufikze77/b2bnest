import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useDemoMode } from '@/contexts/demoModeState';
import { invoiceNeedsVat, moneyOutNeedsVat, type InvoiceVatColumns, type VatColumns } from '@/lib/vat';

type Rpc = (fn: string) => Promise<{ data: unknown; error: unknown }>;
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/**
 * HMRC P4: "N invoices, N expenses and N bills need VAT details". Records without a full VAT breakdown are left out of
 * any VAT figure until fixed; this panel never blocks anything. Invoices and expenses are counted from the lists already
 * loaded on this page; bills (no screen yet) come from vat_records_needing_attention() when the database has it.
 */
export function VatAttentionPanel({ invoices, expenses, onOpenInvoices, onOpenExpenses }: {
  invoices: (InvoiceVatColumns & { status?: string | null })[];
  expenses: (VatColumns & { amount?: number | string | null })[];
  onOpenInvoices: () => void;
  onOpenExpenses: () => void;
}) {
  const { isDemo } = useDemoMode();
  const [bills, setBills] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    // Before the database update the function doesn't exist: no bills count, nothing else changes.
    Promise.resolve().then(() => (supabase.rpc as unknown as Rpc)('vat_records_needing_attention')).then((res) => {
      const { data, error } = res ?? { data: null, error: null };
      if (!live || error || !Array.isArray(data)) return;
      const row = (data as { record_type?: string; needing?: number | string }[]).find((r) => r.record_type === 'bills');
      setBills(row ? Number(row.needing) || 0 : null);
    }).catch(() => {});
    return () => { live = false; };
  }, []);
  const nInvoices = invoices.filter(invoiceNeedsVat).length;
  const nExpenses = expenses.filter(moneyOutNeedsVat).length;
  const nBills = bills ?? 0;
  if (!nInvoices && !nExpenses && !nBills) return null;
  const parts = [nInvoices ? plural(nInvoices, 'invoice') : null, nExpenses ? plural(nExpenses, 'expense') : null, nBills ? plural(nBills, 'bill') : null].filter(Boolean) as string[];
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  const verb = nInvoices + nExpenses + nBills === 1 ? 'needs' : 'need';
  const act = isDemo ? 'Show' : 'Add VAT details to';
  return (
    <section aria-label="VAT details" data-testid="vat-attention" className="flex flex-col gap-3 rounded-card border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50 md:flex-row md:items-center md:justify-between">
      <p className="flex items-start gap-2 text-body">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span><strong>{text} {verb} VAT details.</strong> Until then they are left out of VAT figures. Nothing else is affected.</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {nInvoices > 0 && <Button variant="outline" size="sm" className="min-h-touch md:min-h-9" onClick={onOpenInvoices}>{act} invoices</Button>}
        {nExpenses > 0 && <Button variant="outline" size="sm" className="min-h-touch md:min-h-9" onClick={onOpenExpenses}>{act} expenses</Button>}
        {nBills > 0 && <span className="self-center text-small" data-testid="vat-attention-bills">Bills have no screen in B2BNEST yet.</span>}
      </div>
    </section>
  );
}
