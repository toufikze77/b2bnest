import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import GoogleCalendarConnectCard from '@/components/integrations/GoogleCalendarConnectCard';
import TrelloConnectCard from '@/components/integrations/TrelloConnectCard';
import { FirecrawlComponent } from '@/components/integrations/FirecrawlComponent';

const IntegrationHub = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-2 border-dashed border-blue-300">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-gray-900">
              Sign In Required
            </CardTitle>
            <p className="text-gray-600 mt-2">
              Please sign in to access integrations and connect your accounts.
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Integration Hub</h2>
        </div>
        <p className="text-gray-600">
          Connect your accounts and tools to streamline your workflow and boost productivity.
        </p>
      </div>

      <Tabs defaultValue="oauth" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="oauth">OAuth Integrations</TabsTrigger>
          <TabsTrigger value="tools">Web Scraping Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="oauth" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>OAuth Integrations</CardTitle>
              <p className="text-sm text-muted-foreground">
                Connect your accounts to sync data and automate workflows
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <GoogleCalendarConnectCard userId={user.id} />
              <TrelloConnectCard userId={user.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Web Scraping & Data Extraction</CardTitle>
              <p className="text-sm text-muted-foreground">
                Extract data from websites and analyze content
              </p>
            </CardHeader>
            <CardContent>
              <FirecrawlComponent />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntegrationHub;