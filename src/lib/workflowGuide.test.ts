import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GUIDE_SECTIONS, KB_WORKFLOW_ARTICLES, LIMITS, PLACEHOLDER_ROWS, SENDS_PER_MINUTE, STATUS_MEANINGS, TEMPLATE_NAMES, TROUBLESHOOTING, WORKFLOW_FAQS,
} from './workflowGuide';
import { MAX_RECIPIENTS, MAX_STEPS } from './workflowSteps';
import { STATUS_TEXT } from './workflowRuns';
import { WORKING_TEMPLATES } from './workflowEmailTemplates';
import { MAX_BODY_LENGTH, MAX_SUBJECT_LENGTH, PLACEHOLDERS } from '../../supabase/functions/_shared/placeholders.ts';

const ROOT = path.resolve(__dirname, '../..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');

describe('workflows guide facts come from the code (Phase 17)', () => {
  it('the placeholder table is the shared list, every placeholder with its example and limit', () => {
    expect(PLACEHOLDER_ROWS).toEqual(PLACEHOLDERS.map((p) => ({ token: `{{${p.key}}}`, label: p.label, example: p.example, maxLength: p.maxLength })));
    expect(PLACEHOLDER_ROWS.length).toBe(PLACEHOLDERS.length);
  });

  it('the limits quoted are the constants the code enforces', () => {
    const text = LIMITS.map((l) => `${l.what}: ${l.limit}`).join('\n');
    expect(text).toContain(`Recipients in one email step: ${MAX_RECIPIENTS} addresses`);
    expect(text).toContain(`Steps in one workflow: ${MAX_STEPS}`);
    expect(text).toContain(`Email steps you can send in a minute: ${SENDS_PER_MINUTE}`);
    expect(text).toContain(`${MAX_SUBJECT_LENGTH} characters`);
    expect(text).toContain(`${MAX_BODY_LENGTH.toLocaleString('en-GB')} characters`);
  });

  it('the server uses the same numbers', () => {
    expect(read('supabase/functions/workflow-send-email/index.ts')).toContain(`memoryRateLimit(${SENDS_PER_MINUTE}, 60_000)`);
    expect(read('supabase/functions/workflow-send-email/request.ts')).toContain(`to.length > ${MAX_RECIPIENTS}`);
    expect(read('supabase/functions/workflow-execute/handler.ts')).toContain(`const MAX_STEPS = ${MAX_STEPS};`);
  });

  it('every troubleshooting message is real: its text is in the file that produces it', () => {
    for (const t of TROUBLESHOOTING) expect(read(t.source.file), `${t.shown} → ${t.source.file}`).toContain(t.source.text);
  });

  it('the statuses are the labels the Run history panel shows', () => {
    expect(STATUS_MEANINGS.map((s) => s.status)).toEqual(Object.values(STATUS_TEXT));
    expect(STATUS_MEANINGS[0].means).toMatch(/accepted the email. It does not confirm that it reached the inbox/);
  });

  it('the template names are the working templates', () => {
    expect(TEMPLATE_NAMES).toEqual(WORKING_TEMPLATES.map((t) => t.name));
  });

  it('Knowledge Base cards point at real sections; section ids are unique', () => {
    const ids = GUIDE_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of KB_WORKFLOW_ARTICLES) expect(ids).toContain(a.anchor);
  });

  it('the Help FAQ has 8 to 10 workflow questions, including the ones customers ask most', () => {
    expect(WORKFLOW_FAQS.length).toBeGreaterThanOrEqual(8);
    expect(WORKFLOW_FAQS.length).toBeLessThanOrEqual(10);
    const qs = WORKFLOW_FAQS.map((f) => f.question).join('\n');
    for (const q of ['first workflow', 'WhatsApp, X or LinkedIn', 'placeholders', '"Sent"', 'Delivery status unknown', 'start by themselves', 'limit on emails']) expect(qs).toContain(q);
    expect(WORKFLOW_FAQS.find((f) => /start by themselves/.test(f.question))!.answer).toMatch(/^Not yet\./);
  });

  it('replies go to the sender (Phase 18): the guide, FAQ and step help say so, and nothing says they go to B2BNEST instead', () => {
    const faq = WORKFLOW_FAQS.find((f) => f.question === 'Where do replies go?')!.answer;
    expect(faq).toMatch(/your own account email/);
    expect(faq).toMatch(/isn't verified/);
    expect(read('src/pages/articles/WorkflowGuide.tsx')).toMatch(/the reply goes to your own account email/);
    expect(read('src/lib/workflowSteps.ts')).toMatch(/Replies go to your own verified account email/);
    for (const f of ['src/pages/articles/WorkflowGuide.tsx', 'src/lib/workflowGuide.ts', 'src/lib/workflowSteps.ts', 'src/components/workflows/TemplatePicker.tsx'])
      expect(read(f), f).not.toMatch(/B2BNEST, not (to )?you/);
    // With replies reaching the sender again, the templates may ask the customer to reply.
    expect(WORKING_TEMPLATES.some((t) => t.steps.some((s) => /reply to this email/i.test(s.body)))).toBe(true);
  });
});
