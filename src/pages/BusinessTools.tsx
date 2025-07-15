import React, { useState, useEffect } from 'react';
import { Calculator, CheckSquare, Shield, Lightbulb, Zap, ArrowLeft, Building2, Home, FileText, KanbanSquare, Users, ListTodo, Sparkles, QrCode, Clock, TrendingUp, Target, BarChart, File, Globe, CreditCard, Layout, Mail, Megaphone, Quote, Receipt, Eye, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import CostCalculator from '@/components/CostCalculator';
import BusinessSetupChecklist from '@/components/BusinessSetupChecklist';
import ComplianceChecker from '@/components/ComplianceChecker';
import BestPracticesGuide from '@/components/BestPracticesGuide';
import IntegrationHub from '@/components/IntegrationHub';
import BusinessResources from '@/components/BusinessResources';
import ProjectManagement from '@/components/ProjectManagement';
import CRM from '@/components/CRM';
import TodoList from '@/components/TodoList';
import BusinessNameGenerator from '@/components/BusinessNameGenerator';
import QRCodeGenerator from '@/components/QRCodeGenerator';
import TimeTracker from '@/components/TimeTracker';
import CashFlowTracker from '@/components/CashFlowTracker';
import GoalTracker from '@/components/GoalTracker';
import ROICalculator from '@/components/ROICalculator';
import ContractGenerator from '@/components/ContractGenerator';
import PrivacyPolicyGenerator from '@/components/PrivacyPolicyGenerator';
import DocumentTemplateLibrary from '@/components/DocumentTemplateLibrary';
import BusinessCardDesigner from '@/components/BusinessCardDesigner';
import LandingPageBuilder from '@/components/LandingPageBuilder';
import EmailSignatureGenerator from '@/components/EmailSignatureGenerator';
import SocialMediaPostScheduler from '@/components/SocialMediaPostScheduler';
import CustomerSurveyBuilder from '@/components/CustomerSurveyBuilder';
import BusinessFinanceAssistant from '@/components/BusinessFinanceAssistant';
import { AdvertisementSection } from '@/components/AdvertisementSection';

type ToolType = 'overview' | 'cost-calculator' | 'setup-checklist' | 'compliance' | 'best-practices' | 'integrations' | 'business-resources' | 'project-management' | 'crm' | 'todo-list' | 'business-name-generator' | 'qr-code-generator' | 'time-tracker' | 'cash-flow-tracker' | 'goal-tracker' | 'roi-calculator' | 'contract-generator' | 'privacy-policy-generator' | 'document-templates' | 'business-card-designer' | 'landing-page-builder' | 'email-signature-generator' | 'social-media-scheduler' | 'customer-survey-builder' | 'business-finance-assistant' | 'premium-marketplace';

const BusinessTools = () => {
  const [currentTool, setCurrentTool] = useState<ToolType>('overview');
  const [filter, setFilter] = useState<'all' | 'free' | 'premium'>('all');
  const navigate = useNavigate();
  
  // Handle URL parameters and location state to set the current tool
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const toolParam = urlParams.get('tool') as ToolType;
    
    // Check for state from navigation
    const locationState = window.history.state?.usr;
    const selectedTool = locationState?.selectedTool;
    
    if (selectedTool) {
      setCurrentTool(selectedTool);
    } else if (toolParam) {
      setCurrentTool(toolParam);
    }
  }, []);

  const tools = [
    {
      id: 'premium-marketplace' as ToolType,
      title: 'Premium Marketplace',
      description: 'Exclusive advertising space for yearly subscribers to showcase services and products',
      icon: Megaphone,
      color: 'bg-gradient-to-r from-amber-500 to-amber-600',
      benefits: ['Yearly Subscriber Exclusive', 'Rich Content with Images', 'Contact Integration', 'Category Organization'],
      isPremium: true
    },
    {
      id: 'business-finance-assistant' as ToolType,
      title: 'Business Finance Assistant',
      description: 'Complete finance management with invoices, quotes, and financial tracking',
      icon: Calculator,
      color: 'bg-green-600',
      benefits: ['Invoice & Quote Generation', 'Financial Dashboard', 'Client Management', 'Revenue Tracking'],
      isPremium: true
    },
    {
      id: 'todo-list' as ToolType,
      title: 'To-Do List',
      description: 'Organize and track your tasks efficiently',
      icon: ListTodo,
      color: 'bg-green-600',
      benefits: ['Stay organized', 'Track progress', 'Boost productivity'],
      isPremium: false
    },
    {
      id: 'business-name-generator' as ToolType,
      title: 'Business Name Generator',
      description: 'Generate creative business names for your startup',
      icon: Sparkles,
      color: 'bg-purple-600',
      benefits: ['Creative suggestions', 'Domain availability', 'Industry-specific names'],
      isPremium: false
    },
    {
      id: 'qr-code-generator' as ToolType,
      title: 'QR Code Generator',
      description: 'Create QR codes for websites, contacts, and more',
      icon: QrCode,
      color: 'bg-gray-600',
      benefits: ['Multiple formats', 'Instant generation', 'Easy download'],
      isPremium: false
    },
    {
      id: 'time-tracker' as ToolType,
      title: 'Time Tracker',
      description: 'Track time spent on projects and tasks',
      icon: Clock,
      color: 'bg-emerald-600',
      benefits: ['Project tracking', 'Real-time timer', 'Activity summaries'],
      isPremium: false
    },
    {
      id: 'cash-flow-tracker' as ToolType,
      title: 'Cash Flow Tracker',
      description: 'Monitor your business income and expenses',
      icon: TrendingUp,
      color: 'bg-green-600',
      benefits: ['Income/expense tracking', 'Financial insights', 'Category analysis'],
      isPremium: false
    },
    {
      id: 'goal-tracker' as ToolType,
      title: 'Goal Tracker',
      description: 'Set and monitor your business milestones',
      icon: Target,
      color: 'bg-red-600',
      benefits: ['Milestone tracking', 'Progress monitoring', 'Achievement insights'],
      isPremium: false
    },
    {
      id: 'roi-calculator' as ToolType,
      title: 'ROI Calculator',
      description: 'Calculate return on investment for projects',
      icon: BarChart,
      color: 'bg-yellow-600',
      benefits: ['Investment analysis', 'Performance tracking', 'Decision support'],
      isPremium: false
    },
    {
      id: 'contract-generator' as ToolType,
      title: 'Contract Generator',
      description: 'Generate professional contracts and agreements',
      icon: FileText,
      color: 'bg-purple-700',
      benefits: ['Professional templates', 'Multiple contract types', 'Legal framework'],
      isPremium: false
    },
    {
      id: 'privacy-policy-generator' as ToolType,
      title: 'Privacy Policy Generator',
      description: 'Create GDPR-compliant privacy policies',
      icon: Shield,
      color: 'bg-green-700',
      benefits: ['GDPR compliant', 'Customizable sections', 'Legal protection'],
      isPremium: false
    },
    {
      id: 'document-templates' as ToolType,
      title: 'Document Template Library',
      description: 'Access professional business document templates',
      icon: File,
      color: 'bg-blue-700',
      benefits: ['Professional templates', 'Multiple categories', 'Ready to use'],
      isPremium: false
    },
    {
      id: 'business-card-designer' as ToolType,
      title: 'Business Card Designer',
      description: 'Create professional business cards with custom designs',
      icon: CreditCard,
      color: 'bg-pink-600',
      benefits: ['Professional designs', 'Custom templates', 'Print-ready format'],
      isPremium: false
    },
    {
      id: 'landing-page-builder' as ToolType,
      title: 'Landing Page Builder',
      description: 'Build responsive landing pages with drag-and-drop',
      icon: Layout,
      color: 'bg-indigo-600',
      benefits: ['Responsive design', 'Multiple templates', 'SEO optimized'],
      isPremium: false
    },
    {
      id: 'email-signature-generator' as ToolType,
      title: 'Email Signature Generator',
      description: 'Create professional email signatures for business communications',
      icon: Mail,
      color: 'bg-orange-600',
      benefits: ['Professional templates', 'HTML output', 'Brand consistency'],
      isPremium: false
    },
    {
      id: 'social-media-scheduler' as ToolType,
      title: 'Social Media Post Scheduler',
      description: 'Schedule and manage your social media posts across platforms',
      icon: Users,
      color: 'bg-cyan-600',
      benefits: ['Multi-platform support', 'Content planning', 'Scheduling tools'],
      isPremium: false
    },
    {
      id: 'customer-survey-builder' as ToolType,
      title: 'Customer Survey Builder',
      description: 'Create and manage customer feedback surveys',
      icon: BarChart,
      color: 'bg-violet-600',
      benefits: ['Custom questions', 'Response tracking', 'Analytics dashboard'],
      isPremium: false
    },
    {
      id: 'cost-calculator' as ToolType,
      title: 'Cost Calculator',
      description: 'Calculate setup costs for your business structure',
      icon: Calculator,
      color: 'bg-blue-500',
      benefits: ['Accurate cost estimates', 'Compare business structures', 'Plan your budget'],
      isPremium: true
    },
    {
      id: 'setup-checklist' as ToolType,
      title: 'Business Setup Checklist',
      description: 'Step-by-step guide to starting your business',
      icon: CheckSquare,
      color: 'bg-green-500',
      benefits: ['Never miss important steps', 'Track your progress', 'Organized workflow'],
      isPremium: true
    },
    {
      id: 'compliance' as ToolType,
      title: 'Compliance Checker',
      description: 'Ensure your business meets all requirements',
      icon: Shield,
      color: 'bg-red-500',
      benefits: ['Avoid penalties', 'Stay compliant', 'Industry-specific guidance'],
      isPremium: true
    },
    {
      id: 'best-practices' as ToolType,
      title: 'Best Practices Guide',
      description: 'Learn proven strategies for business success',
      icon: Lightbulb,
      color: 'bg-yellow-500',
      benefits: ['Expert insights', 'Avoid common mistakes', 'Accelerate growth'],
      isPremium: true
    },
    {
      id: 'integrations' as ToolType,
      title: 'Integration Hub',
      description: 'Connect with Google Workspace, Slack, DocuSign & more',
      icon: Zap,
      color: 'bg-purple-500',
      benefits: ['Streamline workflows', 'Automate processes', 'Boost productivity'],
      isPremium: true
    },
    {
      id: 'business-resources' as ToolType,
      title: 'Business Resources',
      description: 'Trusted referrals for banking, accounting, and business services',
      icon: Building2,
      color: 'bg-orange-500',
      benefits: ['Vetted service providers', 'Compare options', 'Get recommendations'],
      isPremium: true
    },
    {
      id: 'project-management' as ToolType,
      title: 'Project Management',
      description: 'Organize tasks, track progress, and collaborate with your team',
      icon: KanbanSquare,
      color: 'bg-teal-500',
      benefits: ['Kanban & List views', 'Task assignments', 'Progress tracking', 'Team collaboration'],
      isPremium: true
    },
    {
      id: 'crm' as ToolType,
      title: 'Customer Relationship Management',
      description: 'Manage leads, contacts, and sales pipeline efficiently',
      icon: Users,
      color: 'bg-pink-500',
      benefits: ['Contact management', 'Sales pipeline', 'Lead tracking', 'Revenue forecasting'],
      isPremium: true
    }
  ];

  const filteredTools = tools.filter(tool => {
    if (filter === 'free') return !tool.isPremium;
    if (filter === 'premium') return tool.isPremium;
    return true;
  });

  const renderTool = () => {
    switch (currentTool) {
      case 'premium-marketplace':
        return <AdvertisementSection />;
      case 'business-finance-assistant':
        return <BusinessFinanceAssistant />;
      case 'todo-list':
        return <TodoList />;
      case 'business-name-generator':
        return <BusinessNameGenerator />;
      case 'qr-code-generator':
        return <QRCodeGenerator />;
      case 'time-tracker':
        return <TimeTracker />;
      case 'cash-flow-tracker':
        return <CashFlowTracker />;
      case 'goal-tracker':
        return <GoalTracker />;
      case 'roi-calculator':
        return <ROICalculator />;
      case 'contract-generator':
        return <ContractGenerator />;
      case 'privacy-policy-generator':
        return <PrivacyPolicyGenerator />;
      case 'document-templates':
        return <DocumentTemplateLibrary />;
      case 'business-card-designer':
        return <BusinessCardDesigner />;
      case 'landing-page-builder':
        return <LandingPageBuilder />;
      case 'email-signature-generator':
        return <EmailSignatureGenerator />;
      case 'social-media-scheduler':
        return <SocialMediaPostScheduler />;
      case 'customer-survey-builder':
        return <CustomerSurveyBuilder />;
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
              
              <div className="flex gap-2 mt-4">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All Tools ({tools.length})
                </Button>
                <Button
                  variant={filter === 'free' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('free')}
                >
                  Free Tools ({tools.filter(t => !t.isPremium).length})
                </Button>
                <Button
                  variant={filter === 'premium' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('premium')}
                >
                  Premium Tools ({tools.filter(t => t.isPremium).length})
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTools.map((tool) => {
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
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-xl">{tool.title}</CardTitle>
                            {tool.isPremium && (
                              <Badge variant="secondary" className="text-xs">Premium</Badge>
                            )}
                          </div>
                        </div>
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

            {/* Quick Access to Quotes & Invoices */}
            <div className="mt-12 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Quotes & Invoices</h2>
                  <p className="text-gray-600">Quick access to view and manage your business documents</p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-2"
                    variant="outline"
                  >
                    <Eye className="h-4 w-4" />
                    View All Documents
                  </Button>
                  <Button
                    onClick={() => setCurrentTool('business-finance-assistant')}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Create New
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/dashboard')}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Quote className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">Manage Quotes</h3>
                        <p className="text-sm text-gray-600">View, download, and send your quotes</p>
                      </div>
                      <Download className="h-4 w-4 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/dashboard')}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-lg">
                        <Receipt className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">Manage Invoices</h3>
                        <p className="text-sm text-gray-600">View, download, and send your invoices</p>
                      </div>
                      <Download className="h-4 w-4 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>
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
