
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Header from "@/components/Header";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import About from "./pages/About";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Blog from "./pages/Blog";
import BusinessTools from "./pages/BusinessTools";
import PLR from "./pages/PLR";
import Fundraising from "./pages/Fundraising";
import NotFound from "./pages/NotFound";
import LegalDocuments from "./pages/categories/LegalDocuments";
import HumanResources from "./pages/categories/HumanResources";
import FinancialForms from "./pages/categories/FinancialForms";
import MarketingMaterials from "./pages/categories/MarketingMaterials";
import Operations from "./pages/categories/Operations";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-gray-50">
            <Header />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/about" element={<About />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/business-tools" element={<BusinessTools />} />
              <Route path="/plr" element={<PLR />} />
              <Route path="/fundraising" element={<Fundraising />} />
              <Route path="/categories/legal" element={<LegalDocuments />} />
              <Route path="/categories/hr" element={<HumanResources />} />
              <Route path="/categories/finance" element={<FinancialForms />} />
              <Route path="/categories/marketing" element={<MarketingMaterials />} />
              <Route path="/categories/operations" element={<Operations />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
