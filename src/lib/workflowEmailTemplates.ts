// Working Workflow Studio templates (Phase 15). Each one preloads real "Send an email" steps that run with the manual
// "Run now" start; the user edits them before use. Placeholders such as {{name}} are filled from the
// "Run with these details" form (supabase/functions/_shared/placeholders.ts).
// The other named templates in src/data/workflowTemplates.ts need an automatic start or a step that isn't available
// yet, so they are listed as "Coming soon" and can't be used or run.
import { workflowTemplates } from '@/data/workflowTemplates';
import type { SimpleStep } from '@/lib/workflowSteps';

export interface EmailTemplateStep { subject: string; body: string }
export interface WorkingTemplate {
  id: string;
  /** The named template in src/data/workflowTemplates.ts this replaces. */
  sourceId: string;
  name: string;
  description: string;
  steps: EmailTemplateStep[];
}

const SIGN_OFF = 'Kind regards,\n{{company}}';

export const WORKING_TEMPLATES: WorkingTemplate[] = [
  {
    id: 'overdue-invoice-reminder', sourceId: 'finance-overdue', name: 'Overdue invoice reminder',
    description: 'A polite reminder to a customer whose invoice is past its due date.',
    steps: [{
      subject: 'Invoice {{invoice_number}} is overdue',
      body: `Hello {{name}},\n\nOur records show that invoice {{invoice_number}} for {{amount}} was due on {{due_date}} and hasn't been paid yet.\n\nIf you've already paid, thank you, and please ignore this email. If not, could you let us know when we can expect payment? Just reply to this email if you have any questions.\n\n${SIGN_OFF}`,
    }],
  },
  {
    id: 'new-lead-welcome', sourceId: 'sales-lead', name: 'New lead welcome',
    description: 'Thank someone for getting in touch and tell them what happens next.',
    steps: [{
      subject: 'Thanks for getting in touch, {{name}}',
      body: `Hello {{name}},\n\nThank you for contacting {{company}}. We've received your enquiry and will reply as soon as we can.\n\nIf there's anything you'd like to add in the meantime, just reply to this email.\n\n${SIGN_OFF}`,
    }],
  },
  {
    id: 'quote-follow-up', sourceId: 'sales-quote', name: 'Quote follow-up',
    description: 'Check in with a customer about a quote you sent.',
    steps: [{
      subject: 'Following up on quote {{quote_number}}',
      body: `Hello {{name}},\n\nI'm following up on quote {{quote_number}} for {{amount}}, which we sent you recently. Do you have any questions, or would you like us to change anything?\n\nIf you'd like to go ahead, just reply to this email and we'll arrange the next steps.\n\n${SIGN_OFF}`,
    }],
  },
  {
    id: 'appointment-reminder', sourceId: 'sales-meeting', name: 'Appointment reminder',
    description: 'Remind a customer of the date and time of their appointment.',
    steps: [{
      subject: 'Reminder: your appointment on {{date}}',
      body: `Hello {{name}},\n\nThis is a reminder of your appointment with {{company}} on {{date}} at {{time}}.\n\nIf you need to change or cancel it, please reply to this email.\n\n${SIGN_OFF}`,
    }],
  },
  {
    id: 'job-thank-you', sourceId: 'customer-feedback', name: 'Thank-you after a job',
    description: 'Thank a customer once the work is done and invite them to reply if anything is wrong.',
    steps: [{
      subject: 'Thank you from {{company}}',
      body: `Hello {{name}},\n\nThank you for choosing {{company}}. We hope you're happy with the work.\n\nIf anything isn't right, please reply to this email and we'll look into it.\n\n${SIGN_OFF}`,
    }],
  },
  {
    id: 'customer-trial-ending', sourceId: 'customer-renewal', name: 'Trial-ending note to a customer',
    description: "Let a customer know when their trial of your service ends, without pressure.",
    steps: [{
      subject: 'Your trial with {{company}} ends on {{date}}',
      body: `Hello {{name}},\n\nYour trial with {{company}} ends on {{date}}. If you'd like to carry on, reply to this email and we'll help you set things up.\n\nIf you decide not to continue, you don't need to do anything.\n\n${SIGN_OFF}`,
    }],
  },
];

/** Why the other named templates can't be used yet (shown next to each "Coming soon" name). */
export const COMING_SOON_REASON = "Needs an automatic start or a step that isn't available yet, so it can't be used or run.";

/** Named templates that stay "Coming soon": every template except the blank one and those converted above. */
export const COMING_SOON_TEMPLATES = workflowTemplates
  .filter((t) => t.id !== 'blank' && !WORKING_TEMPLATES.some((w) => w.sourceId === t.id))
  .map((t) => ({ id: t.id, name: t.name }));

/**
 * The template's steps, ready to edit. `to` is the signed-in user's own address so a first run goes to them;
 * the screen says to change it to the customer's address.
 */
export function templateSteps(t: WorkingTemplate, to: string, makeId: () => string): SimpleStep[] {
  return t.steps.map((s) => ({ id: makeId(), kind: 'email', config: { to, subject: s.subject, body: s.body } }));
}
