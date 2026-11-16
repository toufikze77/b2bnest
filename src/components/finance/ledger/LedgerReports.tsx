// Finance phase 4: the "Reports" section of the Ledger tab (docs/ledger-reports/README.md). Profit and loss, balance
// sheet and account detail, computed by the database from the ledger only. Read only: members can open everything;
// there is nothing to change here. The chosen report, dates and account are in the URL, so a refresh or Back keeps them.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LEDGER_DISCLAIMER, ledgerMessage, toPence, type LedgerAccount } from '@/lib/ledger';
import { codeOf, type LedgerApi } from '@/lib/ledgerApi';
import { AUTO_MFA_MESSAGE } from '@/lib/ledgerAuto';
import { searchWithLedgerSection } from '@/lib/financeTabs';
import { downloadBlob } from '@/lib/legalExport';
import {
  accountDetailCsv, accountFileName, balanceSheetCsv, balanceSheetFileName, beforeBooksText, BS_AGREE, BS_DISAGREE, completenessNotes, DETAIL_TRUNCATED,
  groupBalanceSheet, groupProfitLoss, money, PL_ROW_CODE, PL_ROW_EXPLAINED, profitLossCsv, profitLossFileName, profitWord, QUICK_RANGE_LABELS, quickRange,
  rangeProblem, REPORT_VIEW_LABELS, REPORT_VIEWS, reportParamsFromSearch, REPORTS_EMPTY, searchWithReport, sourceText, startsBeforeBooks, ukDate,
  type AccountDetail, type BsRow, type Completeness, type Line, type PlRow, type QuickRange, type ReportParams, type ReportView,
} from '@/lib/ledgerReports';

const todayIso = () => new Date().toISOString().slice(0, 10);
type Load<T> = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ok'; data: T };
const message = (code: string) => (code === 'MFA_REQUIRED' ? AUTO_MFA_MESSAGE : code === 'NOT_AVAILABLE' ? 'Reports are not available yet.' : ledgerMessage(code));
const csvBlob = (text: string) => new Blob([text], { type: 'text/csv;charset=utf-8' });
/** The latest start date that keeps a drill-down within the 5-year limit. */
function drillFrom(startDate: string | null, to: string): string {
  const [y, m, d] = to.split('-').map(Number);
  const limit = new Date(Date.UTC(y - 5, m - 1, d + 1)).toISOString().slice(0, 10);
  const from = startDate && startDate <= to ? startDate : `${to.slice(0, 4)}-01-01`;
  return from < limit ? limit : from;
}

