import { Link, useSearchParams } from 'react-router-dom';
import AccountSettings from '@/components/AccountSettings';
import NotificationPreferences from '@/components/NotificationPreferences';
import HMRCSettings from '@/components/hmrc/HMRCSettings';
import AccountSecurity from '@/components/settings/AccountSecurity';
import CompanyMembers from '@/components/settings/CompanyMembers';
import CompanySecurity from '@/components/settings/CompanySecurity';
import BillingSettings from '@/components/billing/BillingSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Bell, Building2, CreditCard, ShieldCheck, ArrowRight, Lock, Users, FileLock2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';

const TABS = ['account', 'security', 'billing', 'notifications', 'hmrc', 'members', 'company-security', 'companies'] as const;

const Settings = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab = TABS.includes(requested as typeof TABS[number]) ? requested! : 'account';

  const onTabChange = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === 'account') next.delete('tab'); else next.set('tab', value);
    setParams(next, { replace: true });
  };

  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Settings' }]}
        title="Account settings"
        description="Manage your account preferences, notifications, company data and secure connections."
      />

      <Tabs value={tab} onValueChange={onTabChange} className="space-y-6">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-max">
            <TabsTrigger value="account" className="gap-2"><User className="h-4 w-4" />Account</TabsTrigger>
            <TabsTrigger value="security" className="gap-2"><Lock className="h-4 w-4" />Security</TabsTrigger>
            <TabsTrigger value="billing" className="gap-2"><CreditCard className="h-4 w-4" />Billing</TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" />Notifications</TabsTrigger>
            <TabsTrigger value="hmrc" className="gap-2"><Building2 className="h-4 w-4" />HMRC</TabsTrigger>
            <TabsTrigger value="members" className="gap-2"><Users className="h-4 w-4" />Members &amp; roles</TabsTrigger>
            <TabsTrigger value="company-security" className="gap-2"><FileLock2 className="h-4 w-4" />Company security</TabsTrigger>
            <TabsTrigger value="companies" className="gap-2"><ShieldCheck className="h-4 w-4" />Company data</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="account"><AccountSettings /></TabsContent>
        <TabsContent value="security"><AccountSecurity /></TabsContent>
        <TabsContent value="members"><CompanyMembers /></TabsContent>
        <TabsContent value="company-security"><CompanySecurity /></TabsContent>
        <TabsContent value="billing"><BillingSettings /></TabsContent>
        <TabsContent value="notifications"><NotificationPreferences /></TabsContent>
        <TabsContent value="hmrc"><HMRCSettings onDisconnect={() => {}} /></TabsContent>
        <TabsContent value="companies">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unassigned projects</CardTitle>
              <CardDescription>Review projects created before companies existed and choose the company each one belongs to.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/settings/unassigned-projects">Review unassigned projects<ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
};

export default Settings;
