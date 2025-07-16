import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Zap,
  Calendar,
  BarChart3,
  Plus,
  Workflow,
  Webhook,
  Building,
  Target,
  ExternalLink
} from 'lucide-react';

const IntegrationsTab = () => {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState({
    zapier: false,
    make: false,
    webhooks: false,
    googleCalendar: false,
    outlookCalendar: false,
    teams: false,
    segment: false,
    mixpanel: false,
    googleAnalytics: false
  });

  const handleConnect = (integration: string, serviceName: string) => {
    // Simulate connection process
    setIntegrations(prev => ({
      ...prev,
      [integration]: !prev[integration as keyof typeof prev]
    }));
    
    toast({
      title: integrations[integration as keyof typeof integrations] ? "Disconnected" : "Connected",
      description: `${serviceName} has been ${integrations[integration as keyof typeof integrations] ? "disconnected" : "connected"} successfully.`,
    });
  };

  const handleAction = (action: string) => {
    toast({
      title: "Feature Available",
      description: `${action} functionality is available. Connect your preferred services to get started.`,
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Workflow Automation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                <span>Zapier</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={integrations.zapier ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                  {integrations.zapier ? "Connected" : "Available"}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleConnect('zapier', 'Zapier')}
                >
                  {integrations.zapier ? "Disconnect" : "Connect"}
                </Button>
              </div>
            </div>
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-blue-500" />
                <span>Make (Integromat)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={integrations.make ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                  {integrations.make ? "Connected" : "Available"}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleConnect('make', 'Make')}
                >
                  {integrations.make ? "Disconnect" : "Connect"}
                </Button>
              </div>
            </div>
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Webhook className="w-4 h-4 text-purple-500" />
                <span>Webhooks</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={integrations.webhooks ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                  {integrations.webhooks ? "Active" : "Inactive"}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleConnect('webhooks', 'Webhooks')}
                >
                  {integrations.webhooks ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          </div>
          <Button className="w-full" onClick={() => handleAction("Automation")}>
            <Plus className="w-4 h-4 mr-2" />
            Create New Automation
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Calendar & Productivity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span>Google Calendar</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={integrations.googleCalendar ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                  {integrations.googleCalendar ? "Connected" : "Available"}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleConnect('googleCalendar', 'Google Calendar')}
                >
                  {integrations.googleCalendar ? "Disconnect" : "Connect"}
                </Button>
              </div>
            </div>
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-700" />
                <span>Outlook Calendar</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={integrations.outlookCalendar ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                  {integrations.outlookCalendar ? "Connected" : "Available"}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleConnect('outlookCalendar', 'Outlook Calendar')}
                >
                  {integrations.outlookCalendar ? "Disconnect" : "Connect"}
                </Button>
              </div>
            </div>
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-green-500" />
                <span>Microsoft Teams</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={integrations.teams ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                  {integrations.teams ? "Connected" : "Available"}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleConnect('teams', 'Microsoft Teams')}
                >
                  {integrations.teams ? "Disconnect" : "Connect"}
                </Button>
              </div>
            </div>
          </div>
          <Button className="w-full" onClick={() => handleAction("Calendar sync")}>
            <Calendar className="w-4 h-4 mr-2" />
            Sync Calendar Events
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Analytics & Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-500" />
                <span>Segment</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={integrations.segment ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                  {integrations.segment ? "Connected" : "Available"}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleConnect('segment', 'Segment')}
                >
                  {integrations.segment ? "Disconnect" : "Connect"}
                </Button>
              </div>
            </div>
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-orange-500" />
                <span>Mixpanel</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={integrations.mixpanel ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                  {integrations.mixpanel ? "Connected" : "Available"}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleConnect('mixpanel', 'Mixpanel')}
                >
                  {integrations.mixpanel ? "Disconnect" : "Connect"}
                </Button>
              </div>
            </div>
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-red-500" />
                <span>Google Analytics</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={integrations.googleAnalytics ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                  {integrations.googleAnalytics ? "Connected" : "Available"}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleConnect('googleAnalytics', 'Google Analytics')}
                >
                  {integrations.googleAnalytics ? "Disconnect" : "Connect"}
                </Button>
              </div>
            </div>
          </div>
          <Button className="w-full" onClick={() => handleAction("Analytics")}>
            <BarChart3 className="w-4 h-4 mr-2" />
            View Event Analytics
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationsTab;