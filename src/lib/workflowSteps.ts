// Simple "When this happens → Do this" workflows.
// Only steps that a server function actually carries out are offered to customers.
// Older workflows built in the previous canvas builder are kept as saved; their
// steps are classified so the screen can say honestly which ones cannot run.

export type StepKind = 'email' | 'x' | 'linkedin' | 'whatsapp';

export interface StepField { key: string; label: string; placeholder?: string; multiline?: boolean; required?: boolean }

export interface StepDefinition {
  kind: StepKind;
  /** Name stored on the saved node (matches what the previous builder stored). */
  nodeName: string;
  label: string;
  help: string;
  fields: StepField[];
}

export const STEP_DEFINITIONS: StepDefinition[] = [
  {
    kind: 'email', nodeName: 'Send Email', label: 'Send an email',
    help: 'Sent from B2BNEST notifications. Up to 10 recipients, separated by commas.',
    fields: [
      { key: 'to', label: 'To', placeholder: 'name@example.com', required: true },
      { key: 'subject', label: 'Subject', required: true },
      { key: 'body', label: 'Message', multiline: true, required: true },
    ],
  },
  {
    kind: 'whatsapp', nodeName: 'Send WhatsApp', label: 'Send a WhatsApp message',
    help: 'Needs your Twilio account connected in Integrations → WhatsApp. Number in international format, e.g. +447700900123.',
    fields: [
      { key: 'to', label: 'To (phone number)', placeholder: '+447700900123', required: true },
      { key: 'body', label: 'Message', multiline: true, required: true },
    ],
  },
  {
    kind: 'x', nodeName: 'Twitter Post', label: 'Post on X (Twitter)',
    help: 'Needs your X account connected in Business tools → Integrations.',
    fields: [{ key: 'text', label: 'Post text', multiline: true, required: true }],
  },
  {
    kind: 'linkedin', nodeName: 'LinkedIn Post', label: 'Post on LinkedIn',
    help: 'Needs your LinkedIn account connected in Business tools → Integrations.',
    fields: [{ key: 'text', label: 'Post text', multiline: true, required: true }],
  },
];

/** Names the old builder used that map to a supported step. */
const LEGACY_ALIASES: Record<string, StepKind> = {
  'Send Email': 'email',
  'Send Email (Resend)': 'email',
  'Send WhatsApp': 'whatsapp',
  'Twitter Post': 'x',
  'LinkedIn Post': 'linkedin',
};

export const MANUAL_TRIGGER_NAME = 'Run manually';

export interface SimpleStep { id: string; kind: StepKind; config: Record<string, string> }

