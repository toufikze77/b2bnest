import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  FileText, 
  Plus, 
  Calendar, 
  Calculator, 
  CheckCircle, 
  AlertTriangle,
  Download,
  Upload,
  Eye,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type VATReturn = {
  id: string;
  period: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  status: 'draft' | 'submitted' | 'overdue';
  vatDue: number;
  vatReclaimed: number;
  netVat: number;
  totalSales: number;
  totalPurchases: number;
  submissionId?: string;
  submittedAt?: string;
};

const HMRCVATReturns = () => {
  const { toast } = useToast();
  const [returns, setReturns] = useState<VATReturn[]>([
    {
      id: '1',
      period: 'Q4 2024',
      startDate: '2024-10-01',
      endDate: '2024-12-31',
      dueDate: '2025-02-07',
      status: 'draft',
      vatDue: 4250.00,
      vatReclaimed: 850.00,
      netVat: 3400.00,
      totalSales: 25000.00,
      totalPurchases: 5000.00
    },
    {
      id: '2',
      period: 'Q3 2024',
      startDate: '2024-07-01',
      endDate: '2024-09-30',
      dueDate: '2024-11-07',
      status: 'submitted',
      vatDue: 3800.00,
      vatReclaimed: 950.00,
      netVat: 2850.00,
      totalSales: 22000.00,
      totalPurchases: 5500.00,
      submissionId: 'VAT-SUB-789012',
      submittedAt: '2024-10-15T10:30:00Z'
    }
  ]);

  const [selectedReturn, setSelectedReturn] = useState<VATReturn | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewReturnForm, setShowNewReturnForm] = useState(false);

  const handleSubmitReturn = async (returnId: string) => {
    setIsSubmitting(true);
    
    try {
      // Simulate API call to HMRC
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const submissionId = `VAT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      
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
      
      toast({
        title: "VAT Return Submitted",
        description: `Successfully submitted to HMRC. Reference: ${submissionId}`,
      });
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "Failed to submit VAT return. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: VATReturn['status']) => {
    switch (status) {
      case 'submitted': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusIcon = (status: VATReturn['status']) => {
    switch (status) {
      case 'submitted': return <CheckCircle className="h-4 w-4" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">VAT Returns</h2>
          <p className="text-gray-600">Manage VAT returns and submissions to HMRC</p>
        </div>
        <Button onClick={() => setShowNewReturnForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New VAT Return
        </Button>
      </div>

      {/* Making Tax Digital Alert */}
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertTitle>Making Tax Digital (MTD) Compliant</AlertTitle>
        <AlertDescription>
          All VAT returns are submitted digitally through HMRC's Making Tax Digital system. 
          Ensure your records are maintained digitally and submitted on time.
        </AlertDescription>
      </Alert>

      {/* VAT Returns List */}
      <div className="grid gap-4">
        {returns.map((vatReturn) => (
          <Card key={vatReturn.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{vatReturn.period}</h3>
                    <Badge className={getStatusColor(vatReturn.status)}>
                      {getStatusIcon(vatReturn.status)}
                      <span className="ml-1 capitalize">{vatReturn.status}</span>
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Period</p>
                      <p className="font-medium">
                        {format(new Date(vatReturn.startDate), 'dd MMM')} - {format(new Date(vatReturn.endDate), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Due Date</p>
                      <p className="font-medium">{format(new Date(vatReturn.dueDate), 'dd MMM yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Net VAT</p>
                      <p className="font-medium">£{vatReturn.netVat.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Sales</p>
                      <p className="font-medium">£{vatReturn.totalSales.toLocaleString()}</p>
                    </div>
                  </div>

                  {vatReturn.submissionId && (
                    <div className="mt-2 text-sm text-gray-600">
                      <p>Submission ID: <span className="font-mono">{vatReturn.submissionId}</span></p>
                      {vatReturn.submittedAt && (
                        <p>Submitted: {format(new Date(vatReturn.submittedAt), 'dd MMM yyyy HH:mm')}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedReturn(vatReturn)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                  
                  {vatReturn.status === 'draft' && (
                    <Button 
                      size="sm"
                      onClick={() => handleSubmitReturn(vatReturn.id)}
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
                  
                  {vatReturn.status === 'submitted' && (
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* VAT Return Detail Modal */}
      {selectedReturn && (
        <Card className="mt-6 border-2 border-blue-200">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>VAT Return Details - {selectedReturn.period}</CardTitle>
              <Button variant="outline" onClick={() => setSelectedReturn(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* VAT Calculation */}
              <div>
                <h4 className="font-semibold mb-3">VAT Calculation</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>VAT due on sales and other outputs</span>
                    <span className="font-mono">£{selectedReturn.vatDue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT reclaimed on purchases and other inputs</span>
                    <span className="font-mono">£{selectedReturn.vatReclaimed.toLocaleString()}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between font-semibold">
                    <span>Net VAT to be paid to HMRC</span>
                    <span className="font-mono">£{selectedReturn.netVat.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Sales and Purchases */}
              <div>
                <h4 className="font-semibold mb-3">Sales and Purchases</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total value of sales and all other outputs</span>
                    <span className="font-mono">£{selectedReturn.totalSales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total value of purchases and all other inputs</span>
                    <span className="font-mono">£{selectedReturn.totalPurchases.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {selectedReturn.status === 'draft' && (
              <div className="space-y-4">
                <h4 className="font-semibold">Edit VAT Return</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vatDue">VAT Due (£)</Label>
                    <Input 
                      id="vatDue" 
                      type="number" 
                      step="0.01"
                      value={selectedReturn.vatDue}
                      onChange={(e) => setSelectedReturn(prev => prev ? {
                        ...prev, 
                        vatDue: parseFloat(e.target.value) || 0
                      } : null)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="vatReclaimed">VAT Reclaimed (£)</Label>
                    <Input 
                      id="vatReclaimed" 
                      type="number" 
                      step="0.01"
                      value={selectedReturn.vatReclaimed}
                      onChange={(e) => setSelectedReturn(prev => prev ? {
                        ...prev, 
                        vatReclaimed: parseFloat(e.target.value) || 0
                      } : null)}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* New VAT Return Form */}
      {showNewReturnForm && (
        <Card className="mt-6 border-2 border-green-200">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Create New VAT Return</CardTitle>
              <Button variant="outline" onClick={() => setShowNewReturnForm(false)}>
                Cancel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input type="date" id="startDate" />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input type="date" id="endDate" />
                </div>
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input type="date" id="dueDate" />
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="newVatDue">VAT Due (£)</Label>
                  <Input type="number" step="0.01" id="newVatDue" placeholder="0.00" />
                </div>
                <div>
                  <Label htmlFor="newVatReclaimed">VAT Reclaimed (£)</Label>
                  <Input type="number" step="0.01" id="newVatReclaimed" placeholder="0.00" />
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="button" onClick={() => setShowNewReturnForm(false)} variant="outline">
                  Cancel
                </Button>
                <Button type="submit">
                  <Plus className="h-4 w-4 mr-2" />
                  Create VAT Return
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HMRCVATReturns;