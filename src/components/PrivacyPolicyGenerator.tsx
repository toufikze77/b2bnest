import React, { useState } from 'react';
import { Shield, Download, Globe, CheckCircle, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface PrivacyPolicy {
  id: string;
  companyName: string;
  website: string;
  email: string;
  features: string[];
  createdAt: Date;
}

const PrivacyPolicyGenerator = () => {
  const [policies, setPolicies] = useState<PrivacyPolicy[]>([]);
  const [formData, setFormData] = useState({
    companyName: '',
    website: '',
    email: '',
    features: [] as string[]
  });
  const { toast } = useToast();

  const featureOptions = [
    { id: 'cookies', label: 'Cookies & Tracking' },
    { id: 'analytics', label: 'Analytics (Google Analytics)' },
    { id: 'email', label: 'Email Collection' },
    { id: 'payments', label: 'Payment Processing' },
    { id: 'social', label: 'Social Media Integration' },
    { id: 'advertising', label: 'Third-party Advertising' },
    { id: 'contact', label: 'Contact Forms' },
    { id: 'newsletter', label: 'Newsletter Subscription' }
  ];

  const generatePolicy = () => {
    if (!formData.companyName || !formData.website || !formData.email) {
      toast({
        title: "Missing Information",
        description: "Please fill in company name, website, and email.",
        variant: "destructive"
      });
      return;
    }

    // Free plan limitation: 2 policies max
    if (policies.length >= 2) {
      toast({
        title: "Policy Limit Reached",
        description: "Free plan allows up to 2 privacy policies. Upgrade for unlimited policies.",
        variant: "destructive"
      });
      return;
    }

    const policy: PrivacyPolicy = {
      id: Date.now().toString(),
      companyName: formData.companyName,
      website: formData.website,
      email: formData.email,
      features: formData.features,
      createdAt: new Date()
    };

    setPolicies(prev => [policy, ...prev]);
    setFormData({
      companyName: '',
      website: '',
      email: '',
      features: []
    });

    toast({
      title: "Privacy Policy Generated",
      description: `Privacy policy for ${policy.companyName} has been created.`
    });
  };

  const downloadPolicy = (policy: PrivacyPolicy) => {
    const policyText = `
PRIVACY POLICY

Last updated: ${policy.createdAt.toLocaleDateString()}

1. COMPANY INFORMATION
Company: ${policy.companyName}
Website: ${policy.website}
Contact: ${policy.email}

2. INFORMATION WE COLLECT
We may collect information that you provide directly to us, such as when you:
- Create an account
- Contact us
- Subscribe to our newsletter
- Use our services

3. HOW WE USE INFORMATION
We use the information we collect to:
- Provide and maintain our services
- Process transactions
- Send you technical notices and support messages
- Communicate with you about products, services, and events

${policy.features.includes('cookies') ? `
4. COOKIES AND TRACKING
We use cookies and similar tracking technologies to collect and use personal information about you.
` : ''}

${policy.features.includes('analytics') ? `
5. ANALYTICS
We use Google Analytics to help analyze how users use our site. This tool uses cookies to collect standard internet log information and visitor behavior information in an anonymous form.
` : ''}

${policy.features.includes('email') ? `
6. EMAIL COMMUNICATIONS
We may use your email address to send you information about our services, updates, and promotional materials. You may opt out at any time.
` : ''}

${policy.features.includes('payments') ? `
7. PAYMENT PROCESSING
We use third-party payment processors to handle payments. We do not store credit card information on our servers.
` : ''}

8. DATA SECURITY
We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.

9. YOUR RIGHTS
You have the right to:
- Access your personal information
- Correct inaccurate information
- Request deletion of your information
- Object to processing of your information

10. CONTACT US
If you have any questions about this Privacy Policy, please contact us at ${policy.email}.

This privacy policy template is for general guidance only and should be reviewed by a legal professional before use.
    `.trim();

    const blob = new Blob([policyText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Privacy_Policy_${policy.companyName.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Policy Downloaded",
      description: "Privacy policy has been downloaded as a text file."
    });
  };

  const handleFeatureChange = (featureId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      features: checked 
        ? [...prev.features, featureId]
        : prev.features.filter(f => f !== featureId)
    }));
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy Generator</h1>
        <p className="text-gray-600">Generate GDPR-compliant privacy policies for your website</p>
        <Badge variant="secondary" className="mt-2">
          Free Plan: 2 policies maximum
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Policy Generator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Generate Privacy Policy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  placeholder="Your Company Name"
                  value={formData.companyName}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="website">Website URL</Label>
                <Input
                  id="website"
                  placeholder="https://yourwebsite.com"
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="email">Contact Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@yourcompany.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div>
                <Label>Website Features (select all that apply)</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {featureOptions.map((option) => (
                    <div key={option.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={option.id}
                        checked={formData.features.includes(option.id)}
                        onCheckedChange={(checked) => handleFeatureChange(option.id, checked as boolean)}
                      />
                      <Label htmlFor={option.id} className="text-sm">{option.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                onClick={generatePolicy} 
                className="w-full"
                disabled={policies.length >= 2}
              >
                <Shield className="h-4 w-4 mr-2" />
                {policies.length >= 2 ? 'Limit Reached' : 'Generate Privacy Policy'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Policy Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Policy Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {policies.length}/2
                </div>
                <p className="text-gray-600 text-sm">Policies Generated</p>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>GDPR Compliant</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Customizable Sections</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Professional Format</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Easy Download</span>
                </div>
              </div>

              <div className="text-center">
                <Badge variant="outline" className="text-xs">
                  {2 - policies.length} policies remaining
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Policies List */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Policies</CardTitle>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No privacy policies generated yet. Create your first policy above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className="p-4 border rounded-lg bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{policy.companyName}</h3>
                      <div className="text-sm text-gray-600">
                        {policy.website} • {policy.createdAt.toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadPolicy(policy)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">Contact Email</div>
                      <div className="font-semibold">{policy.email}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Features Included</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {policy.features.length > 0 ? (
                          policy.features.slice(0, 3).map((feature) => (
                            <Badge key={feature} variant="outline" className="text-xs">
                              {featureOptions.find(f => f.id === feature)?.label}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-gray-500">No features selected</span>
                        )}
                        {policy.features.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{policy.features.length - 3} more
                          </Badge>
                        )}
                      </div>
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
              <h4 className="font-semibold text-blue-900 mb-1">Need Advanced Legal Documents?</h4>
              <p className="text-sm text-blue-700 mb-3">
                Upgrade to get unlimited policies, terms of service, cookie policies, and legal compliance tools.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Starter: Unlimited policies</Badge>
                <Badge variant="outline" className="text-xs">Pro: Terms of service</Badge>
                <Badge variant="outline" className="text-xs">Enterprise: Legal review</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrivacyPolicyGenerator;