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
  CheckCircle2
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="deals">Sales Pipeline</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="contacts" className="mt-6">
          <ContactsView />
        </TabsContent>
        
        <TabsContent value="deals" className="mt-6">
          <DealsView />
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