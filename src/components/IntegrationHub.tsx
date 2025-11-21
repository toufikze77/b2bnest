import React, { useState, useEffect, useRef } from 'react';
import { Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import GoogleCalendarConnectCard from '@/components/integrations/GoogleCalendarConnectCard';
import OneDriveConnectCard from '@/components/integrations/OneDriveConnectCard';
import TwitterConnectCard from '@/components/integrations/TwitterConnectCard';
import LinkedInConnectCard from '@/components/integrations/LinkedInConnectCard';
import FacebookConnectCard from '@/components/integrations/FacebookConnectCard';
import { FirecrawlComponent } from '@/components/integrations/FirecrawlComponent';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

const IntegrationHub = () => {
  const { user } = useAuth();
  
  // Refs for scrolling to specific integration cards
  const googleRef = useRef<HTMLDivElement>(null);
  const onedriveRef = useRef<HTMLDivElement>(null);
  const twitterRef = useRef<HTMLDivElement>(null);
  const linkedinRef = useRef<HTMLDivElement>(null);
  const facebookRef = useRef<HTMLDivElement>(null);
  const firecrawlRef = useRef<HTMLDivElement>(null);
  
  // Handle URL params to auto-scroll to specific integration
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const integration = urlParams.get('integration');
    
    const refMap: Record<string, React.RefObject<HTMLDivElement>> = {
      'google-calendar': googleRef,
      'google_calendar': googleRef,
      'google': googleRef,
      'onedrive': onedriveRef,
      'twitter': twitterRef,
      'linkedin': linkedinRef,
      'facebook': facebookRef,
      'firecrawl': firecrawlRef,
    };
    
    if (integration && refMap[integration]?.current) {
      setTimeout(() => {
        refMap[integration].current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'center'
        });
        // Add highlight effect
        refMap[integration].current?.classList.add('ring-2', 'ring-primary', 'ring-opacity-50');
        setTimeout(() => {
          refMap[integration].current?.classList.remove('ring-2', 'ring-primary', 'ring-opacity-50');
        }, 3000);
      }, 500);
    }
  }, []);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-2 border-dashed">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              Sign In Required
            </CardTitle>
            <p className="text-muted-foreground mt-2">
              Please sign in to access integrations and connect your accounts.
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Integration Hub</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Connect your accounts and tools to streamline your workflow and boost productivity.
        </p>
      </div>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          All connections are secure and encrypted. Your credentials are stored safely and only accessible by you.
          Click on any integration to see step-by-step instructions.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="oauth" className="space-y-6">
        <TabsList>
          <TabsTrigger value="oauth">OAuth Integrations</TabsTrigger>
          <TabsTrigger value="tools">Web Scraping Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="oauth" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connect Your Accounts</CardTitle>
              <p className="text-sm text-muted-foreground">
                Authorize access to your favorite tools and platforms
              </p>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div ref={googleRef} className="transition-all duration-300">
                <GoogleCalendarConnectCard userId={user.id} />
              </div>
              <div ref={onedriveRef} className="transition-all duration-300">
                <OneDriveConnectCard userId={user.id} />
              </div>
              <div ref={twitterRef} className="transition-all duration-300">
                <TwitterConnectCard userId={user.id} />
              </div>
              <div ref={linkedinRef} className="transition-all duration-300">
                <LinkedInConnectCard userId={user.id} />
              </div>
              <div ref={facebookRef} className="transition-all duration-300">
                <FacebookConnectCard userId={user.id} />
              </div>
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
