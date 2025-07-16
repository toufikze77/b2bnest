import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  CalendarDays,
  CreditCard,
  PiggyBank,
  Slack,
  Video,
  Building,
  Target,
  FileText,
  ExternalLink,
  Settings,
  DollarSign,
  BarChart3,
  Check,
  X,
  Plus
} from 'lucide-react';

const ServicesTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [services, setServices] = useState({
    calendly: false,
    stripe: false,
    plaid: false,
    notion: false,
    clickup: false,
    slack: false,
    zoom: false,
    teams: false,
    googleMeet: false
  });
  const [loading, setLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState({
    stripeKey: '',
    plaidKey: '',
    calendlyToken: '',
    slackWebhook: '',
    zoomApiKey: ''
  });

  useEffect(() => {
    fetchServiceSettings();
  }, []);

  const fetchServiceSettings = async () => {
    try {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*')
        .eq('user_id', user.id)
        .eq('integration_name', '3rd_party_services')
        .single();

      if (data && !error && data.settings && typeof data.settings === 'object') {
        setServices(prev => ({ ...prev, ...(data.settings as Record<string, any>) }));
      }
    } catch (error) {
      console.error('Error fetching service settings:', error);
    }
  };

  const toggleService = async (serviceName: string, enabled: boolean) => {
    try {
      setLoading(true);
      if (!user?.id) return;

      const newServices = { ...services, [serviceName]: enabled };
      setServices(newServices);

      const { error } = await supabase
        .from('integration_settings')
        .upsert({
          user_id: user.id,
          integration_name: '3rd_party_services',
          settings: newServices,
          is_enabled: true
        });

      if (error) throw error;

      toast({
        title: `${serviceName} ${enabled ? 'Connected' : 'Disconnected'}`,
        description: `${serviceName} integration has been ${enabled ? 'enabled' : 'disabled'}`,
      });

      // Log the action
      await supabase.rpc('log_user_action', {
        p_user_id: user.id,
        p_action: `${serviceName}_${enabled ? 'connected' : 'disconnected'}`,
        p_resource_type: '3rd_party_service',
        p_details: { service: serviceName, enabled }
      });
    } catch (error) {
      console.error('Error toggling service:', error);
      toast({
        title: "Error",
        description: "Failed to update service connection",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const configureService = (serviceName: string) => {
    toast({
      title: `Configure ${serviceName}`,
      description: `Opening ${serviceName} configuration panel...`,
    });
  };

  const createPaymentLink = () => {
    if (!services.stripe) {
      toast({
        title: "Stripe Required",
        description: "Please connect Stripe first to create payment links",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Payment Link Generator",
      description: "Opening payment link creation interface...",
    });
  };

  const connectBankAccount = () => {
    if (!services.plaid) {
      toast({
        title: "Plaid Required",
        description: "Please connect Plaid first to add bank accounts",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Bank Account Connection",
      description: "Opening secure bank account connection...",
    });
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Appointment Booking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="w-4 h-4" />
                <span className="font-medium">Calendly</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">Automated appointment scheduling</p>
              <Switch
                checked={services.calendly}
                onCheckedChange={(checked) => toggleService('calendly', checked)}
                disabled={loading}
              />
              <div className="bg-gray-50 p-3 rounded">
                <iframe 
                  src="https://calendly.com/embed" 
                  width="100%" 
                  height="120"
                  className="border-0"
                  title="Calendly Embed"
                />
              </div>
            </div>
            <Button 
              className="w-full" 
              onClick={() => configureService('Calendly')}
              disabled={loading}
            >
              <Settings className="w-4 h-4 mr-2" />
              Configure Calendly
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Processing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  <span>Stripe API</span>
                </div>
                <Switch
                  checked={services.stripe}
                  onCheckedChange={(checked) => toggleService('stripe', checked)}
                  disabled={loading}
                />
              </div>
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span>Payment Links</span>
                </div>
                <Badge className={services.stripe ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                  {services.stripe ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-500" />
                  <span>Revenue Analytics</span>
                </div>
                <Badge className={services.stripe ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                  {services.stripe ? "Live" : "Disabled"}
                </Badge>
              </div>
            </div>
            <Button 
              className="w-full" 
              onClick={createPaymentLink}
              disabled={loading || !services.stripe}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Create Payment Link
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5" />
              Finance Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-4 h-4 text-blue-600" />
                  <span>Plaid API</span>
                </div>
                <Switch
                  checked={services.plaid}
                  onCheckedChange={(checked) => toggleService('plaid', checked)}
                  disabled={loading}
                />
              </div>
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-green-600" />
                  <span>Bank Verification</span>
                </div>
                <Badge className={services.plaid ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                  {services.plaid ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span>Financial Reports</span>
                </div>
                <Badge className={services.plaid ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                  {services.plaid ? "Live" : "Disabled"}
                </Badge>
              </div>
            </div>
            <Button 
              className="w-full" 
              onClick={connectBankAccount}
              disabled={loading || !services.plaid}
            >
              <PiggyBank className="w-4 h-4 mr-2" />
              Connect Bank Account
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Slack className="w-5 h-5" />
              Team Productivity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-800" />
                  <span>Notion</span>
                </div>
                <Switch
                  checked={services.notion}
                  onCheckedChange={(checked) => toggleService('notion', checked)}
                  disabled={loading}
                />
              </div>
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-600" />
                  <span>ClickUp</span>
                </div>
                <Switch
                  checked={services.clickup}
                  onCheckedChange={(checked) => toggleService('clickup', checked)}
                  disabled={loading}
                />
              </div>
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Slack className="w-4 h-4 text-purple-500" />
                  <span>Slack</span>
                </div>
                <Switch
                  checked={services.slack}
                  onCheckedChange={(checked) => toggleService('slack', checked)}
                  disabled={loading}
                />
              </div>
            </div>
            <Button 
              className="w-full"
              onClick={() => configureService('Team Tools')}
              disabled={loading}
            >
              <Slack className="w-4 h-4 mr-2" />
              Configure Team Tools
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Video Conferencing & Communication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg text-center">
              <Video className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <h4 className="font-medium mb-2">Zoom Integration</h4>
              <p className="text-sm text-gray-600 mb-3">Auto-generate meeting links for deals</p>
              <Switch
                checked={services.zoom}
                onCheckedChange={(checked) => toggleService('zoom', checked)}
                disabled={loading}
              />
            </div>
            <div className="p-4 border rounded-lg text-center">
              <Building className="w-8 h-8 mx-auto mb-2 text-blue-700" />
              <h4 className="font-medium mb-2">Microsoft Teams</h4>
              <p className="text-sm text-gray-600 mb-3">Enterprise video collaboration</p>
              <Switch
                checked={services.teams}
                onCheckedChange={(checked) => toggleService('teams', checked)}
                disabled={loading}
              />
            </div>
            <div className="p-4 border rounded-lg text-center">
              <Video className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <h4 className="font-medium mb-2">Google Meet</h4>
              <p className="text-sm text-gray-600 mb-3">Calendar-integrated meetings</p>
              <Switch
                checked={services.googleMeet}
                onCheckedChange={(checked) => toggleService('googleMeet', checked)}
                disabled={loading}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ServicesTab;