import React, { useState, useEffect, useRef } from 'react';
import { Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import GoogleCalendarConnectCard from '@/components/integrations/GoogleCalendarConnectCard';
import TrelloConnectCard from '@/components/integrations/TrelloConnectCard';
import NotionConnectCard from '@/components/integrations/NotionConnectCard';
import SlackConnectCard from '@/components/integrations/SlackConnectCard';
import { FirecrawlComponent } from '@/components/integrations/FirecrawlComponent';

const IntegrationHub = () => {
  const { user } = useAuth();
  
  // Refs for scrolling to specific integration cards
  const googleRef = useRef<HTMLDivElement>(null);
  const trelloRef = useRef<HTMLDivElement>(null);
  const notionRef = useRef<HTMLDivElement>(null);
  const slackRef = useRef<HTMLDivElement>(null);
  const firecrawlRef = useRef<HTMLDivElement>(null);
  
  // Handle URL params to auto-scroll to specific integration
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const integration = urlParams.get('integration');
    
    const refMap: Record<string, React.RefObject<HTMLDivElement>> = {
      'google-calendar': googleRef,
      'google': googleRef,
      'trello': trelloRef,
      'notion': notionRef,
      'slack': slackRef,
      'firecrawl': firecrawlRef,
      'gmail': googleRef,
      'twilio': slackRef // Map twilio to slack section for now
    };
    
    if (integration && refMap[integration]?.current) {
      setTimeout(() => {
        refMap[integration].current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'center'
        });
        // Add highlight effect
        refMap[integration].current?.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50');
        setTimeout(() => {
          refMap[integration].current?.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50');
        }, 3000);
      }, 500);
    }
  }, []);

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
        <TabsList className="flex space-x-4 border-b pb-2">
          <TabsTrigger value="oauth" className="px-4 py-2">OAuth Integrations</TabsTrigger>
          <TabsTrigger value="tools" className="px-4 py-2">Web Scraping Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="oauth" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>OAuth Integrations</CardTitle>
              <p className="text-sm text-muted-foreground">
                Connect your accounts to sync data and automate workflows
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div ref={googleRef} className="transition-all duration-300">
                <GoogleCalendarConnectCard userId={user.id} />
              </div>
              <div ref={trelloRef} className="transition-all duration-300">
                <TrelloConnectCard userId={user.id} />
              </div>
              <div ref={notionRef} className="transition-all duration-300">
                <NotionConnectCard userId={user.id} />
              </div>
              <div ref={slackRef} className="transition-all duration-300">
                <SlackConnectCard userId={user.id} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Web Scraping & Data Extraction</CardTitle>
              <p className="text-sm text-muted-foreground">
                Extract data from websites and analyze content
              </p>
            </CardHeader>
            <CardContent>
              <div ref={firecrawlRef} className="transition-all duration-300">
                <FirecrawlComponent />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntegrationHub;