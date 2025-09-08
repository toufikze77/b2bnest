import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Calculator, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
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

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Load employer settings from localStorage
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { employer: EmployerDetails };
        setEmployer(parsed.employer || { payeReference: '', accountsOfficeRef: '' });
      }

      // Load employees
      const { data: emps } = await supabase
        .from('payroll_employees')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
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
      const { data: runs } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
        
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
              employerNIC: Number(it.gross_pay) * 0.138,
              netPay: Number(it.net_pay)
            }))
          });
        }
        setPayRuns(runWithItems);
      }
    } catch (error) {
      console.error('Error loading payroll data:', error);
    } finally {
      setLoading(false);
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



  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Calculator className="h-6 w-6" />
          Payroll Management System
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Badge>PAYE/NIC Calculations</Badge>
          <Badge variant="secondary">Employee Management</Badge>
          <Badge variant="secondary">Pay Run Generation</Badge>
          <Badge variant="outline">HMRC Integration</Badge>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="text-center py-8">
            <div className="text-lg">Loading payroll data...</div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="employees" className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="payrun">Pay Runs</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="employees">
            <EmployeeList
              employees={employees}
              onEmployeesUpdated={loadData}
            />
          </TabsContent>

          <TabsContent value="payrun">
            <PayRunGenerator
              employees={employees}
              onPayRunGenerated={loadData}
            />
          </TabsContent>

          <TabsContent value="history">
            <PayRunHistory
              payRuns={payRuns}
              employees={employees}
              employer={employer}
            />
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <Alert>
                  <AlertTitle>Important Notice</AlertTitle>
                  <AlertDescription>
                    This is a demo payroll system. For production use, ensure all tax rates and thresholds 
                    are verified against current HMRC guidelines. Always consult with a qualified accountant 
                    for actual payroll processing.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Payroll;