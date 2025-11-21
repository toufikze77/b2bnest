import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap, GitBranch, Mail, Share2, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';

const WorkflowGuide = () => {
  return (
    <>
      <SEOHead 
        title="Workflow Automation Guide | B2BNEST"
        description="Learn how to automate your business processes with B2BNEST workflow builder"
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
            <h1 className="text-4xl font-bold mb-4">Workflow Automation Guide</h1>
            <p className="text-xl text-muted-foreground">
              Automate repetitive tasks and streamline your business processes
            </p>
          </div>

          {/* Creating First Workflow */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                Creating Your First Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Workflows automate repetitive tasks by connecting triggers and actions. Here's how to get started:
              </p>

              <div>
                <h3 className="font-semibold mb-2">Step-by-Step Tutorial</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Navigate to Dashboard → Workflow Studio</li>
                  <li>Click "Create New Workflow"</li>
                  <li>Give your workflow a descriptive name</li>
                  <li>Choose a trigger (what starts the workflow)</li>
                  <li>Add actions (what happens when triggered)</li>
                  <li>Configure action parameters</li>
                  <li>Test your workflow</li>
                  <li>Activate and monitor</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Example: Welcome Email Workflow</h3>
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <p className="text-sm"><strong>Trigger:</strong> New contact added to CRM</p>
                  <p className="text-sm"><strong>Action 1:</strong> Wait 5 minutes</p>
                  <p className="text-sm"><strong>Action 2:</strong> Send welcome email</p>
                  <p className="text-sm"><strong>Action 3:</strong> Add to "New Leads" list</p>
                  <p className="text-sm"><strong>Action 4:</strong> Notify sales team</p>
                </div>
              </div>

              <Button asChild className="w-full">
                <Link to="/workflow-studio">Open Workflow Studio</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Workflow Triggers */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Understanding Workflow Triggers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Triggers are events that automatically start your workflow. Choose the right trigger for your needs:
              </p>

              <div>
                <h3 className="font-semibold mb-2">Time-Based Triggers</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Schedule (daily, weekly, monthly)</li>
                  <li>Specific date and time</li>
                  <li>Recurring intervals</li>
                  <li>Business hours only</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Event-Based Triggers</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>New contact created</li>
                  <li>Deal stage changed</li>
                  <li>Invoice paid</li>
                  <li>Task completed</li>
                  <li>Form submitted</li>
                  <li>Email received</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Condition-Based Triggers</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Contact value exceeds threshold</li>
                  <li>Task overdue by X days</li>
                  <li>Deal idle for X days</li>
                  <li>Expense category matches criteria</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Email Automation */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Email Automation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Automate email sending based on customer actions, dates, or business events.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Email Workflow Actions</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Send personalized emails with merge fields</li>
                  <li>Use pre-built email templates</li>
                  <li>Attach documents automatically</li>
                  <li>Schedule email send time</li>
                  <li>Add CC/BCC recipients</li>
                  <li>Track opens and clicks</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Use Cases</h3>
                <div className="space-y-3">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="font-semibold text-sm mb-1">Onboarding Sequence</p>
                    <p className="text-sm text-muted-foreground">
                      Send a series of emails to new clients over their first 30 days
                    </p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="font-semibold text-sm mb-1">Invoice Reminders</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically remind clients of overdue invoices
                    </p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="font-semibold text-sm mb-1">Follow-Up Emails</p>
                    <p className="text-sm text-muted-foreground">
                      Reach out to leads who haven't responded in X days
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social Media Scheduling */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                Social Media Scheduling
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Automate your social media presence by scheduling posts across platforms.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Supported Platforms</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Twitter/X</li>
                  <li>LinkedIn (personal & company pages)</li>
                  <li>Facebook business pages</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Scheduling Features</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Queue posts for optimal times</li>
                  <li>Recurring post schedules</li>
                  <li>Cross-post to multiple platforms</li>
                  <li>Add images, videos, links</li>
                  <li>Hashtag suggestions</li>
                  <li>Post preview before publishing</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Automation Examples</h3>
                <div className="space-y-2">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm"><strong>Blog Post Promotion:</strong> Automatically share new blog articles on all social platforms</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm"><strong>Milestone Announcements:</strong> Post when projects reach completion or deals close</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm"><strong>Content Calendar:</strong> Schedule weekly tips, quotes, or updates in advance</p>
                  </div>
                </div>
              </div>

              <Button asChild className="w-full">
                <Link to="/business-tools">Open Social Scheduler</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Advanced Workflows */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Advanced Workflow Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Take your automation to the next level with advanced workflow capabilities.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Conditional Logic</h3>
                <p className="text-muted-foreground mb-2">
                  Create branching workflows that take different paths based on conditions:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>If/Then/Else conditions</li>
                  <li>Multiple condition groups (AND/OR)</li>
                  <li>Field comparisons</li>
                  <li>Date calculations</li>
                  <li>Custom field checks</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Loops & Iterations</h3>
                <p className="text-muted-foreground mb-2">
                  Process multiple items or repeat actions:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Loop through contact lists</li>
                  <li>Process invoice line items</li>
                  <li>Repeat actions with delays</li>
                  <li>Batch operations</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Data Transformations</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Format dates and numbers</li>
                  <li>Combine text fields</li>
                  <li>Extract data from text</li>
                  <li>Calculate values</li>
                  <li>Convert currencies</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Error Handling</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Retry failed actions automatically</li>
                  <li>Fallback actions on error</li>
                  <li>Error notifications to admins</li>
                  <li>Skip and continue on failure</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Workflow Templates */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Pre-Built Workflow Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Get started quickly with our library of ready-to-use workflow templates:
              </p>

              <div className="grid gap-3">
                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold mb-1">Lead Nurturing Sequence</h4>
                  <p className="text-sm text-muted-foreground">
                    Automatically follow up with new leads over 14 days with personalized emails
                  </p>
                </div>

                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold mb-1">Invoice Collection</h4>
                  <p className="text-sm text-muted-foreground">
                    Send payment reminders at 3, 7, and 14 days after due date
                  </p>
                </div>

                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold mb-1">Client Onboarding</h4>
                  <p className="text-sm text-muted-foreground">
                    Welcome new clients with document requests, introductions, and resources
                  </p>
                </div>

                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold mb-1">Task Assignment</h4>
                  <p className="text-sm text-muted-foreground">
                    Automatically assign tasks to team members based on project type or workload
                  </p>
                </div>

                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold mb-1">Social Media Content Calendar</h4>
                  <p className="text-sm text-muted-foreground">
                    Schedule and post content across platforms at optimal times
                  </p>
                </div>
              </div>

              <Button asChild className="w-full">
                <Link to="/workflow-studio">Browse Workflow Templates</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Best Practices */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>Workflow Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span><strong>Start simple:</strong> Begin with basic workflows and add complexity as needed</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span><strong>Test thoroughly:</strong> Always test workflows before activating them</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span><strong>Monitor regularly:</strong> Check workflow logs weekly for errors or issues</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span><strong>Use descriptive names:</strong> Name workflows clearly so you know what they do</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span><strong>Add comments:</strong> Document complex logic for future reference</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">→</span>
                  <span><strong>Review & optimize:</strong> Periodically review workflows and remove unused ones</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default WorkflowGuide;
