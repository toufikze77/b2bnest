import { Suspense } from "react";
import { lazyPage } from "@/lib/lazyPage";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import RouteFallback from "@/components/shell/RouteFallback";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { UserSettingsProvider } from "@/hooks/useUserSettings";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";

import Index from "@/pages/Index";
const About = lazyPage(() => import('@/pages/About'));
const Contact = lazyPage(() => import('@/pages/Contact'));
import Auth from "@/pages/Auth";
const ForgotPassword = lazyPage(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazyPage(() => import('@/pages/ResetPassword'));
const Dashboard = lazyPage(() => import('@/pages/Dashboard'));
const WorkspacesIndex = lazyPage(() => import('@/pages/workspaces/WorkspacesIndex'));
const WorkspaceView = lazyPage(() => import('@/pages/workspaces/WorkspaceView'));

const BusinessTools = lazyPage(() => import('@/pages/BusinessTools'));
const TemplateCenter = lazyPage(() => import('@/pages/TemplateCenter'));
const Onboarding = lazyPage(() => import('@/pages/Onboarding'));
const PLR = lazyPage(() => import('@/pages/PLR'));
const NotePro = lazyPage(() => import('@/components/NotePro'));
import NotFound from "@/pages/NotFound";
const PrivacyPolicy = lazyPage(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazyPage(() => import('@/pages/TermsOfService'));
const ProfileSetup = lazyPage(() => import('@/pages/ProfileSetup'));
const Forum = lazyPage(() => import('@/pages/Forum'));
const AIStudio = lazyPage(() => import('@/pages/AIStudio'));
const WorkflowStudio = lazyPage(() => import('@/pages/WorkflowStudio'));
const Pricing = lazyPage(() => import('@/pages/Pricing'));
const BusinessResourcesPage = lazyPage(() => import('@/pages/BusinessResourcesPage'));
const Unsubscribe = lazyPage(() => import('@/pages/Unsubscribe'));
const HumanResources = lazyPage(() => import('@/pages/categories/HumanResources'));
const LegalDocuments = lazyPage(() => import('@/pages/categories/LegalDocuments'));
const FinancialForms = lazyPage(() => import('@/pages/categories/FinancialForms'));
const MarketingMaterials = lazyPage(() => import('@/pages/categories/MarketingMaterials'));
const Operations = lazyPage(() => import('@/pages/categories/Operations'));
const CRMPage = lazyPage(() => import('@/pages/CRMPage'));
const SupportDesk = lazyPage(() => import('@/pages/SupportDesk'));
const SupportPortal = lazyPage(() => import('@/pages/SupportPortal'));
const JoinCompany = lazyPage(() => import('@/pages/JoinCompany'));
const ProjectManagementPage = lazyPage(() => import('@/pages/ProjectManagementPage'));
const BusinessOverview = lazyPage(() => import('@/pages/BusinessOverview'));
const Settings = lazyPage(() => import('@/pages/Settings'));
const CompanyReconciliation = lazyPage(() => import('@/pages/CompanyReconciliation'));
const PaymentSuccess = lazyPage(() => import('@/pages/PaymentSuccess'));
import ProtectedRoute from "@/components/ProtectedRoute";
import PaywallGate from "@/components/access/PaywallGate";
const PublicWorkRequest = lazyPage(() => import('@/pages/PublicWorkRequest'));
const B2BForm = lazyPage(() => import('@/pages/B2BForm'));
const Help = lazyPage(() => import('@/pages/Help'));
const KnowledgeBase = lazyPage(() => import('@/pages/KnowledgeBase'));
const Blog = lazyPage(() => import('@/pages/Blog'));
const GettingStarted = lazyPage(() => import('@/pages/articles/GettingStarted'));
const BusinessToolsGuide = lazyPage(() => import('@/pages/articles/BusinessToolsGuide'));
const IntegrationsGuide = lazyPage(() => import('@/pages/articles/IntegrationsGuide'));
const FinancialToolsGuide = lazyPage(() => import('@/pages/articles/FinancialToolsGuide'));
const WorkflowGuide = lazyPage(() => import('@/pages/articles/WorkflowGuide'));
const SecurityGuide = lazyPage(() => import('@/pages/articles/SecurityGuide'));
const LeadGenerationGuide = lazyPage(() => import('@/pages/articles/LeadGenerationGuide'));
const WhatsAppSettings = lazyPage(() => import('@/pages/integrations/WhatsAppSettings'));
const LeadGenOverview = lazyPage(() => import('@/pages/lead-generation/Overview'));
const LeadsPage = lazyPage(() => import('@/pages/lead-generation/Leads'));
const FormsList = lazyPage(() => import('@/pages/lead-generation/Forms'));
const FormBuilder = lazyPage(() => import('@/pages/lead-generation/FormBuilder'));
const PagesList = lazyPage(() => import('@/pages/lead-generation/Pages'));
const PageBuilder = lazyPage(() => import('@/pages/lead-generation/PageBuilder'));
const ImportPage = lazyPage(() => import('@/pages/lead-generation/Import'));
const PublicForm = lazyPage(() => import('@/pages/lead-generation/PublicForm'));
const PublicPage = lazyPage(() => import('@/pages/lead-generation/PublicPage'));
const RotaIndex = lazyPage(() => import('@/pages/rota/Index'));
const RotaEmployees = lazyPage(() => import('@/pages/rota/Employees'));
const RotaSchedule = lazyPage(() => import('@/pages/rota/Schedule'));
const AdminLayout = lazyPage(() => import('@/pages/admin/AdminLayout'));
const AdminDashboard = lazyPage(() => import('@/pages/admin/AdminDashboard'));
const AdminUsers = lazyPage(() => import('@/pages/admin/AdminUsers'));
const AdminCompanies = lazyPage(() => import('@/pages/admin/AdminCompanies'));
const AdminCompanyDetail = lazyPage(() => import('@/pages/admin/AdminCompanyDetail'));
const AdminSubscriptions = lazyPage(() => import('@/pages/admin/AdminSubscriptions'));
const AdminPlans = lazyPage(() => import('@/pages/admin/AdminPlans'));
const AdminAI = lazyPage(() => import('@/pages/admin/AdminAI'));
const AdminTools = lazyPage(() => import('@/pages/admin/AdminTools'));
const AdminProjects = lazyPage(() => import('@/pages/admin/AdminProjects'));
const AdminDocuments = lazyPage(() => import('@/pages/admin/AdminDocuments'));
const AdminSocial = lazyPage(() => import('@/pages/admin/AdminSocial'));
const AdminSupport = lazyPage(() => import('@/pages/admin/AdminSupport'));
const AdminAnalytics = lazyPage(() => import('@/pages/admin/AdminAnalytics'));
const AdminAuditLogs = lazyPage(() => import('@/pages/admin/AdminAuditLogs'));
const AdminExport = lazyPage(() => import('@/pages/admin/AdminExport'));
const AdminSystemHealth = lazyPage(() => import('@/pages/admin/AdminSystemHealth'));
const AdminSettings = lazyPage(() => import('@/pages/admin/AdminSettings'));
const AdminTemplates = lazyPage(() => import('@/pages/admin/AdminTemplates'));
const AdminAITemplates = lazyPage(() => import('@/pages/admin/AdminAITemplates'));
import RouteMeta from '@/components/RouteMeta';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrganizationProvider>
        <UserSettingsProvider>
          <ThemeProvider>
          <Router>
          <Layout>
            <RouteMeta />
            <RouteErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
            <PaywallGate>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/join" element={<JoinCompany />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/business-overview" element={<ProtectedRoute><BusinessOverview /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/settings/unassigned-projects" element={<ProtectedRoute><CompanyReconciliation /></ProtectedRoute>} />
            
            <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
              <Route path="/business-tools" element={<BusinessTools />} />
              <Route path="/template-center" element={<TemplateCenter />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

              <Route path="/business-tools/notepro" element={<ProtectedRoute><NotePro /></ProtectedRoute>} />
              <Route path="/ai-showcase" element={<Navigate to="/ai-studio" replace />} />
              <Route path="/ai-studio" element={<AIStudio />} />
              <Route path="/ai-workspace" element={<Navigate to="/ai-studio" replace />} />
              <Route path="/workflow-studio" element={<ProtectedRoute><WorkflowStudio /></ProtectedRoute>} />
              <Route path="/integrations/whatsapp" element={<ProtectedRoute><WhatsAppSettings /></ProtectedRoute>} />
            <Route path="/forum" element={<Forum />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/business-resources" element={<BusinessResourcesPage />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/plr" element={<PLR />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/categories/human-resources" element={<HumanResources />} />
              <Route path="/categories/legal-documents" element={<LegalDocuments />} />
              <Route path="/categories/financial-forms" element={<FinancialForms />} />
              <Route path="/marketing-materials" element={<MarketingMaterials />} />
              <Route path="/categories/operations" element={<Operations />} />
              <Route path="/crm" element={<ProtectedRoute><CRMPage /></ProtectedRoute>} />
              <Route path="/support-desk" element={<ProtectedRoute><SupportDesk /></ProtectedRoute>} />
              <Route path="/support/portal" element={<ProtectedRoute><SupportPortal /></ProtectedRoute>} />
              <Route path="/lead-generation" element={<ProtectedRoute><LeadGenOverview /></ProtectedRoute>} />
              <Route path="/lead-generation/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
              <Route path="/lead-generation/forms" element={<ProtectedRoute><FormsList /></ProtectedRoute>} />
              <Route path="/lead-generation/forms/new" element={<ProtectedRoute><FormBuilder /></ProtectedRoute>} />
              <Route path="/lead-generation/forms/edit/:id" element={<ProtectedRoute><FormBuilder /></ProtectedRoute>} />
              <Route path="/lead-generation/pages" element={<ProtectedRoute><PagesList /></ProtectedRoute>} />
              <Route path="/lead-generation/pages/new" element={<ProtectedRoute><PageBuilder /></ProtectedRoute>} />
              <Route path="/lead-generation/pages/edit/:id" element={<ProtectedRoute><PageBuilder /></ProtectedRoute>} />
              <Route path="/lead-generation/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
              <Route path="/rota" element={<ProtectedRoute><RotaIndex /></ProtectedRoute>} />
              <Route path="/rota/employees" element={<ProtectedRoute><RotaEmployees /></ProtectedRoute>} />
              <Route path="/rota/schedule" element={<ProtectedRoute><RotaSchedule /></ProtectedRoute>} />
              <Route path="/f/:formId" element={<PublicForm />} />
              <Route path="/p/:slug" element={<PublicPage />} />
              <Route path="/workspaces" element={<ProtectedRoute><WorkspacesIndex /></ProtectedRoute>} />
              <Route path="/workspaces/:workspaceId" element={<ProtectedRoute><WorkspaceView /></ProtectedRoute>} />
              <Route path="/project-management" element={<ProtectedRoute><ProjectManagementPage /></ProtectedRoute>} />

              <Route path="/knowledge-base/getting-started" element={<GettingStarted />} />
              <Route path="/knowledge-base/business-tools" element={<BusinessToolsGuide />} />
              <Route path="/knowledge-base/integrations" element={<IntegrationsGuide />} />
              <Route path="/knowledge-base/financial-tools" element={<FinancialToolsGuide />} />
              <Route path="/knowledge-base/workflows" element={<WorkflowGuide />} />
              <Route path="/knowledge-base/security" element={<SecurityGuide />} />
              <Route path="/knowledge-base/lead-generation" element={<LeadGenerationGuide />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="/help" element={<Help />} />
                <Route path="/knowledge-base" element={<KnowledgeBase />} />
                <Route path="/blog" element={<Blog />} />
                
                {/* Public work request form */}
               <Route path="/forms/work-request" element={<PublicWorkRequest />} />
               
               {/* B2B Partnership Form */}
               <Route path="/forms/b2b" element={<B2BForm />} />

               {/* B2BNest Super Admin */}
               <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
                 <Route index element={<AdminDashboard />} />
                 <Route path="users" element={<AdminUsers />} />
                  <Route path="companies" element={<AdminCompanies />} />
                  <Route path="companies/:id" element={<AdminCompanyDetail />} />
                 <Route path="subscriptions" element={<AdminSubscriptions />} />
                 <Route path="plans" element={<AdminPlans />} />
                 <Route path="ai" element={<AdminAI />} />
                 <Route path="tools" element={<AdminTools />} />
                 <Route path="projects" element={<AdminProjects />} />
                 <Route path="documents" element={<AdminDocuments />} />
                 <Route path="social" element={<AdminSocial />} />
                  <Route path="templates" element={<AdminTemplates />} />
                  <Route path="ai-templates" element={<AdminAITemplates />} />
                  <Route path="support" element={<AdminSupport />} />
                 <Route path="analytics" element={<AdminAnalytics />} />
                 <Route path="audit-logs" element={<AdminAuditLogs />} />
                 <Route path="export" element={<AdminExport />} />
                 <Route path="system-health" element={<AdminSystemHealth />} />
                 <Route path="settings" element={<AdminSettings />} />
               </Route>
               
               <Route path="*" element={<NotFound />} />
            </Routes>
            </PaywallGate>
            </Suspense>
            </RouteErrorBoundary>
            <Toaster />
            <SonnerToaster />
          </Layout>
          </Router>
          </ThemeProvider>
        </UserSettingsProvider>
        </OrganizationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
