import React, { useState, useEffect } from 'react';
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
  Link,
  RefreshCw,
  Download,
  Upload,
  Eye,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { hmrcService } from '@/services/hmrcService';
import HMRCVATReturns from '@/components/hmrc/HMRCVATReturns';
import HMRCPayrollSubmissions from '@/components/hmrc/HMRCPayrollSubmissions';
import HMRCTaxReturns from '@/components/hmrc/HMRCTaxReturns';
import HMRCObligations from '@/components/hmrc/HMRCObligations';
import HMRCSettings from '@/components/hmrc/HMRCSettings';

const HMRCIntegration = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  useEffect(() => {
    // Check if user is already connected to HMRC with valid settings
    const isConfigured = hmrcService.isFullyConfigured();
    if (isConfigured) {
      setIsConnected(true);
      setConnectionStatus('connected');
    }
  }, []);

  const handleConnectHMRC = async () => {
    setLoading(true);
    setConnectionStatus('connecting');
    
    try {
      // In a real implementation, this would use actual HMRC OAuth
      const { authUrl } = await hmrcService.startOAuth(
        'demo-client-id', 
        `${window.location.origin}/business-tools?hmrc-callback=true`
      );
      
      // For demo purposes, we'll simulate the connection
      setTimeout(() => {
        setIsConnected(true);
        setConnectionStatus('connected');
        toast({
          title: "HMRC Connected",
          description: "Successfully connected to HMRC services (Demo Mode)",
        });
      }, 2000);
      
    } catch (error) {
      setConnectionStatus('disconnected');
      toast({
        title: "Connection Failed",
        description: "Failed to connect to HMRC. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectHMRC = () => {
    setIsConnected(false);
    setConnectionStatus('disconnected');
    localStorage.removeItem('hmrc_mock_auth_v1');
    hmrcService.clearSettings();
    toast({
      title: "HMRC Disconnected",
      description: "Successfully disconnected from HMRC services",
    });
  };

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

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Building2 className="h-8 w-8 text-green-600" />
          HMRC Integration Suite
        </h1>
        <p className="text-gray-600 mb-4">
          Complete UK tax and compliance management
        </p>
        <div className="flex gap-2 flex-wrap">
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? 'Connected to HMRC' : 'Not Connected'}
          </Badge>
          <Badge variant="outline">VAT Returns</Badge>
          <Badge variant="outline">Payroll Submissions</Badge>
          <Badge variant="outline">Corporation Tax</Badge>
          <Badge variant="outline">Income Tax</Badge>
          <Badge variant="outline">Making Tax Digital</Badge>
        </div>
      </div>

      {!isConnected ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Connect to HMRC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Demo Mode</AlertTitle>
                <AlertDescription>
                  This is a demonstration of HMRC integration capabilities. 
                  In production, this would connect to the actual HMRC Government Gateway.
                </AlertDescription>
              </Alert>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">What you'll get:</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Automated VAT return submissions</li>
                    <li>• Payroll RTI submissions (FPS/EPS)</li>
                    <li>• Corporation tax submissions</li>
                    <li>• Income tax self-assessment</li>
                    <li>• Automatic deadline tracking</li>
                    <li>• HMRC obligation monitoring</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Requirements:</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• HMRC Government Gateway account</li>
                    <li>• Making Tax Digital enrollment</li>
                    <li>• Valid UTR or VAT number</li>
                    <li>• Agent authorization (if applicable)</li>
                  </ul>
                </div>
              </div>
              
              <Button 
                onClick={handleConnectHMRC} 
                disabled={loading || connectionStatus === 'connecting'}
                className="w-full md:w-auto"
              >
                {connectionStatus === 'connecting' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Connecting to HMRC...
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4 mr-2" />
                    Connect to HMRC Government Gateway
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="dashboard" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList className={`grid w-full ${user?.email === 'toufikze@gmail.com' ? 'grid-cols-2 md:grid-cols-6' : 'grid-cols-2 md:grid-cols-5'} max-w-3xl`}>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="vat">VAT Returns</TabsTrigger>
              <TabsTrigger value="payroll">Payroll</TabsTrigger>
              <TabsTrigger value="tax">Tax Returns</TabsTrigger>
              <TabsTrigger value="obligations">Obligations</TabsTrigger>
              {user?.email === 'toufikze@gmail.com' && (
                <TabsTrigger value="settings">Settings</TabsTrigger>
              )}
            </TabsList>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDisconnectHMRC}
            >
              Disconnect HMRC
            </Button>
          </div>

          <TabsContent value="dashboard">
            <div className="grid gap-6">
              {/* Status Overview */}
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-semibold">HMRC Connected</p>
                        <p className="text-sm text-gray-600">Government Gateway</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-500" />
                      <div>
                        <p className="font-semibold">2 Upcoming</p>
                        <p className="text-sm text-gray-600">Obligations due</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="font-semibold">MTD Compliant</p>
                        <p className="text-sm text-gray-600">Making Tax Digital</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Recent HMRC Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium">VAT Return Q3 2024</p>
                          <p className="text-sm text-gray-600">Submitted successfully</p>
                        </div>
                      </div>
                      <Badge variant="secondary">2 days ago</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Upload className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium">Payroll FPS Submission</p>
                          <p className="text-sm text-gray-600">September 2024</p>
                        </div>
                      </div>
                      <Badge variant="secondary">5 days ago</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        <div>
                          <p className="font-medium">Corporation Tax Due</p>
                          <p className="text-sm text-gray-600">Filing deadline: 31 Dec 2024</p>
                        </div>
                      </div>
                      <Badge variant="outline">Upcoming</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Button variant="outline" className="h-20 flex-col gap-2">
                      <FileText className="h-5 w-5" />
                      Submit VAT Return
                    </Button>
                    <Button variant="outline" className="h-20 flex-col gap-2">
                      <Calculator className="h-5 w-5" />
                      Generate Payroll FPS
                    </Button>
                    <Button variant="outline" className="h-20 flex-col gap-2">
                      <Eye className="h-5 w-5" />
                      View Obligations
                    </Button>
                    <Button variant="outline" className="h-20 flex-col gap-2">
                      <Download className="h-5 w-5" />
                      Download Reports
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="vat">
            <HMRCVATReturns />
          </TabsContent>

          <TabsContent value="payroll">
            <HMRCPayrollSubmissions />
          </TabsContent>

          <TabsContent value="tax">
            <HMRCTaxReturns />
          </TabsContent>

          <TabsContent value="obligations">
            <HMRCObligations />
          </TabsContent>

          {user?.email === 'toufikze@gmail.com' && (
            <TabsContent value="settings">
              <HMRCSettings onDisconnect={handleDisconnectHMRC} />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
};

export default HMRCIntegration;