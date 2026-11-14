import { useEffect, useMemo, useState } from 'react';
import { runLedgerAutoSoon } from '@/lib/ledgerAutoRun';
import { Building2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDemoMode } from '@/contexts/demoModeState';
import { formatDueDate } from '@/lib/dashboardData';
import { formatMoney } from '@/lib/money';
import {
  companyErrorMessage, companyLabel, countText, hasCompanyColumn, hasNoCompany, KIND_TABLE, planBulkVat,
  type CompanyChoice, type FinanceBill, type FinanceExpense, type FinanceInvoice, type FinanceKind,
} from '@/lib/financeCompany';
import {
  DEFAULT_TREATMENT, fromPence, invoiceNeedsVat, isGbp, moneyOutNeedsVat, VAT_ENTRY_OPTIONS, VAT_TREATMENT_LABELS, VAT_TREATMENTS, type VatEntry, type VatTreatment,
} from '@/lib/vat';

type Res = { data: unknown; error: { code?: string; message?: string } | null };
/** The slice of the Supabase client used here (narrow, so tests can pass a fake). Every write is filtered by user_id. */
export interface ReviewClient {
  from: (table: string) => {
    select: (cols: string) => { eq: (c: string, v: string) => PromiseLike<Res> };
    update: (row: Record<string, unknown>) => {
      in: (c: string, v: string[]) => { eq: (c: string, v: string) => { is: (c: string, v: null) => { select: (cols: 'id') => PromiseLike<Res> } } };
      eq: (c: string, v: string) => { eq: (c: string, v: string) => { select: (cols: 'id') => PromiseLike<Res> } };
    };
  };
}

interface Row {
  key: string; kind: FinanceKind; id: string; title: string; date: string | null; amount: number; currency: string;
  organizationId: string | null; needsVat: boolean; draft: boolean; notGbp: boolean;
}
type Show = 'no_company' | 'vat_missing' | 'both';
const NOUN: Record<FinanceKind, string> = { invoice: 'Invoice', expense: 'Expense', bill: 'Bill' };
const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * HMRC P4b: the person's own invoices, expenses and bills that have no company yet (or no VAT details). Nothing is ever
 * assigned automatically: the person picks one of the companies they belong to, selects records, reads a confirmation
 * that says how many records of which kind go to which company, and only then are they saved. The same selection can
 * "Set VAT on selected" (invoices and expenses, GBP only) after a preview and a confirmation. Demo accounts only see.
 */
