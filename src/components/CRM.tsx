import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Phone, 
  Mail, 
  Calendar,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Building,
  Target,
  Clock,
  CheckCircle2,
  Zap,
  Bot,
  BarChart3,
  MessageSquare,
  Settings,
  Webhook,
  Star,
  Workflow,
  ChartBar,
  ExternalLink
} from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  position: string;
  status: 'lead' | 'prospect' | 'customer';
  value: number;
  lastContact: Date;
  source: string;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed';
  contact: string;
  probability: number;
  closeDate: Date;
}

const CRM = () => {
  const [activeTab, setActiveTab] = useState('contacts');
  const [contacts, setContacts] = useState<Contact[]>([
    {
      id: '1',
      name: 'John Smith',
      email: 'john@company.com',
      phone: '+1-555-0123',
      company: 'Tech Corp',
      position: 'CEO',
      status: 'prospect',
      value: 50000,
      lastContact: new Date(2024, 0, 15),
      source: 'website'
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah@startup.io',
      phone: '+1-555-0456',
      company: 'Startup Inc',
      position: 'CTO',
      status: 'customer',
      value: 25000,
      lastContact: new Date(2024, 1, 1),
      source: 'referral'
    }
  ]);

  const [deals, setDeals] = useState<Deal[]>([
    {
      id: '1',
      title: 'Enterprise Software License',
      value: 50000,
      stage: 'negotiation',
      contact: 'John Smith',
      probability: 75,
      closeDate: new Date(2024, 2, 15)
    },
    {
      id: '2',
      title: 'Consulting Services',
      value: 15000,
      stage: 'proposal',
      contact: 'Sarah Johnson',
      probability: 60,
      closeDate: new Date(2024, 2, 30)
    }
  ]);

  const stageColumns = [
    { id: 'prospecting', title: 'Prospecting', color: 'bg-gray-100' },
    { id: 'qualification', title: 'Qualification', color: 'bg-blue-100' },
    { id: 'proposal', title: 'Proposal', color: 'bg-yellow-100' },
    { id: 'negotiation', title: 'Negotiation', color: 'bg-orange-100' },
    { id: 'closed', title: 'Closed Won', color: 'bg-green-100' }
  ];

  const statusColors = {
    lead: 'bg-gray-500',
    prospect: 'bg-blue-500',
    customer: 'bg-green-500'
  };

  const totalRevenue = deals.reduce((sum, deal) => sum + (deal.value * deal.probability / 100), 0);
  const totalCustomers = contacts.filter(c => c.status === 'customer').length;
  const totalLeads = contacts.filter(c => c.status === 'lead').length;

  const ContactsView = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input placeholder="Search contacts..." className="pl-10 w-80" />
          </div>
          <Select>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contacts</SelectItem>
              <SelectItem value="lead">Leads</SelectItem>
              <SelectItem value="prospect">Prospects</SelectItem>
              <SelectItem value="customer">Customers</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Full Name" />
              <Input placeholder="Email" type="email" />
              <Input placeholder="Phone" />
              <Input placeholder="Company" />
              <Input placeholder="Position" />
              <Button className="w-full">Add Contact</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {contacts.map(contact => (
          <Card key={contact.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback>
                      {contact.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{contact.name}</h3>
                    <p className="text-sm text-gray-600">{contact.position} at {contact.company}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Mail className="w-4 h-4" />
                        {contact.email}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Phone className="w-4 h-4" />
                        {contact.phone}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold">${contact.value.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">Potential Value</p>
                  </div>
                  <Badge className={`text-white ${statusColors[contact.status]}`}>
                    {contact.status}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const DealsView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {stageColumns.map(stage => (
        <div key={stage.id} className={`${stage.color} rounded-lg p-4 min-h-[600px]`}>
          <h3 className="font-semibold mb-4 flex items-center justify-between">
            {stage.title}
            <Badge variant="secondary">
              {deals.filter(deal => deal.stage === stage.id).length}
            </Badge>
          </h3>
          <div className="space-y-3">
            {deals
              .filter(deal => deal.stage === stage.id)
              .map(deal => (
                <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2">{deal.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">{deal.contact}</p>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-green-600">
                        ${deal.value.toLocaleString()}
                      </span>
                      <Badge variant="outline">{deal.probability}%</Badge>
                    </div>
                    <div className="text-xs text-gray-500">
                      Close: {deal.closeDate.toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Relationship Management</h1>
          <p className="text-gray-600">Manage leads, contacts, and sales pipeline</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Contacts</p>
                <p className="text-2xl font-bold">{contacts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pipeline Value</p>
                <p className="text-2xl font-bold">${Math.round(totalRevenue).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Deals</p>
                <p className="text-2xl font-bold">{deals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Conversion Rate</p>
                <p className="text-2xl font-bold">68%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="deals">Sales Pipeline</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="contacts" className="mt-6">
          <ContactsView />
        </TabsContent>
        
        <TabsContent value="deals" className="mt-6">
          <DealsView />
        </TabsContent>
        
        <TabsContent value="marketing" className="mt-6">
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
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
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
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChartBar className="w-5 h-5" />
                  Advanced Reporting Tools
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 border rounded-lg hover:shadow-md cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <ExternalLink className="w-4 h-4" />
                      <span className="font-medium">Google Looker Studio</span>
                    </div>
                    <p className="text-sm text-gray-600">Interactive dashboards & reports</p>
                    <Badge className="mt-2 bg-green-100 text-green-800">Connected</Badge>
                  </div>
                  <div className="p-4 border rounded-lg hover:shadow-md cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <ExternalLink className="w-4 h-4" />
                      <span className="font-medium">Metabase</span>
                    </div>
                    <p className="text-sm text-gray-600">Self-service business intelligence</p>
                    <Badge className="mt-2 bg-yellow-100 text-yellow-800">Available</Badge>
                  </div>
                  <div className="p-4 border rounded-lg hover:shadow-md cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <ExternalLink className="w-4 h-4" />
                      <span className="font-medium">BigQuery</span>
                    </div>
                    <p className="text-sm text-gray-600">Data warehouse analytics</p>
                    <Badge className="mt-2 bg-green-100 text-green-800">Connected</Badge>
                  </div>
                </div>
                <Button className="w-full">
                  <ChartBar className="w-4 h-4 mr-2" />
                  Create Custom Report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Sales Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Lead Conversion Rate</span>
                      <span className="text-2xl font-bold text-blue-600">24.5%</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '24.5%' }}></div>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Average Deal Size</span>
                      <span className="text-2xl font-bold text-green-600">$32.5K</span>
                    </div>
                    <p className="text-sm text-green-700">↗ 12% vs last quarter</p>
                  </div>

                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Sales Cycle Length</span>
                      <span className="text-2xl font-bold text-purple-600">45 days</span>
                    </div>
                    <p className="text-sm text-purple-700">↘ 8% improvement</p>
                  </div>
                </div>
                <Button className="w-full">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Export Detailed Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Sales Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Monthly Target</span>
                    <span className="font-semibold">$100,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Pipeline</span>
                    <span className="font-semibold">${Math.round(totalRevenue).toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-green-500 h-3 rounded-full" 
                      style={{ width: `${Math.min((totalRevenue / 100000) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Lead Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Website</span>
                    <Badge>45%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Referrals</span>
                    <Badge>30%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Social Media</span>
                    <Badge>15%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Email Campaign</span>
                    <Badge>10%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CRM;