import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileUp, Shield, Check, Users, Calculator } from 'lucide-react';
import { hmrcService, EmployeeFPSRecord, EmployerDetails } from '@/services/hmrcService';
import { payrollUKRates, getMonthlyAllowance, TaxYear } from '@/services/payrollUKRates';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  niNumber?: string;
  taxCode: string; // e.g., 1257L
  niCategory: 'A' | 'B' | 'C' | 'H' | 'M' | 'Z' | string;
  annualSalary: number;
  payFrequency: 'MTH' | 'WK';
};

type PayRun = {
  id: string;
  period: string; // YYYY-MM
  payDate: string; // YYYY-MM-DD
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

// Simplified PAYE calculator: basic rate assumptions for demo purposes
const calculatePAYE = (taxablePayMonthly: number, taxCode: string, year: TaxYear) => {
  // 1257L => personal allowance ~ 12570/year => 1047.5/month
  const allowanceMonthly = /^(\d{4})L|^(1257L)/.test(taxCode) ? getMonthlyAllowance(year) : 0;
  const taxable = Math.max(0, taxablePayMonthly - allowanceMonthly);
  // simple 20% basic rate for demo
  const tax = taxable * payrollUKRates[year].basicRate;
  return Math.round(tax * 100) / 100;
};

// Simplified NI calculator for Category A (employee and employer) with 2024-style thresholds (approx)
const calculateNI = (grossMonthly: number, category: string, year: TaxYear) => {
  // Primary threshold ~ 1048/month; employee 12% above to upper ~ 4189/month; employer 13.8% above ~ 758/month
  const pt = payrollUKRates[year].ni.primaryThresholdMonthly;
  const upper = payrollUKRates[year].ni.upperEarningsMonthly;
  let employeeNIC = 0;
  let employerNIC = 0;
  if (grossMonthly > pt) {
    const mainBand = Math.min(grossMonthly, upper) - pt;
    if (mainBand > 0) employeeNIC += mainBand * payrollUKRates[year].ni.employeeMainRate;
    if (grossMonthly > upper) employeeNIC += (grossMonthly - upper) * payrollUKRates[year].ni.employeeUpperRate;
  }
  if (grossMonthly > payrollUKRates[year].ni.employerThresholdMonthly) {
    employerNIC += (grossMonthly - payrollUKRates[year].ni.employerThresholdMonthly) * payrollUKRates[year].ni.employerRate;
  }
  return {
    employeeNIC: Math.round(employeeNIC * 100) / 100,
    employerNIC: Math.round(employerNIC * 100) / 100,
  };
};

const Payroll = () => {
  const [employer, setEmployer] = useState<EmployerDetails>({ payeReference: '', accountsOfficeRef: '' });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newEmp, setNewEmp] = useState<Employee>({ id: '', firstName: '', lastName: '', niNumber: '', taxCode: '1257L', niCategory: 'A', annualSalary: 30000, payFrequency: 'MTH' });
  const [payRuns, setPayRuns] = useState<PayRun[]>([]);
  const [period, setPeriod] = useState<string>(new Date().toISOString().slice(0,7));
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [taxYear, setTaxYear] = useState<TaxYear>('2024-2025');
  const [clientId, setClientId] = useState<string>('demo-client');
  const [clientSecret, setClientSecret] = useState<string>('demo-secret');
  const [authOk, setAuthOk] = useState<boolean>(!!hmrcService.getToken());
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [lastSubmissionId, setLastSubmissionId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [epsAdjustments, setEpsAdjustments] = useState<{ [k: string]: number }>({});
  const { user } = useAuth();
  const [showPreview, setShowPreview] = useState(false);
  const [previewType, setPreviewType] = useState<'FPS' | 'EPS' | null>(null);
  const [previewPayload, setPreviewPayload] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { employer: EmployerDetails };
          setEmployer(parsed.employer || { payeReference: '', accountsOfficeRef: '' });
        }
      } catch {}
      if (!user) return;
      setLoading(true);
      try {
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
        const { data: runs } = await supabase
          .from('payroll_runs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(12);
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
                taxablePay: Number(it.gross_pay), // Using gross_pay for taxable for simplicity
                taxDeducted: Number(it.tax_deduction),
                employeeNIC: Number(it.ni_deduction),
                employerNIC: Number(it.gross_pay) * 0.138, // Approximate employer NI
                netPay: Number(it.net_pay)
              }))
            });
          }
          setPayRuns(runWithItems);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ employer, employees, payRuns }));
    } catch {}
  }, [employer, employees, payRuns]);

  const addEmployee = () => {
    if (!user || !newEmp.firstName || !newEmp.lastName || !newEmp.annualSalary) return;
    const payload = {
      user_id: user.id,
      first_name: newEmp.firstName,
      last_name: newEmp.lastName,
      ni_number: newEmp.niNumber || null,
      tax_code: newEmp.taxCode,
      ni_category: newEmp.niCategory,
      annual_salary: newEmp.annualSalary,
      pay_frequency: newEmp.payFrequency
    };
    supabase.from('payroll_employees').insert([payload]).select('*').single().then(({ data, error }) => {
      if (error) {
        console.error('Create employee error:', error);
        toast.error('Failed to create employee');
        return;
      }
      if (data) {
        const e: Employee = {
          id: data.id,
          firstName: data.first_name,
          lastName: data.last_name,
          niNumber: data.ni_number || undefined,
          taxCode: data.tax_code,
          niCategory: data.ni_category,
          annualSalary: Number(data.annual_salary),
          payFrequency: data.pay_frequency === 'WK' ? 'WK' : 'MTH'
        };
        setEmployees(prev => [e, ...prev]);
        setNewEmp({ id: '', firstName: '', lastName: '', niNumber: '', taxCode: '1257L', niCategory: 'A', annualSalary: 30000, payFrequency: 'MTH' });
        toast.success('Employee created successfully!');
      }
    });
  };

  const generatePayRun = async () => {
    if (!user || employees.length === 0) return;
    const items = employees.map(emp => {
      const grossMonthly = emp.payFrequency === 'MTH' ? emp.annualSalary / 12 : emp.annualSalary / 52;
      const pay = Math.round(grossMonthly * 100) / 100;
      const tax = calculatePAYE(pay, emp.taxCode, taxYear);
      const ni = calculateNI(pay, emp.niCategory, taxYear);
      const net = Math.round((pay - tax - ni.employeeNIC) * 100) / 100;
      return {
        employeeId: emp.id,
        grossPay: pay,
        taxablePay: pay,
        taxDeducted: tax,
        employeeNIC: ni.employeeNIC,
        employerNIC: ni.employerNIC,
        netPay: net,
      };
    });
    const { data: runRow, error } = await supabase
      .from('payroll_runs')
      .insert([{ user_id: user.id, period, pay_date: payDate, notes: '' }])
      .select('*')
      .single();
    if (error || !runRow) return;
    const runId = runRow.id;
    const itemRows = items.map(it => ({
      run_id: runId,
      employee_id: it.employeeId,
      gross_pay: it.grossPay,
      tax_deduction: it.taxDeducted,
      ni_deduction: it.employeeNIC,
      net_pay: it.netPay
    }));
    await supabase.from('payroll_run_items').insert(itemRows);
    const run: PayRun = { id: runId, period, payDate, notes: '', items };
    setPayRuns(prev => [run, ...prev]);
    toast.success('Pay run generated successfully!');
  };

  const submitFPS = async (run: PayRun) => {
    if (!employer.payeReference || !employer.accountsOfficeRef) return;
    setSubmitting(true);
    try {
      const submissions: EmployeeFPSRecord[] = run.items.map(item => {
        const emp = employees.find(e => e.id === item.employeeId)!;
        return {
          employeeId: emp.id,
          niNumber: emp.niNumber,
          firstName: emp.firstName,
          lastName: emp.lastName,
          payDate: run.payDate,
          taxCode: emp.taxCode,
          niCategory: emp.niCategory,
          payFrequency: emp.payFrequency,
          grossPay: item.grossPay,
          taxablePay: item.taxablePay,
          taxDeducted: item.taxDeducted,
          employeeNIC: item.employeeNIC,
          employerNIC: item.employerNIC,
        };
      });
      const res = await hmrcService.submitFPS({ employer, period: run.period, submissions });
      setLastSubmissionId(res.submissionId);
      if (user) {
        await supabase.from('payroll_submissions').insert([
          { user_id: user.id, run_id: run.id, submission_type: 'FPS', reference_number: res.submissionId }
        ]);
      }
      toast.success('FPS submitted successfully!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit FPS');
    } finally {
      setSubmitting(false);
    }
  };

  const authenticate = async () => {
    await hmrcService.authenticate(clientId, clientSecret);
    setAuthOk(true);
    toast.success('HMRC authentication successful!');
  };

  const submitEPS = async () => {
    if (!user || !employer.payeReference || !employer.accountsOfficeRef) return;
    setSubmitting(true);
    try {
      const res = await hmrcService.submitEPS(period, employer, epsAdjustments);
      setLastSubmissionId(res.submissionId);
      // Attach to most recent run (if exists)
      const recent = payRuns[0];
      const runId = recent ? recent.id : null;
      await supabase.from('payroll_submissions').insert([
        { user_id: user.id, run_id: runId, submission_type: 'EPS', reference_number: res.submissionId }
      ]);
      toast.success('EPS submitted successfully!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit EPS');
    } finally {
      setSubmitting(false);
    }
  };

  const openPreviewFPS = (run: PayRun) => {
    const submissions = run.items.map(item => {
      const emp = employees.find(e => e.id === item.employeeId)!;
      return {
        employeeId: emp.id,
        niNumber: emp.niNumber,
        firstName: emp.firstName,
        lastName: emp.lastName,
        payDate: run.payDate,
        taxCode: emp.taxCode,
        niCategory: emp.niCategory,
        payFrequency: emp.payFrequency,
        grossPay: item.grossPay,
        taxablePay: item.taxablePay,
        taxDeducted: item.taxDeducted,
        employeeNIC: item.employeeNIC,
        employerNIC: item.employerNIC,
      };
    });
    setPreviewType('FPS');
    setPreviewPayload({ employer, period: run.period, submissions });
    setShowPreview(true);
  };

  const openPreviewEPS = () => {
    setPreviewType('EPS');
    setPreviewPayload({ employer, period, adjustments: epsAdjustments });
    setShowPreview(true);
  };

  const downloadPayslip = (run: PayRun, item: PayRun['items'][number]) => {
    const emp = employees.find(e => e.id === item.employeeId);
    if (!emp) return;
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text('Payslip', 20, 20);
    pdf.setFontSize(11);
    pdf.text(`Employer PAYE: ${employer.payeReference || 'N/A'}`, 20, 30);
    pdf.text(`Employee: ${emp.firstName} ${emp.lastName}`, 20, 40);
    if (emp.niNumber) pdf.text(`NI No: ${emp.niNumber}`, 20, 50);
    pdf.text(`Period: ${run.period}`, 20, 60);
    pdf.text(`Pay date: ${run.payDate}`, 20, 70);
    let y = 90;
    pdf.text('Earnings & Deductions', 20, y); y += 10;
    pdf.text(`Gross Pay: £${item.grossPay.toFixed(2)}`, 20, y); y += 8;
    pdf.text(`PAYE Tax: £${item.taxDeducted.toFixed(2)}`, 20, y); y += 8;
    pdf.text(`Employee NIC: £${item.employeeNIC.toFixed(2)}`, 20, y); y += 8;
    pdf.text(`Employer NIC: £${item.employerNIC.toFixed(2)}`, 20, y); y += 12;
    pdf.setFontSize(12);
    pdf.text(`Net Pay: £${item.netPay.toFixed(2)}`, 20, y);
    y += 10;
    pdf.save(`payslip_${emp.lastName}_${run.period}.pdf`);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2"><Calculator className="h-6 w-6"/> Payroll</h1>
        <div className="flex gap-2 flex-wrap">
          <Badge>PAYE/NIC</Badge>
          <Badge variant="secondary">HMRC RTI (mock)</Badge>
          <Badge variant="secondary">FPS/EPS</Badge>
        </div>
      </div>

      <Tabs defaultValue="setup" className="space-y-6">
        <TabsList className="grid grid-cols-3 md:grid-cols-5">
          <TabsTrigger value="setup">Employer</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="payrun">Pay Run</TabsTrigger>
          <TabsTrigger value="hmrc">HMRC</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="setup">
          <Card>
            <CardHeader>
              <CardTitle>Employer Setup</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="mb-1 block">PAYE Reference</Label>
                <Input value={employer.payeReference} onChange={(e) => setEmployer({ ...employer, payeReference: e.target.value })} placeholder="123/AB456" />
              </div>
              <div>
                <Label className="mb-1 block">Accounts Office Ref</Label>
                <Input value={employer.accountsOfficeRef} onChange={(e) => setEmployer({ ...employer, accountsOfficeRef: e.target.value })} placeholder="123PA12345678" />
              </div>
              <div className="md:col-span-3">
                <Alert>
                  <AlertTitle>Note</AlertTitle>
                  <AlertDescription>
                    Demo calculator only. For production, verify thresholds and rates per HMRC tax year.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <Label className="mb-1 block">First name</Label>
                  <Input value={newEmp.firstName} onChange={(e) => setNewEmp({ ...newEmp, firstName: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-1 block">Last name</Label>
                  <Input value={newEmp.lastName} onChange={(e) => setNewEmp({ ...newEmp, lastName: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-1 block">NI Number (optional)</Label>
                  <Input value={newEmp.niNumber} onChange={(e) => setNewEmp({ ...newEmp, niNumber: e.target.value })} placeholder="QQ123456A" />
                </div>
                <div>
                  <Label className="mb-1 block">Tax code</Label>
                  <Input value={newEmp.taxCode} onChange={(e) => setNewEmp({ ...newEmp, taxCode: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-1 block">NI category</Label>
                  <Select value={newEmp.niCategory} onValueChange={(value) => setNewEmp({ ...newEmp, niCategory: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A - Standard</SelectItem>
                      <SelectItem value="B">B - Married women/widows</SelectItem>
                      <SelectItem value="C">C - Over state pension age</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">Annual salary</Label>
                  <Input type="number" min={1} value={newEmp.annualSalary} onChange={(e) => setNewEmp({ ...newEmp, annualSalary: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="mb-1 block">Pay frequency</Label>
                  <Select value={newEmp.payFrequency} onValueChange={(value: 'MTH' | 'WK') => setNewEmp({ ...newEmp, payFrequency: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MTH">Monthly</SelectItem>
                      <SelectItem value="WK">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3">
                  <Button onClick={addEmployee} disabled={!newEmp.firstName || !newEmp.lastName}>
                    Add Employee
                  </Button>
                </div>
              </div>

              {employees.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>NI Number</TableHead>
                      <TableHead>Tax Code</TableHead>
                      <TableHead>NI Category</TableHead>
                      <TableHead>Annual Salary</TableHead>
                      <TableHead>Pay Frequency</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell>{emp.firstName} {emp.lastName}</TableCell>
                        <TableCell>{emp.niNumber || 'N/A'}</TableCell>
                        <TableCell>{emp.taxCode}</TableCell>
                        <TableCell>{emp.niCategory}</TableCell>
                        <TableCell>£{emp.annualSalary.toLocaleString()}</TableCell>
                        <TableCell>{emp.payFrequency === 'MTH' ? 'Monthly' : 'Weekly'}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline">Edit</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payrun">
          <Card>
            <CardHeader>
              <CardTitle>Generate Pay Run</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="mb-1 block">Pay period (YYYY-MM)</Label>
                  <Input value={period} onChange={(e) => setPeriod(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1 block">Pay date</Label>
                  <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1 block">Tax year</Label>
                  <Select value={taxYear} onValueChange={(value: TaxYear) => setTaxYear(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024-2025">2024-2025</SelectItem>
                      <SelectItem value="2023-2024">2023-2024</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={generatePayRun} disabled={employees.length === 0}>
                Generate Pay Run
              </Button>
            </CardContent>
          </Card>

          {payRuns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Pay Runs</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Pay Date</TableHead>
                      <TableHead>Employees</TableHead>
                      <TableHead>Total Gross</TableHead>
                      <TableHead>Total Tax</TableHead>
                      <TableHead>Total NI</TableHead>
                      <TableHead>Total Net</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payRuns.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell>{run.period}</TableCell>
                        <TableCell>{new Date(run.payDate).toLocaleDateString()}</TableCell>
                        <TableCell>{run.items.length}</TableCell>
                        <TableCell>£{run.items.reduce((sum, item) => sum + item.grossPay, 0).toFixed(2)}</TableCell>
                        <TableCell>£{run.items.reduce((sum, item) => sum + item.taxDeducted, 0).toFixed(2)}</TableCell>
                        <TableCell>£{run.items.reduce((sum, item) => sum + item.employeeNIC, 0).toFixed(2)}</TableCell>
                        <TableCell>£{run.items.reduce((sum, item) => sum + item.netPay, 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openPreviewFPS(run)}>View</Button>
                            <Button size="sm" variant="outline" onClick={() => submitFPS(run)} disabled={submitting}>
                              Submit FPS
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="hmrc">
          <Card>
            <CardHeader>
              <CardTitle>HMRC Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">Client ID</Label>
                  <Input value={clientId} onChange={(e) => setClientId(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1 block">Client Secret</Label>
                  <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={authenticate} disabled={!clientId || !clientSecret}>
                  {authOk ? <Check className="h-4 w-4 mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                  {authOk ? 'Authenticated' : 'Authenticate'}
                </Button>
                <Button onClick={submitEPS} disabled={!authOk || submitting}>
                  Submit EPS
                </Button>
                <Button onClick={openPreviewEPS} variant="outline">
                  Preview EPS
                </Button>
              </div>

              {lastSubmissionId && (
                <Alert>
                  <Check className="h-4 w-4" />
                  <AlertTitle>Submission Successful</AlertTitle>
                  <AlertDescription>
                    Submission ID: {lastSubmissionId}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Payroll History</CardTitle>
            </CardHeader>
            <CardContent>
              {payRuns.length === 0 ? (
                <p className="text-muted-foreground">No payroll runs yet. Generate your first pay run to see history.</p>
              ) : (
                <div className="space-y-4">
                  {payRuns.map((run) => (
                    <div key={run.id} className="border rounded p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium">Pay Period: {run.period}</h3>
                          <p className="text-sm text-muted-foreground">Pay Date: {new Date(run.payDate).toLocaleDateString()}</p>
                        </div>
                        <Badge variant="outline">{run.items.length} employees</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Total Gross:</span>
                          <p className="font-medium">£{run.items.reduce((sum, item) => sum + item.grossPay, 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Tax:</span>
                          <p className="font-medium">£{run.items.reduce((sum, item) => sum + item.taxDeducted, 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total NI:</span>
                          <p className="font-medium">£{run.items.reduce((sum, item) => sum + item.employeeNIC, 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Net:</span>
                          <p className="font-medium">£{run.items.reduce((sum, item) => sum + item.netPay, 0).toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openPreviewFPS(run)}>
                          View Details
                        </Button>
                        {run.items.map((item) => {
                          const emp = employees.find(e => e.id === item.employeeId);
                          return (
                            <Button 
                              key={item.employeeId}
                              size="sm" 
                              variant="outline" 
                              onClick={() => downloadPayslip(run, item)}
                            >
                              Payslip: {emp?.firstName}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewType} Preview</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            <pre className="text-xs bg-muted p-4 rounded">
              {JSON.stringify(previewPayload, null, 2)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Payroll;