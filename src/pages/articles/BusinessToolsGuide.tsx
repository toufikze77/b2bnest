import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Wrench, FileText, Users, Clock, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';

const BusinessToolsGuide = () => {
  return (
    <>
      <SEOHead 
        title="Business Tools Guide | B2BNEST"
        description="Complete guide to B2BNEST business tools including invoicing, CRM, project management, and time tracking"
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
            <Wrench className="h-12 w-12 text-primary mb-4" />
            <h1 className="text-4xl font-bold mb-4">Business Tools Guide</h1>
            <p className="text-xl text-muted-foreground">
              Master all the business tools available in B2BNEST
            </p>
          </div>

          {/* Invoice Generator */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Invoice Generator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Create professional, customizable invoices in minutes with our powerful invoice generator.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Creating an Invoice</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Navigate to <strong>Business Tools → Invoice Generator</strong></li>
                  <li>Fill in your company details (or load from profile)</li>
                  <li>Add client information and invoice number</li>
                  <li>Add line items with descriptions, quantities, and prices</li>
                  <li>Set tax rate and currency</li>
                  <li>Preview and download as PDF or send via email</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Key Features</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Auto-incrementing invoice numbers</li>
                  <li>Multiple currency support</li>
                  <li>Customizable templates and branding</li>
                  <li>Automatic tax calculations</li>
                  <li>Payment terms and due dates</li>
                  <li>Save as draft or send immediately</li>
                </ul>
              </div>

              <Button asChild className="w-full">
                <Link to="/business-tools">Open Invoice Generator</Link>
              </Button>
            </CardContent>
          </Card>

          {/* CRM System */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                CRM System Tutorial
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Manage your customer relationships, track deals, and grow your sales pipeline.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Managing Contacts</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Add contacts with detailed information</li>
                  <li>Tag and categorize contacts</li>
                  <li>Track interaction history</li>
                  <li>Set reminders for follow-ups</li>
                  <li>Import/export contact lists</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Deal Pipeline</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Create deals with values and stages</li>
                  <li>Drag-and-drop pipeline management</li>
                  <li>Set probability and close dates</li>
                  <li>Link deals to contacts</li>
                  <li>Track revenue forecasts</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Analytics & Reports</h3>
                <p className="text-muted-foreground mb-2">
                  Get insights into your sales performance:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Conversion rates by stage</li>
                  <li>Revenue trends over time</li>
                  <li>Sales team performance</li>
                  <li>Deal velocity metrics</li>
                </ul>
              </div>

              <Button asChild className="w-full">
                <Link to="/crm">Open CRM System</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Project Management */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Project Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Organize tasks, track progress, and collaborate with your team effectively.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Task Management</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Create tasks with priorities and deadlines</li>
                  <li>Assign tasks to team members</li>
                  <li>Set dependencies between tasks</li>
                  <li>Track progress with status updates</li>
                  <li>Add comments and attachments</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Views Available</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li><strong>List View:</strong> Detailed task list with sorting</li>
                  <li><strong>Board View:</strong> Kanban-style drag-and-drop</li>
                  <li><strong>Calendar View:</strong> Timeline and deadlines</li>
                  <li><strong>Gantt Chart:</strong> Project timeline visualization</li>
                </ul>
              </div>

              <Button asChild className="w-full">
                <Link to="/dashboard">Open Project Management</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Time Tracking */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Time Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Track billable hours, monitor productivity, and generate detailed time reports.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Tracking Time</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Start/stop timers for tasks</li>
                  <li>Manual time entry for past work</li>
                  <li>Tag time entries by project and client</li>
                  <li>Mark entries as billable/non-billable</li>
                  <li>Add notes and descriptions</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Reports & Invoicing</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Generate timesheet reports</li>
                  <li>Export to various formats</li>
                  <li>Convert time entries to invoices</li>
                  <li>View team productivity metrics</li>
                </ul>
              </div>

              <Button asChild className="w-full">
                <Link to="/business-tools">Open Time Tracker</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Document Templates */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Document Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Access over 100 professionally designed business document templates.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Available Templates</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Contracts and agreements</li>
                  <li>Proposals and quotes</li>
                  <li>Marketing materials</li>
                  <li>HR documents</li>
                  <li>Financial reports</li>
                  <li>Legal forms</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Using Templates</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Browse templates by category</li>
                  <li>Preview before downloading</li>
                  <li>Customize with your branding</li>
                  <li>Download in multiple formats (PDF, Word, Excel)</li>
                </ol>
              </div>

              <Button asChild className="w-full">
                <Link to="/market">Browse Templates</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Tips & Best Practices */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>Tips & Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span>Customize your invoice templates with your brand colors and logo</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span>Set up automated reminders for overdue invoices</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span>Regularly update your CRM with interaction notes</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span>Use tags and filters to organize large contact lists</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span>Track time daily to ensure accurate billing</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default BusinessToolsGuide;
