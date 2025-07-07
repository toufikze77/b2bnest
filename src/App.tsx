import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/toaster";
import ProtectedRoute from "@/components/ProtectedRoute";
import Header from "@/components/Header";
import AuthBanner from "@/components/AuthBanner";
import Index from "@/pages/Index";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Blog from "@/pages/Blog";
import BusinessTools from "@/pages/BusinessTools";
import Fundraising from "@/pages/Fundraising";
import PLR from "@/pages/PLR";
import NotFound from "@/pages/NotFound";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import AIShowcase from "@/pages/AIShowcase";
import AIStudio from "@/pages/AIStudio";
import Whitepaper from "@/pages/Whitepaper";
import Tokenomics from "@/pages/Tokenomics";
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
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/blog" element={<Blog />} />
              <Route path="/business-tools" element={
                <ProtectedRoute>
                  <BusinessTools />
                </ProtectedRoute>
              } />
              <Route path="/ai-showcase" element={
                <ProtectedRoute>
                  <AIShowcase />
                </ProtectedRoute>
              } />
              <Route path="/ai-studio" element={
                <ProtectedRoute>
                  <AIStudio />
                </ProtectedRoute>
              } />
              <Route path="/fundraising" element={<Fundraising />} />
              <Route path="/whitepaper" element={<Whitepaper />} />
              <Route path="/tokenomics" element={<Tokenomics />} />
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
