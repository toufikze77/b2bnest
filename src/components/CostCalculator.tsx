
import React, { useState } from 'react';
import { Calculator, DollarSign, FileText, Users, Building } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface CostItem {
  name: string;
  cost: number;
  required: boolean;
  category: string;
}

const CostCalculator = () => {
  const [businessType, setBusinessType] = useState('');
  const [businessSize, setBusinessSize] = useState('');
  const [state, setState] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const businessCosts: Record<string, CostItem[]> = {
    llc: [
      { name: 'State Filing Fee', cost: 150, required: true, category: 'Legal' },
      { name: 'Registered Agent Service', cost: 100, required: true, category: 'Legal' },
      { name: 'Operating Agreement', cost: 200, required: false, category: 'Legal' },
      { name: 'EIN Application', cost: 0, required: true, category: 'Tax' },
      { name: 'Business License', cost: 75, required: true, category: 'Legal' },
      { name: 'Professional Liability Insurance', cost: 500, required: false, category: 'Insurance' },
    ],
    corporation: [
      { name: 'State Filing Fee', cost: 300, required: true, category: 'Legal' },
      { name: 'Registered Agent Service', cost: 150, required: true, category: 'Legal' },
      { name: 'Corporate Bylaws', cost: 300, required: true, category: 'Legal' },
      { name: 'Stock Certificates', cost: 100, required: true, category: 'Legal' },
      { name: 'Board Resolutions', cost: 150, required: true, category: 'Legal' },
      { name: 'Directors & Officers Insurance', cost: 1200, required: false, category: 'Insurance' },
    ],
    partnership: [
      { name: 'Partnership Agreement', cost: 250, required: true, category: 'Legal' },
      { name: 'Business License', cost: 75, required: true, category: 'Legal' },
      { name: 'EIN Application', cost: 0, required: true, category: 'Tax' },
      { name: 'Partnership Insurance', cost: 400, required: false, category: 'Insurance' },
    ],
    soleprop: [
      { name: 'Business License', cost: 50, required: true, category: 'Legal' },
      { name: 'DBA Filing', cost: 40, required: false, category: 'Legal' },
      { name: 'Business Insurance', cost: 300, required: false, category: 'Insurance' },
    ]
  };

  const handleItemToggle = (itemName: string) => {
    setSelectedItems(prev => 
      prev.includes(itemName)
        ? prev.filter(item => item !== itemName)
        : [...prev, itemName]
    );
  };

  const calculateTotal = () => {
    if (!businessType) return 0;
    
    const costs = businessCosts[businessType] || [];
    const requiredCosts = costs.filter(item => item.required).reduce((sum, item) => sum + item.cost, 0);
    const optionalCosts = costs
      .filter(item => !item.required && selectedItems.includes(item.name))
      .reduce((sum, item) => sum + item.cost, 0);
    
    return requiredCosts + optionalCosts;
  };

  const getRequiredCosts = () => {
    if (!businessType) return [];
    return businessCosts[businessType]?.filter(item => item.required) || [];
  };

  const getOptionalCosts = () => {
    if (!businessType) return [];
    return businessCosts[businessType]?.filter(item => !item.required) || [];
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Business Setup Cost Calculator</h2>
        </div>
        <p className="text-gray-600">
          Calculate the estimated costs for setting up your business structure and getting all necessary documents.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Business Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="business-type">Business Type</Label>
              <Select value={businessType} onValueChange={setBusinessType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llc">Limited Liability Company (LLC)</SelectItem>
                  <SelectItem value="corporation">Corporation</SelectItem>
                  <SelectItem value="partnership">Partnership</SelectItem>
                  <SelectItem value="soleprop">Sole Proprietorship</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="business-size">Business Size</Label>
              <Select value={businessSize} onValueChange={setBusinessSize}>
                <SelectTrigger>
                  <SelectValue placeholder="Select business size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solo">Solo Entrepreneur</SelectItem>
                  <SelectItem value="small">Small Team (2-10)</SelectItem>
                  <SelectItem value="medium">Medium Business (11-50)</SelectItem>
                  <SelectItem value="large">Large Business (50+)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="state">State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ca">California</SelectItem>
                  <SelectItem value="ny">New York</SelectItem>
                  <SelectItem value="tx">Texas</SelectItem>
                  <SelectItem value="fl">Florida</SelectItem>
                  <SelectItem value="other">Other State</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  ${calculateTotal().toLocaleString()}
                </div>
                <div className="text-sm text-blue-600">Total Estimated Cost</div>
              </div>
              
              {businessType && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Required Costs:</span>
                    <span className="font-semibold">
                      ${getRequiredCosts().reduce((sum, item) => sum + item.cost, 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Optional Costs:</span>
                    <span className="font-semibold">
                      ${getOptionalCosts()
                        .filter(item => selectedItems.includes(item.name))
                        .reduce((sum, item) => sum + item.cost, 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {businessType && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Required Documents & Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getRequiredCosts().map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <Badge variant="destructive" className="mt-1">Required</Badge>
                    </div>
                    <div className="font-bold text-red-600">
                      {item.cost === 0 ? 'Free' : `$${item.cost}`}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Optional Add-ons</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getOptionalCosts().map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.name)}
                        onChange={() => handleItemToggle(item.name)}
                        className="rounded"
                      />
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <Badge variant="outline" className="mt-1">{item.category}</Badge>
                      </div>
                    </div>
                    <div className="font-bold text-gray-600">
                      ${item.cost}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CostCalculator;
