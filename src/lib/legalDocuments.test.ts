import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import {
  buildFields, CREDITS_PER_DOCUMENT, DOC_TYPES, docTypeById, docTypesFor, generateErrorFrom, groupedDocTypes, creditsRemainingText, ukDate,
} from '@/lib/legalDocuments';
import { deleteHistory, HISTORY_KEY, HISTORY_MAX, type HistoryEntry, loadHistory, saveHistory } from '@/lib/legalHistory';
import { documentFileName } from '@/lib/legalExport';

const FN_DIR = path.resolve(__dirname, '../../supabase/functions/generate-legal-document');
const handlerSource = fs.readFileSync(path.join(FN_DIR, 'handler.ts'), 'utf8');
const catalogueSource = fs.readFileSync(path.join(FN_DIR, 'catalogue.ts'), 'utf8');

describe('catalogue matches the Edge Function', () => {
  it('every doc type id and label in the function catalogue is what the screen shows', () => {
    const fromSource = [...catalogueSource.matchAll(/\{ id: "([a-z0-9_]+)", kind: "(contract|legal_notice)", group: \w+, label: "([^"]+)"/g)]
      .map((m) => ({ id: m[1], kind: m[2], label: m[3] }));
    expect(fromSource.length).toBe(33);
    expect(DOC_TYPES.map((d) => ({ id: d.id, kind: d.kind, label: d.label }))).toEqual(fromSource);
  });

  it('credit cost is the same as the function', () => {
    expect(handlerSource).toContain(`export const CREDITS_PER_DOCUMENT = ${CREDITS_PER_DOCUMENT};`);
  });

  it('contracts and the 7 legal notices, grouped', () => {
    expect(docTypesFor('legal_notice')).toHaveLength(7);
    expect(groupedDocTypes('contract').map((g) => g.group)).toEqual(['Services', 'Employment', 'Commercial', 'Confidentiality and other']);
    expect(groupedDocTypes('legal_notice').map((g) => g.group)).toEqual(['Legal notices']);
  });
});

describe('buildFields', () => {
  it('sends only this type\'s fields, trimmed, dates in UK words, selects as labels, checkbox ids', () => {
    const doc = docTypeById('website_privacy_policy')!;
    const r = buildFields(doc, { business_name: '  Acme Ltd ', website: 'acme.co.uk', contact_email: 'p@acme.co.uk', job_title: 'not mine' }, ['cookies', 'analytics', 'bogus']);
    expect(r.missing).toEqual([]);
    expect(r.fields).toEqual({ business_name: 'Acme Ltd', website: 'acme.co.uk', contact_email: 'p@acme.co.uk', data_collected: 'cookies,analytics' });
    const sa = buildFields(docTypeById('service_agreement')!, { business_name: 'A', other_party_name: 'B', scope: 'x', start_date: '2026-11-01', currency: 'GBP' }, []);
    expect(sa.fields.start_date).toBe('1 November 2026');
    expect(sa.fields.currency).toBe('GBP (£)');
  });

  it('lists missing required fields by their label', () => {
    expect(buildFields(docTypeById('service_agreement')!, { business_name: 'A' }, []).missing).toEqual(["Client's name", 'Scope / deliverables']);
  });

  it('ukDate leaves other text alone', () => {
    expect(ukDate('next Monday')).toBe('next Monday');
  });
});

describe('error states', () => {
  it('402 insufficient credits shows the reset date', () => {
    const e = generateErrorFrom(402, { error: 'insufficient_credits', reset_date: '2026-12-01T00:00:00Z' });
    expect(e.kind).toBe('insufficient_credits');
    expect(e.message).toContain('1 December 2026');
    expect(e.message).toContain('uses 2');
  });
  it('trial ended', () => {
    const e = generateErrorFrom(402, { error: 'trial_ended', message: 'Your 14-day trial has ended. Choose a plan on the Pricing page.' });
    expect(e).toEqual({ kind: 'trial_ended', message: 'Your 14-day trial has ended. Choose a plan on the Pricing page.' });
  });
  it('suspended', () => {
    expect(generateErrorFrom(403, { error: 'account_suspended', message: 'This account has been suspended.' }).kind).toBe('suspended');
  });
  it('AI failed (refunded) says no credit was used; not refunded says contact us', () => {
    const a = generateErrorFrom(502, { error: 'ai_failed', credit_refunded: true });
    expect(a.message).toContain('no credit was used');
    const b = generateErrorFrom(502, { error: 'ai_failed', credit_refunded: false, message: "The AI service didn't produce the document. We couldn't give the credits back automatically; contact us and we'll put it right." });
    expect(b.refunded).toBe(false);
    expect(b.message).toContain('contact us');
  });
  it('other errors use the server sentence or a plain fallback, never the client text', () => {
    expect(generateErrorFrom(400, { error: 'field_too_long', message: '"Scope" is too long (at most 500 characters).' }).message).toBe('"Scope" is too long (at most 500 characters).');
    expect(generateErrorFrom(500, { error: 'Edge Function returned a non-2xx status code' }).message).toBe("We couldn't draft the document just now. Please try again.");
    expect(generateErrorFrom(401, null).kind).toBe('signed_out');
  });
  it('credits text', () => {
    expect(creditsRemainingText({ credits_remaining: 46, credits_limit: 50 })).toBe('You have 46 of 50 AI credits left this month.');
    expect(creditsRemainingText(null)).toBeNull();
  });
});

describe('file names', () => {
  it('<type>_<other-party>_<date>', () => {
    expect(documentFileName('service_agreement', "Beta Client's plc", new Date(2026, 10, 1), 'pdf')).toBe('service_agreement_beta_clients_plc_2026-11-01.pdf');
    expect(documentFileName('cookie_policy', undefined, new Date(2026, 0, 9), 'md')).toBe('cookie_policy_2026-01-09.md');
  });
});

describe('history (this browser only)', () => {
  const entry = (n: number, kind: HistoryEntry['kind'] = 'contract'): HistoryEntry => ({
    id: `id-${kind}-${n}`, kind, docType: 'nda_mutual', label: 'NDA', jurisdiction: 'england_wales', document: `doc ${n}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString(),
  });

  it('saves, reads newest first, keeps 10 per kind, deletes', () => {
    localStorage.clear();
    for (let n = 0; n < 12; n++) saveHistory(entry(n));
    saveHistory(entry(1, 'legal_notice'));
    const list = loadHistory('contract');
    expect(list).toHaveLength(HISTORY_MAX);
    expect(list[0].id).toBe('id-contract-11');
    expect(list.at(-1)!.id).toBe('id-contract-2');
    expect(loadHistory('legal_notice')).toHaveLength(1);
    expect(deleteHistory('contract', 'id-contract-11').map((e) => e.id)).not.toContain('id-contract-11');
    expect(loadHistory('contract')).toHaveLength(9);
    // Same id replaces (edits are kept).
    saveHistory({ ...entry(5), document: 'edited' });
    expect(loadHistory('contract').find((e) => e.id === 'id-contract-5')!.document).toBe('edited');
  });

  it('ignores broken stored data', () => {
    localStorage.setItem(HISTORY_KEY, '{not json');
    expect(loadHistory('contract')).toEqual([]);
    localStorage.setItem(HISTORY_KEY, JSON.stringify([{ id: 1 }, 'x']));
    expect(loadHistory('contract')).toEqual([]);
  });

  it('works when localStorage throws', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(loadHistory('contract')).toEqual([]);
    expect(saveHistory(entry(1))).toEqual([entry(1)]);
    expect(deleteHistory('contract', 'id-contract-1')).toEqual([]);
    get.mockRestore(); set.mockRestore();
  });
});
