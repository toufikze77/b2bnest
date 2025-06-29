
import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, FileText, Building, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ComplianceRequirement {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'important' | 'recommended';
  category: string;
  documents: string[];
  frequency: string;
  penalties?: string;
}

const ComplianceChecker = () => {
  const [businessType, setBusinessType] = useState('');
  const [industry, setIndustry] = useState('');
  const [state, setState] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');

  const complianceData: Record<string, ComplianceRequirement[]> = {
    'tech-startup': [
      {
        id: 'privacy-policy',
        title: 'Privacy Policy',
        description: 'Required if collecting personal data from users',
        severity: 'critical',
        category: 'Privacy',
        documents: ['Privacy Policy Template', 'GDPR Compliance Guide'],
        frequency: 'Annual Review',
        penalties: 'Up to $7,500 per violation'
      },
      {
        id: 'terms-of-service',
        title: 'Terms of Service',
        description: 'Essential for any user-facing platform or service',
        severity: 'critical',
        category: 'Legal',
        documents: ['Terms of Service Template', 'User Agreement'],
        frequency: 'As needed',
        penalties: 'Legal liability exposure'
      },
      {
        id: 'data-processing',
        title: 'Data Processing Agreement',
        description: 'Required when processing customer data',
        severity: 'important',
        category: 'Privacy',
        documents: ['DPA Template', 'Data Security Policy'],
        frequency: 'Per customer contract'
      },
      {
        id: 'software-licenses',
        title: 'Software License Compliance',
        description: 'Ensure all software licenses are properly maintained',
        severity: 'important',
        category: 'Intellectual Property',
        documents: ['License Inventory', 'Compliance Checklist'],
        frequency: 'Quarterly'
      }
    ],
    'restaurant': [
      {
        id: 'food-safety',
        title: 'Food Safety Certification',
        description: 'Required for all food service establishments',
        severity: 'critical',
        category: 'Health & Safety',
        documents: ['Food Handler Permits', 'HACCP Plan'],
        frequency: 'Annual',
        penalties: 'Business closure possible'
      },
      {
        id: 'liquor-license',
        title: 'Liquor License',
        description: 'Required if serving alcoholic beverages',
        severity: 'critical',
        category: 'Licensing',
        documents: ['Liquor License Application', 'Responsible Service Training'],
        frequency: 'Annual renewal',
        penalties: 'Up to $10,000 fine'
      },
      {
        id: 'employment-law',
        title: 'Employment Law Compliance',
        description: 'Wage and hour regulations for restaurant staff',
        severity: 'critical',
        category: 'Employment',
        documents: ['Employee Handbook', 'Wage Payment Notices'],
        frequency: 'Ongoing',
        penalties: 'Back wages + penalties'
      }
    ],
    'consulting': [
      {
        id: 'professional-liability',
        title: 'Professional Liability Insurance',
        description: 'Protection against claims of professional negligence',
        severity: 'critical',
        category: 'Insurance',
        documents: ['Insurance Policy', 'Claims Procedures'],
        frequency: 'Annual',
        penalties: 'Personal liability exposure'
      },
      {
        id: 'client-contracts',
        title: 'Client Service Agreements',
        description: 'Clear contracts defining scope and terms',
        severity: 'important',
        category: 'Legal',
        documents: ['Service Agreement Template', 'SOW Template'],
        frequency: 'Per engagement'
      },
      {
        id: 'tax-compliance',
        title: 'Tax Compliance',
        description: 'Quarterly tax filings and record keeping',
        severity: 'critical',
        category: 'Tax',
        documents: ['Quarterly Tax Forms', 'Expense Records'],
        frequency: 'Quarterly',
        penalties: 'IRS penalties and interest'
      }
    ]
  };

  const employeeRequirements: ComplianceRequirement[] = [
    {
      id: 'workers-comp',
      title: 'Workers\' Compensation',
      description: 'Required for businesses with employees',
      severity: 'critical',
      category: 'Insurance',
      documents: ['Workers Comp Policy', 'Injury Reporting Forms'],
      frequency: 'Annual',
      penalties: 'Up to $100,000 fine'
    },
    {
      id: 'employment-posters',
      title: 'Required Employment Posters',
      description: 'Display mandatory labor law posters',
      severity: 'important',
      category: 'Employment',
      documents: ['Federal Labor Posters', 'State Labor Posters'],
      frequency: 'As updated'
    },
    {
      id: 'i9-forms',
      title: 'I-9 Employment Verification',
      description: 'Verify employment eligibility for all employees',
      severity: 'critical',
      category: 'Employment',
      documents: ['I-9 Forms', 'E-Verify Documentation'],
      frequency: 'Per employee',
      penalties: 'Up to $16,000 per violation'
    }
  ];

  const getRequirements = () => {
    let requirements: ComplianceRequirement[] = [];
    
    if (industry && complianceData[industry]) {
      requirements = [...complianceData[industry]];
    }
    
    if (employeeCount && parseInt(employeeCount) > 0) {
      requirements = [...requirements, ...employeeRequirements];
    }
    
    return requirements;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'important': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'recommended': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'important': return <Shield className="h-4 w-4" />;
      case 'recommended': return <CheckCircle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const requirements = getRequirements();
  const criticalCount = requirements.filter(r => r.severity === 'critical').length;
  const importantCount = requirements.filter(r => r.severity === 'important').length;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Compliance Checker</h2>
        </div>
        <p className="text-gray-600">
          Get a personalized compliance checklist based on your business type and requirements.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium mb-2">Business Type</label>
          <Select value={businessType} onValueChange={setBusinessType}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="llc">LLC</SelectItem>
              <SelectItem value="corporation">Corporation</SelectItem>
              <SelectItem value="partnership">Partnership</SelectItem>
              <SelectItem value="sole-prop">Sole Proprietorship</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Industry</label>
          <Select value={industry} onValueChange={setIndustry}>
            <SelectTrigger>
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tech-startup">Technology/Software</SelectItem>
              <SelectItem value="restaurant">Restaurant/Food Service</SelectItem>
              <SelectItem value="consulting">Consulting Services</SelectItem>
              <SelectItem value="retail">Retail</SelectItem>
              <SelectItem value="healthcare">Healthcare</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">State</label>
          <Select value={state} onValueChange={setState}>
            <SelectTrigger>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ca">California</SelectItem>
              <SelectItem value="ny">New York</SelectItem>
              <SelectItem value="tx">Texas</SelectItem>
              <SelectItem value="fl">Florida</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Number of Employees</label>
          <Select value={employeeCount} onValueChange={setEmployeeCount}>
            <SelectTrigger>
              <SelectValue placeholder="Select count" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0 (Just me)</SelectItem>
              <SelectItem value="1-5">1-5</SelectItem>
              <SelectItem value="6-10">6-10</SelectItem>
              <SelectItem value="11-50">11-50</SelectItem>
              <SelectItem value="50+">50+</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {requirements.length > 0 && (
        <>
          <div className="mb-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Based on your business profile, you have <strong>{criticalCount} critical</strong> and{' '}
                <strong>{importantCount} important</strong> compliance requirements to address.
              </AlertDescription>
            </Alert>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {requirements.map((requirement) => (
              <Card key={requirement.id} className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(requirement.severity)}
                      <CardTitle className="text-lg">{requirement.title}</CardTitle>
                    </div>
                    <Badge className={getSeverityColor(requirement.severity)}>
                      {requirement.severity}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">{requirement.description}</p>
                  
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Category:</p>
                      <Badge variant="outline">{requirement.category}</Badge>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Frequency:</p>
                      <p className="text-sm text-gray-600">{requirement.frequency}</p>
                    </div>

                    {requirement.penalties && (
                      <div>
                        <p className="text-sm font-medium text-red-700 mb-1">Penalties:</p>
                        <p className="text-sm text-red-600">{requirement.penalties}</p>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Required Documents:</p>
                      <div className="flex flex-wrap gap-1">
                        {requirement.documents.map((doc, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            <FileText className="h-3 w-3 mr-1" />
                            {doc}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {requirements.length === 0 && (industry || businessType) && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No specific requirements found
              </h3>
              <p className="text-gray-600">
                Please select your business type, industry, and other details to see personalized compliance requirements.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ComplianceChecker;
