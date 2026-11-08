// docs/hmrc-plan (owner decision): HMRC tools are in Business and Scale, not Solo, and on the 14-day trial; the same
// plan keys as Workflow Studio. The Pricing lists, the Business Tools card, Help, the assistant's knowledge and the
// database rule must all say the same thing.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLANS } from '@/lib/plans';
import { HMRC_INCLUDED_TEXT, HMRC_PLAN_MESSAGE } from '@/lib/hmrcConnection';
import { WORKFLOW_PLAN_KEYS } from '../../supabase/functions/_shared/workflow-access.ts';
import { HMRC_MESSAGES } from '../../supabase/functions/_shared/hmrc/errors.ts';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');

describe('HMRC by plan', () => {
  it('Business and Scale list HMRC Integration; Solo does not; prices and other features unchanged', () => {
    const lists = Object.fromEntries(PLANS.map((p) => [p.id, p.features.join(' | ')]));
    expect(lists.starter).not.toMatch(/HMRC/);
    expect(lists.professional).toMatch(/HMRC Integration: connect your company to HMRC \(filing not available yet\)/);
    expect(lists.enterprise).toMatch(/Everything in Business, including Workflow Studio and HMRC Integration/);
    expect(PLANS.map((p) => [p.id, p.monthly, p.annual, p.aiCredits])).toEqual([['starter', 19, 190, 250], ['professional', 59, 590, 1000], ['enterprise', 89, 890, 5000]]);
  });

  it('the database rule uses exactly the Workflow Studio plan keys (professional, enterprise), failing closed for anything else', () => {
    const sql = read('docs/hmrc-plan/proposal.sql');
    expect(sql).toContain("NOT IN ('professional', 'enterprise') THEN RETURN 'plan_not_included'");
    expect([...WORKFLOW_PLAN_KEYS]).toEqual(['professional', 'enterprise']);
  });

  it('the same words everywhere: server message, app message, Business Tools card, Help, knowledge', () => {
    expect(HMRC_MESSAGES.plan_not_included).toBe('HMRC tools are included in the Business and Scale plans.');
    expect(HMRC_PLAN_MESSAGE).toBe(HMRC_MESSAGES.plan_not_included);
    expect(HMRC_INCLUDED_TEXT).toBe('Included in Business and Scale, and during the 14-day trial.');
    const tools = read('src/pages/BusinessTools.tsx');
    expect(tools).toContain("Filing is not available yet. Included in Business and Scale, and during the 14-day trial.");
    expect(tools).toContain("'Business and Scale plans']");
    const help = read('src/pages/Help.tsx');
    expect(help).toMatch(/HMRC Integration is included in the Business and Scale plans, and every new account can use it during the 14-day trial; Solo doesn't include it\. Only HMRC's test environment \(sandbox\) is available: you can try VAT obligations and a test VAT return, but nothing is filed with HMRC for real\./);
    const knowledge = read('supabase/functions/ai-assistant/knowledge.ts');
    expect(knowledge).toMatch(/HMRC Integration is included in the Business and Scale plans and during the 14-day trial; Solo does not include it/);
    expect(knowledge).toMatch(/HMRC filing is not available yet/);
  });
});
