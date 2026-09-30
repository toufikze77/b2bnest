import { lazy, Suspense } from "react";
import RouteFallback from "@/components/shell/RouteFallback";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { UserSettingsProvider } from "@/hooks/useUserSettings";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";

import Index from "@/pages/Index";
const About = lazy(() => import('@/pages/About'));
const Contact = lazy(() => import('@/pages/Contact'));
import Auth from "@/pages/Auth";
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const WorkspacesIndex = lazy(() => import('@/pages/workspaces/WorkspacesIndex'));
const WorkspaceView = lazy(() => import('@/pages/workspaces/WorkspaceView'));

const BusinessTools = lazy(() => import('@/pages/BusinessTools'));
const TemplateCenter = lazy(() => import('@/pages/TemplateCenter'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const PLR = lazy(() => import('@/pages/PLR'));
const NotePro = lazy(() => import('@/components/NotePro'));
import NotFound from "@/pages/NotFound";
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));
const ProfileSetup = lazy(() => import('@/pages/ProfileSetup'));
const Forum = lazy(() => import('@/pages/Forum'));
const AIShowcase = lazy(() => import('@/pages/AIShowcase'));
const AIStudio = lazy(() => import('@/pages/AIStudio'));
const AIWorkspace = lazy(() => import('@/pages/AIWorkspace'));
const WorkflowStudio = lazy(() => import('@/pages/WorkflowStudio'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const HumanResources = lazy(() => import('@/pages/categories/HumanResources'));
const LegalDocuments = lazy(() => import('@/pages/categories/LegalDocuments'));
const FinancialForms = lazy(() => import('@/pages/categories/FinancialForms'));
const MarketingMaterials = lazy(() => import('@/pages/categories/MarketingMaterials'));
const Operations = lazy(() => import('@/pages/categories/Operations'));
const CRMPage = lazy(() => import('@/pages/CRMPage'));
const ProjectManagementPage = lazy(() => import('@/pages/ProjectManagementPage'));
const BusinessOverview = lazy(() => import('@/pages/BusinessOverview'));
const Settings = lazy(() => import('@/pages/Settings'));
const CompanyReconciliation = lazy(() => import('@/pages/CompanyReconciliation'));
const PaymentSuccess = lazy(() => import('@/pages/PaymentSuccess'));
import ProtectedRoute from "@/components/ProtectedRoute";
const PublicWorkRequest = lazy(() => import('@/pages/PublicWorkRequest'));
const B2BForm = lazy(() => import('@/pages/B2BForm'));
const Help = lazy(() => import('@/pages/Help'));
const KnowledgeBase = lazy(() => import('@/pages/KnowledgeBase'));
const Blog = lazy(() => import('@/pages/Blog'));
const GettingStarted = lazy(() => import('@/pages/articles/GettingStarted'));
const BusinessToolsGuide = lazy(() => import('@/pages/articles/BusinessToolsGuide'));
const IntegrationsGuide = lazy(() => import('@/pages/articles/IntegrationsGuide'));
const FinancialToolsGuide = lazy(() => import('@/pages/articles/FinancialToolsGuide'));
const WorkflowGuide = lazy(() => import('@/pages/articles/WorkflowGuide'));
const SecurityGuide = lazy(() => import('@/pages/articles/SecurityGuide'));
const LeadGenerationGuide = lazy(() => import('@/pages/articles/LeadGenerationGuide'));
const WhatsAppSettings = lazy(() => import('@/pages/integrations/WhatsAppSettings'));
const LeadGenOverview = lazy(() => import('@/pages/lead-generation/Overview'));
const LeadsPage = lazy(() => import('@/pages/lead-generation/Leads'));
const FormsList = lazy(() => import('@/pages/lead-generation/Forms'));
const FormBuilder = lazy(() => import('@/pages/lead-generation/FormBuilder'));
const PagesList = lazy(() => import('@/pages/lead-generation/Pages'));
const PageBuilder = lazy(() => import('@/pages/lead-generation/PageBuilder'));
const ImportPage = lazy(() => import('@/pages/lead-generation/Import'));
const PublicForm = lazy(() => import('@/pages/lead-generation/PublicForm'));
const PublicPage = lazy(() => import('@/pages/lead-generation/PublicPage'));
const RotaIndex = lazy(() => import('@/pages/rota/Index'));
const RotaEmployees = lazy(() => import('@/pages/rota/Employees'));
const RotaSchedule = lazy(() => import('@/pages/rota/Schedule'));
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminCompanies = lazy(() => import('@/pages/admin/AdminCompanies'));
const AdminCompanyDetail = lazy(() => import('@/pages/admin/AdminCompanyDetail'));
const AdminSubscriptions = lazy(() => import('@/pages/admin/AdminSubscriptions'));
const AdminPlans = lazy(() => import('@/pages/admin/AdminPlans'));
const AdminAI = lazy(() => import('@/pages/admin/AdminAI'));
const AdminTools = lazy(() => import('@/pages/admin/AdminTools'));
const AdminProjects = lazy(() => import('@/pages/admin/AdminProjects'));
const AdminDocuments = lazy(() => import('@/pages/admin/AdminDocuments'));
const AdminSocial = lazy(() => import('@/pages/admin/AdminSocial'));
const AdminSupport = lazy(() => import('@/pages/admin/AdminSupport'));
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics'));
const AdminAuditLogs = lazy(() => import('@/pages/admin/AdminAuditLogs'));
const AdminExport = lazy(() => import('@/pages/admin/AdminExport'));
const AdminSystemHealth = lazy(() => import('@/pages/admin/AdminSystemHealth'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const AdminTemplates = lazy(() => import('@/pages/admin/AdminTemplates'));
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
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/auth" element={<Auth />} />
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
              <Route path="/ai-showcase" element={<AIShowcase />} />
              <Route path="/ai-studio" element={<AIStudio />} />
              <Route path="/ai-workspace" element={<ProtectedRoute><AIWorkspace /></ProtectedRoute>} />
              <Route path="/workflow-studio" element={<ProtectedRoute><WorkflowStudio /></ProtectedRoute>} />
              <Route path="/integrations/whatsapp" element={<ProtectedRoute><WhatsAppSettings /></ProtectedRoute>} />
            <Route path="/forum" element={<Forum />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/plr" element={<PLR />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/categories/human-resources" element={<HumanResources />} />
              <Route path="/categories/legal-documents" element={<LegalDocuments />} />
              <Route path="/categories/financial-forms" element={<FinancialForms />} />
              <Route path="/marketing-materials" element={<MarketingMaterials />} />
              <Route path="/categories/operations" element={<Operations />} />
              <Route path="/crm" element={<ProtectedRoute><CRMPage /></ProtectedRoute>} />
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
                  <Route path="support" element={<AdminSupport />} />
                 <Route path="analytics" element={<AdminAnalytics />} />
                 <Route path="audit-logs" element={<AdminAuditLogs />} />
                 <Route path="export" element={<AdminExport />} />
                 <Route path="system-health" element={<AdminSystemHealth />} />
                 <Route path="settings" element={<AdminSettings />} />
               </Route>
               
               <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
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
