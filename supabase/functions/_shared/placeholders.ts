// Placeholders in workflow emails, e.g. "Hello {{name}}". ONE pure function shared by the Workflow Studio preview
// (src/) and the workflow-send-email Edge Function, so what the user previews is exactly what is sent.
// Rules (deterministic, no code is ever evaluated):
// - Only the names in PLACEHOLDERS are allowed, written {{name}} (spaces inside the braces are allowed).
// - Every placeholder used needs a value. A missing value is an error: the literal "{{name}}" is never sent.
// - Values are inserted once, never re-scanned. Values may not contain "{{", "}}", line breaks or control characters.
// - Any other "{{" or "}}" in the subject or message is an error rather than sent as typed.
// - The email is plain text. In HTML mode (not used by Workflow Studio) values are HTML-escaped.
// No imports: this file must stay usable by both Vite and Deno.

export interface PlaceholderDefinition { key: string; label: string; example: string; maxLength: number }

export const PLACEHOLDERS: PlaceholderDefinition[] = [
  { key: 'name', label: "Customer's name", example: 'Sam Taylor', maxLength: 100 },
  { key: 'company', label: 'Your business name', example: 'Taylor & Co', maxLength: 100 },
  { key: 'amount', label: 'Amount', example: '£250.00', maxLength: 30 },
  { key: 'due_date', label: 'Due date', example: '14 November 2026', maxLength: 40 },
  { key: 'invoice_number', label: 'Invoice number', example: 'INV-0042', maxLength: 40 },
  { key: 'quote_number', label: 'Quote number', example: 'Q-0017', maxLength: 40 },
  { key: 'date', label: 'Date', example: 'Tuesday 4 November', maxLength: 40 },
  { key: 'time', label: 'Time', example: '10:30am', maxLength: 20 },
];

export const MAX_SUBJECT_LENGTH = 200;
export const MAX_BODY_LENGTH = 10_000;

const KEYS = new Set(PLACEHOLDERS.map((p) => p.key));
const byKey = (k: string) => PLACEHOLDERS.find((p) => p.key === k);
// {{ key }}: the key is matched loosely here so a typo like {{Name}} or {{first name}} gets a clear error.
const TOKEN = /\{\{\s*([^{}]*?)\s*\}\}/g;
/** Line breaks, tabs and other control characters (checked by code point, not a regex of control characters). */
const hasControl = (s: string) => [...s].some((ch) => { const c = ch.codePointAt(0)!; return c < 0x20 || c === 0x7f || c === 0x2028 || c === 0x2029; });

export type Values = Record<string, string | undefined | null>;
export type RenderResult =
  | { ok: true; subject: string; body: string; used: string[] }
  | { ok: false; errors: string[]; used: string[] };

/** The allowed placeholder names used in these texts, in first-use order, each once. */
export function placeholdersIn(...texts: string[]): string[] {
  const out: string[] = [];
  for (const t of texts) for (const m of (t ?? '').matchAll(TOKEN)) if (KEYS.has(m[1]) && !out.includes(m[1])) out.push(m[1]);
  return out;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function checkTemplate(label: string, text: string, errors: string[]) {
  for (const m of text.matchAll(TOKEN)) {
    if (!KEYS.has(m[1])) errors.push(`${label}: {{${m[1]}}} isn't a placeholder you can use. Use one of: ${PLACEHOLDERS.map((p) => `{{${p.key}}}`).join(', ')}.`);
  }
  const rest = text.replace(TOKEN, '');
  if (rest.includes('{{') || rest.includes('}}')) errors.push(`${label}: has a "{{" or "}}" that isn't a complete placeholder. Remove it or finish it, e.g. {{name}}.`);
}

/**
 * Fills the placeholders. Returns ok:false with plain-English errors when anything is wrong; nothing should be sent then.
 * `html: true` HTML-escapes the values (the message itself is the caller's own markup).
 */
export function renderTemplate(template: { subject: string; body: string }, values: Values = {}, opts: { html?: boolean } = {}): RenderResult {
  const subject = String(template.subject ?? '');
  const body = String(template.body ?? '');
  const used = placeholdersIn(subject, body);
  const errors: string[] = [];

  if (/[\r\n]/.test(subject)) errors.push('Subject: must be a single line.');
  checkTemplate('Subject', subject, errors);
  checkTemplate('Message', body, errors);

  const clean: Record<string, string> = {};
  for (const key of used) {
    const def = byKey(key)!;
    const v = values?.[key];
    const text = typeof v === 'string' ? v.trim() : '';
    if (!text) { errors.push(`${def.label} ({{${key}}}) needs a value.`); continue; }
    if (text.length > def.maxLength) { errors.push(`${def.label}: at most ${def.maxLength} characters.`); continue; }
    if (hasControl(text)) { errors.push(`${def.label}: must be a single line.`); continue; }
    if (text.includes('{{') || text.includes('}}')) { errors.push(`${def.label}: can't contain "{{" or "}}".`); continue; }
    clean[key] = opts.html ? escapeHtml(text) : text;
  }
  if (errors.length) return { ok: false, errors, used };

  // One pass: inserted values are never scanned again.
  const fill = (t: string) => t.replace(TOKEN, (_all, key: string) => clean[key]);
  const out = { subject: fill(subject).trim(), body: fill(body) };
  if (!out.subject) errors.push('Subject: is empty.');
  if (out.subject.length > MAX_SUBJECT_LENGTH) errors.push(`Subject: at most ${MAX_SUBJECT_LENGTH} characters once the details are filled in.`);
  if (!out.body.trim()) errors.push('Message: is empty.');
  if (out.body.length > MAX_BODY_LENGTH) errors.push(`Message: at most ${MAX_BODY_LENGTH.toLocaleString('en-GB')} characters once the details are filled in.`);
  if (errors.length) return { ok: false, errors, used };
  return { ok: true, ...out, used };
}
