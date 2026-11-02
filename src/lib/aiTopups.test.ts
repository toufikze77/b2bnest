import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TOPUP_FAQ_ANSWER, CHOOSE_PLAN_FIRST, packTitle, perCreditLabel, poundsLabel, TOPUP_CAP, TOPUP_PACKS, TOPUP_RULES, TOPUP_VALID_MONTHS, topupOffer } from '@/lib/aiTopups';
import { CREDITS_USAGE_NOTE } from '@/lib/aiCredits';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('top-up catalogue (Phase 37)', () => {
  it('the owner decision: 100 £5, 300 £12, 1,000 £35', () => {
    expect(TOPUP_PACKS.map((p) => [p.credits, poundsLabel(p.amountPence)])).toEqual([[100, '£5'], [300, '£12'], [1000, '£35']]);
    expect(TOPUP_PACKS.map(perCreditLabel)).toEqual(['5p a credit', '4p a credit', '3.5p a credit']);
    expect(TOPUP_PACKS.map(packTitle)).toEqual(['100 credits', '300 credits', '1,000 credits']);
  });
  it('matches the SQL seed exactly (the server source)', () => {
    const sql = read('docs/phase37/proposal.sql');
    const seed = sql.match(/INSERT INTO public\.ai_topup_packs \(id, credits, amount_pence\) VALUES([\s\S]*?);/)![1];
    const rows = [...seed.matchAll(/\('(\w+)', (\d+), (\d+)\)/g)].map((m) => ({ id: m[1], credits: Number(m[2]), amountPence: Number(m[3]) }));
    expect(rows).toEqual(TOPUP_PACKS);
    expect(sql).toContain(`> ${TOPUP_CAP}`);
    expect(sql).toContain(`interval '${TOPUP_VALID_MONTHS} months'`);
  });
  it('matches the Edge Function catalogue exactly', () => {
    const ts = read('supabase/functions/_shared/topup-packs.ts');
    const rows = [...ts.matchAll(/\{ id: "(\w+)", credits: (\d+), amountPence: (\d+) \}/g)].map((m) => ({ id: m[1], credits: Number(m[2]), amountPence: Number(m[3]) }));
    expect(rows).toEqual(TOPUP_PACKS);
    expect(ts).toContain(`TOPUP_CAP = ${TOPUP_CAP}`);
    expect(ts).toContain(`TOPUP_VALID_MONTHS = ${TOPUP_VALID_MONTHS}`);
  });
  it('the rules line and usage note say: 12 months, after monthly, no roll-over, subscribers only, prices as shown', () => {
    expect(TOPUP_RULES).toBe("Top-up credits last 12 months and are used after your monthly credits. Monthly credits don't roll over. For subscribers only. Prices as shown.");
    expect(CREDITS_USAGE_NOTE).toContain('top-up credits last 12 months and are used after your monthly credits');
  });
  it('who may buy: own plan or owner; company members and trials may not', () => {
    expect(topupOffer({ state: 'subscribed', via: 'self' }, true)).toBe('buy');
    expect(topupOffer({ state: 'owner', via: 'self' }, false)).toBe('buy');
    expect(topupOffer({ state: 'subscribed', via: 'company' }, false)).toBe('company');
    for (const state of ['trial', 'trial_ended', 'suspended'] as const) expect(topupOffer({ state, via: 'self' }, false)).toBe('plan_first');
    expect(CHOOSE_PLAN_FIRST).toBe('Choose a plan first. Top-ups are for subscribers.');
  });
  it('the FAQ answer (Pricing, Help) names every pack and the rules', () => {
    expect(TOPUP_FAQ_ANSWER).toBe("Yes, if you subscribe on your own plan: top-ups in Settings → Billing are 100 credits for £5, 300 credits for £12, 1,000 credits for £35, as one-off payments. Prices as shown. Top-up credits last 12 months and are used after your monthly credits. Monthly credits don't roll over. Top-ups aren't available during the free trial or to company members whose company pays.");
  });
});
