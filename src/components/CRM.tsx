import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Target
} from 'lucide-react';

// Import the refactored components
import ContactsView from './crm/ContactsView';
import DealsView from './crm/DealsView';
import MarketingTab from './crm/MarketingTab';
import IntegrationsTab from './crm/IntegrationsTab';
import ServicesTab from './crm/ServicesTab';
import SecurityTab from './crm/SecurityTab';
import ReportsTab from './crm/ReportsTab';
import AnalyticsTab from './crm/AnalyticsTab';

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

  const statusColors = {
    lead: 'bg-gray-500',
    prospect: 'bg-blue-500',
    customer: 'bg-green-500'
  };

  const totalRevenue = deals.reduce((sum, deal) => sum + (deal.value * deal.probability / 100), 0);

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
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="deals">Sales Pipeline</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="services">3rd-Party</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="contacts" className="mt-6">
          <ContactsView contacts={contacts} statusColors={statusColors} />
        </TabsContent>
        
        <TabsContent value="deals" className="mt-6">
          <DealsView deals={deals} />
        </TabsContent>
        
        <TabsContent value="marketing" className="mt-6">
          <MarketingTab />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <IntegrationsTab />
        </TabsContent>

        <TabsContent value="services" className="mt-6">
          <ServicesTab />
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <ReportsTab totalRevenue={totalRevenue} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <AnalyticsTab totalRevenue={totalRevenue} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CRM;