import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { ChartCard, ColumnChart, Donut, TrendChart } from '@/components/charts';
import { pct } from '@/components/charts/chartTheme';
import { StatusBadge } from '@/components/data/StatusBadge';
import CurrencySelector from '@/components/crm/CurrencySelector';
import { CustomiseSections } from '@/components/overview/CustomiseSections';
import SEOHead from '@/components/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { useReportCurrency } from '@/hooks/useReportCurrency';
import { ACTIVE_FILTER } from '@/lib/archive';
import {
  CARD_LINKS, chartMonths, invoiceStatusInPeriod, loadSections, moneyInOutByMonth, OverviewInput, overviewCards, Period, PERIODS,
  pipelineByStage, projectsByStatus, saveSections, SectionPrefs, tasksByStatus, topCustomersInPeriod,
} from '@/lib/businessOverview';
import { contactsAdded } from '@/lib/crmAnalytics';
import { excludedDocsNote } from '@/lib/financeSummary';
import { currencySymbol, formatMoney, normalizeCurrency } from '@/lib/money';
import { cn } from '@/lib/utils';

const EMPTY: OverviewInput = { invoices: [], expenses: [], deals: [], contacts: [], projects: [], tasks: [] };
type Errors = Partial<Record<keyof OverviewInput, boolean>>;
const onNavyFocus = 'focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-0';

