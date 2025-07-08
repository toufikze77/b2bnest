import React, { useState } from 'react';
import { CreditCard, Download, Palette, Type, Image, Save, Zap, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BusinessCard {
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

const BusinessCardDesigner = () => {
  const [cards, setCards] = useState<BusinessCard[]>([]);
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
    template: 'modern',
    color: 'blue'
  });
  const { toast } = useToast();

  const templates = [
    { value: 'modern', label: 'Modern Minimal' },
    { value: 'classic', label: 'Classic Professional' },
    { value: 'creative', label: 'Creative Bold' },
    { value: 'elegant', label: 'Elegant Luxury' }
  ];

  const colorSchemes = [
    { value: 'blue', label: 'Professional Blue', bg: 'bg-blue-500' },
    { value: 'gray', label: 'Classic Gray', bg: 'bg-gray-500' },
    { value: 'green', label: 'Nature Green', bg: 'bg-green-500' },
    { value: 'purple', label: 'Creative Purple', bg: 'bg-purple-500' }
  ];

  const createCard = () => {
    if (!formData.name || !formData.company) {
      toast({
        title: "Missing Information",
        description: "Please fill in name and company at minimum.",
        variant: "destructive"
      });
      return;
    }

    // Free plan limitation: 3 business cards max
    if (cards.length >= 3) {
      toast({
        title: "Card Limit Reached",
        description: "Free plan allows up to 3 business cards. Upgrade for unlimited cards.",
        variant: "destructive"
      });
      return;
    }

    const card: BusinessCard = {
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

    setCards(prev => [card, ...prev]);
    setFormData({
      name: '',
      title: '',
      company: '',
      email: '',
      phone: '',
      website: '',
      address: '',
      logo: '',
      template: 'modern',
      color: 'blue'
    });

    toast({
      title: "Business Card Created",
      description: `Business card for ${card.name} has been designed.`
    });
  };

  const handleLogoUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 2MB)
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

      const { error: uploadError, data } = await supabase.storage
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

  const downloadCard = (card: BusinessCard) => {
    const cardData = `
BUSINESS CARD DESIGN
Generated on: ${card.createdAt.toLocaleDateString()}

${card.name}
${card.title}
${card.company}

Contact Information:
Email: ${card.email}
Phone: ${card.phone}
Website: ${card.website}
Address: ${card.address}

Design Details:
Template: ${card.template}
Color Scheme: ${card.color}

This is a text representation. For actual printing, please use professional design software or printing services.
    `.trim();

    const blob = new Blob([cardData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BusinessCard_${card.name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Card Downloaded",
      description: "Business card design has been downloaded."
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
        <h1 className="text-3xl font-bold mb-2">Business Card Designer</h1>
        <p className="text-gray-600">Create professional business cards with custom designs</p>
        <Badge variant="secondary" className="mt-2">
          Free Plan: 3 business cards maximum
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Designer Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Design Your Card
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
                <Label htmlFor="company">Company Name *</Label>
                <Input
                  id="company"
                  placeholder="Your Company"
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
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
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  placeholder="123 Business St, City, State 12345"
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
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
                  <div className="text-xs text-gray-500">
                    Upload an image file (PNG, JPG, etc.) up to 2MB
                  </div>
                  {formData.logo && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded border">
                      <Image className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-800">Logo uploaded successfully</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, logo: '' }))}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Template</Label>
                  <Select value={formData.template} onValueChange={(value) => setFormData(prev => ({ ...prev, template: value }))}>
                    <SelectTrigger>
                      <Type className="h-4 w-4 mr-2" />
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
                onClick={createCard} 
                className="w-full"
                disabled={cards.length >= 3 || logoUploading}
              >
                {logoUploading ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-spin" />
                    Uploading Logo...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {cards.length >= 3 ? 'Limit Reached' : 'Create Business Card'}
                  </>
                )}
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
            <div className="aspect-[1.75/1] max-w-sm mx-auto">
              <div className={`w-full h-full p-4 border-2 rounded-lg ${getColorClass(formData.color)}`}>
                <div className="h-full flex flex-col justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg leading-tight">{formData.name || 'Your Name'}</h3>
                      <p className="text-sm text-gray-600 mb-2">{formData.title || 'Job Title'}</p>
                      <p className="font-semibold">{formData.company || 'Company Name'}</p>
                    </div>
                    {formData.logo && (
                      <div className="w-12 h-12 border rounded overflow-hidden flex-shrink-0">
                        <img src={formData.logo} alt="Logo" className="w-full h-full object-contain" />
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs space-y-1">
                    {formData.email && <p>{formData.email}</p>}
                    {formData.phone && <p>{formData.phone}</p>}
                    {formData.website && <p>{formData.website}</p>}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 text-center">
              <Badge variant="outline" className="text-xs">
                {formData.template} • {formData.color}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Created Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Your Business Cards</CardTitle>
        </CardHeader>
        <CardContent>
          {cards.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No business cards created yet. Design your first card above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((card) => (
                <div key={card.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className={`aspect-[1.75/1] p-3 border-2 rounded-lg mb-3 ${getColorClass(card.color)}`}>
                    <div className="h-full flex flex-col justify-between text-xs">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <h4 className="font-bold">{card.name}</h4>
                          <p className="text-gray-600">{card.title}</p>
                          <p className="font-semibold">{card.company}</p>
                        </div>
                        {card.logo && (
                          <div className="w-8 h-8 border rounded overflow-hidden flex-shrink-0">
                            <img src={card.logo} alt="Logo" className="w-full h-full object-contain" />
                          </div>
                        )}
                      </div>
                      <div className="text-xs space-y-0.5">
                        {card.email && <p className="truncate">{card.email}</p>}
                        {card.phone && <p>{card.phone}</p>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      {card.createdAt.toLocaleDateString()}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadCard(card)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
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
              <h4 className="font-semibold text-blue-900 mb-1">Need Professional Business Cards?</h4>
              <p className="text-sm text-blue-700 mb-3">
                Upgrade to get unlimited cards, premium templates, high-resolution exports, and print-ready files.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Starter: Unlimited cards</Badge>
                <Badge variant="outline" className="text-xs">Pro: Premium templates</Badge>
                <Badge variant="outline" className="text-xs">Enterprise: Print services</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessCardDesigner;