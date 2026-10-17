/**
 * "Email to customer" for quotes and invoices (Phase 4b). The send-document-email Edge Function does the
 * sending; this file holds the browser side: when the action is available, the default wording (the same
 * as the server's), and the calls. The browser never sends a recipient address: the server always uses
 * the client_email saved on the document.
 */
import type { DocKind } from '@/lib/documentActions';
import { isArchived } from '@/lib/archive';

export const FUNCTION_NAME = 'send-document-email';
export const MESSAGE_MAX = 2000;
export const SUBJECT_MAX = 200;
export const PDF_MAX_BYTES = 5 * 1024 * 1024;

const EMAIL = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export const isValidEmail = (s: string | null | undefined): boolean => !!s && s.trim().length <= 254 && EMAIL.test(s.trim());

/**
 * What the server says about this user (GET send-document-email). `sender` is the address emails are sent from,
 * as configured on the server (SMTP_FROM / SMTP_USER); it is only given to a user who may send.
 */
export type EmailBlock = 'not_configured' | 'not_allowed' | 'email_not_verified';
export interface EmailAccess { configured: boolean; sender?: string; reason?: EmailBlock }
const BLOCKS: EmailBlock[] = ['not_configured', 'not_allowed', 'email_not_verified'];
const NOT_AVAILABLE: Record<EmailBlock, string> = {
  not_configured: 'Emailing from B2BNEST isn’t switched on yet. Download the PDF and send it yourself.',
  not_allowed: 'Emailing from B2BNEST isn’t switched on for your account yet. Download the PDF and send it yourself.',
  email_not_verified: 'Verify your email address to use this.',
};

export interface EmailableDoc {
  status?: string | null; archived_at?: string | null; client_email?: string | null;
}
export interface EmailAvailability {
  /** Menu / button label. */
  label: string;
  enabled: boolean;
  /** Why it is disabled (shown next to the action). */
  reason?: string;
  /** Already sent: emailing again needs the extra confirmation line. */
  again: boolean;
}

/** Whether "Email to customer" can be used for this document, and if not, why not. */
export function emailAvailability(kind: DocKind, doc: EmailableDoc, access: EmailAccess | null): EmailAvailability {
  const noun = kind === 'invoice' ? 'invoice' : 'quote';
  if (!access?.configured) return { label: 'Email to customer (not available yet)', enabled: false, again: false, reason: NOT_AVAILABLE[access?.reason ?? 'not_configured'] };
  if (isArchived(doc)) return { label: 'Email to customer', enabled: false, again: false, reason: `Archived ${noun}s can’t be emailed. Restore it first.` };
  const status = (doc.status || 'draft').toLowerCase();
  if (kind === 'invoice' && status === 'paid') return { label: 'Email to customer', enabled: false, again: false, reason: 'This invoice is paid, so it isn’t emailed.' };
  if (!doc.client_email?.trim()) return { label: 'Email to customer', enabled: false, again: false, reason: `Add the customer’s email address first (Edit the ${noun}).` };
  if (!isValidEmail(doc.client_email)) return { label: 'Email to customer', enabled: false, again: false, reason: `The customer email address isn’t valid. Edit the ${noun} to fix it.` };
  if (status !== 'draft') return { label: 'Email again', enabled: true, again: true };
  return { label: 'Email to customer', enabled: true, again: false };
}