export function LedgerReports({ api, organizationId, accounts, startDate, refreshKey = 0 }: {
  api: LedgerApi; organizationId: string; accounts: LedgerAccount[]; startDate: string | null; refreshKey?: number;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = reportParamsFromSearch(location.search);
  const today = todayIso();
  const defaults = quickRange('this-tax-year', today, startDate);
  const from = params.from ?? defaults.from;
  const to = params.to ?? defaults.to;
  const asOf = params.asOf ?? today;
  const sorted = useMemo(() => [...accounts].sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true })), [accounts]);
  const account = params.account ?? sorted.find((a) => a.code === '1200')?.id ?? sorted[0]?.id;
  const go = (r: Partial<ReportParams>) => navigate({ search: `?${searchWithReport(location.search, { ...params, ...r })}` });
  const linkTo = (r: ReportParams) => ({ search: `?${searchWithReport(location.search, r)}` });

  const [completeness, setCompleteness] = useState<Completeness | null>(null);
  useEffect(() => {
    let live = true;
    void api.reportCompleteness(organizationId).then((r) => { if (live) setCompleteness(r.ok ? r.data : null); });
    return () => { live = false; };
  }, [api, organizationId, refreshKey]);
  const notes = completenessNotes(completeness);

  return (
    <div className="space-y-4 text-sm">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Tabs value={params.view} onValueChange={(v) => go({ view: v as ReportView })}>
          <TabsList aria-label="Reports">
            {REPORT_VIEWS.map((v) => <TabsTrigger key={v} value={v}>{REPORT_VIEW_LABELS[v]}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      </div>
      {notes.length > 0 && (
        <div className="space-y-1 rounded-md border p-3" data-testid="reports-completeness" role="note">
          <p className="font-medium">These figures may not be complete yet.</p>
          <ul className="list-disc space-y-1 pl-5">
            {notes.map((n, i) => (
              <li key={i}>{n.text}{' '}
                <Link className="no-print font-medium text-primary underline" to={{ search: `?${searchWithLedgerSection(location.search, n.link)}` }}>
                  {n.link === 'bank' ? 'Open Bank' : 'Open Automatic postings'}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div id="ledger-report" className="space-y-3">
        {params.view === 'profit-loss' && (
          <ProfitLossView api={api} organizationId={organizationId} accounts={sorted} startDate={startDate} from={from} to={to} refreshKey={refreshKey}
            setRange={(f, t) => go({ from: f, to: t })} drill={(id) => linkTo({ view: 'account', account: id, from, to })} />
        )}
        {params.view === 'balance-sheet' && (
          <BalanceSheetView api={api} organizationId={organizationId} asOf={asOf} refreshKey={refreshKey} setAsOf={(d) => go({ asOf: d })}
            drill={(id) => linkTo({ view: 'account', account: id, from: drillFrom(startDate, asOf), to: asOf })} />
        )}
        {params.view === 'account' && (
          <AccountView api={api} organizationId={organizationId} accounts={sorted} account={account} from={from} to={to} startDate={startDate} refreshKey={refreshKey}
            set={(r) => go(r)} />
        )}
        <p className="text-muted-foreground" data-testid="reports-disclaimer">{LEDGER_DISCLAIMER}</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ shared bits

/** The browser's print dialog, showing only the report (see "print-ledger-report" in index.css). */
function printReport() {
  document.body.classList.add('print-ledger-report');
  const done = () => { document.body.classList.remove('print-ledger-report'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  try { window.print(); } finally { setTimeout(done, 1000); }
}

function Actions({ onCsv, disabled }: { onCsv: () => void; disabled: boolean }) {
  return (
    <div className="no-print flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={onCsv} disabled={disabled}>Download CSV</Button>
      <Button variant="outline" size="sm" onClick={printReport}>Print</Button>
    </div>
  );
}
function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span>{label}</span>
      <Input id={id} type="date" value={value} onChange={(e) => { if (e.target.value) onChange(e.target.value); }} className="w-auto" />
    </label>
  );
}
function useReport<T>(fetcher: () => Promise<{ ok: true; data: T } | { ok: false; code: string }>, deps: unknown[], skip: string | null): Load<T> {
  const [state, setState] = useState<Load<T>>({ kind: 'idle' });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the report's own inputs
  const run = useCallback(fetcher, deps);
  useEffect(() => {
    if (skip) { setState({ kind: 'error', message: skip }); return; }
    let live = true;
    setState({ kind: 'loading' });
    void run().then((r) => { if (live) setState(r.ok ? { kind: 'ok', data: r.data } : { kind: 'error', message: message(codeOf(r)) }); });
    return () => { live = false; };
  }, [run, skip]);
  return state;
}
const Status = ({ s }: { s: Load<unknown> }) => (s.kind === 'loading' || s.kind === 'idle' ? <p role="status">Loading…</p>
  : s.kind === 'error' ? <p role="alert" className="text-destructive">{s.message}</p> : null);
const Amount = ({ pence, strong }: { pence: number; strong?: boolean }) => (
  <td className={`py-1 text-right tabular-nums ${strong ? 'font-semibold' : ''}`}>{money(pence)}</td>
);

// ------------------------------------------------------------------ profit and loss

function ProfitLossView({ api, organizationId, accounts, startDate, from, to, refreshKey, setRange, drill }: {
  api: LedgerApi; organizationId: string; accounts: LedgerAccount[]; startDate: string | null; from: string; to: string; refreshKey: number;
  setRange: (f: string, t: string) => void; drill: (id: string) => { search: string };
}) {
  const [showEmpty, setShowEmpty] = useState(false);
  const problem = rangeProblem(from, to);
  const s = useReport<PlRow[]>(() => api.reportProfitLoss(organizationId, from, to), [api, organizationId, from, to, refreshKey], problem);
  const pl = s.kind === 'ok' ? groupProfitLoss(s.data, accounts, showEmpty) : null;
  const rows = (xs: Line[]) => xs.map((l) => (
    <tr key={l.account_id ?? l.code}>
      <td className="py-1 pr-2"><Link className="hover:underline" to={drill(l.account_id as string)}>{l.code} {l.name}</Link></td><Amount pence={l.pence} />
    </tr>
  ));
  const total = (label: string, pence: number, testId?: string) => (
    <tr className="border-t font-medium" data-testid={testId}><td className="py-1 pr-2">{label}</td><Amount pence={pence} strong /></tr>
  );
  const heading = (label: string) => <tr><th colSpan={2} className="pt-3 text-left font-semibold">{label}</th></tr>;
  return (
    <div className="space-y-3" data-testid="report-profit-loss">
      <h3 className="text-base font-semibold">Profit and loss, {ukDate(from)} to {ukDate(to)}</h3>
      <div className="no-print flex flex-wrap items-end gap-3">
        <DateField id="pl-from" label="From" value={from} onChange={(v) => setRange(v, to)} />
        <DateField id="pl-to" label="To" value={to} onChange={(v) => setRange(from, v)} />
        <div className="flex flex-wrap gap-1" aria-label="Quick choices">
          {(Object.keys(QUICK_RANGE_LABELS) as QuickRange[]).map((q) => (
            <Button key={q} variant="ghost" size="sm" onClick={() => { const r = quickRange(q, new Date().toISOString().slice(0, 10), startDate); setRange(r.from, r.to); }}>{QUICK_RANGE_LABELS[q]}</Button>
          ))}
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} />Show empty accounts</label>
      </div>
      {startDate && startsBeforeBooks(from, startDate) && <p className="text-muted-foreground" data-testid="before-books">{beforeBooksText(startDate)}</p>}
      <Status s={s} />
      {pl && (
        <>
          <Actions disabled={false} onCsv={() => downloadBlob(csvBlob(profitLossCsv(pl, from, to)), profitLossFileName(from, to))} />
          {s.kind === 'ok' && s.data.length === 0 && !showEmpty ? <p data-testid="reports-empty">{REPORTS_EMPTY}</p> : (
            <table className="w-full max-w-2xl" aria-label="Profit and loss">
              <tbody>
                {heading('Income')}
                {rows(pl.sales)}{total('Total sales', pl.totalSales)}
                {pl.otherIncome.length > 0 && <>{rows(pl.otherIncome)}{total('Total other income', pl.totalOtherIncome)}</>}
                {heading('Cost of sales')}
                {rows(pl.costOfSales)}{total('Total cost of sales', pl.totalCostOfSales)}
                {total(profitWord(pl.grossProfit, 'Gross profit', 'Gross loss'), pl.grossProfit, 'pl-gross')}
                {heading('Overheads')}
                {rows(pl.overheads)}{total('Total overheads', pl.totalOverheads)}
                {total(`${profitWord(pl.net)} for the period`, pl.net, 'pl-net')}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ balance sheet

function BalanceSheetView({ api, organizationId, asOf, refreshKey, setAsOf, drill }: {
  api: LedgerApi; organizationId: string; asOf: string; refreshKey: number; setAsOf: (d: string) => void; drill: (id: string) => { search: string };
}) {
  const s = useReport<BsRow[]>(() => api.reportBalanceSheet(organizationId, asOf), [api, organizationId, asOf, refreshKey], null);
  const bs = s.kind === 'ok' ? groupBalanceSheet(s.data) : null;
  const rows = (xs: Line[]) => xs.map((l) => (
    <tr key={l.account_id ?? l.code}>
      <td className="py-1 pr-2">{l.code === PL_ROW_CODE ? <span>{l.name}</span> : <Link className="hover:underline" to={drill(l.account_id as string)}>{l.code} {l.name}</Link>}</td>
      <Amount pence={l.pence} />
    </tr>
  ));
  const total = (label: string, pence: number, testId?: string) => (
    <tr className="border-t font-medium" data-testid={testId}><td className="py-1 pr-2">{label}</td><Amount pence={pence} strong /></tr>
  );
  const heading = (label: string) => <tr><th colSpan={2} className="pt-3 text-left font-semibold">{label}</th></tr>;
  const empty = bs && bs.fixedAssets.length + bs.currentAssets.length + bs.liabilities.length === 0 && bs.equity.every((l) => l.pence === 0);
  return (
    <div className="space-y-3" data-testid="report-balance-sheet">
      <h3 className="text-base font-semibold">Balance sheet as at {ukDate(asOf)}</h3>
      <div className="no-print"><DateField id="bs-as-of" label="As at" value={asOf} onChange={setAsOf} /></div>
      <Status s={s} />
      {bs && (
        <>
          <Actions disabled={false} onCsv={() => downloadBlob(csvBlob(balanceSheetCsv(bs, asOf)), balanceSheetFileName(asOf))} />
          {empty ? <p data-testid="reports-empty">{REPORTS_EMPTY}</p> : (
            <table className="w-full max-w-2xl" aria-label="Balance sheet">
              <tbody>
                {bs.fixedAssets.length > 0 && <>{heading('Fixed assets')}{rows(bs.fixedAssets)}{total('Total fixed assets', bs.totalFixed)}</>}
                {heading('Current assets')}{rows(bs.currentAssets)}{total('Total current assets', bs.totalCurrent)}
                {heading('Current liabilities')}{rows(bs.liabilities)}{total('Total current liabilities', bs.totalLiabilities)}
                {total('Net assets', bs.netAssets, 'bs-net-assets')}
                {heading('Equity')}{rows(bs.equity)}{total('Total equity', bs.totalEquity, 'bs-equity')}
              </tbody>
            </table>
          )}
          <p className="text-muted-foreground">{PL_ROW_EXPLAINED}</p>
          <p role="status" data-testid="bs-check" className={bs.balanced ? 'font-medium text-green-700' : 'font-medium text-destructive'}>{bs.balanced ? BS_AGREE : BS_DISAGREE}</p>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ account detail

function AccountView({ api, organizationId, accounts, account, from, to, startDate, refreshKey, set }: {
  api: LedgerApi; organizationId: string; accounts: LedgerAccount[]; account: string | undefined; from: string; to: string; startDate: string | null;
  refreshKey: number; set: (r: Partial<ReportParams>) => void;
}) {
  const problem = !account ? 'Choose an account.' : rangeProblem(from, to);
  const s = useReport<AccountDetail>(() => api.reportAccountDetail(organizationId, account as string, from, to), [api, organizationId, account, from, to, refreshKey], problem);
  const d = s.kind === 'ok' ? s.data : null;
  return (
    <div className="space-y-3" data-testid="report-account">
      <h3 className="text-base font-semibold">Account detail{d ? `: ${d.account.code} ${d.account.name}` : ''}, {ukDate(from)} to {ukDate(to)}</h3>
      <div className="no-print flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1"><span>Account</span>
          <select aria-label="Account" value={account ?? ''} onChange={(e) => set({ account: e.target.value })} className="rounded-md border bg-background px-2 py-1">
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}{a.is_active ? '' : ' (inactive)'}</option>)}
          </select>
        </label>
        <DateField id="ad-from" label="From" value={from} onChange={(v) => set({ from: v, to })} />
        <DateField id="ad-to" label="To" value={to} onChange={(v) => set({ from, to: v })} />
      </div>
      {startDate && startsBeforeBooks(from, startDate) && <p className="text-muted-foreground">{beforeBooksText(startDate)}</p>}
      <Status s={s} />
      {d && (
        <>
          <Actions disabled={false} onCsv={() => downloadBlob(csvBlob(accountDetailCsv(d)), accountFileName(d.account.code, from, to))} />
          {d.truncated && <p role="note" className="font-medium" data-testid="detail-truncated">{DETAIL_TRUNCATED}</p>}
          {d.rows.length === 0 && <p data-testid="reports-empty">{REPORTS_EMPTY}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]" aria-label="Account detail">
              <thead><tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-medium">Date</th><th className="py-1 pr-2 font-medium">Source</th><th className="py-1 pr-2 font-medium">Description</th>
                <th className="py-1 pr-2 text-right font-medium">Debit</th><th className="py-1 pr-2 text-right font-medium">Credit</th><th className="py-1 text-right font-medium">Balance</th>
              </tr></thead>
              <tbody>
                <tr className="font-medium"><td className="py-1 pr-2">{ukDate(d.from)}</td><td className="py-1 pr-2" colSpan={4}>Opening balance</td><Amount pence={toPence(d.opening_balance)} /></tr>
                {d.rows.map((r) => (
                  <tr key={`${r.entry_id}-${r.line_no}`}>
                    <td className="whitespace-nowrap py-1 pr-2">{ukDate(r.entry_date)}</td>
                    <td className="py-1 pr-2">{sourceText(r)}</td>
                    <td className="py-1 pr-2">{r.description || r.memo}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{toPence(r.debit) ? money(toPence(r.debit)) : ''}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{toPence(r.credit) ? money(toPence(r.credit)) : ''}</td>
                    <Amount pence={toPence(r.balance)} />
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t font-medium" data-testid="detail-closing">
                <td className="py-1 pr-2">{ukDate(d.to)}</td><td className="py-1 pr-2" colSpan={2}>Closing balance</td>
                <td className="py-1 pr-2 text-right tabular-nums">{money(toPence(d.total_debit))}</td><td className="py-1 pr-2 text-right tabular-nums">{money(toPence(d.total_credit))}</td>
                <Amount pence={toPence(d.closing_balance)} strong />
              </tr></tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
