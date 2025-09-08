import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calculator, Play, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { payrollUKRates, getMonthlyAllowance, TaxYear } from '@/services/payrollUKRates';

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

type PayItem = {
  employeeId: string;
  grossPay: number;
  taxDeducted: number;
  employeeNIC: number;
  employerNIC: number;
  netPay: number;
  overtimeHours?: number;
  overtimePay?: number;
  bonusPay?: number;
  deductions?: number;
};

interface PayRunGeneratorProps {
  employees: Employee[];
  onPayRunGenerated: () => void;
}

// Simplified PAYE calculator
const calculatePAYE = (taxablePayMonthly: number, taxCode: string, year: TaxYear) => {
  const allowanceMonthly = /^(\d{4})L|^(1257L)/.test(taxCode) ? getMonthlyAllowance(year) : 0;
  const taxable = Math.max(0, taxablePayMonthly - allowanceMonthly);
  const tax = taxable * payrollUKRates[year].basicRate;
  return Math.round(tax * 100) / 100;
};

// Simplified NI calculator
const calculateNI = (grossMonthly: number, category: string, year: TaxYear) => {
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

const PayRunGenerator: React.FC<PayRunGeneratorProps> = ({
  employees,
  onPayRunGenerated
}) => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<string>(new Date().toISOString().slice(0, 7));
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [taxYear, setTaxYear] = useState<TaxYear>('2024-2025');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [payItems, setPayItems] = useState<PayItem[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleEmployeeSelection = (employeeId: string, checked: boolean) => {
    const newSelection = new Set(selectedEmployees);
    if (checked) {
      newSelection.add(employeeId);
    } else {
      newSelection.delete(employeeId);
    }
    setSelectedEmployees(newSelection);
  };

  const selectAllEmployees = () => {
    if (selectedEmployees.size === employees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(employees.map(emp => emp.id)));
    }
  };

  const calculatePayItems = () => {
    if (selectedEmployees.size === 0) {
      toast.error('Please select at least one employee');
      return;
    }

    setIsCalculating(true);
    const items: PayItem[] = [];

    selectedEmployees.forEach(employeeId => {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return;

      const grossMonthly = employee.payFrequency === 'MTH' 
        ? employee.annualSalary / 12 
        : employee.annualSalary / 52;
      
      const grossPay = Math.round(grossMonthly * 100) / 100;
      const taxDeducted = calculatePAYE(grossPay, employee.taxCode, taxYear);
      const ni = calculateNI(grossPay, employee.niCategory, taxYear);
      const netPay = Math.round((grossPay - taxDeducted - ni.employeeNIC) * 100) / 100;

      items.push({
        employeeId,
        grossPay,
        taxDeducted,
        employeeNIC: ni.employeeNIC,
        employerNIC: ni.employerNIC,
        netPay,
        overtimeHours: 0,
        overtimePay: 0,
        bonusPay: 0,
        deductions: 0
      });
    });

    setPayItems(items);
    setShowPreview(true);
    setIsCalculating(false);
    toast.success('Pay calculations completed');
  };

  const generatePayRun = async () => {
    if (!user || payItems.length === 0) return;

    setIsGenerating(true);

    try {
      // Create the pay run
      const { data: runRow, error: runError } = await supabase
        .from('payroll_runs')
        .insert([{
          user_id: user.id,
          period,
          pay_date: payDate,
          notes: `Pay run for ${payItems.length} employees`
        }])
        .select('*')
        .single();

      if (runError || !runRow) throw runError;

      // Create pay items
      const itemRows = payItems.map(item => ({
        run_id: runRow.id,
        employee_id: item.employeeId,
        gross_pay: item.grossPay,
        tax_deduction: item.taxDeducted,
        ni_deduction: item.employeeNIC,
        net_pay: item.netPay
      }));

      const { error: itemsError } = await supabase
        .from('payroll_run_items')
        .insert(itemRows);

      if (itemsError) throw itemsError;

      toast.success('Pay run generated successfully!');
      onPayRunGenerated();
      
      // Reset form
      setSelectedEmployees(new Set());
      setPayItems([]);
      setShowPreview(false);
    } catch (error) {
      console.error('Generate pay run error:', error);
      toast.error('Failed to generate pay run');
    } finally {
      setIsGenerating(false);
    }
  };

  const updatePayItem = (employeeId: string, field: keyof PayItem, value: number) => {
    setPayItems(prev => prev.map(item => {
      if (item.employeeId === employeeId) {
        const updated = { ...item, [field]: value };
        
        // Recalculate net pay if deductions change
        if (field === 'deductions' || field === 'bonusPay') {
          const totalPay = updated.grossPay + (updated.bonusPay || 0);
          updated.netPay = Math.round((totalPay - updated.taxDeducted - updated.employeeNIC - (updated.deductions || 0)) * 100) / 100;
        }
        
        return updated;
      }
      return item;
    }));
  };

  const totalGross = payItems.reduce((sum, item) => sum + item.grossPay + (item.bonusPay || 0), 0);
  const totalTax = payItems.reduce((sum, item) => sum + item.taxDeducted, 0);
  const totalNI = payItems.reduce((sum, item) => sum + item.employeeNIC, 0);
  const totalDeductions = payItems.reduce((sum, item) => sum + (item.deductions || 0), 0);
  const totalNet = payItems.reduce((sum, item) => sum + item.netPay, 0);

  if (employees.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No employees available</h3>
          <p className="text-muted-foreground">
            Add employees first to generate pay runs
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Generate Pay Run
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <Label htmlFor="period">Pay Period (YYYY-MM)</Label>
              <Input
                id="period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="2024-01"
              />
            </div>
            <div>
              <Label htmlFor="payDate">Pay Date</Label>
              <Input
                id="payDate"
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="taxYear">Tax Year</Label>
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Select Employees</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllEmployees}
              >
                {selectedEmployees.size === employees.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Select</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Pay Frequency</TableHead>
                  <TableHead>Tax Code</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedEmployees.has(employee.id)}
                        onCheckedChange={(checked) => 
                          handleEmployeeSelection(employee.id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {employee.firstName} {employee.lastName}
                        </div>
                        {employee.niNumber && (
                          <div className="text-sm text-muted-foreground">
                            NI: {employee.niNumber}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>£{employee.annualSalary.toLocaleString()}/year</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {employee.payFrequency === 'MTH' ? 'Monthly' : 'Weekly'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{employee.taxCode}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex gap-2">
              <Button
                onClick={calculatePayItems}
                disabled={selectedEmployees.size === 0 || isCalculating}
              >
                {isCalculating ? 'Calculating...' : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Calculations
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showPreview && payItems.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pay Run Preview</CardTitle>
              <div className="text-sm text-muted-foreground">
                Period: {period} | Pay Date: {new Date(payDate).toLocaleDateString()}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Gross Pay</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>NI</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payItems.map((item) => {
                  const employee = employees.find(emp => emp.id === item.employeeId);
                  return (
                    <TableRow key={item.employeeId}>
                      <TableCell>
                        <div className="font-medium">
                          {employee?.firstName} {employee?.lastName}
                        </div>
                      </TableCell>
                      <TableCell>£{item.grossPay.toFixed(2)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.bonusPay || 0}
                          onChange={(e) => updatePayItem(item.employeeId, 'bonusPay', Number(e.target.value))}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>£{item.taxDeducted.toFixed(2)}</TableCell>
                      <TableCell>£{item.employeeNIC.toFixed(2)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.deductions || 0}
                          onChange={(e) => updatePayItem(item.employeeId, 'deductions', Number(e.target.value))}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        £{item.netPay.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 bg-muted/50">
                  <TableCell className="font-bold">TOTALS</TableCell>
                  <TableCell className="font-bold">£{totalGross.toFixed(2)}</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell className="font-bold">£{totalTax.toFixed(2)}</TableCell>
                  <TableCell className="font-bold">£{totalNI.toFixed(2)}</TableCell>
                  <TableCell className="font-bold">£{totalDeductions.toFixed(2)}</TableCell>
                  <TableCell className="font-bold">£{totalNet.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Cancel
              </Button>
              <Button
                onClick={generatePayRun}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating...' : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Generate Pay Run
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PayRunGenerator;