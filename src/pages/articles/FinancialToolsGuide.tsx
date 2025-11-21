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
              Complete guide to managing your business finances with B2BNEST
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
                Monitor your business's income and expenses in real-time to maintain healthy cash flow.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Setting Up Cash Flow Tracking</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Navigate to Business Tools → Cash Flow Tracker</li>
                  <li>Connect your bank accounts (optional but recommended)</li>
                  <li>Set up income and expense categories</li>
                  <li>Configure automatic transaction imports</li>
                  <li>Set budget limits and alerts</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Key Features</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Real-time balance monitoring</li>
                  <li>Visual cash flow charts and forecasts</li>
                  <li>Category-based expense tracking</li>
                  <li>Recurring transaction management</li>
                  <li>Cash flow projections (30/60/90 days)</li>
                  <li>Export reports to Excel/PDF</li>
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
                  <li>Input expected returns or revenue</li>
                  <li>Add timeframe for the investment</li>
                  <li>Include ongoing costs (optional)</li>
                  <li>View ROI percentage and payback period</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Calculations Included</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Simple ROI percentage</li>
                  <li>Annualized ROI</li>
                  <li>Payback period</li>
                  <li>Net present value (NPV)</li>
                  <li>Internal rate of return (IRR)</li>
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
                Track, categorize, and manage all your business expenses efficiently.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Recording Expenses</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Click "Add Expense" button</li>
                  <li>Enter expense details (amount, date, category)</li>
                  <li>Upload receipt photo or PDF</li>
                  <li>Add notes or descriptions</li>
                  <li>Mark as billable if applicable</li>
                  <li>Assign to project or client</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Expense Categories</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Office supplies and equipment</li>
                  <li>Travel and accommodation</li>
                  <li>Marketing and advertising</li>
                  <li>Professional services</li>
                  <li>Utilities and rent</li>
                  <li>Meals and entertainment</li>
                  <li>Custom categories available</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Reports & Analytics</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Expense trends by category</li>
                  <li>Month-over-month comparisons</li>
                  <li>Tax-deductible expense summaries</li>
                  <li>Vendor spending analysis</li>
                  <li>Budget vs. actual reports</li>
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
                Submit VAT returns directly to HMRC and stay compliant with Making Tax Digital regulations.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Prerequisites</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>HMRC integration configured</li>
                  <li>Valid VAT registration number</li>
                  <li>Government Gateway credentials</li>
                  <li>MTD-enabled business account</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Submitting VAT Returns</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Navigate to HMRC Integration Suite</li>
                  <li>Click "VAT Returns" tab</li>
                  <li>Select the return period</li>
                  <li>Review auto-calculated figures</li>
                  <li>Make adjustments if needed</li>
                  <li>Preview submission</li>
                  <li>Submit directly to HMRC</li>
                  <li>Receive confirmation receipt</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Auto-Calculation Features</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Output VAT from sales invoices</li>
                  <li>Input VAT from expenses</li>
                  <li>Net VAT due calculation</li>
                  <li>Flat Rate Scheme support</li>
                  <li>Reverse charge transactions</li>
                </ul>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Important:</strong> Always review VAT figures before submission. B2BNEST auto-calculates based on your data, but you're responsible for accuracy.
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
                Complete UK payroll processing with automatic RTI submissions to HMRC.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Setting Up Payroll</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Add employee information (name, NI number, tax code)</li>
                  <li>Configure pay frequencies</li>
                  <li>Set up salary and deductions</li>
                  <li>Enter PAYE reference number</li>
                  <li>Connect HMRC for RTI submissions</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Running Payroll</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Create new pay run for the period</li>
                  <li>Review employee hours/salaries</li>
                  <li>System calculates PAYE, NI, pensions</li>
                  <li>Review deductions and net pay</li>
                  <li>Approve payroll</li>
                  <li>Generate payslips (PDF or email)</li>
                  <li>Submit RTI to HMRC</li>
                  <li>Process payments to employees</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Compliance Features</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Automatic PAYE calculations</li>
                  <li>National Insurance calculations (all categories)</li>
                  <li>Workplace pension compliance</li>
                  <li>Student loan deductions</li>
                  <li>Statutory payments (SSP, SMP, SPP)</li>
                  <li>P45 and P60 generation</li>
                  <li>RTI submissions (FPS/EPS)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Reports Available</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Payroll summary by period</li>
                  <li>PAYE/NI liability reports</li>
                  <li>Year-to-date summaries</li>
                  <li>Payslip history</li>
                  <li>Pension contribution reports</li>
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
                  <span>Submit VAT returns on time to avoid penalties</span>
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
