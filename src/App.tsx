import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { UserSettingsProvider } from "@/hooks/useUserSettings";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/Layout";

import Index from "@/pages/Index";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Auth from "@/pages/Auth";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";

import BusinessTools from "@/pages/BusinessTools";
import Fundraising from "@/pages/Fundraising";
import PLR from "@/pages/PLR";
import NotFound from "@/pages/NotFound";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import ProfileSetup from "@/pages/ProfileSetup";
import Forum from "@/pages/Forum";
import AIShowcase from "@/pages/AIShowcase";
import AIStudio from "@/pages/AIStudio";
import AIWorkspace from "@/pages/AIWorkspace";
import Whitepaper from "@/pages/Whitepaper";
import WorkflowStudio from "@/pages/WorkflowStudio";
import Tokenomics from "@/pages/Tokenomics";
import Pricing from "@/pages/Pricing";
import HumanResources from "@/pages/categories/HumanResources";
import LegalDocuments from "@/pages/categories/LegalDocuments";
import FinancialForms from "@/pages/categories/FinancialForms";
import MarketingMaterials from "@/pages/categories/MarketingMaterials";
import Operations from "@/pages/categories/Operations";
import CRMPage from "@/pages/CRMPage";
import ProjectManagementPage from "@/pages/ProjectManagementPage";
import Settings from "@/pages/Settings";
import PaymentSuccess from "@/pages/PaymentSuccess";
import ProtectedRoute from "@/components/ProtectedRoute";
import Market from '@/pages/Market';
import BusinessNews from '@/pages/BusinessNews';
import PublicWorkRequest from '@/pages/PublicWorkRequest';
import B2BForm from '@/pages/B2BForm';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserSettingsProvider>
          <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            
            <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
              <Route path="/business-tools" element={<BusinessTools />} />
              <Route path="/ai-showcase" element={<AIShowcase />} />
              <Route path="/ai-studio" element={<AIStudio />} />
              <Route path="/ai-workspace" element={<ProtectedRoute><AIWorkspace /></ProtectedRoute>} />
              <Route path="/workflow-studio" element={<ProtectedRoute><WorkflowStudio /></ProtectedRoute>} />
              <Route path="/fundraising" element={<Fundraising />} />
              <Route path="/whitepaper" element={<Whitepaper />} />
            <Route path="/tokenomics" element={<Tokenomics />} />
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
              <Route path="/project-management" element={<ProtectedRoute><ProjectManagementPage /></ProtectedRoute>} />
              <Route path="/live-charts" element={<Market />} />
              <Route path="/business-news" element={<BusinessNews />} />
               <Route path="/payment-success" element={<PaymentSuccess />} />
               
               {/* Public work request form */}
               <Route path="/forms/work-request" element={<PublicWorkRequest />} />
               
               {/* B2B Partnership Form */}
               <Route path="/forms/b2b" element={<B2BForm />} />
               
               <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
          </Layout>
          </Router>
        </UserSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
