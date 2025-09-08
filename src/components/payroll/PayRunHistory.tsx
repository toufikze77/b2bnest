import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Download, Eye, Calendar, Users, DollarSign } from 'lucide-react';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

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

interface PayRunHistoryProps {
  payRuns: PayRun[];
  employees: Employee[];
  employer: {
    payeReference: string;
    accountsOfficeRef: string;
  };
}

const PayRunHistory: React.FC<PayRunHistoryProps> = ({
  payRuns,
  employees,
  employer
}) => {
  const [selectedPayRun, setSelectedPayRun] = useState<PayRun | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const downloadPayslip = (payRun: PayRun, item: PayRun['items'][number]) => {
    const employee = employees.find(emp => emp.id === item.employeeId);
    if (!employee) {
      toast.error('Employee not found');
      return;
    }

    try {
      const pdf = new jsPDF();
      
      // Header
      pdf.setFontSize(20);
      pdf.text('PAYSLIP', 20, 20);
      
      // Company info
      pdf.setFontSize(10);
      pdf.text(`PAYE Reference: ${employer.payeReference || 'N/A'}`, 20, 35);
      pdf.text(`Accounts Office Ref: ${employer.accountsOfficeRef || 'N/A'}`, 20, 42);
      
      // Employee info
      pdf.setFontSize(12);
      pdf.text('EMPLOYEE DETAILS', 20, 55);
      pdf.setFontSize(10);
      pdf.text(`Name: ${employee.firstName} ${employee.lastName}`, 20, 65);
      if (employee.niNumber) {
        pdf.text(`National Insurance: ${employee.niNumber}`, 20, 72);
      }
      pdf.text(`Tax Code: ${employee.taxCode}`, 20, 79);
      pdf.text(`NI Category: ${employee.niCategory}`, 20, 86);
      
      // Pay period info
      pdf.setFontSize(12);
      pdf.text('PAY PERIOD', 120, 55);
      pdf.setFontSize(10);
      pdf.text(`Period: ${payRun.period}`, 120, 65);
      pdf.text(`Pay Date: ${new Date(payRun.payDate).toLocaleDateString('en-GB')}`, 120, 72);
      
      // Earnings and deductions table
      let y = 100;
      pdf.setFontSize(12);
      pdf.text('EARNINGS & DEDUCTIONS', 20, y);
      y += 10;
      
      // Table headers
      pdf.setFontSize(10);
      pdf.text('Description', 20, y);
      pdf.text('Amount (£)', 150, y);
      y += 7;
      
      // Gross pay
      pdf.text('Gross Pay', 20, y);
      pdf.text(item.grossPay.toFixed(2), 150, y);
      y += 7;
      
      // Deductions
      pdf.text('PAYE Tax', 20, y);
      pdf.text(`-${item.taxDeducted.toFixed(2)}`, 150, y);
      y += 7;
      
      pdf.text('Employee NI', 20, y);
      pdf.text(`-${item.employeeNIC.toFixed(2)}`, 150, y);
      y += 10;
      
      // Net pay (highlighted)
      pdf.setFontSize(12);
      pdf.text('NET PAY', 20, y);
      pdf.text(`£${item.netPay.toFixed(2)}`, 150, y);
      
      // Year to date section
      y += 15;
      pdf.setFontSize(10);
      pdf.text('Year to Date figures would be calculated here in production', 20, y);
      
      // Footer
      y += 20;
      pdf.text('This is a demo payslip. Please verify all calculations before use.', 20, y);
      
      // Save the PDF
      pdf.save(`payslip_${employee.lastName}_${payRun.period}.pdf`);
      toast.success('Payslip downloaded successfully');
    } catch (error) {
      console.error('Error generating payslip:', error);
      toast.error('Failed to generate payslip');
    }
  };

  const downloadPayRunSummary = (payRun: PayRun) => {
    try {
      const pdf = new jsPDF();
      
      // Header
      pdf.setFontSize(16);
      pdf.text('PAY RUN SUMMARY', 20, 20);
      
      // Pay run details
      pdf.setFontSize(10);
      pdf.text(`Period: ${payRun.period}`, 20, 35);
      pdf.text(`Pay Date: ${new Date(payRun.payDate).toLocaleDateString('en-GB')}`, 20, 42);
      pdf.text(`Number of Employees: ${payRun.items.length}`, 20, 49);
      
      // Summary totals
      const totalGross = payRun.items.reduce((sum, item) => sum + item.grossPay, 0);
      const totalTax = payRun.items.reduce((sum, item) => sum + item.taxDeducted, 0);
      const totalNI = payRun.items.reduce((sum, item) => sum + item.employeeNIC, 0);
      const totalNet = payRun.items.reduce((sum, item) => sum + item.netPay, 0);
      
      pdf.text(`Total Gross: £${totalGross.toFixed(2)}`, 120, 35);
      pdf.text(`Total Tax: £${totalTax.toFixed(2)}`, 120, 42);
      pdf.text(`Total NI: £${totalNI.toFixed(2)}`, 120, 49);
      pdf.text(`Total Net: £${totalNet.toFixed(2)}`, 120, 56);
      
      // Employee details table
      let y = 70;
      pdf.setFontSize(12);
      pdf.text('EMPLOYEE BREAKDOWN', 20, y);
      y += 10;
      
      pdf.setFontSize(8);
      pdf.text('Employee', 20, y);
      pdf.text('Gross', 70, y);
      pdf.text('Tax', 95, y);
      pdf.text('NI', 115, y);
      pdf.text('Net', 135, y);
      y += 5;
      
      payRun.items.forEach(item => {
        const employee = employees.find(emp => emp.id === item.employeeId);
        if (employee) {
          pdf.text(`${employee.firstName} ${employee.lastName}`, 20, y);
          pdf.text(`£${item.grossPay.toFixed(2)}`, 70, y);
          pdf.text(`£${item.taxDeducted.toFixed(2)}`, 95, y);
          pdf.text(`£${item.employeeNIC.toFixed(2)}`, 115, y);
          pdf.text(`£${item.netPay.toFixed(2)}`, 135, y);
          y += 5;
        }
      });
      
      pdf.save(`payrun_summary_${payRun.period}.pdf`);
      toast.success('Pay run summary downloaded successfully');
    } catch (error) {
      console.error('Error generating pay run summary:', error);
      toast.error('Failed to generate pay run summary');
    }
  };

  const viewPayRunDetails = (payRun: PayRun) => {
    setSelectedPayRun(payRun);
    setShowDetails(true);
  };

  if (payRuns.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No pay runs yet</h3>
          <p className="text-muted-foreground">
            Generate your first pay run to see history here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Pay Run History ({payRuns.length})
          </CardTitle>
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
              {payRuns.map((payRun) => {
                const totalGross = payRun.items.reduce((sum, item) => sum + item.grossPay, 0);
                const totalTax = payRun.items.reduce((sum, item) => sum + item.taxDeducted, 0);
                const totalNI = payRun.items.reduce((sum, item) => sum + item.employeeNIC, 0);
                const totalNet = payRun.items.reduce((sum, item) => sum + item.netPay, 0);

                return (
                  <TableRow key={payRun.id}>
                    <TableCell>
                      <div className="font-medium">{payRun.period}</div>
                    </TableCell>
                    <TableCell>
                      {new Date(payRun.payDate).toLocaleDateString('en-GB')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        {payRun.items.length}
                      </Badge>
                    </TableCell>
                    <TableCell>£{totalGross.toFixed(2)}</TableCell>
                    <TableCell>£{totalTax.toFixed(2)}</TableCell>
                    <TableCell>£{totalNI.toFixed(2)}</TableCell>
                    <TableCell className="font-medium">
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <DollarSign className="h-3 w-3 mr-1" />
                        £{totalNet.toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewPayRunDetails(payRun)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadPayRunSummary(payRun)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Pay Run Details - {selectedPayRun?.period}
            </DialogTitle>
          </DialogHeader>
          
          {selectedPayRun && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded">
                <div>
                  <div className="text-sm font-medium">Pay Period</div>
                  <div>{selectedPayRun.period}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Pay Date</div>
                  <div>{new Date(selectedPayRun.payDate).toLocaleDateString('en-GB')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Employees</div>
                  <div>{selectedPayRun.items.length}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Total Net</div>
                  <div className="font-bold">
                    £{selectedPayRun.items.reduce((sum, item) => sum + item.netPay, 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Gross Pay</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead>NI</TableHead>
                    <TableHead>Net Pay</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPayRun.items.map((item) => {
                    const employee = employees.find(emp => emp.id === item.employeeId);
                    return (
                      <TableRow key={item.employeeId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {employee?.firstName} {employee?.lastName}
                            </div>
                            {employee?.niNumber && (
                              <div className="text-xs text-muted-foreground">
                                NI: {employee.niNumber}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>£{item.grossPay.toFixed(2)}</TableCell>
                        <TableCell>£{item.taxDeducted.toFixed(2)}</TableCell>
                        <TableCell>£{item.employeeNIC.toFixed(2)}</TableCell>
                        <TableCell className="font-medium">
                          £{item.netPay.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadPayslip(selectedPayRun, item)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Payslip
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PayRunHistory;