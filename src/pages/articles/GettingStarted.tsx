import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Book, CheckCircle, Users, Layout } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';

const GettingStarted = () => {
  return (
    <>
      <SEOHead 
        title="Getting Started with B2BNEST | Complete Guide"
        description="Learn how to get started with B2BNEST - from account creation to your first project setup"
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
            <Book className="h-12 w-12 text-primary mb-4" />
            <h1 className="text-4xl font-bold mb-4">Getting Started with B2BNEST</h1>
            <p className="text-xl text-muted-foreground">
              Everything you need to know to start using B2BNEST effectively
            </p>
          </div>

          {/* Creating Your Account */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Creating Your Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">1. Sign Up</h3>
                <p className="text-muted-foreground mb-2">
                  Visit <Link to="/auth" className="text-primary hover:underline">b2bnest.online/auth</Link> and click "Sign Up"
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Enter your email address and create a strong password</li>
                  <li>Verify your email by clicking the link sent to your inbox</li>
                  <li>Complete your profile with your name and company details</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">2. Profile Setup</h3>
                <p className="text-muted-foreground mb-2">
                  After signing up, you'll be directed to complete your profile:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Add your business name and industry</li>
                  <li>Upload a company logo (optional)</li>
                  <li>Set your timezone and currency preferences</li>
                  <li>Choose your notification settings</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">3. Explore the Free Trial</h3>
                <p className="text-muted-foreground">
                  All new accounts start with a 14-day free trial with access to all premium features. No credit card required!
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Dashboard Overview */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5 text-primary" />
                Dashboard Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your dashboard is your central hub for all B2BNEST features:
              </p>

              <div>
                <h3 className="font-semibold mb-2">Main Navigation</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li><strong>Business Tools:</strong> Access invoicing, CRM, time tracking, and more</li>
                  <li><strong>Market:</strong> Explore PLR documents and business templates</li>
                  <li><strong>Fundraising:</strong> Information about B2BN token presale</li>
                  <li><strong>Dashboard:</strong> Your personalized activity overview</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Quick Actions</h3>
                <p className="text-muted-foreground mb-2">
                  From your dashboard, you can quickly:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Create new invoices or quotes</li>
                  <li>Add CRM contacts and deals</li>
                  <li>Start time tracking for projects</li>
                  <li>Generate business documents</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* First Project Setup */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>First Project Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Projects help you organize your work, team, and tasks in one place:
              </p>

              <div>
                <h3 className="font-semibold mb-2">Creating a Project</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Navigate to Dashboard and click "Create New Project"</li>
                  <li>Enter project name, description, and set deadlines</li>
                  <li>Assign team members (if applicable)</li>
                  <li>Create initial tasks and milestones</li>
                  <li>Set up project-specific tags and categories</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Project Management Features</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Task assignment and tracking</li>
                  <li>Time logging and reporting</li>
                  <li>File attachments and documents</li>
                  <li>Team collaboration and comments</li>
                  <li>Progress visualization with charts</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Inviting Team Members */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Inviting Team Members
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Collaborate with your team by inviting members to your workspace:
              </p>

              <div>
                <h3 className="font-semibold mb-2">How to Invite</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Go to Settings → Team Management</li>
                  <li>Click "Invite Team Member"</li>
                  <li>Enter their email address and select their role</li>
                  <li>Set permissions (View, Edit, Admin)</li>
                  <li>Send invitation - they'll receive an email to join</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Team Roles</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li><strong>Admin:</strong> Full access to all features and settings</li>
                  <li><strong>Manager:</strong> Create and manage projects, view reports</li>
                  <li><strong>Member:</strong> Access assigned projects and tasks</li>
                  <li><strong>Viewer:</strong> Read-only access to projects</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Now that you're set up, explore these features:</p>
              <div className="grid md:grid-cols-2 gap-4">
                <Button asChild variant="outline" className="h-auto py-4 justify-start">
                  <Link to="/business-tools">
                    <div className="text-left">
                      <div className="font-semibold">Business Tools</div>
                      <div className="text-sm text-muted-foreground">Invoice, CRM, Time Tracking</div>
                    </div>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-4 justify-start">
                  <Link to="/knowledge-base">
                    <div className="text-left">
                      <div className="font-semibold">Integrations</div>
                      <div className="text-sm text-muted-foreground">Connect Google, HMRC, and more</div>
                    </div>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default GettingStarted;
