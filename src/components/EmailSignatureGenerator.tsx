import React, { useState } from 'react';
import { Mail, Download, Save, Image, Copy, Palette, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface EmailSignature {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  logo: string;
  template: string;
  color: string;
  createdAt: Date;
}

const EmailSignatureGenerator = () => {
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [logoUploading, setLogoUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    company: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    logo: '',
    template: 'professional',
    color: 'blue'
  });
  const { toast } = useToast();

  const templates = [
    { value: 'professional', label: 'Professional Clean' },
    { value: 'modern', label: 'Modern Minimal' },
    { value: 'creative', label: 'Creative Bold' },
    { value: 'corporate', label: 'Corporate Classic' }
  ];

  const colorSchemes = [
    { value: 'blue', label: 'Professional Blue', bg: 'bg-blue-500' },
    { value: 'gray', label: 'Classic Gray', bg: 'bg-gray-500' },
    { value: 'green', label: 'Nature Green', bg: 'bg-green-500' },
    { value: 'purple', label: 'Creative Purple', bg: 'bg-purple-500' }
  ];

  const createSignature = () => {
    if (!formData.name || !formData.email) {
      toast({
        title: "Missing Information",
        description: "Please fill in name and email at minimum.",
        variant: "destructive"
      });
      return;
    }

    // Free plan limitation: 5 email signatures max
    if (signatures.length >= 5) {
      toast({
        title: "Signature Limit Reached",
        description: "Free plan allows up to 5 email signatures. Upgrade for unlimited signatures.",
        variant: "destructive"
      });
      return;
    }

    const signature: EmailSignature = {
      id: Date.now().toString(),
      name: formData.name,
      title: formData.title,
      company: formData.company,
      email: formData.email,
      phone: formData.phone,
      website: formData.website,
      address: formData.address,
      logo: formData.logo,
      template: formData.template,
      color: formData.color,
      createdAt: new Date()
    };

    setSignatures(prev => [signature, ...prev]);
    setFormData({
      name: '',
      title: '',
      company: '',
      email: '',
      phone: '',
      website: '',
      address: '',
      logo: '',
      template: 'professional',
      color: 'blue'
    });

    toast({
      title: "Email Signature Created",
      description: `Email signature for ${signature.name} has been generated.`
    });
  };

  const handleLogoUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive"
      });
      return;
    }

    setLogoUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, logo: publicUrl }));

      toast({
        title: "Logo Uploaded",
        description: "Logo has been uploaded successfully"
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLogoUploading(false);
    }
  };

  const copySignature = (signature: EmailSignature) => {
    const signatureHTML = `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.4;">
  <table cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding-right: 15px; vertical-align: top;">
        ${signature.logo ? `<img src="${signature.logo}" alt="Logo" style="max-width: 80px; max-height: 60px;">` : ''}
      </td>
      <td style="border-left: 2px solid #${signature.color === 'blue' ? '3b82f6' : signature.color === 'green' ? '10b981' : signature.color === 'purple' ? '8b5cf6' : '6b7280'}; padding-left: 15px;">
        <div style="font-size: 18px; font-weight: bold; color: #${signature.color === 'blue' ? '1e40af' : signature.color === 'green' ? '047857' : signature.color === 'purple' ? '6d28d9' : '374151'};">
          ${signature.name}
        </div>
        ${signature.title ? `<div style="font-size: 14px; color: #666; margin: 2px 0;">${signature.title}</div>` : ''}
        ${signature.company ? `<div style="font-size: 14px; font-weight: 600; margin: 2px 0;">${signature.company}</div>` : ''}
        <div style="font-size: 12px; margin-top: 8px;">
          ${signature.email ? `<div>📧 ${signature.email}</div>` : ''}
          ${signature.phone ? `<div>📱 ${signature.phone}</div>` : ''}
          ${signature.website ? `<div>🌐 ${signature.website}</div>` : ''}
        </div>
      </td>
    </tr>
  </table>
</div>
    `.trim();

    navigator.clipboard.writeText(signatureHTML);
    toast({
      title: "Signature Copied",
      description: "HTML signature copied to clipboard. Paste it into your email client."
    });
  };

  const getColorClass = (color: string) => {
    const colors: { [key: string]: string } = {
      blue: 'border-blue-500 bg-blue-50',
      gray: 'border-gray-500 bg-gray-50',
      green: 'border-green-500 bg-green-50',
      purple: 'border-purple-500 bg-purple-50'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Email Signature Generator</h1>
        <p className="text-gray-600">Create professional email signatures for your business communications</p>
        <Badge variant="secondary" className="mt-2">
          Free Plan: 5 email signatures maximum
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Generator Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Design Your Signature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="title">Job Title</Label>
                  <Input
                    id="title"
                    placeholder="CEO"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="company">Company Name</Label>
                <Input
                  id="company"
                  placeholder="Your Company"
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  placeholder="www.company.com"
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="logo">Company Logo</Label>
                <div className="space-y-2">
                  <Input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                    disabled={logoUploading}
                  />
                  {formData.logo && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded border">
                      <Image className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-800">Logo uploaded successfully</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Template</Label>
                  <Select value={formData.template} onValueChange={(value) => setFormData(prev => ({ ...prev, template: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.value} value={template.value}>
                          {template.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Color Scheme</Label>
                  <Select value={formData.color} onValueChange={(value) => setFormData(prev => ({ ...prev, color: value }))}>
                    <SelectTrigger>
                      <Palette className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {colorSchemes.map((scheme) => (
                        <SelectItem key={scheme.value} value={scheme.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${scheme.bg}`}></div>
                            {scheme.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={createSignature} 
                className="w-full"
                disabled={signatures.length >= 5 || logoUploading}
              >
                <Save className="h-4 w-4 mr-2" />
                {signatures.length >= 5 ? 'Limit Reached' : 'Create Email Signature'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-4 bg-white min-h-32">
              <div className="flex items-start gap-3">
                {formData.logo && (
                  <div className="w-16 h-12 border rounded overflow-hidden flex-shrink-0">
                    <img src={formData.logo} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                )}
                <div className={`border-l-2 pl-3 flex-1 ${formData.color === 'blue' ? 'border-blue-500' : formData.color === 'green' ? 'border-green-500' : formData.color === 'purple' ? 'border-purple-500' : 'border-gray-500'}`}>
                  <div className={`text-lg font-bold ${formData.color === 'blue' ? 'text-blue-900' : formData.color === 'green' ? 'text-green-900' : formData.color === 'purple' ? 'text-purple-900' : 'text-gray-900'}`}>
                    {formData.name || 'Your Name'}
                  </div>
                  {formData.title && <div className="text-sm text-gray-600">{formData.title}</div>}
                  {formData.company && <div className="text-sm font-semibold">{formData.company}</div>}
                  <div className="text-xs mt-2 space-y-1">
                    {formData.email && <div>📧 {formData.email}</div>}
                    {formData.phone && <div>📱 {formData.phone}</div>}
                    {formData.website && <div>🌐 {formData.website}</div>}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Created Signatures */}
      <Card>
        <CardHeader>
          <CardTitle>Your Email Signatures</CardTitle>
        </CardHeader>
        <CardContent>
          {signatures.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No email signatures created yet. Design your first signature above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {signatures.map((signature) => (
                <div key={signature.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="border rounded-lg p-3 bg-white mb-3 min-h-24">
                    <div className="flex items-start gap-2">
                      {signature.logo && (
                        <div className="w-12 h-8 border rounded overflow-hidden flex-shrink-0">
                          <img src={signature.logo} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                      )}
                      <div className={`border-l-2 pl-2 flex-1 ${getColorClass(signature.color)}`}>
                        <div className="font-bold text-sm">{signature.name}</div>
                        {signature.title && <div className="text-xs text-gray-600">{signature.title}</div>}
                        {signature.company && <div className="text-xs font-semibold">{signature.company}</div>}
                        <div className="text-xs mt-1">
                          {signature.email && <div>📧 {signature.email}</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      {signature.createdAt.toLocaleDateString()}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copySignature(signature)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy HTML
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailSignatureGenerator;