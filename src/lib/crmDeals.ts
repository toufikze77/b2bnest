/**
 * What the CRM sends to crm_deals (Phase 1b). No invented values:
 * - probability: blank → null (sent explicitly, never the database default of 50); 0 stays 0;
 * - currency: always sent; the deal's own choice, else the account currency, else null (never 'USD' by default).
 */
import { normalizeCurrency } from '@/lib/money';

export interface DealInput {
  title?: string;
  value?: number | null;
  stage?: string | null;
  contact_id?: string | null;
  probability?: number | null;
  close_date?: string | null;
  notes?: string | null;
  currency?: string | null;
}

/** Blank, NaN or out-of-range → null; otherwise a whole percentage 0–100. */
export function cleanProbability(p: unknown): number | null {
  if (p === null || p === undefined || p === '') return null;
  const n = Number(p);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function dealInsertPayload(d: DealInput, userId: string, accountCurrency: string | null | undefined) {
  return {
    title: (d.title || '').trim(),
    value: d.value || 0,
    stage: d.stage || 'prospecting',
    contact_id: d.contact_id || null,
    probability: cleanProbability(d.probability),
    close_date: d.close_date || null,
    notes: d.notes?.trim() || null,
    currency: normalizeCurrency(d.currency) || normalizeCurrency(accountCurrency) || null,
    user_id: userId,
  };
}

/** Only the fields passed in are written (so a stage-only move never touches the rest). */
export function dealUpdatePayload(d: DealInput) {
  const has = (k: keyof DealInput) => Object.prototype.hasOwnProperty.call(d, k);
  const out: { title?: string; value?: number; stage?: string; contact_id?: string | null; probability?: number | null; close_date?: string | null; notes?: string | null; currency?: string | null } = {};
  if (has('title')) out.title = d.title?.trim();
  if (has('value')) out.value = d.value || 0;
  if (has('stage')) out.stage = d.stage || 'prospecting';
  if (has('contact_id')) out.contact_id = d.contact_id || null;
  if (has('probability')) out.probability = cleanProbability(d.probability);
  if (has('close_date')) out.close_date = d.close_date || null;
  if (has('notes')) out.notes = d.notes?.trim() || null;
  if (has('currency')) out.currency = normalizeCurrency(d.currency) || null;
  return out;
}
