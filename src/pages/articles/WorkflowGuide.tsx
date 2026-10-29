import { ReactNode, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SEOHead from '@/components/SEOHead';
import {
  GUIDE_SECTIONS, GuideSectionId, LIMITS, PLACEHOLDER_ROWS, SENDS_PER_MINUTE, STATUS_MEANINGS, TEMPLATE_NAMES, TROUBLESHOOTING,
} from '@/lib/workflowGuide';
import { MAX_RECIPIENTS, MAX_STEPS } from '@/lib/workflowSteps';

// Facts on this page come from src/lib/workflowGuide.ts, which takes them from the code (tested). Describe only what
// Workflow Studio does today; never promise automatic starts or other steps.

const title = (id: GuideSectionId) => GUIDE_SECTIONS.find((s) => s.id === id)!.title;

/** A guide section: its heading carries the anchor id and can take focus when a link jumps to it. */
function Section({ id, children }: { id: GuideSectionId; children: ReactNode }) {
  return (
    <Card className="mb-6 scroll-mt-24" aria-labelledby={`${id}-title`}>
      <CardHeader>
        <h2 id={id} tabIndex={-1} className="rounded-control text-2xl font-semibold leading-none tracking-tight focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
          <span id={`${id}-title`}>{title(id)}</span>
        </h2>
      </CardHeader>
      <CardContent className="space-y-3 text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

/** A table from 640px up; on phones each row is a stacked card with its labels, so nothing needs sideways scrolling. */
const Table = ({ head, rows, caption }: { head: string[]; rows: ReactNode[][]; caption: string }) => (
  <>
    <div className="hidden overflow-x-auto rounded-md border border-border sm:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/50 text-foreground">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border align-top">
              {r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <ul className="space-y-3 sm:hidden" aria-label={caption}>
      {rows.map((r, i) => (
        <li key={i} className="rounded-md border border-border p-3 text-sm">
          <dl className="space-y-1">
            {r.map((c, j) => (
              <div key={j}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-foreground">{head[j]}</dt>
                <dd>{c}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  </>
);

const WorkflowGuide = () => {
  const { hash } = useLocation();

  // Links such as /knowledge-base/workflows#placeholders scroll to that section and move focus to its heading.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  }, [hash]);

  return (
    <>
      <SEOHead
        title="Workflows guide | B2BNEST"
        description="How to use B2BNEST Workflow Studio: send emails with one click from a template, fill in details such as a customer's name, check an exact preview and read the run history."
      />
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <Button asChild variant="ghost" className="mb-6">
            <Link to="/knowledge-base"><ArrowLeft className="mr-2 h-4 w-4" />Back to Knowledge Base</Link>
          </Button>

          <div className="mb-8">
            <Zap className="mb-4 h-12 w-12 text-primary" aria-hidden="true" />
            <h1 className="mb-4 text-4xl font-bold">Workflows guide</h1>
            <p className="text-xl text-muted-foreground">Send a set of emails with one click, check exactly what will go out, and see what happened afterwards.</p>
          </div>

          <nav aria-label="On this page" className="mb-8 rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">On this page</h2>
            <ol className="grid list-decimal gap-1 pl-5 text-sm sm:grid-cols-2">
              {GUIDE_SECTIONS.map((s) => (
                <li key={s.id}><Link to={`#${s.id}`} className="rounded-control text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">{s.title}</Link></li>
              ))}
            </ol>
          </nav>

          <Section id="what-it-is">
            <p>
              Workflow Studio keeps a list of emails you send often, such as a payment reminder or a thank-you, so you can send
              them again in one go. A workflow is a list of up to {MAX_STEPS} <strong>"Send an email"</strong> steps. They run in
              order when you press <strong>"Run now"</strong>.
            </p>
            <p>What it is not:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>It does not start by itself. There are no schedules, and nothing starts when a form is sent or a record changes. A workflow runs only when you press "Run now".</li>
              <li>It does not send WhatsApp messages or post on X or LinkedIn. Those steps are switched off (see below).</li>
              <li>It does not track whether emails are opened or clicked. Emails are plain text.</li>
            </ul>
            <p>You'll find it in the menu under <strong>Work → Workflows</strong>.</p>
            <Button asChild><Link to="/workflow-studio">Open Workflows</Link></Button>
          </Section>

          <Section id="before-you-start">
            <ul className="list-disc space-y-1 pl-6">
              <li>Have an email address you can read, so you can send the first run to yourself and check it.</li>
              <li>
                Emails are sent from B2BNEST's sending address, and <strong>when your customer replies, the reply goes to your own account email</strong>.
                The preview shows that address before you send. Your account email needs to be verified; if it isn't, the preview says so and
                replies go to B2BNEST's sending address instead.
              </li>
              <li>
                <strong>Workflows are included in the Business and Scale plans</strong>, and every new account can use them during its 14-day trial.
                Solo doesn't include them: on Solo, Workflows shows what they do and a link to the plans, and any workflows you saved are paused (kept,
                not run) with their past runs still readable. If your company pays for B2BNEST, workflows follow your company's plan.
              </li>
            </ul>
          </Section>

          <Section id="first-workflow">
            <ol className="list-decimal space-y-2 pl-6">
              <li>Open <strong>Workflows</strong> from the menu (under Work).</li>
              <li>Press <strong>"Start from a template"</strong>. Press <strong>"Preview"</strong> on a template to read the email, then <strong>"Use this template"</strong>.</li>
              <li><strong>"To"</strong> starts as your own email address, so your first run comes to you. When you're happy, change it to your customer's address (up to {MAX_RECIPIENTS}, separated by commas).</li>
              <li>Change the subject and message as you like. Then press <strong>"Save"</strong>. Only saved workflows keep a run history.</li>
              <li>Press <strong>"Run now"</strong>. Fill in <strong>"Run with these details"</strong>, check the <strong>"Email preview"</strong> and the line that says how many emails will go to how many recipients, then press the <strong>Send</strong> button.</li>
              <li>Each step shows its result, and the run is added to <strong>"Run history"</strong> below the steps.</li>
            </ol>
            <p>The templates are: {TEMPLATE_NAMES.join(', ')}. Each one is a single email you can change. Other named templates are marked "Not available" and can't be used yet.</p>
            <p>To start from nothing, press <strong>"New workflow"</strong> and use <strong>"+ Add a step"</strong> to add "Send an email" steps.</p>
          </Section>

          <Section id="placeholders">
            <p>
              A placeholder is a word in double braces, such as <code>{'{{name}}'}</code>, in the subject or the message. You fill it in each
              time you run the workflow, so one workflow works for different customers. For example, "Hello {'{{name}}'}" becomes "Hello Sam Taylor".
            </p>
            <Table
              caption="Placeholders you can use"
              head={['Placeholder', 'What it is', 'Example', 'Longest value']}
              rows={PLACEHOLDER_ROWS.map((p) => [<code key="t">{p.token}</code>, p.label, p.example, `${p.maxLength} characters`])}
            />
            <ul className="list-disc space-y-1 pl-6">
              <li>Only these placeholders work, written in lower case. Anything else in double braces is shown as an error, not sent.</li>
              <li>Every placeholder you use needs a value. The email is never sent with "{'{{name}}'}" in it.</li>
              <li>Values must fit on one line and can't contain "{'{{'}" or "{'}}'}".</li>
              <li>A placeholder can appear more than once; each one gets the same value.</li>
            </ul>
          </Section>

          <Section id="running">
            <ol className="list-decimal space-y-2 pl-6">
              <li><strong>Run with these details.</strong> A field appears for each placeholder your emails use, and only those.</li>
              <li><strong>Email preview.</strong> Every email is shown exactly as it will be sent: "To", subject and message, with the details filled in. Any problem is listed in red and the Send button stays switched off.</li>
              <li><strong>Confirm.</strong> A line such as "This will send 1 email to 1 recipient." tells you how many emails will go to how many different addresses. Nothing is sent until you press the Send button; "Cancel" sends nothing.</li>
            </ol>
            <p>Steps run one after another. If one step fails, the others still run. Nothing is resent automatically.</p>
          </Section>

          <Section id="run-history">
            <p>
              Each saved workflow shows its latest 20 runs: when it ran and, for each step, its result. Only you can see your runs.
              The history never shows message text; it shows the number of recipients and the reason the server gave.
            </p>
            <Table caption="What each status means" head={['Status', 'What it means']} rows={STATUS_MEANINGS.map((s) => [<strong key="s">{s.status}</strong>, s.means])} />
          </Section>

          <Section id="switched-off">
            <p>
              <strong>WhatsApp, X (Twitter) and LinkedIn steps are switched off.</strong> Their delivery hasn't been checked end to end, so in
              "+ Add a step" they are shown as "not available yet" and can't be picked. If an older workflow still has one of those steps, it is
              skipped when you run it and shown as "Skipped (step not available)".
            </p>
          </Section>

          <Section id="limits">
            <Table caption="Limits" head={['What', 'Limit']} rows={LIMITS.map((l) => [l.what, l.limit])} />
            <p>If you send more than {SENDS_PER_MINUTE} email steps in a minute, nothing more is sent until the minute is up. There is no monthly email allowance.</p>
          </Section>

          <Section id="troubleshooting">
            <p>These are the messages you may see under a step or in the preview. "(…)" stands for the code the email provider gave.</p>
            <Table
              caption="Messages, what they mean and what to do"
              head={['Message shown', 'What it means', 'What to do']}
              rows={TROUBLESHOOTING.map((t) => [<span key="m" className="font-medium text-foreground">{t.shown}</span>, t.means, t.todo])}
            />
          </Section>

          <Section id="old-workflows">
            <p>
              Workflows made in the previous builder are still listed, marked <strong>"Archived · Can't run"</strong>. None of their steps (for example
              "Generate contracts" or "Payment check") ever ran, so they can't run now either. They are kept exactly as saved and can't be edited
              here.
            </p>
            <p>To replace one, open it and press <strong>"Create a working workflow"</strong>. That starts a new, separate workflow; the archived one stays unchanged.</p>
          </Section>

          <p className="text-sm text-muted-foreground">
            Still stuck? <Link to="/help" className="text-link underline">Visit the Help Centre</Link> or <Link to="/contact" className="text-link underline">contact support</Link>.
          </p>
        </div>
      </div>
    </>
  );
};

export default WorkflowGuide;
