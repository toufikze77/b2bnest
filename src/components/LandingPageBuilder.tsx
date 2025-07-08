import React, { useState } from 'react';
import { Globe, Eye, Download, Palette, Layout, Settings, Zap, Upload, Image } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface LandingPage {
  id: string;
  title: string;
  description: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  logo: string;
  template: string;
  color: string;
  createdAt: Date;
}

const LandingPageBuilder = () => {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [logoUploading, setLogoUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    headline: '',
    subheadline: '',
    ctaText: '',
    ctaUrl: '',
    logo: '',
    template: 'startup',
    color: 'blue'
  });
  const { toast } = useToast();

  const templates = [
    { value: 'startup', label: 'Startup Launch' },
    { value: 'saas', label: 'SaaS Product' },
    { value: 'ecommerce', label: 'E-commerce Store' },
    { value: 'agency', label: 'Service Agency' },
    { value: 'portfolio', label: 'Portfolio/Personal' }
  ];

  const colorThemes = [
    { value: 'blue', label: 'Professional Blue', primary: 'text-blue-600', bg: 'bg-blue-50' },
    { value: 'purple', label: 'Creative Purple', primary: 'text-purple-600', bg: 'bg-purple-50' },
    { value: 'green', label: 'Growth Green', primary: 'text-green-600', bg: 'bg-green-50' },
    { value: 'orange', label: 'Energy Orange', primary: 'text-orange-600', bg: 'bg-orange-50' }
  ];

  const createPage = () => {
    if (!formData.title || !formData.headline) {
      toast({
        title: "Missing Information",
        description: "Please fill in page title and headline at minimum.",
        variant: "destructive"
      });
      return;
    }

    // Free plan limitation: 2 landing pages max
    if (pages.length >= 2) {
      toast({
        title: "Page Limit Reached",
        description: "Free plan allows up to 2 landing pages. Upgrade for unlimited pages.",
        variant: "destructive"
      });
      return;
    }

    const page: LandingPage = {
      id: Date.now().toString(),
      title: formData.title,
      description: formData.description,
      headline: formData.headline,
      subheadline: formData.subheadline,
      ctaText: formData.ctaText || 'Get Started',
      ctaUrl: formData.ctaUrl,
      logo: formData.logo,
      template: formData.template,
      color: formData.color,
      createdAt: new Date()
    };

    setPages(prev => [page, ...prev]);
    setFormData({
      title: '',
      description: '',
      headline: '',
      subheadline: '',
      ctaText: '',
      ctaUrl: '',
      logo: '',
      template: 'startup',
      color: 'blue'
    });

    toast({
      title: "Landing Page Created",
      description: `Landing page "${page.title}" has been built.`
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

  const exportPage = (page: LandingPage) => {
    const theme = colorThemes.find(t => t.value === page.color);
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${page.title}</title>
    <meta name="description" content="${page.description}">
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                    ${page.logo ? `<img src="${page.logo}" alt="Logo" class="h-8 w-auto" />` : ''}
                    <div class="text-2xl font-bold ${theme?.primary || 'text-blue-600'}">${page.title}</div>
                </div>
                <nav class="hidden md:flex space-x-8">
                    <a href="#features" class="text-gray-600 hover:text-gray-900">Features</a>
                    <a href="#pricing" class="text-gray-600 hover:text-gray-900">Pricing</a>
                    <a href="#contact" class="text-gray-600 hover:text-gray-900">Contact</a>
                </nav>
            </div>
        </div>
    </header>

    <!-- Hero Section -->
    <section class="py-20 ${theme?.bg || 'bg-blue-50'}">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 class="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                ${page.headline}
            </h1>
            <p class="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                ${page.subheadline}
            </p>
            <a href="${page.ctaUrl || '#'}" class="inline-block bg-${page.color}-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-${page.color}-700 transition-colors">
                ${page.ctaText}
            </a>
        </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="py-20 bg-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 class="text-3xl font-bold text-center mb-12">Features</h2>
            <div class="grid md:grid-cols-3 gap-8">
                <div class="text-center">
                    <div class="bg-${page.color}-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="text-2xl">🚀</span>
                    </div>
                    <h3 class="text-xl font-semibold mb-2">Fast & Reliable</h3>
                    <p class="text-gray-600">Built for speed and performance.</p>
                </div>
                <div class="text-center">
                    <div class="bg-${page.color}-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="text-2xl">🎯</span>
                    </div>
                    <h3 class="text-xl font-semibold mb-2">Easy to Use</h3>
                    <p class="text-gray-600">Intuitive interface for everyone.</p>
                </div>
                <div class="text-center">
                    <div class="bg-${page.color}-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="text-2xl">💎</span>
                    </div>
                    <h3 class="text-xl font-semibold mb-2">Premium Quality</h3>
                    <p class="text-gray-600">High-quality results every time.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="bg-gray-900 text-white py-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div class="text-2xl font-bold mb-4">${page.title}</div>
            <p class="text-gray-400 mb-8">${page.description}</p>
            <p class="text-gray-500">© ${new Date().getFullYear()} ${page.title}. All rights reserved.</p>
        </div>
    </footer>
</body>
</html>
    `.trim();

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${page.title.replace(/\s+/g, '_')}_landing_page.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Page Exported",
      description: "Landing page HTML has been downloaded."
    });
  };

  const getThemeClasses = (color: string) => {
    const themes: { [key: string]: any } = {
      blue: { primary: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
      purple: { primary: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
      green: { primary: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
      orange: { primary: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' }
    };
    return themes[color] || themes.blue;
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Landing Page Builder</h1>
        <p className="text-gray-600">Create professional landing pages with responsive designs</p>
        <Badge variant="secondary" className="mt-2">
          Free Plan: 2 landing pages maximum
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Builder Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Build Your Landing Page
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="page-title">Page Title *</Label>
                <Input
                  id="page-title"
                  placeholder="My Awesome Product"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="description">Meta Description</Label>
                <Input
                  id="description"
                  placeholder="Brief description for SEO"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="headline">Main Headline *</Label>
                <Input
                  id="headline"
                  placeholder="Transform Your Business Today"
                  value={formData.headline}
                  onChange={(e) => setFormData(prev => ({ ...prev, headline: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="subheadline">Sub-headline</Label>
                <Textarea
                  id="subheadline"
                  placeholder="Supporting text that explains your value proposition..."
                  rows={3}
                  value={formData.subheadline}
                  onChange={(e) => setFormData(prev => ({ ...prev, subheadline: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cta-text">Call-to-Action Text</Label>
                  <Input
                    id="cta-text"
                    placeholder="Get Started"
                    value={formData.ctaText}
                    onChange={(e) => setFormData(prev => ({ ...prev, ctaText: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="cta-url">CTA URL</Label>
                  <Input
                    id="cta-url"
                    placeholder="https://signup.example.com"
                    value={formData.ctaUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, ctaUrl: e.target.value }))}
                  />
                </div>
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
                      <Layout className="h-4 w-4 mr-2" />
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
                  <Label>Color Theme</Label>
                  <Select value={formData.color} onValueChange={(value) => setFormData(prev => ({ ...prev, color: value }))}>
                    <SelectTrigger>
                      <Palette className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {colorThemes.map((theme) => (
                        <SelectItem key={theme.value} value={theme.value}>
                          {theme.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={createPage} 
                className="w-full"
                disabled={pages.length >= 2 || logoUploading}
              >
                {logoUploading ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-spin" />
                    Uploading Logo...
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4 mr-2" />
                    {pages.length >= 2 ? 'Limit Reached' : 'Create Landing Page'}
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
            <div className="border rounded-lg bg-white overflow-hidden">
              <div className={`p-4 border-b ${getThemeClasses(formData.color).bg}`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {formData.logo && (
                      <div className="w-6 h-6 border rounded overflow-hidden">
                        <img src={formData.logo} alt="Logo" className="w-full h-full object-contain" />
                      </div>
                    )}
                    <div className={`text-lg font-bold ${getThemeClasses(formData.color).primary}`}>
                      {formData.title || 'Page Title'}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">Navigation</div>
                </div>
              </div>
              
              <div className={`p-6 text-center ${getThemeClasses(formData.color).bg}`}>
                <h2 className="text-2xl font-bold mb-3 text-gray-900">
                  {formData.headline || 'Your Main Headline'}
                </h2>
                <p className="text-gray-600 mb-4 text-sm">
                  {formData.subheadline || 'Supporting text goes here...'}
                </p>
                <div className={`inline-block px-4 py-2 rounded text-white text-sm bg-${formData.color}-600`}>
                  {formData.ctaText || 'Get Started'}
                </div>
              </div>
              
              <div className="p-4 bg-gray-50">
                <div className="text-xs text-gray-500 text-center">Features • Content • Footer</div>
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

      {/* Created Pages */}
      <Card>
        <CardHeader>
          <CardTitle>Your Landing Pages</CardTitle>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No landing pages created yet. Build your first page above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className={`p-4 border rounded-lg ${getThemeClasses(page.color).bg} ${getThemeClasses(page.color).border}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{page.title}</h3>
                      <div className="text-sm text-gray-600">
                        {page.template} • {page.createdAt.toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportPage(page)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export HTML
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm space-y-2">
                    <div>
                      <span className="font-medium">Headline:</span> {page.headline}
                    </div>
                    {page.subheadline && (
                      <div>
                        <span className="font-medium">Sub-headline:</span> {page.subheadline.substring(0, 100)}...
                      </div>
                    )}
                    <div>
                      <span className="font-medium">CTA:</span> {page.ctaText}
                      {page.ctaUrl && <span className="text-gray-500"> → {page.ctaUrl}</span>}
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
              <h4 className="font-semibold text-blue-900 mb-1">Need Advanced Landing Pages?</h4>
              <p className="text-sm text-blue-700 mb-3">
                Upgrade to get unlimited pages, premium templates, custom domains, analytics, and A/B testing.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Starter: Unlimited pages</Badge>
                <Badge variant="outline" className="text-xs">Pro: Custom domains</Badge>
                <Badge variant="outline" className="text-xs">Enterprise: A/B testing</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LandingPageBuilder;