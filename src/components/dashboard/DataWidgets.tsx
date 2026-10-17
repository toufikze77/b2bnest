import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import {
  loadCustomers, loadDeals, loadMoney, loadPendingExpenses, loadRotaToday, loadTickets, Loaded, useScopedLoad,
} from '@/hooks/useDashboardWidgets';
import { CurrencyTotals, countBy, formatMoney, rotaToday, summarizeMoney, summarizePipeline } from '@/lib/dashboardWidgets';
import { STATUS_LABEL, TICKET_STATUSES } from '@/lib/supportTicket';
import { statusLabel } from '@/components/data/StatusBadge';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingRows } from '@/components/ui/states';
import { formatDueDate } from '@/lib/dashboardData';
import { useAccountCurrency } from '@/hooks/useAccountCurrency';
import { Figure, rowLink, WidgetCard } from './WidgetCard';

interface Scope { userId: string; orgId: string }
const key = (s: Scope) => `${s.userId}:${s.orgId}`;

const openLink = (to: string, label: string) => <Button variant="ghost" size="sm" className="text-link" asChild><Link to={to}>{label}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>;

/** Shared loading / error / not-switched-on handling around a widget body. */
function Body<T>({ q, what, children }: { q: Loaded<T>; what: string; children: (data: T) => ReactNode }) {
  if (q.loading) return <LoadingRows rows={2} label={`Loading ${what}`} />;
  if (q.notEnabled) return <p className="px-5 py-4 text-body text-muted-foreground">This tool isn't switched on for this company yet.</p>;
  if (q.error || q.data === null) return <ErrorState className="m-4 rounded-control" title={`Couldn't load ${what}`} description="This is a loading problem, not an empty list." onRetry={q.reload} />;
  return <>{children(q.data)}</>;
}

/** Money per currency; several currencies are listed, never added together. */
function Amounts({ totals }: { totals: CurrencyTotals }) {
  if (totals.length === 0) return <>{formatMoney(0, '')}</>;
  return <>{totals.map((t, i) => <span key={t.currency || 'none'} className={i > 0 ? 'block text-base font-semibold' : 'block'}>{formatMoney(t.amount, t.currency)}</span>)}</>;
}

const Capped = ({ shown, total }: { shown: number; total: number | null }) =>
  total !== null && total > shown ? <p className="px-5 pb-3 text-small text-muted-foreground">Based on the first {shown.toLocaleString()} of {total.toLocaleString()} records.</p> : null;

export function CustomersWidget({ scope }: { scope: Scope }) {
  const q = useScopedLoad(key(scope), true, () => loadCustomers(scope.userId));
  return (
    <WidgetCard id="w-customers" title="Customers" description="CRM contacts by status" scope="personal" action={openLink('/crm', 'Open CRM')}>
      <Body q={q} what="customers">
        {(d) => (
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            <Figure label="All contacts" value={d.total?.toLocaleString() ?? null} />
            <Figure label="Customers" value={d.customer?.toLocaleString() ?? null} />
            <Figure label="Prospects" value={d.prospect?.toLocaleString() ?? null} />
            <Figure label="Leads" value={d.lead?.toLocaleString() ?? null} />
          </div>
        )}
      </Body>
    </WidgetCard>
  );
}

export function PipelineWidget({ scope }: { scope: Scope }) {
  const q = useScopedLoad(key(scope), true, () => loadDeals(scope.userId));
  return (
    <WidgetCard id="w-pipeline" title="Sales pipeline" description="Open deals by stage" scope="personal" action={openLink('/crm', 'Open deals')}>
      <Body q={q} what="the sales pipeline">
        {(d) => {
          const p = summarizePipeline(d.rows);
          if (p.openCount === 0) return <p className="px-5 py-4 text-body text-muted-foreground">No open deals.</p>;
          return (
            <>
              <div className="grid grid-cols-2 gap-4 p-5">
                <Figure label="Open deals" value={p.openCount.toLocaleString()} />
                <Figure label="Open value" value={<Amounts totals={p.total} />} />
              </div>
              <ul className="divide-y divide-border border-t border-border">
                {p.stages.map((s) => (
                  <li key={s.stage} className="flex min-h-touch items-center gap-3 px-5 py-2 text-body">
                    <span className="min-w-0 flex-1 truncate font-semibold">{s.stage === 'no stage' ? 'No stage' : statusLabel(s.stage)}</span>
                    <span className="text-muted-foreground">{s.count} {s.count === 1 ? 'deal' : 'deals'}</span>
                    <span className="w-28 text-right font-semibold tabular-nums">{s.total.map((t) => formatMoney(t.amount, t.currency)).join(' + ')}</span>
                  </li>
                ))}
              </ul>
              <Capped shown={d.rows.length} total={d.total} />
            </>
          );
        }}
      </Body>
    </WidgetCard>
  );
}

const OPEN_TICKET = ['new', 'open', 'waiting_customer'];

