import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Mail, 
  Star, 
  MessageSquare, 
  Phone,
  Plus,
  Settings,
  Bot,
  ExternalLink,
  Send,
  Users,
  BarChart,
  Zap
} from 'lucide-react';

const MarketingTab = () => {
  const { toast } = useToast();
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [isChatBotOpen, setIsChatBotOpen] = useState(false);
  const [isLeadScoringOpen, setIsLeadScoringOpen] = useState(false);
  const [campaignData, setCampaignData] = useState({
    name: '',
    subject: '',
    content: '',
    audience: 'all',
    schedule: ''
  });
  const [chatMessages, setChatMessages] = useState([
    { role: 'bot', message: 'Hello! I\'m your AI assistant. How can I help you with your CRM today?' }
  ]);
  const [newMessage, setNewMessage] = useState('');

  const handleCreateCampaign = () => {
    if (!campaignData.name || !campaignData.subject || !campaignData.content) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Simulate campaign creation
    toast({
      title: "Campaign Created",
      description: `Email campaign "${campaignData.name}" has been created and scheduled!`
    });
    
    setIsCampaignDialogOpen(false);
    setCampaignData({ name: '', subject: '', content: '', audience: 'all', schedule: '' });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const userMessage = { role: 'user', message: newMessage };
    setChatMessages(prev => [...prev, userMessage]);

    // Simulate AI response
    setTimeout(() => {
      const botResponse = { 
        role: 'bot', 
        message: `I understand you're asking about "${newMessage}". As your AI assistant, I can help you with lead management, deal tracking, and customer insights. What specific aspect would you like to explore?`
      };
      setChatMessages(prev => [...prev, botResponse]);
    }, 1000);

    setNewMessage('');
  };

  const handleConfigureScoring = () => {
    toast({
      title: "Lead Scoring Updated",
      description: "AI lead scoring rules have been configured successfully!"
    });
    setIsLeadScoringOpen(false);
  };

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
          <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Create Email Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Email Campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input 
                  placeholder="Campaign Name *" 
                  value={campaignData.name}
                  onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
                />
                <Input 
                  placeholder="Email Subject *" 
                  value={campaignData.subject}
                  onChange={(e) => setCampaignData({ ...campaignData, subject: e.target.value })}
                />
                <Textarea 
                  placeholder="Email Content *" 
                  value={campaignData.content}
                  onChange={(e) => setCampaignData({ ...campaignData, content: e.target.value })}
                  rows={4}
                />
                <Select value={campaignData.audience} onValueChange={(value) => setCampaignData({ ...campaignData, audience: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contacts</SelectItem>
                    <SelectItem value="leads">Leads Only</SelectItem>
                    <SelectItem value="prospects">Prospects Only</SelectItem>
                    <SelectItem value="customers">Customers Only</SelectItem>
                  </SelectContent>
                </Select>
                <Input 
                  placeholder="Schedule Date (optional)" 
                  type="datetime-local" 
                  value={campaignData.schedule}
                  onChange={(e) => setCampaignData({ ...campaignData, schedule: e.target.value })}
                />
                <Button className="w-full" onClick={handleCreateCampaign}>
                  <Send className="w-4 h-4 mr-2" />
                  Create Campaign
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
          <Dialog open={isLeadScoringOpen} onOpenChange={setIsLeadScoringOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Settings className="w-4 h-4 mr-2" />
                Configure Scoring Rules
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Lead Scoring Configuration</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Email Activity</label>
                    <Input placeholder="20 points" defaultValue="20" type="number" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Phone Contact</label>
                    <Input placeholder="30 points" defaultValue="30" type="number" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Company Size</label>
                    <Input placeholder="25 points" defaultValue="25" type="number" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Deal Value</label>
                    <Input placeholder="40 points" defaultValue="40" type="number" />
                  </div>
                </div>
                <Button className="w-full" onClick={handleConfigureScoring}>
                  <Zap className="w-4 h-4 mr-2" />
                  Update Scoring Rules
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
          <Dialog open={isChatBotOpen} onOpenChange={setIsChatBotOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Bot className="w-4 h-4 mr-2" />
                Open AI Chat
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>AI CRM Assistant</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="h-80 overflow-y-auto border rounded-lg p-4 bg-gray-50">
                  {chatMessages.map((msg, index) => (
                    <div key={index} className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <div className={`inline-block px-3 py-2 rounded-lg max-w-xs ${
                        msg.role === 'user' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-white border'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Ask your AI assistant..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button onClick={handleSendMessage}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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