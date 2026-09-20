import React from 'react';
import AccountSettings from '@/components/AccountSettings';
import NotificationPreferences from '@/components/NotificationPreferences';
import HMRCSettings from '@/components/hmrc/HMRCSettings';
import BillingSettings from '@/components/billing/BillingSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Bell, Building2, CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

const Settings = () => {
  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <PageHeader className="mb-6" eyebrow="Settings" title="Account settings" description="Manage your account preferences, notifications and secure connections." />
          
          <Tabs defaultValue="account" className="space-y-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="account" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Account
              </TabsTrigger>
              <TabsTrigger value="billing" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Billing
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="hmrc" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                HMRC
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="account">
              <AccountSettings />
            </TabsContent>

            <TabsContent value="billing">
              <BillingSettings />
            </TabsContent>
            
            <TabsContent value="notifications">
              <NotificationPreferences />
            </TabsContent>
            
            <TabsContent value="hmrc">
              <HMRCSettings onDisconnect={() => {}} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Settings;