import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Zap,
  Calendar,
  BarChart3,
  Plus,
  Workflow,
  Webhook,
  Building,
  Target
} from 'lucide-react';

const IntegrationsTab = () => {
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
              <Badge className="bg-green-100 text-green-800">Connected</Badge>
            </div>
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-blue-500" />
                <span>Make (Integromat)</span>
              </div>
              <Badge className="bg-yellow-100 text-yellow-800">Available</Badge>
            </div>
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Webhook className="w-4 h-4 text-purple-500" />
                <span>Webhooks</span>
              </div>
              <Badge className="bg-green-100 text-green-800">Active</Badge>
            </div>
          </div>
          <Button className="w-full">
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
              <Badge className="bg-green-100 text-green-800">Connected</Badge>
            </div>
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-700" />
                <span>Outlook Calendar</span>
              </div>
              <Badge className="bg-yellow-100 text-yellow-800">Available</Badge>
            </div>
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-green-500" />
                <span>Microsoft Teams</span>
              </div>
              <Badge className="bg-yellow-100 text-yellow-800">Available</Badge>
            </div>
          </div>
          <Button className="w-full">
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
              <Badge className="bg-green-100 text-green-800">Connected</Badge>
            </div>
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-orange-500" />
                <span>Mixpanel</span>
              </div>
              <Badge className="bg-yellow-100 text-yellow-800">Available</Badge>
            </div>
            <div className="p-3 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-red-500" />
                <span>Google Analytics</span>
              </div>
              <Badge className="bg-green-100 text-green-800">Connected</Badge>
            </div>
          </div>
          <Button className="w-full">
            <BarChart3 className="w-4 h-4 mr-2" />
            View Event Analytics
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationsTab;