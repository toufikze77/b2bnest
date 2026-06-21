import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Filter, Target, FileText, Globe, Upload, Users,
  Flame, Zap, CheckCircle2, ArrowRight, Mail, BarChart3
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center">
      {n}
    </div>
    <div className="flex-1 pb-2">
      <h4 className="font-semibold mb-1">{title}</h4>
      <div className="text-sm text-muted-foreground space-y-2">{children}</div>
    </div>
  </div>
);

const LeadGenerationGuide = () => {
  return (
    <>
      <SEOHead
        title="Lead Generation Guide | B2BNEST Knowledge Base"
        description="Step-by-step guide to using the B2BNEST Lead Generation & Prospecting module: capture leads, build forms and landing pages, score, and sync to CRM."
        keywords="lead generation guide, b2bnest leads, lead scoring, form builder, landing page builder, CRM sync"
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
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Filter className="h-8 w-8 text-primary" />
              </div>
              <Badge variant="secondary">New & Featured</Badge>
            </div>
            <h1 className="text-4xl font-bold mb-3">Lead Generation & Prospecting</h1>
            <p className="text-xl text-muted-foreground">
              A step-by-step guide to capture, score, and convert leads — and sync them straight into your CRM.
            </p>
          </div>

          {/* Quick Start */}
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Quick Start (60 seconds)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Step n={1} title="Open Lead Generation">
                Go to <strong>Business Tools</strong> and click the featured <strong>Lead Generation</strong> card,
                or visit <code className="px-1.5 py-0.5 rounded bg-muted">/lead-generation</code> directly.
              </Step>
              <Step n={2} title="Add your first lead">
                On the <strong>Overview</strong>, use <strong>Quick Add</strong> — enter name, email and source, then save.
                It instantly appears in your pipeline with a calculated score.
              </Step>
              <Step n={3} title="Push it to CRM">
                Open the lead, click <strong>Add to CRM</strong>. It becomes a contact in your CRM with the
                <code className="px-1.5 py-0.5 rounded bg-muted ml-1">from-lead-gen</code> tag.
              </Step>
              <div className="pt-2">
                <Button asChild>
                  <Link to="/lead-generation">
                    Open Lead Generation <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Section: Leads */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Managing Leads
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Step n={1} title="Browse the pipeline">
                Click <strong>Leads</strong> in the side menu to see every lead in one paginated table.
                Filter by <strong>Status</strong>, <strong>Source</strong>, or <strong>Score</strong>.
              </Step>
              <Step n={2} title="Open a lead">
                Click any row to open the detail slide-over. Edit fields, change status
                (<em>New → Contacted → Qualified → Converted</em>), and add timestamped notes.
              </Step>
              <Step n={3} title="Convert to CRM contact">
                Hit <strong>Add to CRM</strong>. We check for duplicate emails first, so the same person
                never lands in your CRM twice.
              </Step>
              <Step n={4} title="Export anytime">
                Use <strong>Export CSV</strong> to download leads for outreach campaigns or backups.
              </Step>
            </CardContent>
          </Card>

          {/* Section: Scoring */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-amber-500" />
                How Lead Scoring Works (0–100)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Every lead receives an automatic score based on data completeness, source quality, and engagement.
              </p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li>• Email <Badge variant="outline">+20</Badge>, Phone <Badge variant="outline">+15</Badge>, Company <Badge variant="outline">+15</Badge></li>
                <li>• Source: Referral / Event <Badge variant="outline">+20</Badge>, Website / Form / Landing Page <Badge variant="outline">+10</Badge>, Cold Outreach <Badge variant="outline">+5</Badge></li>
                <li>• Status: Contacted <Badge variant="outline">+10</Badge>, Qualified <Badge variant="outline">+25</Badge></li>
                <li>• Recency: created within 7 days <Badge variant="outline">+5</Badge></li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge className="bg-gray-200 text-gray-700 hover:bg-gray-200">Cold 0–39</Badge>
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Warm 40–69</Badge>
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Hot 70–89</Badge>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Ready 90–100</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Section: Forms */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Building Lead Capture Forms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Step n={1} title="Create a form">
                Go to <strong>Forms → New Form</strong>. You'll get a split-screen builder: fields on the left, live preview on the right.
              </Step>
              <Step n={2} title="Add and arrange fields">
                Click any field type (Text, Email, Phone, Textarea, Select…) to add it. The first three core fields
                (First Name, Last Name, Email) are locked to ensure clean CRM data.
              </Step>
              <Step n={3} title="Style and configure">
                Set the title, button text, primary color, GDPR consent, success message, and an optional redirect URL.
              </Step>
              <Step n={4} title="Publish & embed">
                Switch status to <strong>Active</strong>. Copy the generated embed snippet, or share the hosted form
                URL at <code className="px-1.5 py-0.5 rounded bg-muted">/f/&lt;formId&gt;</code>.
              </Step>
              <Step n={5} title="Submissions become leads">
                Every form submission creates a lead, tagged with the form's source tag.
              </Step>
            </CardContent>
          </Card>

          {/* Section: Landing Pages */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Publishing Landing Pages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Step n={1} title="Create a page">
                Go to <strong>Pages → New Page</strong>. Add blocks: Hero, Features, Text, Form, Social Proof, CTA.
              </Step>
              <Step n={2} title="Embed a form">
                Add a <strong>Form</strong> block and select one of your active forms — submissions feed leads back automatically.
              </Step>
              <Step n={3} title="SEO & favicon">
                Set the page title, SEO description, and favicon emoji in <strong>Settings</strong>.
              </Step>
              <Step n={4} title="Publish">
                Set status to <strong>Published</strong>. Your page goes live at
                <code className="px-1.5 py-0.5 rounded bg-muted ml-1">/p/&lt;slug&gt;</code> — share the link anywhere.
              </Step>
            </CardContent>
          </Card>

          {/* Section: Import */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Importing Leads from CSV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Step n={1} title="Upload your file">
                Go to <strong>Import</strong> and drop in any CSV. We'll auto-detect headers.
              </Step>
              <Step n={2} title="Map columns">
                Match each CSV column to a lead field (First Name, Email, Company…). Skip columns you don't need.
              </Step>
              <Step n={3} title="Review duplicates">
                Existing leads with the same email are flagged so you can choose to skip or update.
              </Step>
              <Step n={4} title="Import">
                Confirm — leads land in your pipeline tagged with the <strong>CSV Import</strong> source.
              </Step>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-semibold mb-1">Where is my data stored?</p>
                <p className="text-muted-foreground">
                  Leads, forms, and pages are stored locally in your browser for instant performance.
                  Once a lead is sent to CRM, it's saved to your secure cloud CRM database.
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1">Do I have to pay extra?</p>
                <p className="text-muted-foreground">
                  No — Lead Generation is included free in every B2BNEST account.
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1">Can I get notified of new leads?</p>
                <p className="text-muted-foreground">
                  Yes — enable <strong>Email notification</strong> in any form's settings tab.
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1">How do I prevent spam?</p>
                <p className="text-muted-foreground">
                  Spam protection is on by default for every form. You can also require GDPR consent.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="text-center py-8">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-3" />
              <h3 className="text-2xl font-bold mb-2">Ready to generate leads?</h3>
              <p className="text-muted-foreground mb-5">
                Jump in and create your first form, landing page, or import a CSV.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button asChild size="lg">
                  <Link to="/lead-generation">
                    <Target className="mr-2 h-4 w-4" />
                    Open Lead Generation
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/contact">
                    <Mail className="mr-2 h-4 w-4" />
                    Contact Support
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

export default LeadGenerationGuide;
