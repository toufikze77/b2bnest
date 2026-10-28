// Content for the Workflow Studio guide (/knowledge-base/workflows), the Knowledge Base workflow cards and the Help
// FAQ. Facts come from the code, not copied by hand: limits are the constants the code enforces, placeholders and
// templates are the shared lists, and every troubleshooting message is checked against its source file
// (src/lib/workflowGuide.test.ts). Describe only what Workflow Studio does on main.
import { MAX_RECIPIENTS, MAX_STEPS, EMAIL_STATUS_UNKNOWN, NOT_YET_AVAILABLE } from '@/lib/workflowSteps';
import { STATUS_TEXT } from '@/lib/workflowRuns';
import { WORKING_TEMPLATES } from '@/lib/workflowEmailTemplates';
import { MAX_BODY_LENGTH, MAX_SUBJECT_LENGTH, PLACEHOLDERS } from '../../supabase/functions/_shared/placeholders.ts';

export const GUIDE_PATH = '/knowledge-base/workflows';

/** Sections of the guide, in order. The ids are the page's anchors. */
export const GUIDE_SECTIONS = [
  { id: 'what-it-is', title: 'What Workflow Studio is (and is not)' },
  { id: 'before-you-start', title: 'Before you start' },
  { id: 'first-workflow', title: 'Your first workflow, in 6 steps' },
  { id: 'placeholders', title: 'Placeholders such as {{name}}' },
  { id: 'running', title: 'Running a workflow: details, preview and confirm' },
  { id: 'run-history', title: 'Run history and what each status means' },
  { id: 'switched-off', title: 'Steps that are switched off' },
  { id: 'limits', title: 'Limits' },
  { id: 'troubleshooting', title: 'Troubleshooting' },
  { id: 'old-workflows', title: 'Workflows from the old builder' },
] as const;
export type GuideSectionId = (typeof GUIDE_SECTIONS)[number]['id'];
export const guideLink = (id: GuideSectionId) => `${GUIDE_PATH}#${id}`;

/**
 * Email steps one person can send in a minute. Set in supabase/functions/workflow-send-email/index.ts
 * (memoryRateLimit(30, 60_000)); the test reads that file to keep this number honest.
 */
export const SENDS_PER_MINUTE = 30;

export const LIMITS = [
  { what: 'Recipients in one email step', limit: `${MAX_RECIPIENTS} addresses, separated by commas` },
  { what: 'Steps in one workflow', limit: `${MAX_STEPS}` },
  { what: 'Email steps you can send in a minute', limit: `${SENDS_PER_MINUTE}` },
  { what: 'Subject, once the details are filled in', limit: `${MAX_SUBJECT_LENGTH} characters, one line` },
  { what: 'Message, once the details are filled in', limit: `${MAX_BODY_LENGTH.toLocaleString('en-GB')} characters, plain text` },
];

/** The placeholder table: generated from the shared list the preview and the server use. */
export const PLACEHOLDER_ROWS = PLACEHOLDERS.map((p) => ({ token: `{{${p.key}}}`, label: p.label, example: p.example, maxLength: p.maxLength }));

export const TEMPLATE_NAMES = WORKING_TEMPLATES.map((t) => t.name);

/** Run history statuses, with the exact labels the panel shows (src/lib/workflowRuns.ts). */
export const STATUS_MEANINGS = [
  { status: STATUS_TEXT.sent, means: 'The email provider accepted the email. It does not confirm that it reached the inbox: it can still land in spam or be bounced later.' },
  { status: STATUS_TEXT.failed, means: 'The email was not sent. The reason the server gave is shown under the step.' },
  { status: STATUS_TEXT.unknown, means: "The connection broke before the server could confirm either way. The email may or may not have gone. Check the recipient's inbox (or ask them) before you run it again, so they don't get it twice." },
  { status: STATUS_TEXT.skipped, means: "The step is one that's switched off (WhatsApp, X or LinkedIn), so it was not run." },
];

export interface TroubleshootingRow {
  shown: string;
  means: string;
  todo: string;
  /** Exact text that must appear in the file that produces this message (checked by a test). */
  source: { file: string; text: string };
}

const SEND_EMAIL = 'supabase/functions/workflow-send-email/request.ts';
const SMTP = 'supabase/functions/workflow-send-email/handler.ts';
const PH = 'supabase/functions/_shared/placeholders.ts';
const STEPS = 'src/lib/workflowSteps.ts';

export const TROUBLESHOOTING: TroubleshootingRow[] = [
  {
    shown: "Customer's name ({{name}}) needs a value.",
    means: 'The email uses a placeholder you left empty in "Run with these details". (Any placeholder can show this, with its own name.)',
    todo: 'Fill in the field. Send stays switched off until every placeholder has a value.',
    source: { file: PH, text: 'needs a value.' },
  },
  {
    shown: "Subject: {{first_name}} isn't a placeholder you can use.",
    means: 'The subject or message has a word in double braces that is not on the placeholder list (names are lower case).',
    todo: 'Change it to one of the placeholders in the table above, for example {{name}}.',
    source: { file: PH, text: "isn't a placeholder you can use" },
  },
  {
    shown: 'Message: has a "{{" or "}}" that isn\'t a complete placeholder.',
    means: 'There is a stray "{{" or "}}" in the text.',
    todo: 'Remove it, or finish the placeholder, for example {{name}}.',
    source: { file: PH, text: 'that isn\'t a complete placeholder' },
  },
  {
    shown: 'Send an email: check the email addresses',
    means: 'One of the addresses in "To" is not a valid email address.',
    todo: 'Check for typos and separate addresses with commas.',
    source: { file: STEPS, text: "'Send an email: check the email addresses'" },
  },
  {
    shown: `Send an email: at most ${MAX_RECIPIENTS} recipients`,
    means: `A step can send to at most ${MAX_RECIPIENTS} addresses.`,
    todo: 'Split the recipients across two steps.',
    source: { file: STEPS, text: 'Send an email: at most ${MAX_RECIPIENTS} recipients' },
  },
  {
    shown: "You've sent a lot of emails in the last minute. Nothing was sent. Wait a minute, then try again.",
    means: `You went over ${SENDS_PER_MINUTE} email steps in a minute.`,
    todo: 'Wait a minute, then run it again.',
    source: { file: SEND_EMAIL, text: "You've sent a lot of emails in the last minute. Nothing was sent. Wait a minute, then try again." },
  },
  {
    shown: 'The email changed after the preview. Nothing was sent. Check the preview and run it again.',
    means: 'What would have been sent no longer matched the preview you confirmed.',
    todo: 'Press "Run now" again, check the preview and send.',
    source: { file: SEND_EMAIL, text: 'The email changed after the preview. Nothing was sent. Check the preview and run it again.' },
  },
  {
    shown: EMAIL_STATUS_UNKNOWN,
    means: "The connection broke, or the email provider didn't answer in time, so it isn't known whether the email went.",
    todo: "Check the recipient's inbox (or ask them) before trying again, so they don't get it twice.",
    source: { file: STEPS, text: "EMAIL_STATUS_UNKNOWN = 'Delivery status unknown. Check your inbox before trying again.'" },
  },
  {
    shown: "The email provider rejected the sender account's sign-in (…). The sending account's settings need fixing. Nothing was sent.",
    means: "B2BNEST's own sending account could not sign in to the email provider. This is not something you can fix.",
    todo: 'Contact support and include the code shown in brackets.',
    source: { file: SMTP, text: "The sending account's settings need fixing. Nothing was sent." },
  },
  {
    shown: 'The email provider refused the message (…). Nothing was sent.',
    means: 'The email provider would not accept this email, for example because it rejects one of the recipient addresses.',
    todo: 'Check the addresses. If it keeps happening, contact support with the code shown.',
    source: { file: SMTP, text: 'The email provider refused the message' },
  },
  {
    shown: 'The email provider is temporarily refusing mail (…). Nothing was sent; try again later.',
    means: 'The email provider is busy or limiting mail for a short time.',
    todo: 'Try again later.',
    source: { file: SMTP, text: 'The email provider is temporarily refusing mail' },
  },
  {
    shown: "Email sending isn't set up on the server yet. Nothing was sent.",
    means: 'Email sending is not configured on the B2BNEST server.',
    todo: 'Contact support.',
    source: { file: SEND_EMAIL, text: "Email sending isn't set up on the server yet. Nothing was sent." },
  },
  {
    shown: 'Please sign in again.',
    means: 'Your session has ended.',
    todo: 'Sign in again, then run the workflow.',
    source: { file: SEND_EMAIL, text: 'Please sign in again.' },
  },
  {
    shown: NOT_YET_AVAILABLE,
    means: "The workflow has a WhatsApp, X or LinkedIn step, which is switched off. It was skipped; the other steps still ran.",
    todo: 'Remove the step if you no longer need it.',
    source: { file: STEPS, text: "NOT_YET_AVAILABLE = 'Not available yet — this step has not been verified, so it was not run.'" },
  },
];

/** Knowledge Base cards for this guide: each links to a section of the guide. */
export const KB_WORKFLOW_ARTICLES: { title: string; description: string; readTime: string; anchor: GuideSectionId }[] = [
  { title: 'Your first workflow', description: 'Start from a template, check the email and send it with "Run now"', readTime: '4 min', anchor: 'first-workflow' },
  { title: 'Placeholders and templates', description: 'Fill in {{name}}, {{amount}} and other details each time you run it', readTime: '4 min', anchor: 'placeholders' },
  { title: 'Run history and troubleshooting', description: 'What Sent, Failed, Delivery status unknown and Skipped mean, and what to do', readTime: '5 min', anchor: 'run-history' },
  { title: 'Limits and switched-off steps', description: 'Recipients, steps and sends a minute; why WhatsApp, X and LinkedIn are off', readTime: '3 min', anchor: 'limits' },
];

/** Help Centre questions about workflows. */
export const WORKFLOW_FAQS: { question: string; answer: string }[] = [
  {
    question: 'How do I make my first workflow?',
    answer: 'Open Workflows from the menu (under Work), choose "Start from a template", press "Preview" on a template, then "Use this template". Change "To" to the right address, press "Save", then "Run now". The guide in the Knowledge Base walks through it step by step.',
  },
  {
    question: 'What can a workflow do today?',
    answer: `Send emails. A workflow is a saved list of up to ${MAX_STEPS} "Send an email" steps that run in order when you press "Run now". Each step sends one plain-text email to up to ${MAX_RECIPIENTS} addresses, from B2BNEST's sending address.`,
  },
  {
    question: "Why can't I pick WhatsApp, X or LinkedIn?",
    answer: "Those steps are switched off. Their delivery hasn't been checked end to end, so they are shown as not available and never run. Older workflows that still contain them skip those steps.",
  },
  {
    question: 'What are placeholders?',
    answer: 'Words in double braces, such as {{name}} or {{amount}}, in the subject or message. When you press "Run now", "Run with these details" asks for a value for each one you used (and only those), then shows an exact preview of every email and a line such as "This will send 1 email to 1 recipient." Nothing is sent until you press the Send button. Only the placeholders listed in the guide can be used, and each has a length limit.',
  },
  {
    question: 'What does "Sent" mean?',
    answer: "It means the email provider accepted the email. It does not confirm that it reached the inbox: it can still go to spam or bounce later.",
  },
  {
    question: 'What does "Delivery status unknown" mean, and what should I do?',
    answer: "The connection broke before the server could confirm whether the email went. Check the recipient's inbox (or ask them) before you run it again, so they don't get it twice. Workflows never resend automatically.",
  },
  {
    question: 'Why did my run fail?',
    answer: 'Run history shows the reason under each failed step, for example a missing value for a placeholder or an address the email provider refused. The troubleshooting table in the guide lists each message, what it means and what to do.',
  },
  {
    question: 'Can workflows start by themselves?',
    answer: 'Not yet. A workflow runs only when you press "Run now". Schedules and starts from forms or record changes are not available.',
  },
  {
    question: 'Is there a limit on emails?',
    answer: `Each email step can go to up to ${MAX_RECIPIENTS} addresses, a workflow can have up to ${MAX_STEPS} steps, and each person can send up to ${SENDS_PER_MINUTE} email steps a minute. If you go over that, nothing is sent and you're asked to wait a minute.`,
  },
  {
    question: 'Where do replies go?',
    answer: "Workflow emails are sent from B2BNEST's sending address, so if your customer replies, the reply goes to B2BNEST, not to you. Put your own phone number or email address in the message so customers can reach you.",
  },
];
