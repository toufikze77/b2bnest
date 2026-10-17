import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorState, LoadingRows } from '@/components/ui/states';
import { AlertTriangle, Shield } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PayrollSubTab, payrollTabFromSearch, searchWithPayrollTab } from '@/lib/financeTabs';
import { supabase } from '@/integrations/supabase/client';
import EmployeeList from './EmployeeList';
import PayRunGenerator from './PayRunGenerator';
import PayRunHistory from './PayRunHistory';
import { hmrcService, EmployerDetails } from '@/services/hmrcService';

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  niNumber?: string;
  taxCode: string;
  niCategory: 'A' | 'B' | 'C' | 'H' | 'M' | 'Z' | string;
  annualSalary: number;
  payFrequency: 'MTH' | 'WK';
};

type PayRun = {
  id: string;
  period: string;
  payDate: string;
  notes?: string;
  items: {
    employeeId: string;
    grossPay: number;
    taxablePay: number;
    taxDeducted: number;
    employeeNIC: number;
    employerNIC: number;
    netPay: number;
  }[];
};

const STORAGE_KEY = 'payroll_uk_state_v1';

const Payroll = () => {
  const { user } = useAuth();
  const [employer, setEmployer] = useState<EmployerDetails>({ 
    payeReference: '', 
    accountsOfficeRef: '' 
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payRuns, setPayRuns] = useState<PayRun[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  // A failed load is shown as an error with Retry, never as "No employees yet".
  const [loadError, setLoadError] = useState(false);
  // The sub-tab lives in the address bar (?payroll=), so a refresh stays on it; unknown values → Employees.
  const location = useLocation();
  const navigate = useNavigate();
  const subTab = payrollTabFromSearch(location.search);
  const setSubTab = (tab: string) => navigate({ search: searchWithPayrollTab(location.search, tab as PayrollSubTab) }, { replace: true });
  // Skeleton only on the first load; later refreshes (after a save) keep the list and any open form on screen.
  const [loadedOnce, setLoadedOnce] = useState(false);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    setLoadError(false);
    try {
      // Load employer settings from localStorage
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { employer: EmployerDetails };
        setEmployer(parsed.employer || { payeReference: '', accountsOfficeRef: '' });
      }

      // Load employees
      const { data: emps, error: empError } = await supabase
        .from('payroll_employees')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (empError) throw empError;

      if (emps) {
        setEmployees(emps.map((e: any) => ({
          id: e.id,
          firstName: e.first_name,
          lastName: e.last_name,
          niNumber: e.ni_number || undefined,
          taxCode: e.tax_code || '1257L',
          niCategory: e.ni_category || 'A',
          annualSalary: Number(e.annual_salary) || 0,
          payFrequency: e.pay_frequency === 'WK' ? 'WK' : 'MTH'
        })));
      }

      // Load pay runs
      const { data: runs, error: runError } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (runError) throw runError;

      const runWithItems: PayRun[] = [];
      if (runs) {
        for (const r of runs) {
          const { data: items } = await supabase
            .from('payroll_run_items')
            .select('*')
            .eq('run_id', r.id);
          runWithItems.push({
            id: r.id,
            period: r.period,
            payDate: r.pay_date,
            notes: r.notes || undefined,
            items: (items || []).map((it: any) => ({
              employeeId: it.employee_id,
              grossPay: Number(it.gross_pay),
              taxablePay: Number(it.gross_pay),
              taxDeducted: Number(it.tax_deduction),
              employeeNIC: Number(it.ni_deduction),
              // Not changed in Phase 3, flagged for review: a fixed 13.8% of gross with no threshold.
              // UK employer NIC rates and thresholds changed on 6 April 2025; verify before real use.
              employerNIC: Number(it.gross_pay) * 0.138,
              netPay: Number(it.net_pay)
            }))
          });
        }
        setPayRuns(runWithItems);
      }
    } catch (error) {
      console.error('Error loading payroll data:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ employer }));
    } catch {}
  }, [employer]);



  const subTabClass = 'min-h-touch shrink-0 rounded-none border-b-[3px] border-transparent px-2.5 pb-2 pt-2 sm:px-4 text-body font-semibold text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-0 data-[state=active]:border-nav-marker data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none';
  const SUB_GROUPS = [
    [{ value: 'employees', label: 'Employees' }],
    [{ value: 'payrun', label: 'Pay runs' }, { value: 'history', label: 'History' }],
    [{ value: 'settings', label: 'Settings' }],
  ];
  // Employees, pay runs and history need the loaded data; Settings works without it.
  const dataPanel = (panel: React.ReactNode) => loading && !loadedOnce
    ? <LoadingRows label="Loading payroll data" rows={4} className="rounded-card border border-border bg-card" />
    : loadError
      ? <ErrorState title="Payroll data couldn't be loaded" description="Your employees and pay runs are not shown because loading failed. This is a loading problem, not missing data." onRetry={loadData} className="rounded-card" />
      : panel;

  // Sits inside the Invoices & quotes frame, which already has the page title (h1) and padding.
  return (
    <section aria-labelledby="payroll-heading" className="space-y-4">
      <div>
        <h2 id="payroll-heading" className="text-card-title text-foreground">Payroll (UK)</h2>
        <p className="text-small text-muted-foreground">Employees, pay runs and pay run history. PAYE and National Insurance are estimated by the app.</p>
      </div>

      <div role="note" className="flex items-start gap-3 rounded-card border border-warning/50 border-l-4 border-l-warning bg-warning/10 p-4 text-body text-foreground">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
        <p>
          <strong>Important notice.</strong> This is a demo payroll system. For production use, ensure all tax rates and thresholds
          are verified against current HMRC guidelines. Always consult with a qualified accountant for actual payroll processing.
        </p>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab} className="rounded-card border border-border bg-card">
        <TabsList aria-label="Payroll sections" className="flex h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-border bg-transparent px-1 pt-1 sm:px-2">
          {SUB_GROUPS.map((g, gi) => (
            <React.Fragment key={g[0].value}>
              {gi > 0 && <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 self-center bg-border sm:mx-2" />}
              {g.map((t) => <TabsTrigger key={t.value} value={t.value} className={subTabClass}>{t.label}</TabsTrigger>)}
            </React.Fragment>
          ))}
        </TabsList>

        <div className="p-4">
          <TabsContent value="employees" className="mt-0">
            {dataPanel(
              <EmployeeList
                employees={employees}
                onEmployeesUpdated={loadData}
              />,
            )}
          </TabsContent>

          <TabsContent value="payrun" className="mt-0">
            {dataPanel(
              <PayRunGenerator
                employees={employees}
                onPayRunGenerated={loadData}
              />,
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            {dataPanel(
              <PayRunHistory
                payRuns={payRuns}
                employees={employees}
                employer={employer}
              />,
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" aria-hidden="true" />
                  Employer Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="payeRef" className="block text-sm font-medium mb-2">
                      PAYE Reference
                    </label>
                    <input
                      id="payeRef"
                      type="text"
                      value={employer.payeReference}
                      onChange={(e) => setEmployer(prev => ({ 
                        ...prev, 
                        payeReference: e.target.value 
                      }))}
                      placeholder="123/AB456"
                      aria-describedby="employer-storage-note"
                      className="h-11 w-full rounded-control border border-input bg-background px-3 text-body focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label htmlFor="accountsRef" className="block text-sm font-medium mb-2">
                      Accounts Office Reference
                    </label>
                    <input
                      id="accountsRef"
                      type="text"
                      value={employer.accountsOfficeRef}
                      onChange={(e) => setEmployer(prev => ({ 
                        ...prev, 
                        accountsOfficeRef: e.target.value 
                      }))}
                      placeholder="123PA12345678"
                      aria-describedby="employer-storage-note"
                      className="h-11 w-full rounded-control border border-input bg-background px-3 text-body focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                    />
                  </div>
                </div>
                <p id="employer-storage-note" className="text-small text-muted-foreground">
                  These references are saved in this browser only. They won’t appear on another device or browser.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
};

export default Payroll;