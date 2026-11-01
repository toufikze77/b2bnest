// Phase 30: the AI Contract Generator and the Privacy / Legal Notices Generator. The catalogue is the Edge Function's own
// file (supabase/functions/generate-legal-document/catalogue.ts), so the screen can only ask for what the function
// accepts. legalDocuments.test.ts checks the two stay the same.
import { supabase } from '@/integrations/supabase/client';
import { functionErrorStatus, functionErrorText, readFunctionError } from '@/lib/billingErrors';
import {
  DATA_COLLECTED_OPTIONS, DETAILS_MAX, DOC_TYPES, docTypeById, docTypesFor, FIELD_MAX, FIELDS, fieldLabel, JURISDICTIONS,
  type DocKind, type DocType, type FieldDef, type FieldId, type Jurisdiction,
} from '../../supabase/functions/generate-legal-document/catalogue.ts';

export {
  DATA_COLLECTED_OPTIONS, DETAILS_MAX, DOC_TYPES, docTypeById, docTypesFor, FIELD_MAX, FIELDS, fieldLabel, JURISDICTIONS,
  type DocKind, type DocType, type FieldDef, type FieldId, type Jurisdiction,
};

/** Must match CREDITS_PER_DOCUMENT in the function's handler.ts (checked by the test). */
export const CREDITS_PER_DOCUMENT = 2;
export const DEFAULT_JURISDICTION: Jurisdiction = 'england_wales';
export const CREDIT_COST_TEXT = `Uses ${CREDITS_PER_DOCUMENT} AI credits`;
export const AI_DRAFT_BANNER = 'AI-drafted. Not legal advice. Have a solicitor check it.';
export const PROGRESS_TEXT = 'Drafting your document… this can take up to a minute.';

/** The doc types of one kind, grouped in catalogue order (for <optgroup>). */
export function groupedDocTypes(kind: DocKind): { group: string; types: DocType[] }[] {
  const out: { group: string; types: DocType[] }[] = [];
  for (const d of docTypesFor(kind)) {
    const g = out.find((x) => x.group === d.group);
    if (g) g.types.push(d); else out.push({ group: d.group, types: [d] });
  }
  return out;
}

export const fieldMax = (id: FieldId) => (id === 'details' ? DETAILS_MAX : FIELD_MAX);

/** "2026-11-01" → "1 November 2026" (what the model is given). Anything else is sent as typed. */
export function ukDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * The fields to send: only this type's, trimmed, empty ones left out, dates in UK words, selects as their label,
 * checkboxes as comma separated ids. Returns the missing required labels too.
 */
export function buildFields(doc: DocType, values: Partial<Record<FieldId, string>>, dataCollected: string[]):
  { fields: Partial<Record<FieldId, string>>; missing: string[] } {
  const fields: Partial<Record<FieldId, string>> = {};
  const missing: string[] = [];
  for (const f of doc.fields) {
    const def = FIELDS[f.id];
    let value = '';
    if (def.input === 'checkboxes') value = dataCollected.filter((id) => DATA_COLLECTED_OPTIONS.some((o) => o.id === id)).join(',');
    else {
      value = (values[f.id] ?? '').trim();
      if (def.input === 'date') value = ukDate(value);
      if (def.input === 'select') value = def.options?.find((o) => o.id === value)?.label ?? value;
    }
    if (value) fields[f.id] = value.slice(0, fieldMax(f.id));
    else if (f.required) missing.push(fieldLabel(doc, f.id));
  }
  return { fields, missing };
}

export interface GeneratedDocument {
  document: string; docType: string; jurisdiction: Jurisdiction;
  credits_used: number; credits_remaining?: number; credits_limit?: number; reset_date?: string;
}

export type GenerateErrorKind = 'insufficient_credits' | 'trial_ended' | 'suspended' | 'ai_failed' | 'signed_out' | 'other';
export interface GenerateError { kind: GenerateErrorKind; message: string; refunded?: boolean; resetDate?: string }
export type GenerateResult = { ok: true; data: GeneratedDocument } | { ok: false; error: GenerateError };

const GENERIC = "We couldn't draft the document just now. Please try again.";
const formatReset = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Maps a failed call to what the screen shows. Pure (the body is already read), so it is easy to test. */
export function generateErrorFrom(status: number | null, body: Record<string, unknown> | null): GenerateError {
  const code = typeof body?.error === 'string' ? body.error : '';
  const text = (fallback: string) => functionErrorText(body as { message?: unknown }, fallback);
  if (status === 402 && code === 'insufficient_credits') {
    const reset = formatReset(typeof body?.reset_date === 'string' ? body.reset_date : undefined);
    return {
      kind: 'insufficient_credits', resetDate: reset ?? undefined,
      message: `You don't have enough AI credits for this document (it uses ${CREDITS_PER_DOCUMENT}). ${reset ? `Your credits reset on ${reset}.` : 'Your credits reset at the start of your next billing month.'}`,
    };
  }
  if (code === 'trial_ended') return { kind: 'trial_ended', message: text('Your trial has ended. Choose a plan on the Pricing page to keep drafting documents.') };
  if (code === 'account_suspended') return { kind: 'suspended', message: text('This account has been suspended. Contact us if you think this is a mistake.') };
  if (code === 'ai_failed') {
    const refunded = body?.credit_refunded !== false;
    return {
      kind: 'ai_failed', refunded,
      message: refunded
        ? "The AI didn't produce the document, so no credit was used. Please try again in a moment."
        : text("The AI didn't produce the document and we couldn't give the credits back automatically. Contact us and we'll put it right."),
    };
  }
  if (status === 401) return { kind: 'signed_out', message: 'Please sign in again.' };
  return { kind: 'other', message: text(GENERIC) };
}

export interface GenerateRequest { kind: DocKind; docType: string; jurisdiction: Jurisdiction; fields: Partial<Record<FieldId, string>> }

export async function invokeGenerateLegalDocument(request: GenerateRequest): Promise<GenerateResult> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-legal-document', { body: request });
    if (error) return { ok: false, error: generateErrorFrom(functionErrorStatus(error), await readFunctionError(error) as Record<string, unknown> | null) };
    const d = data as GeneratedDocument | null;
    if (!d || typeof d.document !== 'string' || !d.document.trim()) return { ok: false, error: { kind: 'other', message: GENERIC } };
    return { ok: true, data: d };
  } catch {
    return { ok: false, error: { kind: 'other', message: GENERIC } };
  }
}

/** "You have 46 of 50 AI credits left this month." */
export function creditsRemainingText(d: { credits_remaining?: number; credits_limit?: number } | null | undefined): string | null {
  if (typeof d?.credits_remaining !== 'number') return null;
  const of = typeof d.credits_limit === 'number' ? ` of ${d.credits_limit.toLocaleString('en-GB')}` : '';
  return `You have ${d.credits_remaining.toLocaleString('en-GB')}${of} AI credits left this month.`;
}
