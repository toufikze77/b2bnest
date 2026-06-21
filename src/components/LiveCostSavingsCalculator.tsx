import React, { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calculator, Share2, Printer, TrendingDown, Check, Link2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ToolOption {
  id: string;
  name: string;
  category: string;
  competitor: string;
  competitorCost: number; // monthly USD
  b2bnestIncluded: boolean;
  description: string;
}

const TOOLS: ToolOption[] = [
  { id: 'crm', name: 'CRM', category: 'Sales', competitor: 'HubSpot / Salesforce', competitorCost: 90, b2bnestIncluded: true, description: 'Contacts, pipelines, deals' },
  { id: 'invoicing', name: 'Invoicing & Quotes', category: 'Finance', competitor: 'QuickBooks', competitorCost: 60, b2bnestIncluded: true, description: 'Send invoices & quotes' },
  { id: 'cashflow', name: 'Cash Flow Tracker', category: 'Finance', competitor: 'Float / Pulse', competitorCost: 59, b2bnestIncluded: true, description: 'Forecast & monitor cash' },
  { id: 'projects', name: 'Project Management', category: 'Productivity', competitor: 'Asana / Monday', competitorCost: 45, b2bnestIncluded: true, description: 'Tasks, timelines, teams' },
  { id: 'time', name: 'Time Tracking', category: 'Productivity', competitor: 'Toggl / Harvest', competitorCost: 20, b2bnestIncluded: true, description: 'Track billable hours' },
  { id: 'ai', name: 'AI Business Advisor', category: 'AI', competitor: 'ChatGPT Team', competitorCost: 30, b2bnestIncluded: true, description: 'Insights & recommendations' },
  { id: 'payroll', name: 'UK Payroll', category: 'Finance', competitor: 'Xero Payroll', competitorCost: 35, b2bnestIncluded: true, description: 'HMRC-ready payroll' },
  { id: 'hmrc', name: 'HMRC Integration', category: 'Compliance', competitor: 'FreeAgent', competitorCost: 29, b2bnestIncluded: true, description: 'MTD VAT submissions' },
  { id: 'workflows', name: 'Workflow Automation', category: 'Automation', competitor: 'Zapier', competitorCost: 49, b2bnestIncluded: true, description: 'Automate repetitive tasks' },
  { id: 'integrations', name: 'Integration Hub', category: 'Automation', competitor: 'Make.com', competitorCost: 29, b2bnestIncluded: true, description: 'Gmail, Slack, Calendar+' },
];

const B2BNEST_PRICE = 15; // Professional plan £/month (see /pricing)
const CURRENCY = '£';

const parseInitial = (): string[] => {
  if (typeof window === 'undefined') return TOOLS.slice(0, 5).map(t => t.id);
  const params = new URLSearchParams(window.location.search);
  const sel = params.get('savings');
  if (!sel) return TOOLS.slice(0, 5).map(t => t.id);
  return sel.split(',').filter(id => TOOLS.some(t => t.id === id));
};

const LiveCostSavingsCalculator: React.FC = () => {
  const [selected, setSelected] = useState<string[]>(parseInitial);
  const printRef = useRef<HTMLDivElement>(null);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const { competitorTotal, annualSavings, monthlySavings, percentSaved } = useMemo(() => {
    const competitorTotal = TOOLS.filter(t => selected.includes(t.id)).reduce((s, t) => s + t.competitorCost, 0);
    const monthlySavings = Math.max(0, competitorTotal - B2BNEST_PRICE);
    const annualSavings = monthlySavings * 12;
    const percentSaved = competitorTotal > 0 ? Math.round((monthlySavings / competitorTotal) * 100) : 0;
    return { competitorTotal, annualSavings, monthlySavings, percentSaved };
  }, [selected]);

  const buildShareUrl = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('savings', selected.join(','));
    return url.toString();
  };

  const handleShare = async () => {
    const url = buildShareUrl();
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My B2BNest Savings', text: `I'd save £${annualSavings.toLocaleString()}/year with B2BNest`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied!', description: 'Share your savings results with anyone.' });
      }
    } catch {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied!', description: 'Share your savings results with anyone.' });
    }
  };

  const handlePrint = () => {
    const html = printRef.current?.innerHTML || '';
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>B2BNest Savings Report</title>
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px;color:#0f172a;}
        h1{font-size:28px;margin:0 0 8px;}
        h2{font-size:18px;margin:24px 0 8px;color:#1e40af;}
        .big{font-size:48px;font-weight:800;color:#059669;margin:8px 0;}
        table{width:100%;border-collapse:collapse;margin-top:12px;}
        th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:14px;}
        th{background:#f8fafc;}
        .muted{color:#64748b;font-size:13px;}
        .summary{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:16px 0;}
      </style></head><body>${html}
      <p class="muted" style="margin-top:32px;">Report generated ${new Date().toLocaleDateString()} · b2bnest.online</p>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const grouped = TOOLS.reduce<Record<string, ToolOption[]>>((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <Badge className="mb-3 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            <TrendingDown className="h-3 w-3 mr-1" /> Live Savings Calculator
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
            See exactly how much you'd save with B2BNest
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Toggle the tools you currently pay for. We'll show your real monthly and annual savings — instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calculator className="h-5 w-5 text-blue-600" />
                Your current stack
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(grouped).map(([cat, tools]) => (
                <div key={cat}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{cat}</div>
                  <div className="space-y-2">
                    {tools.map(t => {
                      const on = selected.includes(t.id);
                      return (
                        <div
                          key={t.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${on ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Switch checked={on} onCheckedChange={() => toggle(t.id)} />
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 truncate">{t.name}</div>
                              <div className="text-xs text-slate-500 truncate">vs {t.competitor} · {t.description}</div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <div className="font-semibold text-slate-900">£{t.competitorCost}<span className="text-xs text-slate-500">/mo</span></div>
                            <div className="text-[10px] text-emerald-600 font-medium">Included in B2BNest</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="lg:sticky lg:top-6 self-start">
            <Card className="shadow-lg border-emerald-200">
              <CardHeader className="bg-gradient-to-br from-emerald-600 to-blue-600 text-white rounded-t-lg">
                <CardTitle className="text-white">Your Savings</CardTitle>
              </CardHeader>
              <CardContent className="pt-6" ref={printRef}>
                <h1 className="sr-only">B2BNest Savings Report</h1>
                <div className="summary">
                  <div className="text-sm text-slate-600">You could save</div>
                  <div className="big text-4xl font-extrabold text-emerald-600">£{annualSavings.toLocaleString()}<span className="text-base font-medium text-slate-600">/year</span></div>
                  <div className="text-sm text-slate-600">£{monthlySavings.toLocaleString()}/month · {percentSaved}% less</div>
                </div>

                <h2 className="text-sm font-semibold text-slate-700 mt-4 mb-2">Breakdown</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1">Item</th>
                      <th className="py-1 text-right">Monthly</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="py-1.5">Current tools ({selected.length})</td>
                      <td className="py-1.5 text-right font-medium">£{competitorTotal}</td>
                    </tr>
                    <tr className="border-t">
                      <td className="py-1.5">B2BNest all-in-one</td>
                      <td className="py-1.5 text-right font-medium text-emerald-600">£{B2BNEST_PRICE}</td>
                    </tr>
                    <tr className="border-t bg-emerald-50">
                      <td className="py-2 font-semibold">Monthly savings</td>
                      <td className="py-2 text-right font-bold text-emerald-700">£{monthlySavings}</td>
                    </tr>
                  </tbody>
                </table>

                <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5" /> One login, one bill, one platform</li>
                  <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5" /> No per-seat surprises</li>
                  <li className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5" /> Cancel anytime</li>
                </ul>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <Button variant="outline" onClick={handleShare} className="w-full">
                <Share2 className="h-4 w-4 mr-1" /> Share
              </Button>
              <Button variant="outline" onClick={handlePrint} className="w-full">
                <Printer className="h-4 w-4 mr-1" /> Print
              </Button>
            </div>
            <Button asChild className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-blue-600 hover:opacity-95">
              <a href="/pricing">Start saving with B2BNest →</a>
            </Button>
            <button
              onClick={async () => { await navigator.clipboard.writeText(buildShareUrl()); toast({ title: 'Link copied' }); }}
              className="w-full mt-2 text-xs text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1"
            >
              <Link2 className="h-3 w-3" /> Copy shareable results link
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LiveCostSavingsCalculator;
