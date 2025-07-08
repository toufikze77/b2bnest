import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/toaster";
import Header from "@/components/Header";
import AuthBanner from "@/components/AuthBanner";
import Index from "@/pages/Index";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Auth from "@/pages/Auth";
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
import Whitepaper from "@/pages/Whitepaper";
import Tokenomics from "@/pages/Tokenomics";
import Pricing from "@/pages/Pricing";
import HumanResources from "@/pages/categories/HumanResources";
import LegalDocuments from "@/pages/categories/LegalDocuments";
import FinancialForms from "@/pages/categories/FinancialForms";
import MarketingMaterials from "@/pages/categories/MarketingMaterials";
import Operations from "@/pages/categories/Operations";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            <Header />
            <AuthBanner />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/business-social" element={<BusinessSocial />} />
            <Route path="/profile-setup" element={<ProfileSetup />} />
              <Route path="/business-tools" element={<BusinessTools />} />
              <Route path="/ai-showcase" element={<AIShowcase />} />
              <Route path="/ai-studio" element={<AIStudio />} />
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
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
