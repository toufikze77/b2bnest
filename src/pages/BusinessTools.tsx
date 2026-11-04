import React, { useState, useEffect } from 'react';
import { Calculator, CheckSquare, Shield, Lightbulb, Zap, Building2, FileText, KanbanSquare, Users, ListTodo, Sparkles, QrCode, Clock, TrendingUp, Target, BarChart, File, Globe, CreditCard, Layout, Mail, Megaphone, Quote, Receipt, Eye, Download, Star, Tag, Trophy, Link2, Calendar as CalIcon, Filter, ArrowRight, Flame, Zap as ZapIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { useFavoriteTools } from '@/hooks/useFavoriteTools';
import PageBackBar from '@/components/shell/PageBackBar';
import { authUrlWithNext } from '@/lib/onboarding';
import SubscriptionUpgrade from '@/components/SubscriptionUpgrade';
import CostCalculator from '@/components/CostCalculator';
import BusinessSetupChecklist from '@/components/BusinessSetupChecklist';
import ComplianceChecker from '@/components/ComplianceChecker';
import BestPracticesGuide from '@/components/BestPracticesGuide';
import IntegrationHub from '@/components/IntegrationHub';
import BusinessResources from '@/components/BusinessResources';
import ProjectManagement from '@/components/ProjectManagement';
import CRM from '@/components/CRM';
import TodoList from '@/components/TodoList';
import QRCodeGenerator from '@/components/QRCodeGenerator';
import CouponGenerator from '@/components/CouponGenerator';
import TimeTracker from '@/components/TimeTracker';
import CashFlowTracker from '@/components/CashFlowTracker';
import GoalTracker from '@/components/GoalTracker';
import ROICalculator from '@/components/ROICalculator';
import ContractGenerator from '@/components/ContractGenerator';
import PrivacyPolicyGenerator from '@/components/PrivacyPolicyGenerator';
import CurrencyConverter from '@/components/CurrencyConverter';
import CustomerSurveyBuilder from '@/components/CustomerSurveyBuilder';
import BusinessFinanceAssistant from '@/components/BusinessFinanceAssistant';
import HMRCIntegration from '@/components/HMRCIntegration';
import BusinessToolsSEO from '@/components/BusinessToolsSEO';
import { CREDITS_PER_DOCUMENT } from '@/lib/legalDocuments';
import { isFreeTool } from '@/lib/freeTools';
import { FinanceAssistantPromo } from '@/components/freeTools/Promos';
import { TrialEndedNote } from '@/components/freeTools/FreeToolAccount';
import { useAccess } from '@/hooks/useAccess';

type ToolType = 'overview' | 'notepro' | 'cost-calculator' | 'setup-checklist' | 'compliance' | 'best-practices' | 'integrations' | 'business-resources' | 'project-management' | 'crm' | 'todo-list' | 'qr-code-generator' | 'coupon-generator' | 'time-tracker' | 'cash-flow-tracker' | 'goal-tracker' | 'roi-calculator' | 'contract-generator' | 'privacy-policy-generator' | 'customer-survey-builder' | 'business-finance-assistant' | 'currency-converter' | 'hmrc-integration' | 'workflow-studio' | 'lead-generation' | 'employee-rota';

type FilterType = 'all' | 'premium' | 'favorites' | 'free' | 'finance';

/** Phase 29: money tools, shown under the Finance filter (the Cash Flow Tracker is in the Money menu group too). */
const FINANCE_TOOLS = ['business-finance-assistant', 'cash-flow-tracker', 'currency-converter', 'cost-calculator', 'roi-calculator', 'hmrc-integration'];

const BusinessTools = () => {
  // Phase 29: the address bar (React Router) is the single source of truth for which tool is open.
  const location = useLocation();
  const toolFromLocation = (): ToolType => {
    const toolParam = new URLSearchParams(location.search).get('tool') as ToolType | null;
    const selectedTool = (location.state as { selectedTool?: ToolType } | null)?.selectedTool;
    // The address bar wins: history state survives a refresh and could reopen a different tool.
    return toolParam || selectedTool || 'overview';
  };
  const [currentTool, setCurrentToolState] = useState<ToolType>(toolFromLocation);
  const [filter, setFilter] = useState<FilterType>('all');
  const navigate = useNavigate();
  const { isPremium } = useSubscription();
  const { user } = useAuth();
  const access = useAccess();
  const { favorites, toggleFavorite, isFavorited } = useFavoriteTools();

  // Phase 29: a normal React Router push (no hand-made history entries), so Back and Forward stay inside the app.
  const setCurrentTool = (tool: ToolType) => {
    const params = new URLSearchParams(location.search);
    if (tool === 'overview') params.delete('tool'); else params.set('tool', tool);
    const search = params.toString();
    navigate({ pathname: '/business-tools', search: search ? `?${search}` : '' });
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // The tool follows the address bar (menu links, Back/Forward, opening a link directly).
  useEffect(() => {
    const toolParam = new URLSearchParams(location.search).get('tool') as ToolType | null;
    setCurrentToolState(toolParam || 'overview');
  }, [location.search, location.key]);

  const toolList = [
    {
      id: 'lead-generation' as ToolType,
      title: 'Lead Generation & Prospecting',
      description: 'Capture, score, and convert leads with forms, landing pages, and native CRM sync (ClickUp/Notion inspired)',
      icon: Filter,
      color: 'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600',
      benefits: ['Smart lead scoring', 'Form & landing page builder', 'CSV import & export', 'Native CRM sync', 'Activity timeline', 'Shareable public forms'],
      featured: true
    },
    {
      id: 'employee-rota' as ToolType,
      title: 'Employee Rota & Scheduling',
      description: 'Plan weekly shifts, manage staff, and track labour costs (RotaCloud / Workday inspired)',
      icon: CalIcon,
      color: 'bg-gradient-to-r from-amber-600 to-rose-600',
      benefits: ['Weekly schedule grid', 'Employee management', 'Labour cost totals', 'Copy last week', 'Publish shifts', 'Org-scoped & secure'],
      featured: true
    },
    {
      id: 'notepro' as ToolType,
      title: 'NotePro - Professional Note Taking',
      description: 'Organize your thoughts, ideas, and tasks in one professional note-taking app',
      icon: FileText,
      color: 'bg-gradient-to-r from-purple-600 to-pink-600',
      benefits: ['Rich text editing', 'Tags & categories', 'Search & archive', 'Favorites & templates']
    },
    {
      id: 'hmrc-integration' as ToolType,
      title: 'HMRC Integration Suite',
      // docs/hmrc-plan: a Business and Scale feature (and on the 14-day trial), worded like Workflow Studio.
      description: "Connect your company to HMRC's test environment and preview VAT, payroll and tax returns. Filing is not available yet. Included in Business and Scale, and during the 14-day trial.",
      icon: Building2,
      color: 'bg-gradient-to-r from-green-600 to-blue-600',
      benefits: ['HMRC connection (test environment)', 'VAT, payroll and tax return previews', 'Filing: not available yet', 'Business and Scale plans']
    },
    {
      id: 'workflow-studio' as ToolType,
      title: 'Workflow Studio',
      // Phase 19: what it really does today, and that it is a Business and Scale feature (and on the 14-day trial).
      description: 'Save emails you send often and send them with one click, with an exact preview first. Included in Business and Scale, and during the 14-day trial.',
      icon: Zap,
      color: 'bg-gradient-to-r from-purple-600 to-indigo-600',
      benefits: ['One-click email workflows', 'Exact preview before sending', 'Run history', 'Email templates', 'Business and Scale plans']
    },
    {
      id: 'business-finance-assistant' as ToolType,
      title: 'Business Finance Assistant',
      description: 'Complete finance management with invoices, quotes, and financial tracking',
      icon: Calculator,
      color: 'bg-green-600',
      benefits: ['Invoice & Quote Generation', 'Financial Dashboard', 'Client Management', 'Revenue Tracking']
    },
    {
      id: 'todo-list' as ToolType,
      title: 'To-Do List',
      description: 'Organize and track your tasks efficiently',
      icon: ListTodo,
      color: 'bg-green-600',
      benefits: ['Stay organized', 'Track progress', 'Boost productivity']
    },
    {
      id: 'coupon-generator' as ToolType,
      title: 'Create Coupon',
      description: 'Generate and manage coupon codes with validation and CSV export/import',
      icon: Tag,
      color: 'bg-rose-600',
      benefits: ['Unique code patterns', 'Bulk generation', 'CSV import/export', 'Validation rules']
    },
    {
      id: 'qr-code-generator' as ToolType,
      title: 'QR Code Generator',
      description: 'Create QR codes for websites, contacts, and more',
      icon: QrCode,
      color: 'bg-gray-600',
      benefits: ['Multiple formats', 'Instant generation', 'Easy download']
    },
    {
      id: 'time-tracker' as ToolType,
      title: 'Time Tracker',
      description: 'Track time on projects and tasks, saved to your account',
      icon: Clock,
      color: 'bg-emerald-600',
      // Phase 31: saved to the account, so it needs signing in (trial and paying accounts, like the other saved tools).
      benefits: ['Timer that keeps running across devices', 'Billable hours and value', 'Totals by day and project, CSV export']
    },
    {
      id: 'cash-flow-tracker' as ToolType,
      title: 'Cash Flow Tracker',
      description: 'Monitor your business income and expenses',
      icon: TrendingUp,
      color: 'bg-green-600',
      benefits: ['Income/expense tracking', 'Financial insights', 'Category analysis']
    },
    {
      id: 'goal-tracker' as ToolType,
      title: 'Goal Tracker',
      description: 'Set and monitor your business milestones',
      icon: Target,
      color: 'bg-red-600',
      benefits: ['Milestone tracking', 'Progress monitoring', 'Achievement insights']
    },
    {
      id: 'roi-calculator' as ToolType,
      title: 'ROI Calculator',
      description: 'Calculate return on investment for projects',
      icon: BarChart,
      color: 'bg-yellow-600',
      benefits: ['Investment analysis', 'Performance tracking', 'Decision support']
    },
    {
      id: 'contract-generator' as ToolType,
      title: 'Contract Generator',
      description: `AI-drafted UK contracts to check with a solicitor (${CREDITS_PER_DOCUMENT} AI credits each)`,
      icon: FileText,
      color: 'bg-purple-700',
      benefits: ['26 UK contract types', 'England and Wales, Scotland or Northern Ireland', 'Word, PDF and Markdown downloads']
    },
    {
      id: 'privacy-policy-generator' as ToolType,
      title: 'Privacy & Legal Notices',
      description: `AI-drafted UK privacy policies and notices to check (${CREDITS_PER_DOCUMENT} AI credits each)`,
      icon: Shield,
      color: 'bg-green-700',
      benefits: ['7 UK notices and policies', 'UK GDPR and Data Protection Act 2018 topics', 'Word, PDF and Markdown downloads']
    },
    {
      id: 'customer-survey-builder' as ToolType,
      title: 'Customer Survey Builder',
      description: 'Create and manage customer feedback surveys',
      icon: BarChart,
      color: 'bg-violet-600',
      benefits: ['Custom questions', 'Response tracking', 'Analytics dashboard']
    },
    {
      id: 'currency-converter' as ToolType,
      title: 'Currency Converter',
      description: 'Convert currencies with real-time exchange rates',
      icon: TrendingUp,
      color: 'bg-green-600',
      benefits: ['Real-time rates', '20+ currencies', 'Business-focused']
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
      id: 'project-management' as ToolType,
      title: 'Project Management',
      description: 'Organize tasks, track progress, and collaborate with your team',
      icon: KanbanSquare,
      color: 'bg-teal-500',
      benefits: ['Kanban & List views', 'Task assignments', 'Progress tracking', 'Team collaboration']
    },
    {
      id: 'crm' as ToolType,
      title: 'CRM',
      description: 'Manage leads, contacts, and sales pipeline efficiently',
      icon: Users,
      color: 'bg-pink-500',
      benefits: ['Contact management', 'Sales pipeline', 'Lead tracking', 'Revenue forecasting']
    }
  ];
  // Phase 38: free or not comes from one list (src/lib/freeTools.ts), so badges, filters and gates follow it.
  const tools = toolList.map((t) => ({ ...t, isPremium: !isFreeTool(t.id) }));


  const filteredTools = tools.filter(tool => {
    if (filter === 'premium') return tool.isPremium;
    if (filter === 'finance') return FINANCE_TOOLS.includes(tool.id);
    if (filter === 'free') return !tool.isPremium;
    if (filter === 'favorites') return isFavorited(tool.id);
    return true;
  });

  const renderTool = () => {
    // Check if user is trying to access a premium tool
    const currentToolData = tools.find(tool => tool.id === currentTool);
    if (currentToolData?.isPremium) {
      // If user is not authenticated, show sign-in prompt
      if (!user) {
        return (
          <div className="max-w-2xl mx-auto p-6">
            <Card className="border-2 border-dashed border-blue-300">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl text-gray-900">
                  Sign in to use this tool
                </CardTitle>
                <p className="text-gray-600 mt-2">
                  Please sign in to access <strong>{currentToolData.title}</strong> and other premium tools.
                </p>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Premium tool benefits:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {currentToolData.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-center justify-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-3 justify-center">
                  <Button 
                    // Phase 24: back to this tool after signing in.
                    onClick={() => navigate(authUrlWithNext(`/business-tools?tool=${encodeURIComponent(currentTool)}`))}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    Sign In / Sign Up
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }
      
      // If user is authenticated but doesn't have premium, show upgrade prompt
      if (!isPremium) {
        return <SubscriptionUpgrade featureName={currentToolData.title} />;
      }
    }

    switch (currentTool) {
      case 'business-finance-assistant':
        return <BusinessFinanceAssistant />;
      case 'todo-list':
        return <TodoList />;
      case 'qr-code-generator':
        return <QRCodeGenerator />;
      case 'coupon-generator':
        return <CouponGenerator />;
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
      case 'customer-survey-builder':
        return <CustomerSurveyBuilder />;
      case 'hmrc-integration':
        return <HMRCIntegration />;
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
        return <BusinessResources headingLevel="h2" />;
      case 'project-management':
        navigate('/project-management');
        return null;
      case 'workflow-studio':
        navigate('/workflow-studio');
        return null;
      case 'lead-generation':
        navigate('/lead-generation');
        return null;
      case 'employee-rota':
        navigate('/rota');
        return null;
      case 'notepro':
        navigate('/business-tools/notepro');
        return null;
      case 'crm':
        return <CRM />;
      case 'currency-converter':
        return <CurrencyConverter />;
      default:
        return (
          <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold">Business Tools</h1>
              </div>
              <p className="text-gray-600 text-lg">
                Comprehensive tools to help you start, manage, and grow your business with confidence.
              </p>
              
               <div className="flex flex-wrap gap-2 mt-4">
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
                  className="bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
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
                <Button
                  variant={filter === 'finance' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('finance')}
                >
                  Finance ({tools.filter(t => FINANCE_TOOLS.includes(t.id)).length})
                </Button>
                {user && (
                  <Button
                    variant={filter === 'favorites' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('favorites')}
                  >
                    Favorites ({favorites.length})
                  </Button>
                )}
              </div>
            </div>



            {(filter === 'all' || filter === 'free' || filter === 'finance') && <div className="mb-6 max-w-2xl"><FinanceAssistantPromo /></div>}

            {/* Featured Tool: Lead Generation (ClickUp / Notion inspired) */}
            {(filter === 'all' || filter === 'premium' || (filter === 'favorites' && isFavorited('lead-generation'))) && (
              <div
                onClick={() => setCurrentTool('lead-generation')}
                className="group relative overflow-hidden rounded-2xl mb-8 cursor-pointer border border-border bg-card shadow-sm hover:shadow-2xl transition-all duration-300"
              >
                {/* Subtle gradient backdrop */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-fuchsia-500/10" />
                <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-400/20 to-fuchsia-400/20 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-violet-400/20 to-pink-400/20 blur-3xl" />

                <div className="relative grid grid-cols-1 lg:grid-cols-5 gap-8 p-8 lg:p-10">
                  {/* Left: copy */}
                  <div className="lg:col-span-3 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-4">
                      <Badge className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white border-0 flex items-center gap-1">
                        <Flame className="h-3 w-3" /> New & Featured
                      </Badge>
                      <Badge variant="outline" className="border-amber-400/50 text-amber-600 dark:text-amber-400">Premium</Badge>
                    </div>

                    <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-3">
                      Lead Generation & Prospecting
                    </h2>
                    <p className="text-muted-foreground text-base lg:text-lg mb-6 max-w-2xl">
                      Capture leads, build forms and landing pages, score prospects automatically, and push the hottest contacts straight into your CRM — all in one workspace.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                      {[
                        { icon: Target, label: 'Smart Scoring' },
                        { icon: Layout, label: 'Form Builder' },
                        { icon: Globe, label: 'Landing Pages' },
                        { icon: Users, label: 'CRM Sync' },
                        { icon: Download, label: 'CSV Import' },
                        { icon: BarChart, label: 'Pipeline View' },
                      ].map(({ icon: I, label }) => (
                        <div key={label} className="flex items-center gap-2 text-sm text-foreground/80">
                          <div className="h-7 w-7 rounded-md bg-background border border-border flex items-center justify-center shadow-sm">
                            <I className="h-3.5 w-3.5 text-indigo-500" />
                          </div>
                          {label}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        size="lg"
                        className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg group/btn"
                        onClick={(e) => { e.stopPropagation(); navigate('/lead-generation'); }}
                      >
                        Open Lead Generation
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="border-border"
                        onClick={(e) => { e.stopPropagation(); navigate('/lead-generation/import'); }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Import CSV
                      </Button>
                      <span className="text-xs text-muted-foreground ml-1">No setup required · Works with your CRM</span>
                    </div>
                  </div>

                  {/* Right: mock UI card (Notion/ClickUp inspired) */}
                  <div className="lg:col-span-2">
                    <div className="relative rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
                      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 bg-slate-50">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                        <span className="ml-3 text-xs text-slate-500 font-medium">Leads · Example data</span>
                      </div>
                      <div className="p-4 space-y-2">
                        {[
                          { name: 'Alex Example', email: 'alex@example.com', score: 85, tag: 'Hot', tagColor: 'bg-red-100 text-red-700' },
                          { name: 'Sam Sample', email: 'sam@example.com', score: 72, tag: 'Hot', tagColor: 'bg-red-100 text-red-700' },
                          { name: 'Jo Demo', email: 'jo@example.co.uk', score: 55, tag: 'Warm', tagColor: 'bg-amber-100 text-amber-700' },
                          { name: 'Chris Test', email: 'chris@example.org', score: 40, tag: 'Warm', tagColor: 'bg-amber-100 text-amber-700' },
                          { name: 'Pat Placeholder', email: 'pat@example.net', score: 25, tag: 'Cold', tagColor: 'bg-sky-100 text-sky-700' },
                        ].map((l) => (
                          <div key={l.email} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                              {l.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-slate-900 truncate">{l.name}</div>
                              <div className="text-xs text-slate-500 truncate">{l.email}</div>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${l.tagColor}`}>{l.tag}</span>
                            <span className="text-xs font-mono font-semibold text-slate-700 w-8 text-right">{l.score}</span>
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                        <span>5 of 247 leads</span>
                        <span className="flex items-center gap-1 text-indigo-600 font-medium">
                          <ZapIcon className="h-3 w-3" /> Auto-synced to CRM
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Card 
                    key={tool.id} 
                    className="cursor-pointer hover:shadow-lg transition-all duration-200 h-full flex flex-col"
                    onClick={() => {
                      if (tool.isPremium) {
                        // Always set the tool to trigger the appropriate prompt
                        setCurrentTool(tool.id);
                      } else {
                        setCurrentTool(tool.id);
                      }
                    }}
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
                        {user && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(tool.id);
                            }}
                            className="p-2 h-auto hover:bg-gray-100"
                            aria-label={isFavorited(tool.id) ? `Remove ${tool.title} from favorites` : `Add ${tool.title} to favorites`}
                            aria-pressed={isFavorited(tool.id)}
                          >
                            <Star 
                              className={`h-4 w-4 ${
                                isFavorited(tool.id) 
                                  ? 'fill-yellow-400 text-yellow-400' 
                                  : 'text-gray-400'
                              }`} 
                            />
                          </Button>
                        )}
                      </div>
                      <p className="text-gray-600">{tool.description}</p>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-1">
                      <div className="space-y-2 flex-1">
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
            <div className="mt-12 bg-gradient-to-r from-green-100/60 to-blue-100/60 rounded-lg p-6 border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Quotes & Invoices</h2>
                  <p className="text-gray-600">Quick access to view and manage your business documents</p>
                </div>
                <div className="flex flex-wrap gap-3">
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

            <div className="mt-12 bg-gradient-to-r from-blue-100/60 to-purple-100/60 rounded-lg p-8 border border-slate-200">
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

  // Invoices & quotes draws its own navy band with a breadcrumb back to Business tools,
  // so the sticky back bar and page padding are left off when it renders.
  const ownFrame = currentTool === 'business-finance-assistant' && !!user && isPremium;

  return (
    <div className="min-h-full">
      <BusinessToolsSEO />
      {currentTool !== 'overview' && !ownFrame && (
        <PageBackBar title={tools.find((t) => t.id === currentTool)?.title ?? 'Business tool'} />
      )}

      <div className={ownFrame ? undefined : 'py-8'}>
        {/* Phase 39: the free tools stay free after a trial ends; one calm line, no countdown. Referral links now sit
            next to the task inside the tools that need them (Setup Checklist, Cost Calculator), not above every tool. */}
        {currentTool !== 'overview' && isFreeTool(currentTool) && access.trialEnded && !access.suspended && (
          <div className="mx-auto mb-4 max-w-6xl px-4 sm:px-6"><TrialEndedNote /></div>
        )}
        {renderTool()}
      </div>
    </div>
  );
};

export default BusinessTools;
