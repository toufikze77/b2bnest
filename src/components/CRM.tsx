import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Target,
  Loader2
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
import SubscriptionUpgrade from './SubscriptionUpgrade';

// Updated interfaces to match database schema
interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  status: string | null;
  value: number | null;
  last_contact: string | null;
  source: string | null;
  user_id: string;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface Deal {
  id: string;
  title: string;
  value: number | null;
  stage: string | null;
  contact_id: string | null;
  probability: number | null;
  close_date: string | null;
  user_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const CRM = () => {
  const { user } = useAuth();
  const { canAccessFeature } = useSubscription();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('contacts');
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  // Check if user can access CRM features
  const canAccessCRM = canAccessFeature('crm');

  useEffect(() => {
    if (user && canAccessCRM) {
      fetchCRMData();
    } else {
      setLoading(false);
    }
  }, [user, canAccessCRM]);

  const fetchCRMData = async () => {
    try {
      setLoading(true);
      
      // Fetch contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('crm_contacts')
        .select('*')
        .eq('user_id', user?.id);

      if (contactsError) throw contactsError;

      // Fetch deals
      const { data: dealsData, error: dealsError } = await supabase
        .from('crm_deals')
        .select('*')
        .eq('user_id', user?.id);

      if (dealsError) throw dealsError;

      setContacts(contactsData || []);
      setDeals(dealsData || []);
    } catch (error) {
      console.error('Error fetching CRM data:', error);
      toast({
        title: "Error",
        description: "Failed to load CRM data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addContact = async (contactData: Partial<Contact>) => {
    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .insert({
          name: contactData.name || '',
          email: contactData.email,
          phone: contactData.phone,
          company: contactData.company,
          position: contactData.position,
          status: contactData.status || 'lead',
          value: contactData.value || 0,
          source: contactData.source,
          user_id: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      setContacts(prev => [...prev, data]);
      toast({
        title: "Success",
        description: "Contact added successfully!"
      });
      return data;
    } catch (error) {
      console.error('Error adding contact:', error);
      toast({
        title: "Error",
        description: "Failed to add contact. Please try again.",
        variant: "destructive"
      });
    }
  };

  const addDeal = async (dealData: Partial<Deal>) => {
    try {
      const { data, error } = await supabase
        .from('crm_deals')
        .insert({
          title: dealData.title || '',
          value: dealData.value || 0,
          stage: dealData.stage || 'prospecting',
          contact_id: dealData.contact_id,
          probability: dealData.probability || 50,
          close_date: dealData.close_date,
          notes: dealData.notes,
          user_id: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      setDeals(prev => [...prev, data]);
      toast({
        title: "Success",
        description: "Deal added successfully!"
      });
      return data;
    } catch (error) {
      console.error('Error adding deal:', error);
      toast({
        title: "Error",
        description: "Failed to add deal. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (!canAccessCRM) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <SubscriptionUpgrade 
          featureName="CRM" 
          onUpgrade={() => window.location.reload()}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const statusColors = {
    lead: 'bg-gray-500',
    prospect: 'bg-blue-500',
    customer: 'bg-green-500'
  };

  const totalRevenue = deals.reduce((sum, deal) => sum + ((deal.value || 0) * (deal.probability || 50) / 100), 0);

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
          <ContactsView 
            contacts={contacts} 
            statusColors={statusColors}
            onAddContact={addContact}
            onRefresh={fetchCRMData}
          />
        </TabsContent>
        
        <TabsContent value="deals" className="mt-6">
          <DealsView 
            deals={deals}
            onAddDeal={addDeal}
            onRefresh={fetchCRMData}
          />
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