export function CompanyRecordsReview({ client, userId, invoices, expenses, companies, organizationId, accountCurrency, onChanged }: {
  client: ReviewClient;
  userId: string;
  invoices: (FinanceInvoice & { archived_at?: string | null })[];
  expenses: FinanceExpense[];
  companies: CompanyChoice[];
  organizationId: string | null;
  accountCurrency: string;
  onChanged: () => void;
}) {
  const { isDemo } = useDemoMode();
  const [bills, setBills] = useState<FinanceBill[]>([]);
  const [billsTick, setBillsTick] = useState(0);
  useEffect(() => {
    let live = true;
    if (!userId) return;
    Promise.resolve(client.from('bills').select('*').eq('user_id', userId)).then((r) => {
      if (live && r && !r.error && Array.isArray(r.data)) setBills(r.data as FinanceBill[]);
    }).catch(() => {});
    return () => { live = false; };
  }, [client, userId, billsTick]);

  const activeInvoices = useMemo(() => invoices.filter((d) => !d.archived_at), [invoices]);
  const columnReady = hasCompanyColumn([...activeInvoices, ...expenses, ...bills]);
  const [show, setShow] = useState<Show>('no_company');
  const [kindFilter, setKindFilter] = useState<'all' | FinanceKind>('all');
  const [company, setCompany] = useState<string>(organizationId ?? '');
  useEffect(() => { if (!company && organizationId) setCompany(organizationId); }, [organizationId, company]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmAssign, setConfirmAssign] = useState(false);
  const [vatOpen, setVatOpen] = useState(false);
  const [vatConfirm, setVatConfirm] = useState(false);
  const [treatment, setTreatment] = useState<VatTreatment>(DEFAULT_TREATMENT);
  const [entry, setEntry] = useState<VatEntry>('including');
  const [busy, setBusy] = useState(false);
  const money = (n: number, c: string) => formatMoney(n, c, { cents: true });

  const allRows: Row[] = useMemo(() => [
    ...activeInvoices.map((d): Row => ({ key: `invoice:${d.id}`, kind: 'invoice', id: d.id, title: d.invoice_number || 'Invoice', date: d.created_at ?? null, amount: Number(d.total_amount) || 0,
      currency: d.currency || '', organizationId: d.organization_id ?? null, needsVat: invoiceNeedsVat(d), draft: (d.status ?? '') === 'draft', notGbp: !isGbp(d.currency) })),
    ...expenses.map((e): Row => ({ key: `expense:${e.id}`, kind: 'expense', id: e.id, title: e.description || 'Expense', date: e.date ?? null, amount: Number(e.amount) || 0,
      currency: accountCurrency, organizationId: e.organization_id ?? null, needsVat: moneyOutNeedsVat(e), draft: false, notGbp: !isGbp(accountCurrency) })),
    ...bills.map((b): Row => ({ key: `bill:${b.id}`, kind: 'bill', id: b.id, title: b.description || 'Bill', date: b.issue_date ?? null, amount: Number(b.amount) || 0,
      currency: b.currency || '', organizationId: b.organization_id ?? null, needsVat: moneyOutNeedsVat(b), draft: false, notGbp: !isGbp(b.currency) })),
  ], [activeInvoices, expenses, bills, accountCurrency]);
  // Only rows that need something: no company (once the column exists) or no VAT details.
  const listed = allRows.filter((r) => {
    const noCompany = columnReady && !r.organizationId;
    const match = show === 'no_company' ? noCompany : show === 'vat_missing' ? r.needsVat : noCompany || r.needsVat;
    return match && (kindFilter === 'all' || r.kind === kindFilter);
  });
  const noCompanyCount = columnReady ? allRows.filter((r) => !r.organizationId).length : 0;
  const vatMissingCount = allRows.filter((r) => r.needsVat).length;
  const picked = allRows.filter((r) => selected.has(r.key));
  const pickedNoCompany = picked.filter((r) => !r.organizationId);
  const companyName = companies.find((c) => c.organizationId === company)?.name ?? '';
  const allListedPicked = listed.length > 0 && listed.every((r) => selected.has(r.key));
  const toggle = (key: string) => setSelected((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const toggleAll = () => setSelected((s) => { const n = new Set(s); listed.forEach((r) => (allListedPicked ? n.delete(r.key) : n.add(r.key))); return n; });
  const countOf = (rows: Row[]) => ({ invoice: rows.filter((r) => r.kind === 'invoice').length, expense: rows.filter((r) => r.kind === 'expense').length, bill: rows.filter((r) => r.kind === 'bill').length });

  const plan = useMemo(() => planBulkVat({
    invoices: activeInvoices.filter((d) => selected.has(`invoice:${d.id}`)), expenses: expenses.filter((e) => selected.has(`expense:${e.id}`)),
    bills: bills.filter((b) => selected.has(`bill:${b.id}`)), treatment, entry, accountCurrency,
  }), [activeInvoices, expenses, bills, selected, treatment, entry, accountCurrency]);
  // Records with no company are linked to the chosen company in the same save (the database needs a company for VAT).
  const vatNeedsCompany = columnReady && plan.needCompany > 0;
  const changed = () => { setSelected(new Set()); setBillsTick((n) => n + 1); onChanged(); };

  const assign = async () => {
    if (!company || !pickedNoCompany.length) return;
    setBusy(true);
    let done = 0; let failed = 0; let message: string | null = null;
    for (const kind of ['invoice', 'expense', 'bill'] as FinanceKind[]) {
      const ids = pickedNoCompany.filter((r) => r.kind === kind).map((r) => r.id);
      if (!ids.length) continue;
      try {
        // Only this person's rows that still have no company: nothing already linked is moved.
        const r = await client.from(KIND_TABLE[kind]).update({ organization_id: company }).in('id', ids).eq('user_id', userId).is('organization_id', null).select('id');
        if (r.error) { failed += ids.length; message = companyErrorMessage(r.error) ?? message; continue; }
        const n = Array.isArray(r.data) ? r.data.length : 0;
        done += n; failed += ids.length - n;
        if (kind === 'invoice' && n > 0) runLedgerAutoSoon(company);
      } catch { failed += ids.length; }
    }
    setBusy(false); setConfirmAssign(false);
    if (done) toast.success(`${done} record${done === 1 ? '' : 's'} assigned to ${companyName}.`);
    if (failed) toast.error(message ?? `${failed} record${failed === 1 ? ' was' : 's were'} not assigned. Nothing else was changed.`);
    changed();
  };

  const saveVat = async () => {
    if (vatNeedsCompany && !company) return;
    setBusy(true);
    let done = 0; let failed = 0; let message: string | null = null;
    for (const c of plan.changes) {
      const row = allRows.find((r) => r.key === `${c.kind}:${c.id}`);
      const payload = { ...c.payload, ...(columnReady && row && hasNoCompany({ organization_id: row.organizationId }) ? { organization_id: company } : {}) };
      try {
        const r = await client.from(KIND_TABLE[c.kind]).update(payload).eq('id', c.id).eq('user_id', userId).select('id');
        const ok = !r.error && Array.isArray(r.data) && r.data.length === 1;
        if (ok) done += 1; else { failed += 1; message = (r.error ? companyErrorMessage(r.error) : null) ?? message; }
        if (ok && c.kind === 'invoice') runLedgerAutoSoon(row?.organizationId ?? (typeof payload.organization_id === 'string' ? payload.organization_id : null));
      } catch { failed += 1; }
    }
    setBusy(false); setVatConfirm(false); setVatOpen(false);
    if (done) toast.success(`VAT details saved on ${done} record${done === 1 ? '' : 's'}.`);
    if (failed) toast.error(message ?? `${failed} record${failed === 1 ? ' was' : 's were'} not changed. Check them one by one.`);
    changed();
  };

  const skippedText = [
    plan.skipped.notGbp ? `${plan.skipped.notGbp} not in GBP` : null,
    plan.skipped.bills ? `${plan.skipped.bills} bill${plan.skipped.bills === 1 ? '' : 's'} (no VAT helper for bills yet)` : null,
    plan.skipped.alreadyRecorded ? `${plan.skipped.alreadyRecorded} already with VAT details` : null,
    plan.skipped.unreadable ? `${plan.skipped.unreadable} that can't be worked out (no lines, amount or date)` : null,
  ].filter(Boolean) as string[];
  const totalsChange = plan.changes.filter((c) => c.totalChanged).length;

  return (
    <section aria-labelledby="company-records-title" className="space-y-4 rounded-card border border-border bg-card p-4 md:p-6">
      <div className="space-y-1">
        <h2 id="company-records-title" className="text-h3 font-semibold text-foreground">Records with no company</h2>
        <p className="text-body text-muted-foreground">
          Your invoices, expenses and bills from before records were linked to a company. A VAT return uses one company&rsquo;s records only, so choose the company each one belongs to. Nothing is assigned automatically.
        </p>
      </div>

      {!columnReady && (
        <p className="rounded-control border border-border bg-muted/40 p-3 text-body" data-testid="company-column-missing">
          Linking records to a company arrives with a database update. Until then this list shows records that need VAT details.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {([['no_company', `No company (${noCompanyCount})`], ['vat_missing', `VAT not recorded (${vatMissingCount})`], ['both', 'Either']] as [Show, string][]).map(([v, label]) => (
            <Button key={v} type="button" size="sm" variant={show === v ? 'default' : 'outline'} aria-pressed={show === v} className="min-h-touch md:min-h-9" onClick={() => setShow(v)}>{label}</Button>
          ))}
        </div>
        <div className="w-40">
          <Label htmlFor="company-records-kind">Type</Label>
          <select id="company-records-kind" className={selectClass} value={kindFilter} onChange={(e) => setKindFilter(e.target.value as 'all' | FinanceKind)}>
            <option value="all">All types</option><option value="invoice">Invoices</option><option value="expense">Expenses</option><option value="bill">Bills</option>
          </select>
        </div>
        {!isDemo && columnReady && (
          <div className="w-64">
            <Label htmlFor="company-records-company">Company</Label>
            <select id="company-records-company" className={selectClass} value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="" disabled>Choose a company</option>
              {companies.map((c) => <option key={c.organizationId} value={c.organizationId}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {listed.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-control border border-dashed p-8 text-center">
          <CheckCircle2 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium text-foreground">Nothing to review here</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-body">
            <caption className="sr-only">Records to review</caption>
            <thead>
              <tr className="border-b border-border text-small text-muted-foreground">
                {!isDemo && <th scope="col" className="w-10 p-2"><input type="checkbox" aria-label={`Select all ${listed.length} shown`} checked={allListedPicked} onChange={toggleAll} className="h-4 w-4" /></th>}
                <th scope="col" className="p-2">Type</th><th scope="col" className="p-2">Record</th><th scope="col" className="p-2">Date</th>
                <th scope="col" className="p-2 text-right">Amount</th><th scope="col" className="p-2">Company</th><th scope="col" className="p-2">VAT</th>
              </tr>
            </thead>
            <tbody>
              {listed.map((r) => (
                <tr key={r.key} className="border-b border-border" data-testid="company-record-row">
                  {!isDemo && <td className="p-2"><input type="checkbox" aria-label={`Select ${NOUN[r.kind].toLowerCase()} ${r.title}`} checked={selected.has(r.key)} onChange={() => toggle(r.key)} className="h-4 w-4" /></td>}
                  <td className="p-2">{NOUN[r.kind]}</td>
                  <td className="max-w-[16rem] truncate p-2 font-semibold">{r.title}
                    {r.draft && <span className="ml-2 rounded-full bg-muted px-2 text-small font-normal">Draft</span>}
                    {r.notGbp && <span className="ml-2 rounded-full bg-muted px-2 text-small font-normal">Not GBP{r.currency ? ` (${r.currency})` : ''}</span>}
                  </td>
                  <td className="whitespace-nowrap p-2">{r.date ? formatDueDate(r.date.slice(0, 10)) : '—'}</td>
                  <td className="whitespace-nowrap p-2 text-right tabular-nums">{money(r.amount, r.currency)}</td>
                  <td className="p-2">{columnReady ? companyLabel(r.organizationId, companies) : '—'}</td>
                  <td className="p-2">{r.needsVat ? 'VAT not recorded' : 'Recorded'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isDemo && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-small text-muted-foreground" aria-live="polite">{picked.length} selected</span>
          {columnReady && (
            <Button type="button" disabled={!company || !pickedNoCompany.length || busy} onClick={() => setConfirmAssign(true)}>
              <Building2 className="h-4 w-4" aria-hidden="true" />Assign to company
            </Button>
          )}
          <Button type="button" variant="outline" disabled={!picked.length || busy} onClick={() => setVatOpen(true)}>Set VAT on selected</Button>
        </div>
      )}
      <p className="flex items-start gap-2 text-small text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        You only see your own records here, and only the companies you are a member of.
      </p>

      <AlertDialog open={confirmAssign} onOpenChange={(o) => { if (!busy) setConfirmAssign(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign to {companyName}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2" data-testid="assign-summary">
                <p><strong>{countText(countOf(pickedNoCompany))}</strong> will be assigned to <strong>{companyName}</strong>.</p>
                {picked.length > pickedNoCompany.length && <p>{picked.length - pickedNoCompany.length} selected record{picked.length - pickedNoCompany.length === 1 ? '' : 's'} already {picked.length - pickedNoCompany.length === 1 ? 'has' : 'have'} a company and {picked.length - pickedNoCompany.length === 1 ? 'is' : 'are'} left as {picked.length - pickedNoCompany.length === 1 ? 'it is' : 'they are'}.</p>}
                <p>Their VAT figures will count for {companyName} only.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void assign(); }}>{busy ? 'Assigning…' : `Assign ${pickedNoCompany.length} to ${companyName}`}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={vatOpen} onOpenChange={(o) => { if (!busy) setVatOpen(o); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Set VAT on selected</DialogTitle>
            <DialogDescription>Choose how VAT applies, check the preview, then confirm. Nothing is saved until you confirm.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="bulk-vat-treatment">VAT treatment</Label>
                <select id="bulk-vat-treatment" className={selectClass} value={treatment} onChange={(e) => setTreatment(e.target.value as VatTreatment)}>
                  {VAT_TREATMENTS.map((t) => <option key={t} value={t}>{VAT_TREATMENT_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="bulk-vat-entry">Expense amounts are</Label>
                <select id="bulk-vat-entry" className={selectClass} value={entry} onChange={(e) => setEntry(e.target.value as VatEntry)}>
                  {VAT_ENTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <p className="text-small text-muted-foreground">On invoices the line prices are before VAT (as in the invoice form): the treatment is set on every line and VAT is added per line.</p>
            <div className="rounded-control border border-border bg-muted/40 p-3 text-body" data-testid="bulk-vat-preview">
              <p><strong>{plan.changes.length} record{plan.changes.length === 1 ? '' : 's'}</strong>: net <strong className="tabular-nums">{money(fromPence(plan.totals.net), 'GBP')}</strong> · VAT <strong className="tabular-nums">{money(fromPence(plan.totals.vat), 'GBP')}</strong> · total <strong className="tabular-nums">{money(fromPence(plan.totals.gross), 'GBP')}</strong></p>
              {skippedText.length > 0 && <p data-testid="bulk-vat-skipped">Left out: {skippedText.join(', ')}.</p>}
              {totalsChange > 0 && <p>{totalsChange} record total{totalsChange === 1 ? '' : 's'} will change.</p>}
              {vatNeedsCompany && <p>{plan.needCompany} of them {plan.needCompany === 1 ? 'has' : 'have'} no company: {company ? <>{plan.needCompany === 1 ? 'it' : 'they'} will be assigned to <strong>{companyName}</strong>.</> : 'choose a company above first.'}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setVatOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="button" disabled={!plan.changes.length || busy || (vatNeedsCompany && !company)} onClick={() => setVatConfirm(true)}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={vatConfirm} onOpenChange={(o) => { if (!busy) setVatConfirm(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save VAT details on {plan.changes.length} record{plan.changes.length === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2" data-testid="bulk-vat-confirm">
                <p>{countText({ invoice: plan.changes.filter((c) => c.kind === 'invoice').length, expense: plan.changes.filter((c) => c.kind === 'expense').length })} will be saved with <strong>{VAT_TREATMENT_LABELS[treatment]}</strong>, VAT recorded, with the tax point on each record&rsquo;s own date.</p>
                {vatNeedsCompany && <p>{plan.needCompany} will also be assigned to <strong>{companyName}</strong>.</p>}
                <p>You can still change each record afterwards.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void saveVat(); }}>{busy ? 'Saving…' : 'Save VAT details'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
