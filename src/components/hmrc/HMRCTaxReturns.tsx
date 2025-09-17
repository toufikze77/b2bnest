import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  FileText, 
  Building, 
  User, 
  Calculator, 
  Calendar, 
  CheckCircle, 
  AlertTriangle,
  Download,
  Upload,
  Eye,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type TaxReturn = {
  id: string;
  type: 'corporation' | 'income' | 'self-assessment';
  taxYear: string;
  dueDate: string;
  status: 'draft' | 'submitted' | 'overdue' | 'accepted';
  profit?: number;
  taxDue: number;
  submissionId?: string;
  submittedAt?: string;
};

const HMRCTaxReturns = () => {
  const { toast } = useToast();
  const [returns, setReturns] = useState<TaxReturn[]>([
    {
      id: '1',
      type: 'corporation',
      taxYear: '2023-24',
      dueDate: '2024-12-31',
      status: 'draft',
      profit: 85000.00,
      taxDue: 16150.00
    },
    {
      id: '2',
      type: 'self-assessment',
      taxYear: '2023-24',
      dueDate: '2025-01-31',
      status: 'submitted',
      taxDue: 8500.00,
      submissionId: 'SA-XYZ789DEF',
      submittedAt: '2024-10-15T16:45:00Z'
    },
    {
      id: '3',
      type: 'corporation',
      taxYear: '2022-23',
      dueDate: '2023-12-31',
      status: 'accepted',
      profit: 75000.00,
      taxDue: 14250.00,
      submissionId: 'CT-ABC123GHI',
      submittedAt: '2023-11-15T14:30:00Z'
    }
  ]);

  const [selectedReturn, setSelectedReturn] = useState<TaxReturn | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitReturn = async (returnId: string) => {
    setIsSubmitting(true);
    
    try {
      // Simulate API call to HMRC
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const submissionId = `${returns.find(r => r.id === returnId)?.type?.toUpperCase().slice(0, 2)}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      
      setReturns(prev => prev.map(ret => 
        ret.id === returnId 
          ? { 
              ...ret, 
              status: 'submitted' as const,
              submissionId,
              submittedAt: new Date().toISOString()
            }
          : ret
      ));
      
      const returnType = returns.find(r => r.id === returnId)?.type;
      toast({
        title: "Tax Return Submitted",
        description: `Successfully submitted ${returnType} tax return to HMRC. Reference: ${submissionId}`,
      });
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "Failed to submit tax return. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: TaxReturn['status']) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusIcon = (status: TaxReturn['status']) => {
    switch (status) {
      case 'accepted':
      case 'submitted': return <CheckCircle className="h-4 w-4" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const getTypeIcon = (type: TaxReturn['type']) => {
    switch (type) {
      case 'corporation': return <Building className="h-5 w-5" />;
      case 'self-assessment':
      case 'income': return <User className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getTypeName = (type: TaxReturn['type']) => {
    switch (type) {
      case 'corporation': return 'Corporation Tax';
      case 'self-assessment': return 'Self Assessment';
      case 'income': return 'Income Tax';
      default: return 'Tax Return';
    }
  };

  const corporationReturns = returns.filter(r => r.type === 'corporation');
  const selfAssessmentReturns = returns.filter(r => r.type === 'self-assessment' || r.type === 'income');

  const renderReturnCard = (taxReturn: TaxReturn) => (
    <Card key={taxReturn.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {getTypeIcon(taxReturn.type)}
              <h3 className="text-lg font-semibold">
                {getTypeName(taxReturn.type)} - {taxReturn.taxYear}
              </h3>
              <Badge className={getStatusColor(taxReturn.status)}>
                {getStatusIcon(taxReturn.status)}
                <span className="ml-1 capitalize">{taxReturn.status}</span>
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Tax Year</p>
                <p className="font-medium">{taxReturn.taxYear}</p>
              </div>
              <div>
                <p className="text-gray-600">Due Date</p>
                <p className="font-medium">{format(new Date(taxReturn.dueDate), 'dd MMM yyyy')}</p>
              </div>
              {taxReturn.profit && (
                <div>
                  <p className="text-gray-600">Profit</p>
                  <p className="font-medium">£{taxReturn.profit.toLocaleString()}</p>
                </div>
              )}
              <div>
                <p className="text-gray-600">Tax Due</p>
                <p className="font-medium">£{taxReturn.taxDue.toLocaleString()}</p>
              </div>
            </div>

            {taxReturn.submissionId && (
              <div className="mt-2 text-sm text-gray-600">
                <p>Submission ID: <span className="font-mono">{taxReturn.submissionId}</span></p>
                {taxReturn.submittedAt && (
                  <p>Submitted: {format(new Date(taxReturn.submittedAt), 'dd MMM yyyy HH:mm')}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedReturn(taxReturn)}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
            
            {taxReturn.status === 'draft' && (
              <Button 
                size="sm"
                onClick={() => handleSubmitReturn(taxReturn.id)}
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
            
            {(taxReturn.status === 'submitted' || taxReturn.status === 'accepted') && (
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tax Returns</h2>
        <p className="text-gray-600">Manage corporation tax and self-assessment returns</p>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="all">All Returns</TabsTrigger>
          <TabsTrigger value="corporation">Corporation Tax</TabsTrigger>
          <TabsTrigger value="self-assessment">Self Assessment</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertTitle>Digital Tax Returns</AlertTitle>
            <AlertDescription>
              All tax returns must be submitted digitally to HMRC. Ensure your records are accurate and 
              submissions are made before the deadline to avoid penalties.
            </AlertDescription>
          </Alert>

          {returns.map(renderReturnCard)}
        </TabsContent>

        <TabsContent value="corporation" className="space-y-4">
          <Alert>
            <Building className="h-4 w-4" />
            <AlertTitle>Corporation Tax</AlertTitle>
            <AlertDescription>
              Corporation tax returns must be filed within 12 months of the company's year-end. 
              Tax is usually due 9 months and 1 day after the end of the accounting period.
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{corporationReturns.length}</p>
                    <p className="text-sm text-gray-600">CT Returns</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      £{corporationReturns.reduce((acc, r) => acc + (r.profit || 0), 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">Total Profit</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      £{corporationReturns.reduce((acc, r) => acc + r.taxDue, 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">Tax Due</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {corporationReturns.map(renderReturnCard)}
        </TabsContent>

        <TabsContent value="self-assessment" className="space-y-4">
          <Alert>
            <User className="h-4 w-4" />
            <AlertTitle>Self Assessment</AlertTitle>
            <AlertDescription>
              Self Assessment tax returns must be filed by 31 January following the end of the tax year. 
              Online filing provides an automatic extension until midnight on 31 January.
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">{selfAssessmentReturns.length}</p>
                    <p className="text-sm text-gray-600">SA Returns</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-2xl font-bold">31 Jan</p>
                    <p className="text-sm text-gray-600">Deadline</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      £{selfAssessmentReturns.reduce((acc, r) => acc + r.taxDue, 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">Tax Due</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {selfAssessmentReturns.map(renderReturnCard)}
        </TabsContent>
      </Tabs>

      {/* Tax Return Detail Modal */}
      {selectedReturn && (
        <Card className="mt-6 border-2 border-blue-200">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                {getTypeIcon(selectedReturn.type)}
                {getTypeName(selectedReturn.type)} Details - {selectedReturn.taxYear}
              </CardTitle>
              <Button variant="outline" onClick={() => setSelectedReturn(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Return Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Tax Year:</span>
                    <span className="font-mono">{selectedReturn.taxYear}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Due Date:</span>
                    <span className="font-mono">{format(new Date(selectedReturn.dueDate), 'dd MMM yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <Badge className={`${getStatusColor(selectedReturn.status)} text-xs`}>
                      {selectedReturn.status}
                    </Badge>
                  </div>
                  {selectedReturn.submissionId && (
                    <div className="flex justify-between">
                      <span>Submission ID:</span>
                      <span className="font-mono">{selectedReturn.submissionId}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Financial Summary</h4>
                <div className="space-y-2 text-sm">
                  {selectedReturn.profit && (
                    <div className="flex justify-between">
                      <span>Profit for Tax Purposes:</span>
                      <span className="font-mono">£{selectedReturn.profit.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Tax Due:</span>
                    <span className="font-mono">£{selectedReturn.taxDue.toLocaleString()}</span>
                  </div>
                  {selectedReturn.type === 'corporation' && selectedReturn.profit && (
                    <div className="flex justify-between">
                      <span>Tax Rate:</span>
                      <span className="font-mono">{((selectedReturn.taxDue / selectedReturn.profit) * 100).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {selectedReturn.type === 'corporation' && (
              <Alert>
                <Building className="h-4 w-4" />
                <AlertTitle>Corporation Tax Information</AlertTitle>
                <AlertDescription>
                  Corporation tax is charged on company profits including trading profits, investment profits, 
                  and capital gains. The current main rate is 25% for profits over £250,000 (as of April 2023).
                </AlertDescription>
              </Alert>
            )}

            {selectedReturn.type === 'self-assessment' && (
              <Alert>
                <User className="h-4 w-4" />
                <AlertTitle>Self Assessment Information</AlertTitle>
                <AlertDescription>
                  Self Assessment covers income from self-employment, rental income, investment income, 
                  and other sources not taxed at source. Tax is calculated on your total income for the tax year.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HMRCTaxReturns;