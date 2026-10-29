import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign, TrendingUp, Receipt, FileText, Users2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';

const FinancialToolsGuide = () => {
  return (
    <>
      <SEOHead 
        title="Financial Tools Guide | B2BNEST"
        description="Master B2BNEST financial tools including cash flow tracking, expense management, VAT returns, and payroll"
      />
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <Button asChild variant="ghost" className="mb-6">
            <Link to="/knowledge-base">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Knowledge Base
            </Link>
          </Button>

          <div className="mb-8">
            <DollarSign className="h-12 w-12 text-primary mb-4" />
            <h1 className="text-4xl font-bold mb-4">Financial Tools Guide</h1>
            <p className="text-xl text-muted-foreground">
              What the finance tools in B2BNEST do today, step by step.
            </p>
          </div>

          {/* Cash Flow Tracking */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Cash Flow Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                A quick tracker for money in and out over the last 30 days. Entries are kept in this browser only (up to 50), not in your account.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Setting Up Cash Flow Tracking</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Navigate to Business Tools → Cash Flow Tracker</li>
                  <li>Add each payment in or out by hand: amount, description and a category from the list</li>
                  <li>Edit or delete an entry at any time</li>
                  <li>Bank accounts are not connected and nothing is imported automatically</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Key Features</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>30-day summary: money in, money out and net flow</li>
                  <li>Top categories for income and for expenses</li>
                  <li>Fixed income and expense categories (for example Sales Revenue, Office Rent, Software/Tools)</li>
                  <li>No charts, forecasts, budgets, recurring entries or exports yet</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Best Practices</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Review cash flow weekly</li>
                  <li>Set aside reserves for slow periods</li>
                  <li>Monitor accounts receivable aging</li>
                  <li>Plan for seasonal variations</li>
                </ul>
              </div>

              <Button asChild className="w-full">
                <Link to="/business-tools">Open Cash Flow Tracker</Link>
              </Button>
            </CardContent>
          </Card>

          {/* ROI Calculator */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>ROI Calculator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Calculate return on investment for projects, campaigns, and business decisions.
              </p>

              <div>
                <h3 className="font-semibold mb-2">How to Use</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Enter initial investment amount</li>
                  <li>Input the total expected returns</li>
                  <li>Add the timeframe in months</li>
                  <li>View the ROI percentage, annualised ROI and net profit</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Calculations Included</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Simple ROI percentage</li>
                  <li>Annualised ROI</li>
                  <li>Net profit (returns minus investment)</li>
                  <li>Payback period, NPV and IRR are not calculated</li>
                </ul>
              </div>

              <Button asChild className="w-full">
                <Link to="/business-tools">Open ROI Calculator</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Expense Management */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Expense Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Record business expenses, sort them by category and supplier, and download them as a CSV file.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Recording Expenses</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Open Finance → Expenses and click "Add expense"</li>
                  <li>Enter a description, amount, date and category</li>
                  <li>Choose a supplier (optional) and a status (Pending, Approved or Paid)</li>
                  <li>Receipts can't be attached yet</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Expense Categories</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Premises and office: office costs, rent and rates, utilities, telephone and internet, software</li>
                  <li>Travel: travel and transport, vehicle running costs, fuel, meals and subsistence</li>
                  <li>People and services: wages, subcontractors, training, professional fees (accountant, legal)</li>
                  <li>Stock, equipment, marketing, insurance, bank charges, licences, taxes and duties</li>
                  <li>"Other (type your own)" adds your own category</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Reports & Analytics</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Search by description, category or supplier, and filter by status or category</li>
                  <li>Expenses this month on the Finance Reports tab</li>
                  <li>Download expenses as a CSV file</li>
                </ul>
              </div>

              <Button asChild className="w-full">
                <Link to="/business-tools">Open Expense Management</Link>
              </Button>
            </CardContent>
          </Card>

          {/* HMRC VAT Returns */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                HMRC VAT Returns
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Preview VAT return figures. HMRC filing is not available yet. Nothing has been sent to HMRC. File with HMRC directly or through your accountant.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Prerequisites</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Nothing: the VAT screen shows example figures to show the layout</li>
                  <li>You can save your VAT number in HMRC settings for later use</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Previewing a VAT return</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Navigate to HMRC Integration Suite</li>
                  <li>Click "VAT Returns" tab</li>
                  <li>Select the return period</li>
                  <li>Look at the example figures (marked "Preview only")</li>
                  <li>File the return with HMRC yourself (filing from B2BNEST is not available yet)</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Auto-Calculation Features</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Nothing is calculated from your invoices or expenses yet</li>
                  <li>The figures shown are examples, the same for everyone</li>
                </ul>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Important:</strong> The VAT figures in B2BNEST are examples, not your data. Work out your VAT return from your own records or with your accountant.
                </p>
              </div>

              <Button asChild className="w-full">
                <Link to="/dashboard">Open HMRC Integration</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Payroll Management */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users2 className="h-5 w-5 text-primary" />
                Payroll Management (UK)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                UK payroll calculations to help you prepare pay runs. RTI filing (FPS/EPS) with HMRC is not available yet. Check every figure before you pay anyone.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Setting Up Payroll</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Add employee information (name, NI number, tax code)</li>
                  <li>Choose monthly or weekly pay and the NI category (A, B, C, H, M or Z)</li>
                  <li>Enter the annual salary</li>
                  <li>Enter the employer PAYE reference and Accounts Office reference</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Running Payroll</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Create new pay run for the period</li>
                  <li>Review each employee's pay and add any bonus</li>
                  <li>B2BNEST calculates income tax (PAYE) and employee National Insurance</li>
                  <li>Review tax, NI and net pay, then save the pay run</li>
                  <li>Download payslips and a pay run summary as PDFs</li>
                  <li>File RTI with HMRC yourself or through your accountant (not available from B2BNEST yet)</li>
                  <li>Pay your employees from your bank yourself</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Compliance Features</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Income tax (PAYE) from the tax code</li>
                  <li>Employee National Insurance for categories A, B, C, H, M and Z</li>
                  <li>RTI previews (FPS/EPS) with example figures; filing not available yet</li>
                  <li>Not available yet: pensions, student loans, statutory payments (SSP, SMP, SPP), P45 and P60</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Reports Available</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Pay run history with each employee's payslip</li>
                  <li>Pay run summary (PDF) with total gross pay, tax, NI and net pay</li>
                  <li>Year-to-date figures aren't included yet</li>
                </ul>
              </div>

              <Button asChild className="w-full">
                <Link to="/business-tools">Open Payroll System</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Tax Compliance Tips */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>Tax Compliance Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span>Keep all receipts and invoices for at least 6 years</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span>File VAT returns with HMRC on time to avoid penalties</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span>Review payroll before each RTI submission</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span>Set calendar reminders for tax deadlines</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span>Consult an accountant for complex tax situations</span>
                </li>
              </ul>

              <div className="mt-4 p-4 bg-background rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Disclaimer:</strong> B2BNEST provides tools to help with financial management and tax compliance, but we're not accountants or tax advisors. Always consult with qualified professionals for tax advice specific to your situation.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default FinancialToolsGuide;
