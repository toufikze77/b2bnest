import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap, MousePointerClick, Mail, MessageCircle, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';

const WorkflowGuide = () => (
  <>
    <SEOHead
      title="Workflows Guide | B2BNEST"
      description="Set up simple B2BNEST workflows that send emails, WhatsApp messages and social posts in one click."
    />
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <Button asChild variant="ghost" className="mb-6">
          <Link to="/knowledge-base"><ArrowLeft className="mr-2 h-4 w-4" />Back to Knowledge Base</Link>
        </Button>

        <div className="mb-8">
          <Zap className="mb-4 h-12 w-12 text-primary" />
          <h1 className="mb-4 text-4xl font-bold">Workflows guide</h1>
          <p className="text-xl text-muted-foreground">Send a set of messages and posts with one click.</p>
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2"><MousePointerClick className="h-5 w-5" />How a workflow works</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>Every workflow has two parts:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li><strong>When this happens:</strong> when you click "Run now". Automatic starts — on a schedule, when a form is submitted or when a record changes — aren't available yet.</li>
              <li><strong>Do this:</strong> one or more steps, run in order. Each step really sends something.</li>
            </ul>
            <ol className="list-decimal space-y-1 pl-6">
              <li>Open <strong>Workflows</strong> from the menu and click <strong>New workflow</strong>.</li>
              <li>Give it a name, then use <strong>Add a step</strong>.</li>
              <li>Fill in each step, click <strong>Save</strong>, then <strong>Run now</strong> when you're ready.</li>
              <li>Each step shows whether it was sent or why it failed.</li>
            </ol>
            <Button asChild><Link to="/workflow-studio">Open Workflows</Link></Button>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle>Steps you can use</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Send an email</strong> — up to 10 recipients, sent from B2BNEST notifications.</span></p>
            <p className="flex gap-2"><MessageCircle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Send a WhatsApp message</strong> — needs your Twilio account connected in Integrations → WhatsApp. Use international format, e.g. +447700900123.</span></p>
            <p className="flex gap-2"><Share2 className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Post on X or LinkedIn</strong> — needs that account connected in Business tools → Integrations.</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Workflows made in the old builder</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">
            <p>Workflows saved in the previous drag-and-drop builder are still listed. Their steps (for example "Generate contracts" or "Payment check") never ran automatically, so they're marked "can't run". You can remove those steps and add supported ones, or delete the workflow.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  </>
);

export default WorkflowGuide;
