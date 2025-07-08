import React, { useState } from 'react';
import { FileText, Download, User, Calendar, DollarSign, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Contract {
  id: string;
  type: string;
  clientName: string;
  amount: number;
  duration: string;
  description: string;
  createdAt: Date;
}

const ContractGenerator = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [formData, setFormData] = useState({
    type: '',
    clientName: '',
    amount: 0,
    duration: '',
    description: ''
  });
  const { toast } = useToast();

  const contractTypes = [
    'Service Agreement',
    'Freelance Contract',
    'Consulting Agreement',
    'Non-Disclosure Agreement',
    'Employment Contract',
    'Partnership Agreement'
  ];

  const generateContract = () => {
    if (!formData.type || !formData.clientName) {
      toast({
        title: "Missing Information",
        description: "Please fill in contract type and client name.",
        variant: "destructive"
      });
      return;
    }

    // Free plan limitation: 3 contracts max
    if (contracts.length >= 3) {
      toast({
        title: "Contract Limit Reached",
        description: "Free plan allows up to 3 contracts. Upgrade for unlimited contracts.",
        variant: "destructive"
      });
      return;
    }

    const contract: Contract = {
      id: Date.now().toString(),
      type: formData.type,
      clientName: formData.clientName,
      amount: formData.amount,
      duration: formData.duration,
      description: formData.description,
      createdAt: new Date()
    };

    setContracts(prev => [contract, ...prev]);
    setFormData({
      type: '',
      clientName: '',
      amount: 0,
      duration: '',
      description: ''
    });

    toast({
      title: "Contract Generated",
      description: `${contract.type} for ${contract.clientName} has been created.`
    });
  };

  const downloadContract = (contract: Contract) => {
    const contractText = `
CONTRACT AGREEMENT

Contract Type: ${contract.type}
Client: ${contract.clientName}
Amount: $${contract.amount}
Duration: ${contract.duration}
Date: ${contract.createdAt.toLocaleDateString()}

DESCRIPTION:
${contract.description}

TERMS AND CONDITIONS:
[Standard terms would be inserted here based on contract type]

This is a basic contract template. Please consult with a legal professional before using in business.
    `.trim();

    const blob = new Blob([contractText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contract.type.replace(/\s+/g, '_')}_${contract.clientName.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Contract Downloaded",
      description: "Contract has been downloaded as a text file."
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Contract Generator</h1>
        <p className="text-gray-600">Generate professional contracts and agreements</p>
        <Badge variant="secondary" className="mt-2">
          Free Plan: 3 contracts maximum
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Contract Generator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generate Contract
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="contract-type">Contract Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contract type" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="client-name">Client Name</Label>
                <Input
                  id="client-name"
                  placeholder="Enter client name"
                  value={formData.clientName}
                  onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Contract Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0"
                    value={formData.amount || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duration</Label>
                  <Input
                    id="duration"
                    placeholder="e.g., 6 months"
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Project Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of work to be performed..."
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <Button 
                onClick={generateContract} 
                className="w-full"
                disabled={contracts.length >= 3}
              >
                <FileText className="h-4 w-4 mr-2" />
                {contracts.length >= 3 ? 'Limit Reached' : 'Generate Contract'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contract Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Contract Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {contracts.length}/3
                </div>
                <p className="text-gray-600 text-sm">Contracts Generated</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm font-semibold text-gray-900">
                    ${contracts.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">Total Value</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm font-semibold text-gray-900">
                    {new Set(contracts.map(c => c.type)).size}
                  </div>
                  <div className="text-xs text-gray-600">Types Used</div>
                </div>
              </div>

              <div className="text-center">
                <Badge variant="outline" className="text-xs">
                  {3 - contracts.length} contracts remaining
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contracts List */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No contracts generated yet. Create your first contract above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {contracts.map((contract) => (
                <div
                  key={contract.id}
                  className="p-4 border rounded-lg bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{contract.type}</h3>
                      <div className="text-sm text-gray-600">
                        Client: {contract.clientName} • {contract.createdAt.toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadContract(contract)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">Amount</div>
                      <div className="font-semibold">${contract.amount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Duration</div>
                      <div className="font-semibold">{contract.duration || 'Not specified'}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Description</div>
                      <div className="font-semibold truncate">{contract.description || 'No description'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade CTA */}
      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Need More Advanced Contract Features?</h4>
              <p className="text-sm text-blue-700 mb-3">
                Upgrade to get unlimited contracts, legal templates, electronic signatures, and professional formatting.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Starter: Unlimited contracts</Badge>
                <Badge variant="outline" className="text-xs">Pro: Legal templates</Badge>
                <Badge variant="outline" className="text-xs">Enterprise: E-signatures</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContractGenerator;