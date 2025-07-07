import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Star, 
  MessageSquare, 
  Phone,
  Plus,
  Settings,
  Bot,
  ExternalLink
} from 'lucide-react';

const MarketingTab = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Marketing Automation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg hover:shadow-md cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="w-4 h-4" />
                <span className="font-medium">Mailchimp</span>
              </div>
              <p className="text-sm text-gray-600">Email campaigns & automation</p>
              <Badge className="mt-2 bg-green-100 text-green-800">Connected</Badge>
            </div>
            <div className="p-4 border rounded-lg hover:shadow-md cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="w-4 h-4" />
                <span className="font-medium">SendGrid</span>
              </div>
              <p className="text-sm text-gray-600">Transactional emails</p>
              <Badge className="mt-2 bg-yellow-100 text-yellow-800">Setup Required</Badge>
            </div>
          </div>
          <Button className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Create Email Campaign
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Lead Scoring & Nurturing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span>AI Lead Scoring</span>
              <Badge className="bg-blue-100 text-blue-800">Active</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Auto Nurturing Workflows</span>
              <Badge className="bg-green-100 text-green-800">5 Active</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>ZoomInfo Enrichment</span>
              <Badge className="bg-yellow-100 text-yellow-800">Setup Required</Badge>
            </div>
          </div>
          <Button className="w-full">
            <Settings className="w-4 h-4 mr-2" />
            Configure Scoring Rules
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Chat & Engagement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4" />
                <span className="font-medium">AI Chatbot</span>
              </div>
              <p className="text-sm text-gray-600">OpenAI GPT-powered</p>
              <Badge className="mt-2 bg-green-100 text-green-800">Live</Badge>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4" />
                <span className="font-medium">Live Chat</span>
              </div>
              <p className="text-sm text-gray-600">Intercom integration</p>
              <Badge className="mt-2 bg-yellow-100 text-yellow-800">Setup Required</Badge>
            </div>
          </div>
          <Button className="w-full">
            <Settings className="w-4 h-4 mr-2" />
            Configure Chat Settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Communication Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span>Twilio SMS Integration</span>
              <Badge className="bg-green-100 text-green-800">Connected</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Call Tracking</span>
              <Badge className="bg-green-100 text-green-800">Active</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Email Logging (Gmail)</span>
              <Badge className="bg-yellow-100 text-yellow-800">Setup Required</Badge>
            </div>
          </div>
          <Button className="w-full">
            <Phone className="w-4 h-4 mr-2" />
            View Call Analytics
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingTab;