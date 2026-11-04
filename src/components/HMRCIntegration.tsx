import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Building2, 
  FileText, 
  Calculator, 
  Calendar, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Settings,
  Link as LinkIcon,
  RefreshCw,
  Download,
  Upload,
  Eye,
  TrendingUp,
  HelpCircle,
  Book,
  Mail
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import HMRCConnectionPanel from '@/components/hmrc/HMRCConnectionPanel';
import HMRCVATReturns from '@/components/hmrc/HMRCVATReturns';
import HMRCPayrollSubmissions from '@/components/hmrc/HMRCPayrollSubmissions';
import HMRCTaxReturns from '@/components/hmrc/HMRCTaxReturns';
import HMRCObligations from '@/components/hmrc/HMRCObligations';
import HMRCSettings from '@/components/hmrc/HMRCSettings';
import HMRCSubmissionLogs from '@/components/hmrc/HMRCSubmissionLogs';
import { HMRCFilingBanner, PREVIEW_ONLY } from '@/components/hmrc/filingStatus';

const HMRCIntegration = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-2 border-dashed border-blue-300">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-green-600 to-blue-600 rounded-full flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-gray-900">
              Sign In Required
            </CardTitle>
            <p className="text-gray-600 mt-2">
              Please sign in to access HMRC integration and tax management tools.
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // HMRC P0: the company's connection (owners and admins connect; members see the status). Filing is not built yet,
  // so the return screens below keep their example figures and "not available yet" banner.
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Building2 className="h-8 w-8 text-green-600" />
          HMRC Integration Suite
        </h1>
        <p className="text-muted-foreground mb-4">
          Connect your company to HMRC (test environment for now) and preview returns. Filing is not available yet.
        </p>
      </div>

      <div className="mb-6"><HMRCConnectionPanel /></div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 max-w-3xl">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="vat">VAT Returns</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="tax">Tax Returns</TabsTrigger>
          <TabsTrigger value="obligations">Obligations</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <div className="grid gap-6">
            <HMRCFilingBanner />
            <Card>
              <CardHeader><CardTitle>What works today</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Connect your company to HMRC's test environment (owners and admins)</li>
                  <li>Save your business details (Settings tab)</li>
                  <li>Preview VAT, payroll and tax return layouts with example figures ({PREVIEW_ONLY.toLowerCase()})</li>
                  <li>Filing VAT, payroll (FPS/EPS) and tax returns with HMRC: not available yet</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="vat"><HMRCVATReturns /></TabsContent>
        <TabsContent value="payroll"><HMRCPayrollSubmissions /></TabsContent>
        <TabsContent value="tax"><HMRCTaxReturns /></TabsContent>
        <TabsContent value="obligations"><HMRCObligations /></TabsContent>
        <TabsContent value="settings"><HMRCSettings showConnection={false} /></TabsContent>
      </Tabs>

      <div className="mt-6"><HMRCSubmissionLogs /></div>

      {/* Help & Resources Section */}
      <Card className="mt-6 bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Help & Resources
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Internal Resources */}
          <div>
            <h3 className="font-semibold mb-3 text-sm text-muted-foreground">B2BNEST Support</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="w-full h-auto flex-col gap-2 p-4 hover:bg-primary/5"
                asChild
              >
                <Link to="/help">
                  <HelpCircle className="h-6 w-6 text-primary" />
                  <div className="text-center">
                    <p className="font-semibold">Help Center</p>
                    <p className="text-xs text-muted-foreground">FAQs and guides</p>
                  </div>
                </Link>
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full h-auto flex-col gap-2 p-4 hover:bg-primary/5"
                asChild
              >
                <Link to="/knowledge-base">
                  <Book className="h-6 w-6 text-primary" />
                  <div className="text-center">
                    <p className="font-semibold">Knowledge Base</p>
                    <p className="text-xs text-muted-foreground">Detailed documentation</p>
                  </div>
                </Link>
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full h-auto flex-col gap-2 p-4 hover:bg-primary/5"
                asChild
              >
                <Link to="/contact">
                  <Mail className="h-6 w-6 text-primary" />
                  <div className="text-center">
                    <p className="font-semibold">Contact Support</p>
                    <p className="text-xs text-muted-foreground">Get in touch with us</p>
                  </div>
                </Link>
              </Button>
            </div>
          </div>

          {/* Official HMRC Resources */}
          <div>
            <h3 className="font-semibold mb-3 text-sm text-muted-foreground">Official HMRC Resources</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="justify-start h-auto p-3 hover:bg-primary/5"
                asChild
              >
                <a href="https://www.gov.uk/government/organisations/hm-revenue-customs" target="_blank" rel="noopener noreferrer">
                  <div className="flex items-center gap-3 text-left">
                    <Building2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">HMRC Official Website</p>
                      <p className="text-xs text-muted-foreground">Government portal</p>
                    </div>
                  </div>
                </a>
              </Button>

              <Button 
                variant="outline" 
                className="justify-start h-auto p-3 hover:bg-primary/5"
                asChild
              >
                <a href="https://www.gov.uk/topic/business-tax/vat" target="_blank" rel="noopener noreferrer">
                  <div className="flex items-center gap-3 text-left">
                    <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">VAT Guidance</p>
                      <p className="text-xs text-muted-foreground">Official VAT information</p>
                    </div>
                  </div>
                </a>
              </Button>

              <Button 
                variant="outline" 
                className="justify-start h-auto p-3 hover:bg-primary/5"
                asChild
              >
                <a href="https://www.gov.uk/topic/business-tax/paye" target="_blank" rel="noopener noreferrer">
                  <div className="flex items-center gap-3 text-left">
                    <Calculator className="h-5 w-5 text-purple-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">PAYE & Payroll</p>
                      <p className="text-xs text-muted-foreground">Employer obligations</p>
                    </div>
                  </div>
                </a>
              </Button>

              <Button 
                variant="outline" 
                className="justify-start h-auto p-3 hover:bg-primary/5"
                asChild
              >
                <a href="https://www.gov.uk/log-in-register-hmrc-online-services" target="_blank" rel="noopener noreferrer">
                  <div className="flex items-center gap-3 text-left">
                    <LinkIcon className="h-5 w-5 text-orange-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">Government Gateway</p>
                      <p className="text-xs text-muted-foreground">Sign in to HMRC services</p>
                    </div>
                  </div>
                </a>
              </Button>

              <Button 
                variant="outline" 
                className="justify-start h-auto p-3 hover:bg-primary/5"
                asChild
              >
                <a href="https://www.gov.uk/guidance/making-tax-digital-for-vat" target="_blank" rel="noopener noreferrer">
                  <div className="flex items-center gap-3 text-left">
                    <TrendingUp className="h-5 w-5 text-teal-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">Making Tax Digital</p>
                      <p className="text-xs text-muted-foreground">MTD requirements</p>
                    </div>
                  </div>
                </a>
              </Button>

              <Button 
                variant="outline" 
                className="justify-start h-auto p-3 hover:bg-primary/5"
                asChild
              >
                <a href="https://developer.service.hmrc.gov.uk/api-documentation" target="_blank" rel="noopener noreferrer">
                  <div className="flex items-center gap-3 text-left">
                    <Book className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">HMRC API Documentation</p>
                      <p className="text-xs text-muted-foreground">Developer resources</p>
                    </div>
                  </div>
                </a>
              </Button>
            </div>
          </div>
          
          <Alert>
            <HelpCircle className="h-4 w-4" />
            <AlertTitle>Need Help with HMRC Integration?</AlertTitle>
            <AlertDescription>
              Visit our <Link to="/knowledge-base" className="underline font-medium">Knowledge Base</Link> for step-by-step guides on setting up HMRC integration,
              submitting returns, and managing tax obligations. For official HMRC guidance, refer to the links above.
              Our support team is available <Link to="/contact" className="underline font-medium">here</Link> Mon-Fri, 9am-6pm GMT.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default HMRCIntegration;