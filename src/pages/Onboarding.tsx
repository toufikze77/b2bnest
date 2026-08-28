import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Rocket, Users, FolderKanban, FileText, LifeBuoy, Settings2, CheckCircle2, Circle,
  ArrowRight, Bell, Building2, Plug, CreditCard, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import Footer from '@/components/Footer';
import SEOHead from '@/components/SEOHead';
import CsvImportWizard, { type ImportResult } from '@/components/onboarding/CsvImportWizard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toNumber, toDate, type ImportField } from '@/lib/csvImport';

const CONTACT_FIELDS: ImportField[] = [
  { key: 'name', label: 'Name', required: true, match: ['name', 'full name', 'contact'] },
  { key: 'email', label: 'Email', match: ['email', 'e mail'] },
  { key: 'phone', label: 'Phone', match: ['phone', 'mobile', 'tel'] },
  { key: 'company', label: 'Company', match: ['company', 'organisation', 'organization', 'account'] },
  { key: 'position', label: 'Job title', match: ['position', 'title', 'role'] },
  { key: 'status', label: 'Status', match: ['status', 'stage'] },
  { key: 'source', label: 'Source', match: ['source', 'origin'] },
  { key: 'value', label: 'Value', match: ['value', 'amount', 'revenue'] },
  { key: 'notes', label: 'Notes', match: ['notes', 'comment', 'description'] },
];

const PROJECT_FIELDS: ImportField[] = [
  { key: 'name', label: 'Project name', required: true, match: ['name', 'project', 'title'] },
  { key: 'description', label: 'Description', match: ['description', 'summary', 'notes'] },
  { key: 'client', label: 'Client', match: ['client', 'customer', 'account'] },
  { key: 'status', label: 'Status', match: ['status', 'state'] },
  { key: 'priority', label: 'Priority', match: ['priority'] },
  { key: 'stage', label: 'Stage', match: ['stage', 'phase'] },
  { key: 'budget', label: 'Budget', match: ['budget', 'cost'] },
  { key: 'estimated_hours', label: 'Estimated hours', match: ['estimated', 'hours'] },
  { key: 'deadline', label: 'Deadline', match: ['deadline', 'due', 'end date'] },
];

const DOCUMENT_FIELDS: ImportField[] = [
  { key: 'title', label: 'Title', required: true, match: ['title', 'name', 'document'] },
  { key: 'category', label: 'Category', required: true, match: ['category', 'type', 'folder'] },
  { key: 'subcategory', label: 'Subcategory', match: ['subcategory', 'sub category'] },
  { key: 'description', label: 'Description', match: ['description', 'summary', 'notes'] },
  { key: 'file_url', label: 'File URL', match: ['url', 'link', 'file'] },
  { key: 'file_name', label: 'File name', match: ['file name', 'filename'] },
  { key: 'tags', label: 'Tags (comma separated)', match: ['tags', 'labels'] },
];

type Step = { key: string; label: string; description: string; to: string; done: boolean };