export interface SavedNode {
  id?: string; type?: string; name?: string; config?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface ParsedWorkflow {
  steps: SimpleStep[];
  /** Names of saved steps that cannot run (kept untouched until the user saves). */
  unsupported: string[];
}

export function stepDefinition(kind: StepKind): StepDefinition {
  return STEP_DEFINITIONS.find((d) => d.kind === kind)!;
}

export function parseSavedSteps(raw: unknown): ParsedWorkflow {
  const nodes = Array.isArray(raw) ? (raw as SavedNode[]) : [];
  const steps: SimpleStep[] = [];
  const unsupported: string[] = [];
  nodes.forEach((n, i) => {
    const name = typeof n?.name === 'string' ? n.name : 'Unnamed step';
    if (n?.type === 'trigger' && name === MANUAL_TRIGGER_NAME) return;
    const kind = n?.type === 'trigger' ? undefined : LEGACY_ALIASES[name];
    if (!kind) { unsupported.push(name); return; }
    const cfg: Record<string, string> = {};
    for (const f of stepDefinition(kind).fields) {
      const v = n.config?.[f.key];
      cfg[f.key] = typeof v === 'string' ? v : '';
    }
    steps.push({ id: typeof n.id === 'string' ? n.id : `step_${i}`, kind, config: cfg });
  });
  return { steps, unsupported };
}

export function serializeSteps(steps: SimpleStep[]): SavedNode[] {
  return [
    { id: 'trigger_manual', type: 'trigger', category: 'Manual', name: MANUAL_TRIGGER_NAME, config: {}, connections: [], position: { x: 0, y: 0 } },
    ...steps.map((s, i) => ({
      id: s.id, type: 'action', category: s.kind, name: stepDefinition(s.kind).nodeName,
      config: { ...s.config }, connections: [], position: { x: 0, y: (i + 1) * 120 },
    })),
  ];
}

const E164 = /^\+[1-9]\d{6,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns a problem description, or null when the step is ready to run. */
export function validateStep(step: SimpleStep): string | null {
  const def = stepDefinition(step.kind);
  for (const f of def.fields) {
    if (f.required && !step.config[f.key]?.trim()) return `${def.label}: "${f.label}" is required`;
  }
  if (step.kind === 'email') {
    const list = step.config.to.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length > 10) return 'Send an email: at most 10 recipients';
    if (list.some((e) => !EMAIL.test(e))) return 'Send an email: check the email addresses';
  }
  if (step.kind === 'whatsapp') {
    if (!E164.test(step.config.to.trim())) return 'WhatsApp: use international format, e.g. +447700900123';
    if (step.config.body.length > 1600) return 'WhatsApp: message is longer than 1,600 characters';
  }
  if (step.kind === 'x' && step.config.text.length > 280) return 'X: post is longer than 280 characters';
  return null;
}

export interface StepResult { ok: boolean; message: string }
export type Invoke = (fn: string, body: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

export const EMAIL_STATUS_UNKNOWN = 'Delivery status unknown. Check your inbox before trying again.';

/** Reads the server's reason; null when the server gave no readable answer (network drop, relay error). */
async function errorText(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: { json?: () => Promise<{ error?: string; message?: string }> } })?.context;
  if (ctx?.json) {
    const body = await ctx.json().catch(() => null);
    if (body?.error || body?.message) return String(body.error || body.message);
  }
  return null;
}

/** Runs one step. Success is reported ONLY when the server explicitly confirms it. */
export async function executeStep(step: SimpleStep, workflowId: string | null, invoke: Invoke): Promise<StepResult> {
  const c = step.config;
  // Without a readable server answer we can't know whether a message went out.
  const unknown = step.kind === 'email' ? EMAIL_STATUS_UNKNOWN : 'Status unknown — check before trying again.';
  const confirmed = async (fn: string, body: Record<string, unknown>, okMessage: string): Promise<StepResult> => {
    const { data, error } = await invoke(fn, body);
    if (error) return { ok: false, message: (await errorText(error)) ?? unknown };
    const d = data as { success?: boolean; error?: string; message?: string } | null;
    return d?.success === true ? { ok: true, message: okMessage } : { ok: false, message: d?.error || d?.message || 'Not confirmed by the server' };
  };
  try {
    if (step.kind === 'email') return await confirmed('workflow-send-email', { to: c.to, subject: c.subject, body: c.body, workflowId }, 'Accepted by the email provider (inbox delivery not confirmed)');
    if (step.kind === 'x') return await confirmed('workflow-twitter-post', { text: c.text, workflowId }, 'Posted on X');
    if (step.kind === 'linkedin') return await confirmed('workflow-linkedin-post', { text: c.text, visibility: 'PUBLIC', workflowId }, 'Posted on LinkedIn');
    const { data, error } = await invoke('workflow-execute', { workflow_id: workflowId, steps: [{ type: 'whatsapp.send', to: c.to.trim(), body: c.body }] });
    if (error) return { ok: false, message: await errorText(error) };
    const r = (data as { results?: { ok?: boolean; error?: string; message?: string }[] } | null)?.results?.[0];
    return r?.ok === true ? { ok: true, message: 'WhatsApp message sent' } : { ok: false, message: r?.message || r?.error || 'Not confirmed by the server' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}