/** Header-safe business name (the server cleans it the same way). */
export const cleanName = (s: string | null | undefined, max = 70) =>
  String(s ?? '').replace(/[\r\n<>"\\]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
const amountText = (total: number | string | null | undefined, currency: string | null | undefined) => {
  const a = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(total) || 0);
  return currency ? `${a} ${String(currency).toUpperCase()}` : a;
};
const dateText = (iso: string | null | undefined) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const t = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export interface EmailDocInfo {
  kind: DocKind; number: string; clientName?: string | null; business?: string | null;
  total?: number | string | null; currency?: string | null;
  /** Invoice due date or quote valid-until date. */
  date?: string | null;
}
export function defaultEmailSubject(d: EmailDocInfo): string {
  const biz = cleanName(d.business);
  return `${d.kind === 'invoice' ? 'Invoice' : 'Quote'} ${d.number}${biz ? ` from ${biz}` : ''}`.replace(/\s+/g, ' ').trim().slice(0, SUBJECT_MAX);
}
export function defaultEmailMessage(d: EmailDocInfo): string {
  const biz = cleanName(d.business) || 'your supplier';
  const when = dateText(d.date);
  const due = when ? (d.kind === 'invoice' ? `, due ${when}` : `, valid until ${when}`) : '';
  return `Hello ${cleanName(d.clientName) || 'there'},\n\nPlease find ${d.kind} ${d.number} attached, total ${amountText(d.total, d.currency)}${due}.\n\nSent by ${biz} using B2BNEST.`;
}
/** Same rule as the server: letters, digits, dot, dash and underscore. */
export function attachmentName(kind: DocKind, number: string | null | undefined): string {
  const base = String(number ?? '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 80);
  return `${base || kind}.pdf`;
}
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export type SendResult =
  | { ok: true; recipient: string }
  | { ok: false; error: string; code?: string; sent?: 'not_sent' | 'unknown' };

interface FunctionsClient {
  functions: { invoke: (name: string, opts?: { method?: string; body?: unknown }) => Promise<{ data: unknown; error: unknown }> };
}
const UNREACHABLE = 'B2BNEST couldn’t reach its email service. Nothing was sent. Download the PDF and send it yourself.';

/** Reads the JSON body of a non-2xx function reply (supabase-js puts the Response in error.context). */
async function errorBody(error: unknown): Promise<Record<string, unknown> | null> {
  const ctx = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (!ctx || typeof ctx.json !== 'function') return null;
  try { const b = await ctx.json(); return b && typeof b === 'object' ? (b as Record<string, unknown>) : null; } catch { return null; }
}

export function documentEmailApi(client: FunctionsClient) {
  return {
    /**
     * Lightweight check: may this user send, and from which address? The function answers without touching the mail
     * server. Any problem (not deployed, offline, odd answer) = not available.
     */
    async access(): Promise<EmailAccess> {
      try {
        const { data, error } = await client.functions.invoke(FUNCTION_NAME, { method: 'GET' });
        const d = (error ? null : data) as { configured?: unknown; sender?: unknown; reason?: unknown } | null;
        if (d?.configured === true) return { configured: true, ...(typeof d.sender === 'string' && isValidEmail(d.sender) ? { sender: d.sender.trim() } : {}) };
        return { configured: false, reason: BLOCKS.includes(d?.reason as EmailBlock) ? (d!.reason as EmailBlock) : 'not_configured' };
      } catch { return { configured: false, reason: 'not_configured' }; }
    },
    /** Sends one document. Only kind, id, subject, message and the PDF are sent: never an address. */
    async send(input: { kind: DocKind; id: string; subject: string; message: string; pdfBase64: string }): Promise<SendResult> {
      const body = { kind: input.kind, id: input.id, subject: input.subject, message: input.message, pdf_base64: input.pdfBase64 };
      let res: { data: unknown; error: unknown };
      try { res = await client.functions.invoke(FUNCTION_NAME, { method: 'POST', body }); } catch { return { ok: false, error: UNREACHABLE, sent: 'not_sent' }; }
      const data = (res.error ? await errorBody(res.error) : res.data) as Record<string, unknown> | null;
      if (!res.error && data?.success === true && data.status === 'accepted_by_provider' && typeof data.recipient === 'string') return { ok: true, recipient: data.recipient };
      if (data && typeof data.error === 'string') {
        return { ok: false, error: data.error, code: typeof data.code === 'string' ? data.code : undefined, sent: data.sent === 'unknown' ? 'unknown' : 'not_sent' };
      }
      // No readable answer: we cannot tell what happened, so never claim success (and never claim "nothing sent").
      return res.error
        ? { ok: false, error: UNREACHABLE, sent: 'not_sent' }
        : { ok: false, error: 'The email service gave an unexpected answer, so B2BNEST can’t confirm the email was sent. Check with your customer before trying again.', sent: 'unknown' };
    },
  };
}

export const SENT_TOAST = (address: string) => `Email sent to ${address}. Your mail provider accepted it.`;
export const SENT_NOT_SAVED = 'The email was sent, but the status could not be saved. Mark it as sent manually.';
