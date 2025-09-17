import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Users, 
  Upload, 
  CheckCircle, 
  AlertTriangle,
  Download,
  Eye,
  RefreshCw,
  Calendar,
  Calculator
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { hmrcService } from '@/services/hmrcService';

type PayrollSubmission = {
  id: string;
  type: 'FPS' | 'EPS';
  period: string;
  payDate: string;
  employeeCount: number;
  status: 'draft' | 'submitted' | 'failed';
  submissionId?: string;
  submittedAt?: string;
  totalGross: number;
  totalTax: number;
  totalNI: number;
  errors?: string[];
};

const HMRCPayrollSubmissions = () => {
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<PayrollSubmission[]>([
    {
      id: '1',
      type: 'FPS',
      period: '2024-09',
      payDate: '2024-09-30',
      employeeCount: 5,
      status: 'submitted',
      submissionId: 'FPS-ABC123DEF',
      submittedAt: '2024-09-30T14:30:00Z',
      totalGross: 15000.00,
      totalTax: 2850.00,
      totalNI: 1650.00
    },
    {
      id: '2',
      type: 'EPS',
      period: '2024-09',
      payDate: '2024-09-30',
      employeeCount: 0,
      status: 'submitted',
      submissionId: 'EPS-XYZ789GHI',
      submittedAt: '2024-09-30T14:35:00Z',
      totalGross: 0,
      totalTax: 0,
      totalNI: 0
    },
    {
      id: '3',
      type: 'FPS',
      period: '2024-10',
      payDate: '2024-10-31',
      employeeCount: 5,
      status: 'draft',
      totalGross: 15500.00,
      totalTax: 2950.00,
      totalNI: 1700.00
    }
  ]);

  const [selectedSubmission, setSelectedSubmission] = useState<PayrollSubmission | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitPayroll = async (submissionId: string) => {
    setIsSubmitting(true);
    
    try {
      const submission = submissions.find(s => s.id === submissionId);
      if (!submission) return;

      // Simulate HMRC submission
      const result = await hmrcService.submitFPS({
        employer: {
          payeReference: '123/AB456',
          accountsOfficeRef: '123PA12345678'
        },
        period: submission.period,
        submissions: [{
          employeeId: 'EMP001',
          firstName: 'John',
          lastName: 'Doe',
          payDate: submission.payDate,
          taxCode: '1257L',
          niCategory: 'A',
          payFrequency: 'MTH',
          grossPay: submission.totalGross,
          taxablePay: submission.totalGross,
          taxDeducted: submission.totalTax,
          employeeNIC: submission.totalNI,
          employerNIC: submission.totalNI * 1.138
        }]
      });
      
      setSubmissions(prev => prev.map(sub => 
        sub.id === submissionId 
          ? { 
              ...sub, 
              status: 'submitted' as const,
              submissionId: result.submissionId,
              submittedAt: new Date().toISOString()
            }
          : sub
      ));
      
      toast({
        title: "Payroll Submitted",
        description: `Successfully submitted ${submission.type} to HMRC. Reference: ${result.submissionId}`,
      });
    } catch (error) {
      setSubmissions(prev => prev.map(sub => 
        sub.id === submissionId 
          ? { 
              ...sub, 
              status: 'failed' as const,
              errors: ['Failed to submit to HMRC. Please check your connection and try again.']
            }
          : sub
      ));
      
      toast({
        title: "Submission Failed",
        description: "Failed to submit payroll data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: PayrollSubmission['status']) => {
    switch (status) {
      case 'submitted': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusIcon = (status: PayrollSubmission['status']) => {
    switch (status) {
      case 'submitted': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <AlertTriangle className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Payroll Submissions</h2>
        <p className="text-gray-600">Real Time Information (RTI) submissions to HMRC</p>
      </div>

      {/* RTI Information */}
      <Alert>
        <Users className="h-4 w-4" />
        <AlertTitle>Real Time Information (RTI)</AlertTitle>
        <AlertDescription>
          Submit Full Payment Submissions (FPS) and Employer Payment Summaries (EPS) to HMRC on or before each pay date. 
          Late submissions may result in penalties.
        </AlertDescription>
      </Alert>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{submissions.filter(s => s.status === 'submitted').length}</p>
                <p className="text-sm text-gray-600">Submitted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{submissions.filter(s => s.status === 'draft').length}</p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{Math.max(...submissions.map(s => s.employeeCount))}</p>
                <p className="text-sm text-gray-600">Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">RTI</p>
                <p className="text-sm text-gray-600">Compliant</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submissions List */}
      <div className="grid gap-4">
        {submissions.map((submission) => (
          <Card key={submission.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">
                      {submission.type} - {submission.period}
                    </h3>
                    <Badge className={`${getStatusColor(submission.status)} text-xs`}>
                      {getStatusIcon(submission.status)}
                      <span className="ml-1 capitalize">{submission.status}</span>
                    </Badge>
                    {submission.type === 'FPS' && (
                      <Badge variant="outline" className="text-xs">
                        Full Payment Submission
                      </Badge>
                    )}
                    {submission.type === 'EPS' && (
                      <Badge variant="outline" className="text-xs">
                        Employer Payment Summary
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Pay Date</p>
                      <p className="font-medium">{format(new Date(submission.payDate), 'dd MMM yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Employees</p>
                      <p className="font-medium">{submission.employeeCount}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Gross Pay</p>
                      <p className="font-medium">£{submission.totalGross.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Tax</p>
                      <p className="font-medium">£{submission.totalTax.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">NI</p>
                      <p className="font-medium">£{submission.totalNI.toLocaleString()}</p>
                    </div>
                  </div>

                  {submission.submissionId && (
                    <div className="mt-2 text-sm text-gray-600">
                      <p>HMRC Reference: <span className="font-mono">{submission.submissionId}</span></p>
                      {submission.submittedAt && (
                        <p>Submitted: {format(new Date(submission.submittedAt), 'dd MMM yyyy HH:mm')}</p>
                      )}
                    </div>
                  )}

                  {submission.errors && submission.errors.length > 0 && (
                    <div className="mt-2">
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          {submission.errors.join(', ')}
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedSubmission(submission)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                  
                  {submission.status === 'draft' && (
                    <Button 
                      size="sm"
                      onClick={() => handleSubmitPayroll(submission.id)}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Submit to HMRC
                    </Button>
                  )}
                  
                  {submission.status === 'failed' && (
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleSubmitPayroll(submission.id)}
                      disabled={isSubmitting}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry Submission
                    </Button>
                  )}
                  
                  {submission.status === 'submitted' && (
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download Report
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <Card className="mt-6 border-2 border-blue-200">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                {selectedSubmission.type} Details - {selectedSubmission.period}
              </CardTitle>
              <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Submission Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <span className="font-mono">{selectedSubmission.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Period:</span>
                    <span className="font-mono">{selectedSubmission.period}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pay Date:</span>
                    <span className="font-mono">{format(new Date(selectedSubmission.payDate), 'dd MMM yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Employee Count:</span>
                    <span className="font-mono">{selectedSubmission.employeeCount}</span>
                  </div>
                  {selectedSubmission.submissionId && (
                    <div className="flex justify-between">
                      <span>HMRC Reference:</span>
                      <span className="font-mono">{selectedSubmission.submissionId}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Financial Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Gross Pay:</span>
                    <span className="font-mono">£{selectedSubmission.totalGross.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Tax Deducted:</span>
                    <span className="font-mono">£{selectedSubmission.totalTax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total NI Deducted:</span>
                    <span className="font-mono">£{selectedSubmission.totalNI.toLocaleString()}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between font-semibold">
                    <span>Total Net Pay:</span>
                    <span className="font-mono">
                      £{(selectedSubmission.totalGross - selectedSubmission.totalTax - selectedSubmission.totalNI).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {selectedSubmission.type === 'FPS' && (
              <div>
                <h4 className="font-semibold mb-3">FPS Requirements</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• Must be submitted on or before the pay date</p>
                  <p>• Include all employees paid in this period</p>
                  <p>• Contains individual employee payment details</p>
                  <p>• Updates year-to-date figures for each employee</p>
                </div>
              </div>
            )}

            {selectedSubmission.type === 'EPS' && (
              <div>
                <h4 className="font-semibold mb-3">EPS Requirements</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• Submit by 19th of the month following the tax period</p>
                  <p>• Required even if no employees were paid</p>
                  <p>• Confirms total amounts due to HMRC</p>
                  <p>• May include adjustments from previous periods</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HMRCPayrollSubmissions;