/** One summary card. A real link with a visible focus ring and an "opens …" name, or a plain card when nothing manages it. */
function OverviewCard({ label, value, hint, link, loading, alert }: {
  label: string; value: string | null; hint: string; link: { to: string; place: string } | null; loading?: boolean; alert?: string | null;
}) {
  const body = (
    <>
      <p className="flex items-center justify-between gap-2 text-small font-semibold text-muted-foreground">
        {label}{link && <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
      </p>
      {loading ? <Skeleton className="mt-2 h-8 w-24" /> : <p className="mt-1 break-words text-2xl font-bold tabular-nums text-foreground">{value ?? '—'}</p>}
      {!loading && <p className="mt-0.5 text-small text-muted-foreground">{hint}</p>}
      {!loading && alert && <p className="mt-1"><StatusBadge value={alert} tone="danger" /></p>}
    </>
  );
  return link ? (
    <Link to={link.to} aria-label={`${label}: ${loading ? 'loading' : value ?? 'no data'}. ${hint} Opens ${link.place}.`}
      className="block min-w-0 rounded-card border border-border bg-card p-4 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    <div className="min-w-0 rounded-card border border-dashed border-border bg-card p-4">{body}</div>
  );
}

const BusinessOverview = () => {
  const { user } = useAuth();
  const { organizationId, organization } = useActiveOrganization();
  const rc = useReportCurrency('overview');
  const { currency, account } = rc;
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<OverviewInput>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<SectionPrefs>(() => loadSections(user?.id, organizationId));
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const customiseBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => { setSections(loadSections(user?.id, organizationId)); }, [user?.id, organizationId]);

  const userId = user?.id;
  const load = useCallback(async () => {
    if (!userId || !organizationId) { setData(EMPTY); setLoading(false); return; }
    setLoading(true);
    // Money and CRM: the signed-in user's own records. Projects and tasks: the active company.
    // Archived invoices never leave the database here (archived_at is null).
    const [inv, exp, deals, contacts, projects, tasks] = await Promise.all([
      supabase.from('invoices').select('id,status,total_amount,currency,created_at,due_date,paid_at,archived_at,client_name').eq('user_id', userId).is(...ACTIVE_FILTER),
      supabase.from('expenses').select('amount,date,status').eq('user_id', userId),
      supabase.from('crm_deals').select('stage,value,currency').eq('user_id', userId),
      supabase.from('crm_contacts').select('status,created_at').eq('user_id', userId),
      supabase.from('projects').select('status').eq('organization_id', organizationId).is('archived_at', null).is('deleted_at', null),
      supabase.from('todos').select('status,due_date').eq('organization_id', organizationId).is('archived_at', null),
    ]);
    const res = { invoices: inv, expenses: exp, deals, contacts, projects, tasks } as const;
    const next = { ...EMPTY } as OverviewInput;
    const errs: Errors = {};
    for (const [k, r] of Object.entries(res) as [keyof OverviewInput, { data: unknown; error: unknown }][]) {
      if (r.error) errs[k] = true; else (next as unknown as Record<string, unknown>)[k] = r.data ?? [];
    }
    setData(next); setErrors(errs); setLoading(false);
  }, [userId, organizationId]);
  useEffect(() => { void load(); }, [load]);

  const cards = overviewCards(data, currency, account, period);
  const money = (n: number) => formatMoney(n, currency);
  const sym = currencySymbol(currency);
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? '';
  const months = chartMonths(period);
  const inOut = moneyInOutByMonth(data, currency, account, months);
  const statuses = invoiceStatusInPeriod(data.invoices, period);
  const pipeline = pipelineByStage(data.deals, currency);
  const taskStats = tasksByStatus(data.tasks);
  const projectStats = projectsByStatus(data.projects);
  const added = contactsAdded(data.contacts.map((c) => ({ ...c, source: null })), months);
  const top = topCustomersInPeriod(data.invoices, currency, period, 5);
  const excludedNote = excludedDocsNote(cards.excludedInvoices);
  const stored = Array.from(new Set([...data.invoices, ...data.deals].map((d) => normalizeCurrency(d.currency)).filter(Boolean)));
  const state = (k: (keyof OverviewInput)[], empty: boolean) => (loading ? 'loading' : k.some((x) => errors[x]) ? 'error' : empty ? 'empty' : 'ready') as 'loading' | 'error' | 'empty' | 'ready';
  const anyError = Object.values(errors).some(Boolean);
  const cardHint = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  const saveCustomise = (next: SectionPrefs) => { setSections(next); saveSections(user?.id, organizationId, next); setCustomiseOpen(false); };

  return (
    <div className="min-w-0">
      <SEOHead title="Business Overview | B2BNest" description="Unified overview of revenue, expenses, projects, tasks and CRM across your organization." canonicalUrl="https://www.b2bnest.online/business-overview" />

      <div className="bg-brand-navy text-brand-navy-foreground">
        <div className="mx-auto w-full max-w-[1440px] px-4 pb-5 pt-5 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5 text-small text-brand-navy-muted">
              <li><Link to="/dashboard" className="inline-flex min-h-touch items-center rounded-sm underline-offset-2 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-0">{organization?.name || 'Company'}</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold text-white">Business overview</li>
            </ol>
          </nav>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-page-title text-white">Business overview</h1>
              <p className="mt-1 text-body text-brand-navy-muted">Money, sales and work for {organization?.name || 'your company'} in one place, from your own records.</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="overview-period" className="text-small font-semibold text-white">Period</label>
                <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                  <SelectTrigger id="overview-period" className={cn('h-11 w-44 border-white/50 bg-transparent text-white md:h-10', onNavyFocus)}><SelectValue /></SelectTrigger>
                  <SelectContent>{PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="overview-currency" className="text-small font-semibold text-white">Currency</label>
                <CurrencySelector id="overview-currency" value={currency} onValueChange={rc.setCurrency} extraCodes={stored}
                  className={cn('h-11 w-52 border-white/50 bg-transparent text-white md:h-10', onNavyFocus)} />
              </div>
              <Button ref={customiseBtn} variant="outline" className={cn('min-h-touch border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white md:min-h-10', onNavyFocus)} onClick={() => setCustomiseOpen(true)}>
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Customise
              </Button>
            </div>
          </div>
          {rc.isCustom && (
            <button type="button" onClick={rc.reset} className="mt-3 min-h-touch rounded-sm text-small font-semibold text-white underline underline-offset-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-0">
              Reset to account currency ({account})
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-small text-muted-foreground">
          Money, CRM and expenses: your own records. Projects and tasks: everyone in {organization?.name || 'this company'}. {currency ? `Money in ${currency} only, never converted.` : 'Choose a currency to see money figures.'} Expenses have no currency of their own: they count in your account currency{account ? ` (${account})` : ''}. {periodLabel} unless a card says “as of today”.
        </p>
        {anyError && !loading && <ErrorState title="Some figures couldn't be loaded" description="Sections that failed say so below. This is a loading problem, not missing data." onRetry={() => { void load(); }} className="rounded-card" />}
        {excludedNote && <p role="note" className="text-small text-muted-foreground">{excludedNote}</p>}

        {sections.cards && (
          <section aria-label="Summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <OverviewCard loading={loading} link={CARD_LINKS.moneyIn} label="Money in" value={errors.invoices ? null : money(cards.moneyIn.amount)}
              hint={`${cardHint(cards.moneyIn.count, 'paid invoice')}, ${periodLabel.toLowerCase()}, by the date marked paid.`} />
            <OverviewCard loading={loading} link={CARD_LINKS.moneyOut} label="Money out" value={errors.expenses || !cards.moneyOut ? null : money(cards.moneyOut.amount)}
              hint={cards.moneyOut ? `${cardHint(cards.moneyOut.count, 'expense')} dated ${periodLabel.toLowerCase()}, paid or not.` : `Expenses are in your account currency${account ? ` (${account})` : ''}; choose it to see them.`} />
            <OverviewCard loading={loading} link={CARD_LINKS.outstanding} label="Outstanding invoices" value={errors.invoices ? null : money(cards.outstanding.amount)}
              hint={`${cardHint(cards.outstanding.count, 'invoice')} sent, not paid, as of today.`} />
            <OverviewCard loading={loading} link={CARD_LINKS.overdue} label="Overdue invoices" value={errors.invoices ? null : money(cards.overdue.amount)}
              hint={`${cardHint(cards.overdue.count, 'invoice')} past the due date, as of today.`} alert={cards.overdue.count ? `${cards.overdue.count} overdue` : null} />
            <OverviewCard loading={loading} link={CARD_LINKS.openPipeline} label="Open pipeline" value={errors.deals ? null : money(cards.openPipeline.amount)}
              hint={`${cardHint(cards.openPipeline.count, 'open deal')} in ${currency || 'this currency'}, as of today.`} />
            <OverviewCard loading={loading} link={CARD_LINKS.openTasks} label="Open tasks" value={errors.tasks ? null : String(cards.openTasks)}
              hint="Company-wide, as of today." alert={cards.overdueTasks ? `${cards.overdueTasks} overdue` : null} />
            <OverviewCard loading={loading} link={CARD_LINKS.activeProjects} label="Active projects" value={errors.projects ? null : String(cards.activeProjects)}
              hint="Company-wide, not completed or cancelled." />
            <OverviewCard loading={loading} link={CARD_LINKS.contacts} label="CRM contacts" value={errors.contacts ? null : String(cards.contacts)}
              hint="Your own contacts." />
            <OverviewCard loading={loading} link={CARD_LINKS.expensesToPay} label="Expenses to pay" value={errors.expenses || !cards.expensesToPay ? null : money(cards.expensesToPay.amount)}
              hint={cards.expensesToPay ? `${cardHint(cards.expensesToPay.count, 'unpaid expense')}, as of today. Pending or approved, any date.` : `Not included: expenses are in your account currency${account ? ` (${account})` : ''}; choose it to see them.`} />
          </section>
        )}

        {sections.moneyInOut && (
          <ChartCard
            title="Money in and money out"
            subtitle={`Last ${months} months, ${currency || 'no currency chosen'}. Money in = paid invoices by the date marked paid; money out = expenses by date.`}
            state={!currency ? 'empty' : state(['invoices', 'expenses'], !inOut.rows.some((r) => r.moneyIn || r.moneyOut))}
            onRetry={() => { void load(); }}
            empty={{ message: !currency ? 'Choose a currency to see money in and out.' : 'No data yet. Mark invoices as paid or add expenses to see this.', action: <Button asChild size="sm" variant="outline" className="min-h-touch md:min-h-0"><Link to={CARD_LINKS.moneyIn.to}>Open Invoices</Link></Button> }}
            summary={`Money in and out per month in ${currency}: ${inOut.rows.filter((r) => r.moneyIn || r.moneyOut).map((r) => `${r.label} in ${money(r.moneyIn)}${r.moneyOut != null ? `, out ${money(r.moneyOut)}` : ''}`).join('; ')}.`}
            table={{ caption: `Money in and out per month in ${currency}`, columns: inOut.expensesIncluded ? ['Month', `Money in (${currency})`, `Money out (${currency})`] : ['Month', `Money in (${currency})`], rows: inOut.rows.map((r) => (inOut.expensesIncluded ? [r.label, money(r.moneyIn), money(r.moneyOut ?? 0)] : [r.label, money(r.moneyIn)])) }}
            footer={!inOut.expensesIncluded ? <p>Money out is not shown: expenses are in your account currency{account ? ` (${account})` : ''}.</p> : undefined}
          >
            <TrendChart data={inOut.rows.map((r) => ({ label: r.label, moneyIn: r.moneyIn, ...(inOut.expensesIncluded ? { moneyOut: r.moneyOut ?? 0 } : {}) }))}
              series={inOut.expensesIncluded ? [{ key: 'moneyIn', label: 'Money in' }, { key: 'moneyOut', label: 'Money out' }] : [{ key: 'moneyIn', label: 'Money in' }]}
              format={money} axisTitle={`Amount${sym ? ` (${sym})` : ''}`} integer={false} />
          </ChartCard>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          {sections.invoiceStatus && (
            <ChartCard
              title="Invoices by status"
              subtitle={`Invoices dated ${periodLabel.toLowerCase()}, every currency. Counts, not amounts.`}
              state={state(['invoices'], statuses.length === 0)} onRetry={() => { void load(); }}
              empty={{ message: 'No data yet. No invoices dated in this period.', action: <Button asChild size="sm" variant="outline" className="min-h-touch md:min-h-0"><Link to="/business-tools?tool=business-finance-assistant&tab=create&type=invoice">New invoice</Link></Button> }}
              summary={`Invoices by status: ${statuses.map((s) => `${s.label} ${s.count}`).join(', ')}.`}
              table={{ caption: 'Invoices by status', columns: ['Status', 'Invoices', 'Share'], rows: statuses.map((s) => [s.label, s.count, pct(s.count / statuses.reduce((n, x) => n + x.count, 0))]) }}
            >
              <Donut data={statuses.map((s) => ({ label: s.label, value: s.count }))} totalLabel="invoices" />
            </ChartCard>
          )}

          {sections.pipeline && (
            <ChartCard
              title="Sales pipeline by stage"
              subtitle={`Open deals only (won, lost and closed left out), ${currency || 'no currency chosen'}, as of today.`}
              state={!currency ? 'empty' : state(['deals'], pipeline.rows.length === 0)} onRetry={() => { void load(); }}
              empty={{ message: !currency ? 'Choose a currency to see the pipeline.' : 'No data yet. No open deals in this currency.', action: <Button asChild size="sm" variant="outline" className="min-h-touch md:min-h-0"><Link to="/crm?tab=deals">Open the pipeline</Link></Button> }}
              summary={`Open pipeline by stage in ${currency}: ${pipeline.rows.map((r) => `${r.stage} ${money(r.value)} (${r.count})`).join('; ')}.`}
              table={{ caption: `Open pipeline by stage in ${currency}`, columns: ['Stage', `Value (${currency})`, 'Deals'], rows: pipeline.rows.map((r) => [r.stage, money(r.value), r.count]) }}
              footer={pipeline.otherCurrency ? <p>{pipeline.otherCurrency} open {pipeline.otherCurrency === 1 ? 'deal' : 'deals'} in other currencies {pipeline.otherCurrency === 1 ? 'is' : 'are'} not included.</p> : undefined}
            >
              <ColumnChart data={pipeline.rows.map((r) => ({ label: r.stage, value: r.value }))} seriesLabel="Value" format={money} axisTitle={`Value${sym ? ` (${sym})` : ''}`} />
            </ChartCard>
          )}

          {sections.tasks && (
            <ChartCard
              title="Tasks by status"
              subtitle={`Company-wide, as of today.${taskStats.overdue ? '' : ' Nothing is overdue.'}`}
              controls={taskStats.overdue ? <StatusBadge value={`${taskStats.overdue} overdue`} tone="danger" /> : undefined}
              state={state(['tasks'], data.tasks.length === 0)} onRetry={() => { void load(); }}
              empty={{ message: 'No data yet. No tasks in this company.', action: <Button asChild size="sm" variant="outline" className="min-h-touch md:min-h-0"><Link to="/project-management?view=list">Open tasks</Link></Button> }}
              summary={`Tasks by status: ${taskStats.rows.map((r) => `${r.status} ${r.count}`).join(', ')}. ${taskStats.overdue} overdue.`}
              table={{ caption: 'Tasks by status', columns: ['Status', 'Tasks'], rows: [...taskStats.rows.map((r) => [r.status, r.count]), ['Overdue (open, past due date)', taskStats.overdue]] }}
            >
              <ColumnChart data={taskStats.rows.map((r) => ({ label: r.status, value: r.count }))} seriesLabel="Tasks" format={(n) => String(n)} axisTitle="Tasks" integer />
            </ChartCard>
          )}

          {sections.projects && (
            <ChartCard
              title="Projects by status"
              subtitle="Company-wide, not archived, as of today."
              state={state(['projects'], projectStats.length === 0)} onRetry={() => { void load(); }}
              empty={{ message: 'No data yet. No projects in this company.', action: <Button asChild size="sm" variant="outline" className="min-h-touch md:min-h-0"><Link to="/project-management">Open projects</Link></Button> }}
              summary={`Projects by status: ${projectStats.map((p) => `${p.status} ${p.count}`).join(', ')}.`}
              table={{ caption: 'Projects by status', columns: ['Status', 'Projects'], rows: projectStats.map((p) => [p.status, p.count]) }}
            >
              <Donut data={projectStats.map((p) => ({ label: p.status, value: p.count }))} totalLabel="projects" />
            </ChartCard>
          )}

          {sections.contacts && (
            <ChartCard
              title="Contacts added and how many are customers now"
              subtitle={`By the month each contact was added, last ${months} months. “Customers now” is today’s status: there is no record of when a contact converted.`}
              state={state(['contacts'], data.contacts.length === 0)} onRetry={() => { void load(); }}
              empty={{ message: 'No data yet. No CRM contacts.', action: <Button asChild size="sm" variant="outline" className="min-h-touch md:min-h-0"><Link to="/crm">Open CRM</Link></Button> }}
              summary={`Contacts added per month over the last ${months} months, and how many of them are customers now.`}
              table={{ caption: 'Contacts added per month', columns: ['Month', 'Added', 'Customers now'], rows: added.rows.map((r) => [r.label, r.added, r.customersNow]) }}
            >
              <TrendChart data={added.rows.map((r) => ({ label: r.label, added: r.added, customers: r.customersNow }))} series={[{ key: 'added', label: 'Contacts added' }, { key: 'customers', label: 'Of those, customers now' }]} axisTitle="Contacts" />
            </ChartCard>
          )}

          {sections.topCustomers && (
            <ChartCard
              title="Top customers by invoiced amount"
              subtitle={`Sent, overdue and paid invoices dated ${periodLabel.toLowerCase()}, ${currency || 'no currency chosen'}.`}
              state={!currency ? 'empty' : state(['invoices'], top.length === 0)} onRetry={() => { void load(); }}
              empty={{ message: !currency ? 'Choose a currency to see top customers.' : 'No data yet. No sent or paid invoices in this period.', action: <Button asChild size="sm" variant="outline" className="min-h-touch md:min-h-0"><Link to={CARD_LINKS.moneyIn.to}>Open Invoices</Link></Button> }}
              summary={`Top customers in ${currency}: ${top.map((t) => `${t.name} ${money(t.amount)}`).join('; ')}.`}
              table={{ caption: `Top customers in ${currency}`, columns: ['Customer', `Invoiced (${currency})`, 'Invoices'], rows: top.map((t) => [t.name, money(t.amount), t.count]) }}
              footer={<p>Customers are grouped by the client name on the invoice.</p>}
            >
              <ol className="space-y-3">
                {top.map((t, i) => (
                  <li key={t.name} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-body">
                      <span className="min-w-0 truncate"><span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span><span className="font-semibold">{t.name}</span></span>
                      <span className="shrink-0 tabular-nums">{money(t.amount)} <span className="text-small text-muted-foreground">· {t.count} {t.count === 1 ? 'invoice' : 'invoices'}</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-muted" aria-hidden="true"><div className="h-2 rounded-full" style={{ width: `${Math.max(2, (t.amount / (top[0]?.amount || 1)) * 100)}%`, background: 'var(--chart-1)' }} /></div>
                  </li>
                ))}
              </ol>
            </ChartCard>
          )}
        </div>

        {!Object.values(sections).some(Boolean) && (
          <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border p-8 text-center text-body text-muted-foreground">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <p>Every section is hidden. Use Customise to show them again.</p>
          </div>
        )}
      </div>

      <CustomiseSections open={customiseOpen} onOpenChange={setCustomiseOpen} prefs={sections} onSave={saveCustomise} returnFocusRef={customiseBtn} />
    </div>
  );
};

export default BusinessOverview;
