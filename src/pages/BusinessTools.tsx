
import React, { useState } from 'react';
import { Calculator, CheckSquare, Shield, Lightbulb, Zap, ArrowLeft, Building2, Home, FileText, KanbanSquare, Users, ListTodo } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import CostCalculator from '@/components/CostCalculator';
import BusinessSetupChecklist from '@/components/BusinessSetupChecklist';
import ComplianceChecker from '@/components/ComplianceChecker';
import BestPracticesGuide from '@/components/BestPracticesGuide';
import IntegrationHub from '@/components/IntegrationHub';
import BusinessResources from '@/components/BusinessResources';
import QuoteInvoiceCreationSection from '@/components/QuoteInvoiceCreationSection';
import ProjectManagement from '@/components/ProjectManagement';
import CRM from '@/components/CRM';
import TodoList from '@/components/TodoList';

type ToolType = 'overview' | 'cost-calculator' | 'setup-checklist' | 'compliance' | 'best-practices' | 'integrations' | 'business-resources' | 'quote-invoice' | 'project-management' | 'crm' | 'todo-list';

const BusinessTools = () => {
  const [currentTool, setCurrentTool] = useState<ToolType>('overview');
  const navigate = useNavigate();

  const tools = [
    {
      id: 'todo-list' as ToolType,
      title: 'To-Do List',
      description: 'Organize and track your tasks efficiently',
      icon: ListTodo,
      color: 'bg-green-600',
      benefits: ['Stay organized', 'Track progress', 'Boost productivity']
    },
    {
      id: 'cost-calculator' as ToolType,
      title: 'Cost Calculator',
      description: 'Calculate setup costs for your business structure',
      icon: Calculator,
      color: 'bg-blue-500',
      benefits: ['Accurate cost estimates', 'Compare business structures', 'Plan your budget']
    },
    {
      id: 'setup-checklist' as ToolType,
      title: 'Business Setup Checklist',
      description: 'Step-by-step guide to starting your business',
      icon: CheckSquare,
      color: 'bg-green-500',
      benefits: ['Never miss important steps', 'Track your progress', 'Organized workflow']
    },
    {
      id: 'compliance' as ToolType,
      title: 'Compliance Checker',
      description: 'Ensure your business meets all requirements',
      icon: Shield,
      color: 'bg-red-500',
      benefits: ['Avoid penalties', 'Stay compliant', 'Industry-specific guidance']
    },
    {
      id: 'best-practices' as ToolType,
      title: 'Best Practices Guide',
      description: 'Learn proven strategies for business success',
      icon: Lightbulb,
      color: 'bg-yellow-500',
      benefits: ['Expert insights', 'Avoid common mistakes', 'Accelerate growth']
    },
    {
      id: 'integrations' as ToolType,
      title: 'Integration Hub',
      description: 'Connect with Google Workspace, Slack, DocuSign & more',
      icon: Zap,
      color: 'bg-purple-500',
      benefits: ['Streamline workflows', 'Automate processes', 'Boost productivity']
    },
    {
      id: 'business-resources' as ToolType,
      title: 'Business Resources',
      description: 'Trusted referrals for banking, accounting, and business services',
      icon: Building2,
      color: 'bg-orange-500',
      benefits: ['Vetted service providers', 'Compare options', 'Get recommendations']
    },
    {
      id: 'quote-invoice' as ToolType,
      title: 'Quote & Invoice System',
      description: 'Create professional quotes and invoices with auto-generated codes',
      icon: FileText,
      color: 'bg-indigo-500',
      benefits: ['Professional templates', 'Auto-generated codes', 'Track payments']
    },
    {
      id: 'project-management' as ToolType,
      title: 'Project Management',
      description: 'Organize tasks, track progress, and collaborate with your team',
      icon: KanbanSquare,
      color: 'bg-teal-500',
      benefits: ['Kanban & List views', 'Task assignments', 'Progress tracking', 'Team collaboration']
    },
    {
      id: 'crm' as ToolType,
      title: 'Customer Relationship Management',
      description: 'Manage leads, contacts, and sales pipeline efficiently',
      icon: Users,
      color: 'bg-pink-500',
      benefits: ['Contact management', 'Sales pipeline', 'Lead tracking', 'Revenue forecasting']
    }
  ];

  const renderTool = () => {
    switch (currentTool) {
      case 'todo-list':
        return <TodoList />;
      case 'cost-calculator':
        return <CostCalculator />;
      case 'setup-checklist':
        return <BusinessSetupChecklist />;
      case 'compliance':
        return <ComplianceChecker />;
      case 'best-practices':
        return <BestPracticesGuide />;
      case 'integrations':
        return <IntegrationHub />;
      case 'business-resources':
        return <BusinessResources />;
      case 'quote-invoice':
        return <QuoteInvoiceCreationSection />;
      case 'project-management':
        return <ProjectManagement />;
      case 'crm':
        return <CRM />;
      default:
        return (
          <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold">Business Tools</h1>
                <Button
                  variant="outline"
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go Back Home
                </Button>
              </div>
              <p className="text-gray-600 text-lg">
                Comprehensive tools to help you start, manage, and grow your business with confidence.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Card 
                    key={tool.id} 
                    className="cursor-pointer hover:shadow-lg transition-all duration-200 h-full"
                    onClick={() => setCurrentTool(tool.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${tool.color}`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <CardTitle className="text-xl">{tool.title}</CardTitle>
                      </div>
                      <p className="text-gray-600">{tool.description}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">Key Benefits:</p>
                        <ul className="space-y-1">
                          {tool.benefits.map((benefit, index) => (
                            <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                              {benefit}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Button className="w-full mt-4">
                        Get Started
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Why Use Our Business Tools?</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  <div className="text-center">
                    <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckSquare className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="font-semibold mb-2">Comprehensive</h3>
                    <p className="text-sm text-gray-600">All-in-one toolkit for every aspect of your business</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Lightbulb className="h-6 w-6 text-green-600" />
                    </div>
                    <h3 className="font-semibold mb-2">Expert-Driven</h3>
                    <p className="text-sm text-gray-600">Based on best practices from successful businesses</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Zap className="h-6 w-6 text-purple-600" />
                    </div>
                    <h3 className="font-semibold mb-2">Time-Saving</h3>
                    <p className="text-sm text-gray-600">Streamline your workflow and focus on what matters</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen">
      {currentTool !== 'overview' && (
        <div className="sticky top-0 z-10 bg-white border-b">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentTool('overview')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Tools
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go Back Home
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <div className="py-8">
        {renderTool()}
      </div>
    </div>
  );
};

export default BusinessTools;
