import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap, Calendar, Cloud, Mail, Share2, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';

const IntegrationsGuide = () => {
  return (
    <>
      <SEOHead 
        title="Integrations Guide | B2BNEST"
        description="Learn how to integrate B2BNEST with Google Calendar, HMRC, social media platforms, and more"
      />
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <Button asChild variant="ghost" className="mb-6">
            <Link to="/knowledge-base">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Knowledge Base
            </Link>
          </Button>

          <div className="mb-8">
            <Zap className="h-12 w-12 text-primary mb-4" />
            <h1 className="text-4xl font-bold mb-4">Integrations Guide</h1>
            <p className="text-xl text-muted-foreground">
              Connect B2BNEST with your favorite tools and services
            </p>
          </div>

          {/* Google Calendar */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Google Calendar Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Sync your B2BNEST tasks and events with Google Calendar for seamless scheduling.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Setup Process</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Go to Dashboard → Integrations</li>
                  <li>Click "Connect" on Google Calendar card</li>
                  <li>Sign in with your Google account</li>
                  <li>Grant calendar access permissions</li>
                  <li>Select which calendars to sync</li>
                  <li>Configure sync preferences</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">What Gets Synced</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Project deadlines and milestones</li>
                  <li>Task due dates</li>
                  <li>Scheduled meetings and events</li>
                  <li>Team member availability</li>
                  <li>Recurring tasks (optional)</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Changes made in either Google Calendar or B2BNEST will sync automatically within 5 minutes.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* iCloud Calendar */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>iCloud Calendar Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Connect your Apple iCloud Calendar to keep all your events synchronized.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Connection Steps</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Navigate to Dashboard → Integrations</li>
                  <li>Select "iCloud Calendar"</li>
                  <li>Enter your Apple ID credentials</li>
                  <li>Enable two-factor authentication if prompted</li>
                  <li>Select calendars to sync</li>
                  <li>Save integration settings</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Troubleshooting</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Ensure two-factor authentication is enabled on your Apple ID</li>
                  <li>Use an app-specific password for added security</li>
                  <li>Check iCloud calendar sharing settings</li>
                  <li>Verify internet connection and sync status</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Outlook 365 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Outlook 365 Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Integrate Microsoft Outlook for email and calendar synchronization.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Features</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Sync Outlook calendar with B2BNEST events</li>
                  <li>Send invoices and documents via Outlook</li>
                  <li>Create tasks from emails</li>
                  <li>Access contacts from Outlook</li>
                  <li>Schedule meetings with team members</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Setup Requirements</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Active Microsoft 365 subscription</li>
                  <li>Admin permissions for calendar access</li>
                  <li>OAuth authentication enabled</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* OneDrive */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-primary" />
                OneDrive Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Access and manage your OneDrive files directly from B2BNEST.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Capabilities</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Attach OneDrive files to projects and tasks</li>
                  <li>Save B2BNEST documents to OneDrive</li>
                  <li>Share files with team members</li>
                  <li>Real-time file synchronization</li>
                  <li>Version control and history</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">File Types Supported</h3>
                <p className="text-muted-foreground">
                  All Microsoft Office files, PDFs, images, and common document formats are fully supported.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Social Media */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                Social Media Automation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Connect Twitter, LinkedIn, and Facebook to automate your social media presence.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Twitter/X Integration</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Schedule tweets in advance</li>
                  <li>Auto-post project updates</li>
                  <li>Share business milestones</li>
                  <li>Analytics and engagement tracking</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">LinkedIn Integration</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Publish to your company page</li>
                  <li>Share articles and updates</li>
                  <li>Import LinkedIn connections to CRM</li>
                  <li>Track post performance</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Facebook Pages</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Schedule posts to business page</li>
                  <li>Respond to messages from B2BNEST</li>
                  <li>Share promotional content</li>
                  <li>View page insights</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* HMRC Integration */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                HMRC Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Connect directly to HMRC for seamless UK tax submissions and compliance.
              </p>

              <div>
                <h3 className="font-semibold mb-2">What You Can Do</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Submit VAT returns electronically</li>
                  <li>File payroll RTI submissions</li>
                  <li>View tax obligations and deadlines</li>
                  <li>Check payment status</li>
                  <li>Download historical submissions</li>
                  <li>Automatic Making Tax Digital compliance</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Setup Requirements</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Valid HMRC Government Gateway credentials</li>
                  <li>MTD-enabled business account</li>
                  <li>VAT registration number (for VAT submissions)</li>
                  <li>PAYE reference (for payroll submissions)</li>
                </ol>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Important:</strong> HMRC integration requires additional verification. Setup can take 2-3 business days for approval.
                </p>
              </div>

              <Button asChild className="w-full">
                <Link to="/dashboard">Configure HMRC Integration</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Security & Permissions */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>Security & Permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                All integrations use secure OAuth 2.0 authentication:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">✓</span>
                  <span>Your passwords are never stored by B2BNEST</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span>
                  <span>You can revoke access at any time</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span>
                  <span>Encrypted data transmission</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span>
                  <span>Granular permission controls</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">✓</span>
                  <span>Regular security audits</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default IntegrationsGuide;