const Onboarding = () => {
  const { user } = useAuth();
  const [steps, setSteps] = useState<Step[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(true);
  const [help, setHelp] = useState({ title: '', description: '' });
  const [sending, setSending] = useState(false);

  const loadSteps = async () => {
    if (!user) return;
    setLoadingSteps(true);
    const count = async (table: string) => {
      const { count: c } = await (supabase as any)
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      return c ?? 0;
    };
    try {
      const [profile, contacts, projects, documents, invoices] = await Promise.all([
        supabase.from('profiles').select('full_name, company').eq('id', user.id).maybeSingle(),
        count('crm_contacts'),
        count('projects'),
        count('documents'),
        count('invoices'),
      ]);
      setSteps([
        {
          key: 'profile',
          label: 'Complete your business profile',
          description: 'Name, company and branding used across invoices, forms and pages.',
          to: '/settings',
          done: Boolean(profile.data?.full_name && profile.data?.company),
        },
        {
          key: 'contacts',
          label: 'Import your contacts',
          description: 'Bring your CRM list over from a CSV export.',
          to: '/onboarding?tab=contacts',
          done: contacts > 0,
        },
        {
          key: 'projects',
          label: 'Import or create your first project',
          description: 'Migrate active work so your board reflects reality on day one.',
          to: '/onboarding?tab=projects',
          done: projects > 0,
        },
        {
          key: 'documents',
          label: 'Import your document library',
          description: 'Catalogue existing files so everything is searchable in one hub.',
          to: '/onboarding?tab=documents',
          done: documents > 0,
        },
        {
          key: 'invoice',
          label: 'Send your first invoice or quote',
          description: 'Pick a template and get paid from within B2BNest.',
          to: '/business-tools',
          done: invoices > 0,
        },
      ]);
    } finally {
      setLoadingSteps(false);
    }
  };

  useEffect(() => {
    loadSteps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const requireUser = () => {
    if (!user) throw new Error('You must be signed in to import data.');
    return user.id;
  };

  const importContacts = async (rows: Record<string, string>[]): Promise<ImportResult> => {
    const uid = requireUser();
    const errors: string[] = [];
    const payload = rows
      .filter((r) => r.name)
      .map((r) => ({
        user_id: uid,
        name: r.name,
        email: r.email || null,
        phone: r.phone || null,
        company: r.company || null,
        position: r.position || null,
        status: r.status || 'lead',
        source: r.source || 'Migration import',
        value: toNumber(r.value),
        notes: r.notes || null,
      }));
    if (payload.length) {
      const { error } = await supabase.from('crm_contacts').insert(payload);
      if (error) errors.push(error.message);
    }
    const inserted = errors.length ? 0 : payload.length;
    return { inserted, skipped: rows.length - inserted, errors };
  };

  const importProjects = async (rows: Record<string, string>[]): Promise<ImportResult> => {
    const uid = requireUser();
    const errors: string[] = [];
    const payload = rows
      .filter((r) => r.name)
      .map((r) => ({
        user_id: uid,
        name: r.name,
        description: r.description || null,
        client: r.client || null,
        status: r.status || 'active',
        priority: r.priority || 'medium',
        stage: r.stage || null,
        budget: toNumber(r.budget),
        estimated_hours: toNumber(r.estimated_hours),
        deadline: toDate(r.deadline),
      }));
    if (payload.length) {
      const { error } = await supabase.from('projects').insert(payload);
      if (error) errors.push(error.message);
    }
    const inserted = errors.length ? 0 : payload.length;
    return { inserted, skipped: rows.length - inserted, errors };
  };

  const importDocuments = async (rows: Record<string, string>[]): Promise<ImportResult> => {
    const uid = requireUser();
    const errors: string[] = [];
    const payload = rows
      .filter((r) => r.title)
      .map((r) => ({
        user_id: uid,
        title: r.title,
        category: r.category || 'Imported',
        subcategory: r.subcategory || null,
        description: r.description || null,
        file_url: r.file_url || null,
        file_name: r.file_name || null,
        tags: r.tags ? r.tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean) : null,
      }));
    if (payload.length) {
      const { error } = await supabase.from('documents').insert(payload);
      if (error) errors.push(error.message);
    }
    const inserted = errors.length ? 0 : payload.length;
    return { inserted, skipped: rows.length - inserted, errors };
  };

  const submitHelp = async (category: string) => {
    if (!user) {
      toast.error('Please sign in first.');
      return;
    }
    if (!help.title.trim() || !help.description.trim()) {
      toast.error('Add a subject and a short description.');
      return;
    }
    setSending(true);
    const { error } = await supabase.from('feedback_requests').insert({
      user_id: user.id,
      type: 'support',
      category,
      title: help.title.trim(),
      description: help.description.trim(),
      priority: 'medium',
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setHelp({ title: '', description: '' });
    toast.success('Request sent — our team will get back to you by email.');
  };

  const completed = steps.filter((s) => s.done).length;
  const pct = steps.length ? Math.round((completed / steps.length) * 100) : 0;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const configCards = [
    { icon: Building2, title: 'Business profile & branding', text: 'Logo, company details and currency used on invoices, quotes, forms and landing pages.', to: '/settings' },
    { icon: Bell, title: 'Notifications', text: 'Choose which task, project and billing alerts reach your inbox.', to: '/settings' },
    { icon: Plug, title: 'Integrations', text: 'Connect Gmail, Google Calendar, Outlook, WhatsApp and more.', to: '/business-tools' },
    { icon: CreditCard, title: 'Plan & billing', text: 'Compare plans, AI credits and team seats.', to: '/pricing' },
    { icon: ShieldCheck, title: 'Security & HMRC', text: 'Two-factor authentication and HMRC credentials for MTD submissions.', to: '/settings' },
    { icon: Users, title: 'Team & permissions', text: 'Invite colleagues and set their access level.', to: '/dashboard' },
  ];

  return (
    <>
      <SEOHead
        title="Onboarding & Migration | B2BNest"
        description="Move your contacts, projects and documents into B2BNest in minutes, with guided setup and configuration assistance from our team."
      />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-background dark:to-background">
        <div className="container mx-auto max-w-6xl px-4 py-10">
          <div className="mb-8 flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3">
              <Rocket className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Onboarding &amp; Migration</h1>
              <p className="text-muted-foreground">
                Bring your existing business data into B2BNest and get set up with help from our team.
              </p>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setSearchParams(v === 'overview' ? {} : { tab: v })}
            className="space-y-6"
          >
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="contacts" className="gap-1"><Users className="h-4 w-4" />Contacts</TabsTrigger>
              <TabsTrigger value="projects" className="gap-1"><FolderKanban className="h-4 w-4" />Projects</TabsTrigger>
              <TabsTrigger value="documents" className="gap-1"><FileText className="h-4 w-4" />Documents</TabsTrigger>
              <TabsTrigger value="setup" className="gap-1"><LifeBuoy className="h-4 w-4" />Setup help</TabsTrigger>
              <TabsTrigger value="config" className="gap-1"><Settings2 className="h-4 w-4" />Configuration</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Your setup progress</CardTitle>
                  <CardDescription>
                    {user ? `${completed} of ${steps.length} steps complete` : 'Sign in to track your migration progress.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={pct} />
                  {loadingSteps && user && <p className="text-sm text-muted-foreground">Checking your workspace…</p>}
                  {steps.map((s) => (
                    <div key={s.key} className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
                      <div className="flex items-start gap-3">
                        {s.done ? (
                          <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                        ) : (
                          <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium text-foreground">{s.label}</p>
                          <p className="text-sm text-muted-foreground">{s.description}</p>
                        </div>
                      </div>
                      <Button asChild variant={s.done ? 'ghost' : 'outline'} size="sm">
                        <Link to={s.to}>
                          {s.done ? 'Review' : 'Start'} <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                  {!user && (
                    <Button asChild>
                      <Link to="/auth">Sign in to begin</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>How migration works</CardTitle>
                  <CardDescription>Three simple steps for each data type.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  {[
                    { n: '1', t: 'Export a CSV', d: 'From your current CRM, project tool or drive index.' },
                    { n: '2', t: 'Map your columns', d: 'We auto-match headings; adjust anything that looks wrong.' },
                    { n: '3', t: 'Import securely', d: 'Records are written to your private workspace only.' },
                  ].map((s) => (
                    <div key={s.n} className="rounded-lg border border-border p-4">
                      <Badge variant="secondary" className="mb-2">Step {s.n}</Badge>
                      <p className="font-medium text-foreground">{s.t}</p>
                      <p className="text-sm text-muted-foreground">{s.d}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contacts">
              <CsvImportWizard
                title="Import contacts"
                description="Move your CRM contacts and leads across. Duplicate emails are not merged, so clean your export first."
                fields={CONTACT_FIELDS}
                templateName="b2bnest-contacts-template.csv"
                onImport={async (rows) => {
                  const r = await importContacts(rows);
                  loadSteps();
                  return r;
                }}
              />
            </TabsContent>

            <TabsContent value="projects">
              <CsvImportWizard
                title="Import projects"
                description="Recreate your active project list with clients, budgets and deadlines."
                fields={PROJECT_FIELDS}
                templateName="b2bnest-projects-template.csv"
                onImport={async (rows) => {
                  const r = await importProjects(rows);
                  loadSteps();
                  return r;
                }}
              />
            </TabsContent>

            <TabsContent value="documents">
              <CsvImportWizard
                title="Import documents"
                description="Catalogue your existing documents. Provide a link for each file, or upload files later from the document library."
                fields={DOCUMENT_FIELDS}
                templateName="b2bnest-documents-template.csv"
                onImport={async (rows) => {
                  const r = await importDocuments(rows);
                  loadSteps();
                  return r;
                }}
              />
            </TabsContent>

            <TabsContent value="setup" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Setup assistance</CardTitle>
                  <CardDescription>
                    Tell us what you are moving from and our team will help plan and run the migration with you.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="setup-title">Subject</Label>
                      <Input
                        id="setup-title"
                        value={help.title}
                        onChange={(e) => setHelp({ ...help, title: e.target.value })}
                        placeholder="Migrating from HubSpot and Trello"
                      />
                    </div>
                    <div className="flex items-end">
                      <p className="text-sm text-muted-foreground">
                        Typical response within one business day. Include your current tools and data volumes.
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="setup-desc">What do you need help with?</Label>
                    <Textarea
                      id="setup-desc"
                      rows={5}
                      value={help.description}
                      onChange={(e) => setHelp({ ...help, description: e.target.value })}
                      placeholder="We have ~2,000 contacts, 40 active projects and a Google Drive of contracts…"
                    />
                  </div>
                  <Button onClick={() => submitHelp('onboarding')} disabled={sending}>
                    {sending ? 'Sending…' : 'Request setup assistance'}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Self-serve guides</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {[
                    { t: 'Getting started guide', to: '/knowledge-base/getting-started' },
                    { t: 'Business tools guide', to: '/knowledge-base/business-tools' },
                    { t: 'Integrations guide', to: '/knowledge-base/integrations' },
                    { t: 'Help centre', to: '/help' },
                  ].map((g) => (
                    <Button key={g.to} asChild variant="outline" className="justify-between">
                      <Link to={g.to}>
                        {g.t} <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="config" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {configCards.map((c) => (
                  <Card key={c.title}>
                    <CardHeader>
                      <c.icon className="mb-2 h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{c.title}</CardTitle>
                      <CardDescription>{c.text}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button asChild variant="outline" size="sm">
                        <Link to={c.to}>Configure</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Configuration assistance</CardTitle>
                  <CardDescription>
                    Need a hand with integrations, HMRC, templates or team permissions? Send us the details.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="cfg-title">Subject</Label>
                    <Input
                      id="cfg-title"
                      value={help.title}
                      onChange={(e) => setHelp({ ...help, title: e.target.value })}
                      placeholder="Help connecting Gmail and HMRC"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cfg-desc">Details</Label>
                    <Textarea
                      id="cfg-desc"
                      rows={5}
                      value={help.description}
                      onChange={(e) => setHelp({ ...help, description: e.target.value })}
                      placeholder="Describe what you are trying to configure and any errors you saw…"
                    />
                  </div>
                  <Button onClick={() => submitHelp('configuration')} disabled={sending}>
                    {sending ? 'Sending…' : 'Request configuration assistance'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        <Footer />
      </div>
    </>
  );
};

export default Onboarding;
