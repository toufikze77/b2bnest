import { Link, useSearchParams } from 'react-router-dom';
import AccountSettings from '@/components/AccountSettings';
import NotificationPreferences from '@/components/NotificationPreferences';
import InAppNotificationPreferences from '@/components/InAppNotificationPreferences';
import { MarketingConsentSwitch } from '@/components/MarketingConsent';
import HMRCSettings from '@/components/hmrc/HMRCSettings';
import AccountSecurity from '@/components/settings/AccountSecurity';
import CompanyMembers from '@/components/settings/CompanyMembers';
import InviteMembers from '@/components/settings/InviteMembers';
import CompanySecurity from '@/components/settings/CompanySecurity';
import BillingSettings from '@/components/billing/BillingSettings';
import YourData from '@/components/settings/YourData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Bell, Building2, CreditCard, ShieldCheck, ArrowRight, Lock, Users, FileLock2, Database } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { useDemoMode } from '@/contexts/demoModeState';
import { DemoReadonlyNote } from '@/components/demo/DemoBanner';

const TABS = ['account', 'security', 'billing', 'notifications', 'hmrc', 'members', 'company-security', 'companies', 'data'] as const;

const Settings = () => {
  const { isDemo } = useDemoMode();
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
        {/* Every tab visible: the list wraps onto more rows instead of hiding tabs behind a horizontal scrollbar. */}
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1" data-testid="settings-tabs">
          <TabsTrigger value="account" className="gap-2"><User className="h-4 w-4" />Account</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Lock className="h-4 w-4" />Security</TabsTrigger>
          <TabsTrigger value="billing" className="gap-2"><CreditCard className="h-4 w-4" />Billing</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" />Notifications</TabsTrigger>
          <TabsTrigger value="hmrc" className="gap-2"><Building2 className="h-4 w-4" />HMRC</TabsTrigger>
          <TabsTrigger value="members" className="gap-2"><Users className="h-4 w-4" />Members &amp; roles</TabsTrigger>
          <TabsTrigger value="company-security" className="gap-2"><FileLock2 className="h-4 w-4" />Company security</TabsTrigger>
          <TabsTrigger value="companies" className="gap-2"><ShieldCheck className="h-4 w-4" />Company data</TabsTrigger>
          <TabsTrigger value="data" className="gap-2"><Database className="h-4 w-4" />Your data</TabsTrigger>
        </TabsList>

        <TabsContent value="account"><AccountSettings /></TabsContent>
        <TabsContent value="security"><AccountSecurity /></TabsContent>
        <TabsContent value="members" className="space-y-4"><CompanyMembers />{isDemo ? <DemoReadonlyNote what="Inviting members" /> : <InviteMembers />}</TabsContent>
        <TabsContent value="company-security"><CompanySecurity /></TabsContent>
        <TabsContent value="billing">
          {/* Demo read-only: the plan is shown; its buttons are disabled (checkout and portal are refused by the server too). */}
          {isDemo ? (
            <div className="space-y-4"><DemoReadonlyNote what="Billing" /><fieldset disabled className="min-w-0" aria-label="Billing (view only)"><BillingSettings /></fieldset></div>
          ) : <BillingSettings />}
        </TabsContent>
        <TabsContent value="notifications" className="space-y-4"><InAppNotificationPreferences /><NotificationPreferences /><MarketingConsentSwitch /></TabsContent>
        <TabsContent value="hmrc"><HMRCSettings /></TabsContent>
        <TabsContent value="data"><YourData /></TabsContent>
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