export function SupportWidget({ scope }: { scope: Scope }) {
  const q = useScopedLoad(key(scope), true, () => loadTickets(scope.orgId));
  return (
    <WidgetCard id="w-support" title="Support tickets" description="Tickets for this company" action={openLink('/support-desk', 'Open desk')}>
      <Body q={q} what="support tickets">
        {(tickets) => {
          const by = countBy(tickets, (t) => t.status);
          const open = OPEN_TICKET.reduce((n, s) => n + (by.get(s) ?? 0), 0);
          return (
            <>
              <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
                <Figure label="Open" value={open.toLocaleString()} hint="New, open or waiting" />
                {TICKET_STATUSES.filter((s) => s !== 'closed' && s !== 'resolved').map((s) => <Figure key={s} label={STATUS_LABEL[s]} value={(by.get(s) ?? 0).toLocaleString()} />)}
              </div>
              {tickets.length >= 500 && <p className="px-5 pb-3 text-small text-muted-foreground">Based on the 500 most recently updated tickets.</p>}
            </>
          );
        }}
      </Body>
    </WidgetCard>
  );
}

export function MoneyWidget({ scope }: { scope: Scope }) {
  const q = useScopedLoad(key(scope), true, () => loadMoney(scope.userId));
  const account = useAccountCurrency();
  return (
    <WidgetCard id="w-money" title="Key money numbers" description="From your invoices and expenses" scope="personal" action={openLink('/business-tools?tool=business-finance-assistant&tab=dashboard', 'Finance')}>
      <Body q={q} what="money numbers">
        {(d) => {
          const m = summarizeMoney(d.invoices.rows, d.expenses.rows);
          return (
            <>
              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
                <Figure label="Paid invoices" value={<Amounts totals={m.paid} />} />
                <Figure label="Outstanding invoices" value={<Amounts totals={m.outstanding} />} hint={`${m.outstandingCount} sent or pending`} />
                <div className="min-w-0">
                  {/* Expenses have no currency of their own: they are in the account currency. */}
                  <Figure label="Expenses to pay" value={formatMoney(m.expensesToPay, account)}
                    hint={`${m.expensesToPayCount} unpaid ${m.expensesToPayCount === 1 ? 'expense' : 'expenses'}, as of today${account ? `, in ${account}` : ''}.`} />
                  <Link to="/business-tools?tool=business-finance-assistant&tab=expenses" aria-label="Open Expenses to see expenses to pay"
                    className="mt-1 inline-flex min-h-touch items-center gap-1 rounded-sm text-small font-semibold text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-0">
                    Open Expenses<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
              <Capped shown={d.invoices.rows.length} total={d.invoices.total} />
              <Capped shown={d.expenses.rows.length} total={d.expenses.total} />
            </>
          );
        }}
      </Body>
    </WidgetCard>
  );
}

export function ExpensesWidget({ scope }: { scope: Scope }) {
  const q = useScopedLoad(key(scope), true, () => loadPendingExpenses(scope.userId));
  return (
    <WidgetCard id="w-expenses" title="Expenses to review" description="Expenses still marked pending" scope="personal" action={openLink('/business-tools?tool=business-finance-assistant&tab=expenses', 'Expenses')}>
      <Body q={q} what="expenses">
        {(d) => d.items.length === 0 ? <p className="px-5 py-4 text-body text-muted-foreground">No pending expenses.</p> : (
          <>
            <p className="px-5 pt-3 text-small text-muted-foreground">{d.total ?? d.items.length} pending{d.total !== null && d.total > d.items.length ? `, newest ${d.items.length} shown` : ''}</p>
            <ul className="divide-y divide-border">
              {d.items.map((e) => (
                <li key={e.id} className="flex min-h-touch items-center gap-3 px-5 py-2 text-body">
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{e.description}</span><span className="block text-small text-muted-foreground">{statusLabel(e.category)} · {formatDueDate(e.date)}</span></span>
                  <span className="shrink-0 font-semibold tabular-nums">{new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(e.amount) || 0)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Body>
    </WidgetCard>
  );
}

export function RotaWidget({ scope }: { scope: Scope }) {
  const q = useScopedLoad(key(scope), true, () => loadRotaToday(scope.orgId));
  return (
    <WidgetCard id="w-rota" title="Rota today" description="Today's shifts for this company" action={openLink('/rota/schedule', 'Rota')}>
      <Body q={q} what="today's rota">
        {(d) => {
          const rows = rotaToday(d.shifts, d.employees);
          if (rows.length === 0) return <p className="px-5 py-4 text-body text-muted-foreground">No shifts today.</p>;
          return (
            <ul className="divide-y divide-border">
              {rows.slice(0, 8).map((s) => (
                <li key={s.id}>
                  <Link to="/rota/schedule" className={rowLink}>
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{s.name}</span>{s.role && <span className="block truncate text-small text-muted-foreground">{s.role}</span>}</span>
                    {s.status === 'draft' && <span className="rounded-full border border-border px-2 py-0.5 text-small text-muted-foreground">Draft</span>}
                    <span className="shrink-0 font-semibold tabular-nums">{s.start}–{s.end}</span>
                  </Link>
                </li>
              ))}
              {rows.length > 8 && <li className="px-5 py-2 text-small text-muted-foreground">and {rows.length - 8} more</li>}
            </ul>
          );
        }}
      </Body>
    </WidgetCard>
  );
}
