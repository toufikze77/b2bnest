import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import ContactsImportExport from './crm/ContactsImportExport';
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
import { Navigate, useSearchParams } from 'react-router-dom';
import { crmSummary, formatByCurrency } from "@/lib/marketingAudience";
import { dealInsertPayload, dealUpdatePayload } from '@/lib/crmDeals';
import { useAccountCurrency } from '@/hooks/useAccountCurrency';
import { readCrmTab, writeCrmTab } from '@/lib/crmTab';
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
  currency?: string | null;
  close_date: string | null;
  user_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CRMProps {
  /** Full-page mode (/crm): navy header band with breadcrumb, actions and tabs. Embedded uses (Business Tools) leave it off. */
  band?: boolean;
}

const CRM = ({ band = false }: CRMProps) => {
  const { user } = useAuth();
  const { organization } = useActiveOrganization();
  const [addContactOpen, setAddContactOpen] = useState(false);
  const accountCurrency = useAccountCurrency();
  const { canAccessFeature } = useSubscription();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const activeTab = readCrmTab(params);
  const setActiveTab = (v: string) => {
    const tab = readCrmTab(new URLSearchParams({ tab: v }));
    if (tab !== activeTab) setParams(writeCrmTab(params, tab));
  };
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  // A failed load is shown as an error in Analytics and Reports, never as "no data".
  const [loadError, setLoadError] = useState(false);

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
      
      if (!user?.id) {
        console.log('No user ID available for fetching CRM data');
        return;
      }

      console.log('Fetching CRM data for user:', user.id);
      
      // Fetch contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('crm_contacts')
        .select('*')
        .eq('user_id', user.id);

      if (contactsError) {
        console.error('Error fetching contacts:', contactsError);
        throw contactsError;
      }

      // Fetch deals
      const { data: dealsData, error: dealsError } = await supabase
        .from('crm_deals')
        .select('*')
        .eq('user_id', user.id);

      if (dealsError) {
        console.error('Error fetching deals:', dealsError);
        throw dealsError;
      }

      console.log('Fetched contacts:', contactsData?.length || 0);
      console.log('Fetched deals:', dealsData?.length || 0);

      setLoadError(false);
      setContacts(contactsData || []);
      setDeals(dealsData || []);
    } catch (error) {
      setLoadError(true);
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

  const updateContact = async (contactId: string, contactData: Partial<Contact>) => {
    try {
      console.log('Updating contact with ID:', contactId, 'data:', contactData);
      
      if (!user?.id) {
        console.error('No user ID available');
        toast({
          title: "Error",
          description: "You must be logged in to update contacts",
          variant: "destructive"
        });
        return;
      }

      const updateData = {
        name: contactData.name?.trim(),
        email: contactData.email?.trim() || null,
        phone: contactData.phone?.trim() || null,
        company: contactData.company?.trim() || null,
        position: contactData.position?.trim() || null,
        status: contactData.status || 'lead',
        value: contactData.value || 0,
        source: contactData.source?.trim() || null,
        notes: contactData.notes?.trim() || null
      };

      const { data, error } = await supabase
        .from('crm_contacts')
        .update(updateData)
        .eq('id', contactId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Supabase contact update error:', error);
        toast({
          title: "Database Error",
          description: error.message || "Failed to update contact",
          variant: "destructive"
        });
        return;
      }

      // Update local state
      setContacts(prev => prev.map(contact => 
        contact.id === contactId ? data : contact
      ));
      
      toast({
        title: "Success",
        description: "Contact updated successfully!"
      });
      
      return data;
    } catch (error) {
      console.error('Error updating contact:', error);
      toast({
        title: "Error",
        description: `Failed to update contact: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const deleteContact = async (contactId: string) => {
    try {
      if (!user?.id) {
        toast({
          title: "Error",
          description: "You must be logged in to delete contacts",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('crm_contacts')
        .delete()
        .eq('id', contactId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting contact:', error);
        toast({
          title: "Error",
          description: "Failed to delete contact",
          variant: "destructive"
        });
        return;
      }

      setContacts(prev => prev.filter(contact => contact.id !== contactId));
      
      toast({
        title: "Success",
        description: "Contact deleted successfully!"
      });
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({
        title: "Error",
        description: `Failed to delete contact: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const addContact = async (contactData: Partial<Contact>) => {
    try {
      console.log('Adding contact with data:', contactData);
      
      if (!user?.id) {
        console.error('No user ID available');
        toast({
          title: "Error",
          description: "You must be logged in to add contacts",
          variant: "destructive"
        });
        return;
      }

      // Validate required fields
      if (!contactData.name || contactData.name.trim() === '') {
        toast({
          title: "Error",
          description: "Contact name is required",
          variant: "destructive"
        });
        return;
      }

      const insertData = {
        name: contactData.name.trim(),
        email: contactData.email?.trim() || null,
        phone: contactData.phone?.trim() || null,
        company: contactData.company?.trim() || null,
        position: contactData.position?.trim() || null,
        status: contactData.status || 'lead',
        value: contactData.value || 0,
        source: contactData.source?.trim() || null,
        user_id: user.id
      };

      console.log('Insert contact data:', insertData);

      const { data, error } = await supabase
        .from('crm_contacts')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Supabase contact error:', error);
        toast({
          title: "Database Error",
          description: error.message || "Failed to save contact to database",
          variant: "destructive"
        });
        return;
      }

      console.log('Contact added successfully:', data);
      
      // Update local state
      setContacts(prev => [...prev, data]);
      
      // Refresh data to ensure consistency
      await fetchCRMData();
      
      toast({
        title: "Success",
        description: "Contact added successfully!"
      });
      
      return data;
    } catch (error) {
      console.error('Error adding contact:', error);
      toast({
        title: "Error",
        description: `Failed to add contact: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  /**
   * Saves only the fields passed in (same defaults as before for each field that is passed),
   * so a stage-only move never rewrites a missing value or probability.
   * Returns the saved deal, or undefined on failure. `quiet` leaves the messages to the caller.
   */
  const updateDeal = async (dealId: string, dealData: Partial<Deal>, opts: { quiet?: boolean } = {}) => {
    const say = (t: Parameters<typeof toast>[0]) => { if (!opts.quiet) toast(t); };
    try {
      if (!user?.id) {
        say({
          title: "Error",
          description: "You must be logged in to update deals",
          variant: "destructive"
        });
        return;
      }

      const updateData = dealUpdatePayload(dealData);

      const { data, error } = await supabase
        .from('crm_deals')
        .update(updateData)
        .eq('id', dealId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Supabase deal update error:', error);
        say({
          title: "Database Error",
          description: error.message || "Failed to update deal",
          variant: "destructive"
        });
        return;
      }

      // Update local state
      setDeals(prev => prev.map(deal => 
        deal.id === dealId ? data : deal
      ));
      
      say({
        title: "Success",
        description: "Deal updated successfully!"
      });
      
      return data;
    } catch (error) {
      console.error('Error updating deal:', error);
      say({
        title: "Error",
        description: `Failed to update deal: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const deleteDeal = async (dealId: string) => {
    try {
      if (!user?.id) {
        toast({
          title: "Error",
          description: "You must be logged in to delete deals",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('crm_deals')
        .delete()
        .eq('id', dealId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting deal:', error);
        toast({
          title: "Error",
          description: "Failed to delete deal",
          variant: "destructive"
        });
        return;
      }

      setDeals(prev => prev.filter(deal => deal.id !== dealId));
      
      toast({
        title: "Success",
        description: "Deal deleted successfully!"
      });
    } catch (error) {
      console.error('Error deleting deal:', error);
      toast({
        title: "Error",
        description: `Failed to delete deal: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const addDeal = async (dealData: Partial<Deal>) => {
    try {
      console.log('Adding deal with data:', dealData);
      
      if (!user?.id) {
        console.error('No user ID available');
        toast({
          title: "Error",
          description: "You must be logged in to add deals",
          variant: "destructive"
        });
        return;
      }

      // Validate required fields
      if (!dealData.title || dealData.title.trim() === '') {
        toast({
          title: "Error",
          description: "Deal title is required",
          variant: "destructive"
        });
        return;
      }

      // Explicit currency (deal's own, else the account currency) and probability (blank → null, 0 stays 0).
      const insertData = dealInsertPayload(dealData, user.id, accountCurrency);

      console.log('Insert deal data:', insertData);

      const { data, error } = await supabase
        .from('crm_deals')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Supabase deal error:', error);
        toast({
          title: "Database Error",
          description: error.message || "Failed to save deal to database",
          variant: "destructive"
        });
        return;
      }

      console.log('Deal added successfully:', data);
      
      // Update local state
      setDeals(prev => [...prev, data]);
      
      // Refresh data to ensure consistency
      await fetchCRMData();
      
      toast({
        title: "Success",
        description: "Deal added successfully!"
      });
      
      return data;
    } catch (error) {
      console.error('Error adding deal:', error);
      toast({
        title: "Error",
        description: `Failed to add deal: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  // Old deep link: CRM security moved to company settings.
  if (params.get('tab') === 'security') return <Navigate to="/settings?tab=company-security" replace />;

  const ready = canAccessCRM && !loading;

  const tabList = (
    <TabsList className={band
      ? 'flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 text-brand-navy-muted'
      : 'flex w-full overflow-x-auto justify-start'}>
      {[['contacts', 'Contacts'], ['deals', 'Sales Pipeline'], ['marketing', 'Marketing'], ['reports', 'Reports'], ['analytics', 'Analytics']].map(([v, label]) => (
        <TabsTrigger key={v} value={v} className={band
          ? 'min-h-touch rounded-none border-b-[3px] border-transparent px-4 pb-2 pt-2 text-body font-semibold text-brand-navy-muted shadow-none hover:text-white focus-visible:ring-[3px] focus-visible:ring-offset-0 data-[state=active]:border-nav-marker data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none'
          : undefined}>
          {label}
        </TabsTrigger>
      ))}
    </TabsList>
  );

  /** Navy header band for the full CRM page; tabs sit on the band. */
  const bandHeader = band && (
    <div className="bg-brand-navy text-brand-navy-foreground">
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-5 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-small text-brand-navy-muted">
            <li><Link to="/dashboard" className="inline-flex min-h-touch items-center rounded-sm underline-offset-2 md:min-h-0 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">{organization?.name || 'Company'}</Link></li>
            <li aria-hidden="true">/</li>
            <li>Customers</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-white">CRM</li>
          </ol>
        </nav>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1 className="text-page-title text-white">CRM</h1>
            <p className="mt-1 text-body text-brand-navy-muted">Manage contacts, opportunities and the next action for each relationship.</p>
          </div>
          {ready && (
            <div className="flex flex-wrap gap-2 [&_button]:min-h-touch [&_button]:focus-visible:ring-offset-brand-navy">
              {/* Outline button on navy: white text and border, like "Customise dashboard". */}
              <div className="contents [&>button]:border-white/50 [&>button]:bg-transparent [&>button]:text-white [&>button:hover]:bg-white/10 [&>button:hover]:text-white">
                <ContactsImportExport contacts={contacts} onImported={fetchCRMData} />
              </div>
              <Button onClick={() => { setActiveTab('contacts'); setAddContactOpen(true); }}>
                <Plus className="h-4 w-4" aria-hidden="true" />Add contact
              </Button>
            </div>
          )}
        </div>
        {ready ? <div className="mt-4">{tabList}</div> : <div className="h-5" />}
      </div>
    </div>
  );

  const shell = (body: React.ReactNode) => band ? (
    <div className="min-w-0">
      {bandHeader}
      <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">{body}</div>
    </div>
  ) : <div className="max-w-7xl mx-auto p-6 space-y-6">{body}</div>;

  if (!canAccessCRM) {
    return band ? shell(
      <div className="max-w-4xl">
        <SubscriptionUpgrade featureName="CRM" onUpgrade={() => window.location.reload()} />
      </div>
    ) : (
      <div className="max-w-4xl mx-auto p-6">
        <SubscriptionUpgrade 
          featureName="CRM" 
          onUpgrade={() => window.location.reload()}
        />
      </div>
    );
  }

  if (loading) {
    const spinner = (
      <div className="flex items-center justify-center min-h-[400px]" role="status" aria-label="Loading CRM">
        <Loader2 className="w-8 h-8 animate-spin" aria-hidden="true" />
      </div>
    );
    return band ? shell(spinner) : <div className="max-w-7xl mx-auto p-6">{spinner}</div>;
  }

  const statusColors = {
    lead: 'bg-gray-500',
    prospect: 'bg-blue-500',
    customer: 'bg-green-500'
  };

  const summary = crmSummary(contacts, deals);
  const showNoProbability = () => {
    const next = writeCrmTab(params, 'deals');
    next.set('prob', 'none');
    setParams(next);
  };
  const stats: { icon: typeof Users; label: string; value: string; hint: React.ReactNode }[] = [
    { icon: Users, label: 'Total contacts', value: String(summary.contacts), hint: 'Your own CRM contacts.' },
    { icon: Target, label: 'Open pipeline', value: formatByCurrency(summary.openByCurrency), hint: `Total value of ${summary.openDeals} open ${summary.openDeals === 1 ? 'deal' : 'deals'} (not won or lost), per currency, not converted.` },
    {
      icon: DollarSign, label: 'Weighted forecast',
      value: summary.withProbabilityDeals ? formatByCurrency(summary.weightedByCurrency) : '—',
      hint: (
        <>
          {summary.withProbabilityDeals === 0 ? 'Value × probability. No open deal has a probability yet.' : <>Value × probability, only for the {summary.withProbabilityDeals} open {summary.withProbabilityDeals === 1 ? 'deal' : 'deals'} that {summary.withProbabilityDeals === 1 ? 'has' : 'have'} a probability.</>}
          {summary.noProbabilityDeals > 0 && (
            <> <button type="button" onClick={showNoProbability} className="font-semibold text-link underline underline-offset-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring rounded-sm">
              {summary.noProbabilityDeals} open {summary.noProbabilityDeals === 1 ? 'deal has' : 'deals have'} no probability yet
            </button></>
          )}
        </>
      ),
    },
    { icon: TrendingUp, label: 'Customers', value: summary.customerShare == null ? '—' : `${summary.customerShare}%`, hint: 'Share of contacts with status Customer.' },
  ];

  const statsRow = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map(({ icon: Icon, label, value, hint }) => (
        <Card key={label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="w-4 h-4" aria-hidden="true" />{label}</div>
            <p className="text-2xl font-bold mt-1 break-words">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const panels = (
    <>
      <TabsContent value="contacts" className={band ? 'mt-0' : 'mt-6'}>
        <ContactsView 
          contacts={contacts} 
          statusColors={statusColors}
          onAddContact={addContact}
          onUpdateContact={updateContact}
          onDeleteContact={deleteContact}
          onRefresh={fetchCRMData}
          actionsInHeader={band}
          addOpen={addContactOpen}
          onAddOpenChange={setAddContactOpen}
        />
      </TabsContent>
      
      <TabsContent value="deals" className={band ? 'mt-0' : 'mt-6'}>
        <DealsView 
          deals={deals}
          contacts={contacts}
          onAddDeal={addDeal}
          onUpdateDeal={updateDeal}
          onDeleteDeal={deleteDeal}
          onRefresh={fetchCRMData}
        />
      </TabsContent>
      
      <TabsContent value="marketing" className={band ? 'mt-0' : 'mt-6'}>
        <MarketingTab contacts={contacts} />
      </TabsContent>

      <TabsContent value="reports" className={band ? 'mt-0' : 'mt-6'}>
        <ReportsTab contacts={contacts} deals={deals} error={loadError} onRetry={fetchCRMData} />
      </TabsContent>

      <TabsContent value="analytics" className={band ? 'mt-0' : 'mt-6'}>
        <AnalyticsTab contacts={contacts} deals={deals} error={loadError} onRetry={fetchCRMData} onOpenTab={setActiveTab} />
      </TabsContent>
    </>
  );

  // Tabs wraps the band too, so the tab list on the band controls the panels below it.
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      {band ? shell(<>{statsRow}{panels}</>) : (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Stats Cards — recorded data only */}
          {statsRow}

          {/* Main Content */}
          {tabList}
          {panels}
        </div>
      )}
    </Tabs>
  );
};

export default CRM;