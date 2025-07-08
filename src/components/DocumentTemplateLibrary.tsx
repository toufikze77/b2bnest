import React, { useState } from 'react';
import { FileText, Download, Search, Filter, Star, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface DocumentTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  isPremium: boolean;
  downloads: number;
  rating: number;
}

const DocumentTemplateLibrary = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [downloadCount, setDownloadCount] = useState(0);
  const { toast } = useToast();

  const templates: DocumentTemplate[] = [
    {
      id: '1',
      title: 'Business Plan Template',
      category: 'business',
      description: 'Comprehensive business plan template with financial projections',
      isPremium: false,
      downloads: 1250,
      rating: 4.8
    },
    {
      id: '2',
      title: 'Employee Handbook',
      category: 'hr',
      description: 'Complete employee handbook template with policies and procedures',
      isPremium: true,
      downloads: 890,
      rating: 4.9
    },
    {
      id: '3',
      title: 'Marketing Strategy Template',
      category: 'marketing',
      description: 'Strategic marketing plan template with campaign frameworks',
      isPremium: false,
      downloads: 670,
      rating: 4.6
    },
    {
      id: '4',
      title: 'Financial Forecast Spreadsheet',
      category: 'finance',
      description: '5-year financial projection template with automated calculations',
      isPremium: true,
      downloads: 445,
      rating: 4.7
    },
    {
      id: '5',
      title: 'Project Proposal Template',
      category: 'business',
      description: 'Professional project proposal template for client presentations',
      isPremium: false,
      downloads: 780,
      rating: 4.5
    },
    {
      id: '6',
      title: 'Legal Compliance Checklist',
      category: 'legal',
      description: 'Comprehensive compliance checklist for various industries',
      isPremium: true,
      downloads: 320,
      rating: 4.8
    },
    {
      id: '7',
      title: 'Vendor Agreement Template',
      category: 'legal',
      description: 'Standard vendor/supplier agreement template',
      isPremium: false,
      downloads: 560,
      rating: 4.4
    },
    {
      id: '8',
      title: 'Social Media Calendar',
      category: 'marketing',
      description: 'Monthly social media content planning template',
      isPremium: false,
      downloads: 920,
      rating: 4.7
    }
  ];

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'business', label: 'Business Planning' },
    { value: 'legal', label: 'Legal & Compliance' },
    { value: 'hr', label: 'Human Resources' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'finance', label: 'Finance & Accounting' }
  ];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const downloadTemplate = (template: DocumentTemplate) => {
    if (template.isPremium) {
      toast({
        title: "Premium Template",
        description: "This template requires a premium subscription. Upgrade to access all templates.",
        variant: "destructive"
      });
      return;
    }

    // Free plan limitation: 5 downloads per month
    if (downloadCount >= 5) {
      toast({
        title: "Download Limit Reached",
        description: "Free plan allows 5 downloads per month. Upgrade for unlimited downloads.",
        variant: "destructive"
      });
      return;
    }

    // Simulate download
    const content = `
${template.title.toUpperCase()}

${template.description}

This is a sample template document. The actual template would contain:
- Detailed sections and formatting
- Professional layout and design
- Customizable fields and content
- Industry best practices

Download Date: ${new Date().toLocaleDateString()}
Template ID: ${template.id}

This template is provided for business use. Please customize according to your specific needs.
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadCount(prev => prev + 1);
    toast({
      title: "Template Downloaded",
      description: `${template.title} has been downloaded successfully.`
    });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-3 w-3 ${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ));
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Document Template Library</h1>
        <p className="text-gray-600">Professional templates for all your business needs</p>
        <Badge variant="secondary" className="mt-2">
          Free Plan: 5 downloads per month ({5 - downloadCount} remaining)
        </Badge>
      </div>

      {/* Search and Filter */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="md:w-48">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between mb-2">
                <CardTitle className="text-lg line-clamp-2">{template.title}</CardTitle>
                {template.isPremium && (
                  <Badge variant="secondary" className="text-xs">Premium</Badge>
                )}
              </div>
              <p className="text-gray-600 text-sm line-clamp-3">{template.description}</p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="capitalize">{template.category.replace('-', ' ')}</span>
                  <span>{template.downloads} downloads</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex">{renderStars(template.rating)}</div>
                  <span className="text-sm text-gray-600">{template.rating}</span>
                </div>
              </div>

              <Button
                onClick={() => downloadTemplate(template)}
                className="w-full mt-4"
                variant={template.isPremium ? "outline" : "default"}
                disabled={!template.isPremium && downloadCount >= 5}
              >
                {template.isPremium ? (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Upgrade Required
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    {downloadCount >= 5 ? 'Limit Reached' : 'Download'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No templates found matching your criteria.</p>
          </CardContent>
        </Card>
      )}

      {/* Upgrade CTA */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Unlock Premium Templates</h4>
              <p className="text-sm text-blue-700 mb-3">
                Get unlimited downloads, premium templates, custom formatting, and priority support.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Starter: Unlimited downloads</Badge>
                <Badge variant="outline" className="text-xs">Pro: Premium templates</Badge>
                <Badge variant="outline" className="text-xs">Enterprise: Custom templates</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentTemplateLibrary;