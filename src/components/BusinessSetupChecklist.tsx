
import React, { useState } from 'react';
import { CheckCircle, Circle, AlertCircle, Clock, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  timeEstimate: string;
  dependencies?: string[];
  resources?: string[];
}

const BusinessSetupChecklist = () => {
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const checklistItems: ChecklistItem[] = [
    {
      id: 'business-idea',
      title: 'Define Your Business Idea',
      description: 'Clearly articulate your business concept, target market, and value proposition',
      category: 'Planning',
      priority: 'high',
      timeEstimate: '1-2 weeks',
      resources: ['Business Plan Template', 'Market Research Guide']
    },
    {
      id: 'business-name',
      title: 'Choose Business Name',
      description: 'Select and verify availability of your business name',
      category: 'Legal',
      priority: 'high',
      timeEstimate: '1-3 days',
      resources: ['Name Availability Search', 'Trademark Search']
    },
    {
      id: 'business-structure',
      title: 'Select Business Structure',
      description: 'Choose between LLC, Corporation, Partnership, or Sole Proprietorship',
      category: 'Legal',
      priority: 'high',
      timeEstimate: '1 week',
      dependencies: ['business-idea'],
      resources: ['Business Structure Guide', 'Tax Implications Guide']
    },
    {
      id: 'register-business',
      title: 'Register Your Business',
      description: 'File necessary paperwork with state and local authorities',
      category: 'Legal',
      priority: 'high',
      timeEstimate: '1-2 weeks',
      dependencies: ['business-name', 'business-structure'],
      resources: ['Articles of Incorporation', 'Operating Agreement']
    },
    {
      id: 'ein-number',
      title: 'Get EIN Number',
      description: 'Apply for Employer Identification Number with IRS',
      category: 'Tax',
      priority: 'high',
      timeEstimate: '1 day',
      dependencies: ['register-business'],
      resources: ['EIN Application Form']
    },
    {
      id: 'business-license',
      title: 'Obtain Business Licenses',
      description: 'Get required federal, state, and local business licenses',
      category: 'Legal',
      priority: 'high',
      timeEstimate: '2-4 weeks',
      dependencies: ['register-business'],
      resources: ['License Requirements Guide']
    },
    {
      id: 'business-bank',
      title: 'Open Business Bank Account',
      description: 'Separate personal and business finances',
      category: 'Financial',
      priority: 'high',
      timeEstimate: '1 day',
      dependencies: ['ein-number'],
      resources: ['Bank Account Comparison', 'Required Documents List']
    },
    {
      id: 'accounting-system',
      title: 'Set Up Accounting System',
      description: 'Choose and implement bookkeeping and accounting software',
      category: 'Financial',
      priority: 'medium',
      timeEstimate: '1 week',
      dependencies: ['business-bank'],
      resources: ['Accounting Software Guide', 'Bookkeeping Templates']
    },
    {
      id: 'business-insurance',
      title: 'Get Business Insurance',
      description: 'Protect your business with appropriate insurance coverage',
      category: 'Insurance',
      priority: 'medium',
      timeEstimate: '1-2 weeks',
      dependencies: ['register-business'],
      resources: ['Insurance Requirements Guide', 'Insurance Comparison']
    },
    {
      id: 'website-domain',
      title: 'Secure Domain & Website',
      description: 'Register domain name and create business website',
      category: 'Marketing',
      priority: 'medium',
      timeEstimate: '2-3 weeks',
      dependencies: ['business-name'],
      resources: ['Domain Registration Guide', 'Website Templates']
    },
    {
      id: 'business-contracts',
      title: 'Create Business Contracts',
      description: 'Develop standard contracts for customers, vendors, and employees',
      category: 'Legal',
      priority: 'low',
      timeEstimate: '1-2 weeks',
      dependencies: ['register-business'],
      resources: ['Contract Templates', 'Legal Review Checklist']
    },
    {
      id: 'marketing-plan',
      title: 'Develop Marketing Plan',
      description: 'Create strategy for reaching and acquiring customers',
      category: 'Marketing',
      priority: 'medium',
      timeEstimate: '2-3 weeks',
      dependencies: ['business-idea'],
      resources: ['Marketing Plan Template', 'Customer Persona Worksheet']
    }
  ];

  const categories = ['all', 'Planning', 'Legal', 'Tax', 'Financial', 'Insurance', 'Marketing'];

  const toggleItem = (itemId: string) => {
    setCompletedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const filteredItems = selectedCategory === 'all' 
    ? checklistItems 
    : checklistItems.filter(item => item.category === selectedCategory);

  const progressPercentage = Math.round((completedItems.length / checklistItems.length) * 100);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const canComplete = (item: ChecklistItem) => {
    if (!item.dependencies) return true;
    return item.dependencies.every(dep => completedItems.includes(dep));
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Business Setup Checklist</h2>
        <p className="text-gray-600 mb-6">
          Follow this comprehensive checklist to ensure you don't miss any important steps when starting your business.
        </p>
        
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Overall Progress</h3>
                <p className="text-sm text-gray-600">
                  {completedItems.length} of {checklistItems.length} items completed
                </p>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {progressPercentage}%
              </div>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map(category => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="capitalize"
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const isCompleted = completedItems.includes(item.id);
          const isBlocked = !canComplete(item);
          
          return (
            <Card 
              key={item.id} 
              className={`cursor-pointer transition-all duration-200 ${
                isCompleted ? 'bg-green-50 border-green-200' : 
                isBlocked ? 'bg-gray-50 border-gray-200 opacity-60' : 
                'hover:shadow-md'
              }`}
              onClick={() => !isBlocked && toggleItem(item.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : isBlocked ? (
                      <AlertCircle className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-400" />
                    )}
                    <Badge className={getPriorityColor(item.priority)}>
                      {item.priority}
                    </Badge>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {item.category}
                  </Badge>
                </div>
                <CardTitle className={`text-lg ${isCompleted ? 'line-through text-gray-500' : ''}`}>
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-500">{item.timeEstimate}</span>
                </div>

                {item.dependencies && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Dependencies:</p>
                    <div className="flex flex-wrap gap-1">
                      {item.dependencies.map(dep => (
                        <Badge 
                          key={dep} 
                          variant="outline" 
                          className={`text-xs ${
                            completedItems.includes(dep) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {checklistItems.find(i => i.id === dep)?.title || dep}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {item.resources && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Resources:</p>
                    <div className="flex flex-wrap gap-1">
                      {item.resources.map((resource, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          {resource}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default BusinessSetupChecklist;
