import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  BarChart3
} from 'lucide-react';

const ServicesTab = () => {
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
              <Badge className="bg-green-100 text-green-800 mb-3">Connected</Badge>
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
            <Button className="w-full">
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
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              </div>
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span>Payment Links</span>
                </div>
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-500" />
                  <span>Revenue Analytics</span>
                </div>
                <Badge className="bg-green-100 text-green-800">Live</Badge>
              </div>
            </div>
            <Button className="w-full">
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
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              </div>
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-green-600" />
                  <span>Bank Verification</span>
                </div>
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span>Financial Reports</span>
                </div>
                <Badge className="bg-green-100 text-green-800">Live</Badge>
              </div>
            </div>
            <Button className="w-full">
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
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              </div>
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-600" />
                  <span>ClickUp</span>
                </div>
                <Badge className="bg-yellow-100 text-yellow-800">Available</Badge>
              </div>
              <div className="p-3 border rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Slack className="w-4 h-4 text-purple-500" />
                  <span>Slack</span>
                </div>
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              </div>
            </div>
            <Button className="w-full">
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
              <Badge className="bg-green-100 text-green-800">Connected</Badge>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <Building className="w-8 h-8 mx-auto mb-2 text-blue-700" />
              <h4 className="font-medium mb-2">Microsoft Teams</h4>
              <p className="text-sm text-gray-600 mb-3">Enterprise video collaboration</p>
              <Badge className="bg-yellow-100 text-yellow-800">Available</Badge>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <Video className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <h4 className="font-medium mb-2">Google Meet</h4>
              <p className="text-sm text-gray-600 mb-3">Calendar-integrated meetings</p>
              <Badge className="bg-green-100 text-green-800">Connected</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ServicesTab;