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
import BusinessSocial from "@/pages/BusinessSocial";
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
import Tokenomics from "@/pages/Tokenomics";
import Pricing from "@/pages/Pricing";
import HumanResources from "@/pages/categories/HumanResources";
import LegalDocuments from "@/pages/categories/LegalDocuments";
import FinancialForms from "@/pages/categories/FinancialForms";
import MarketingMaterials from "@/pages/categories/MarketingMaterials";
import Operations from "@/pages/categories/Operations";
import CRMPage from "@/pages/CRMPage";
import ProjectManagementPage from "@/pages/ProjectManagementPage";
import BusinessDirectory from "@/pages/BusinessDirectory";
import SupplierDirectory from "@/pages/SupplierDirectory";
import CompanyDirectory from "@/pages/CompanyDirectory";
import ServiceDirectory from "@/pages/ServiceDirectory";
import Settings from "@/pages/Settings";
import PaymentSuccess from "@/pages/PaymentSuccess";
import ProtectedRoute from "@/components/ProtectedRoute";

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
            <Route path="/business-social" element={<ProtectedRoute><BusinessSocial /></ProtectedRoute>} />
            <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
              <Route path="/business-tools" element={<BusinessTools />} />
              <Route path="/ai-showcase" element={<AIShowcase />} />
              <Route path="/ai-studio" element={<AIStudio />} />
              <Route path="/ai-workspace" element={<ProtectedRoute><AIWorkspace /></ProtectedRoute>} />
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
              <Route path="/categories/marketing-materials" element={<MarketingMaterials />} />
              <Route path="/categories/operations" element={<Operations />} />
              <Route path="/crm" element={<ProtectedRoute><CRMPage /></ProtectedRoute>} />
              <Route path="/project-management" element={<ProtectedRoute><ProjectManagementPage /></ProtectedRoute>} />
              
              {/* Directory Routes - Protected */}
              <Route path="/directory" element={<ProtectedRoute><BusinessDirectory /></ProtectedRoute>} />
              <Route path="/directory/suppliers" element={<ProtectedRoute><SupplierDirectory /></ProtectedRoute>} />
              <Route path="/directory/companies" element={<ProtectedRoute><CompanyDirectory /></ProtectedRoute>} />
              <Route path="/directory/services" element={<ProtectedRoute><ServiceDirectory /></ProtectedRoute>} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              
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
