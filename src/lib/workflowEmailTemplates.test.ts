import { describe, expect, it } from 'vitest';
import { COMING_SOON_TEMPLATES, WORKING_TEMPLATES, templateSteps } from './workflowEmailTemplates';
import { workflowTemplates } from '@/data/workflowTemplates';
import { MAX_STEPS, renderEmailStep, stepDefinition, validateStep } from './workflowSteps';
import { PLACEHOLDERS, placeholdersIn } from '../../supabase/functions/_shared/placeholders.ts';

const examples = Object.fromEntries(PLACEHOLDERS.map((p) => [p.key, p.example]));
let n = 0;
const id = () => `t${++n}`;

describe('working Workflow Studio templates', () => {
  it('there are six, each replacing a named template that exists', () => {
    expect(WORKING_TEMPLATES).toHaveLength(6);
    for (const t of WORKING_TEMPLATES) expect(workflowTemplates.some((w) => w.id === t.sourceId), t.id).toBe(true);
    expect(new Set(WORKING_TEMPLATES.map((t) => t.sourceId)).size).toBe(6);
  });

  it('every preloaded template passes validateStep, uses only the verified email step and fits the step limit', () => {
    for (const t of WORKING_TEMPLATES) {
      const steps = templateSteps(t, 'you@example.com', id);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.length).toBeLessThanOrEqual(MAX_STEPS);
      for (const s of steps) {
        expect(s.kind).toBe('email');
        expect(stepDefinition(s.kind).verified).toBe(true);
        expect(validateStep(s), t.id).toBeNull();
        expect(s.config.to).toBe('you@example.com');
      }
    }
  });

  it('uses only known placeholders and renders cleanly with example details (no {{ left)', () => {
    for (const t of WORKING_TEMPLATES) {
      for (const s of templateSteps(t, 'you@example.com', id)) {
        const r = renderEmailStep(s, examples);
        expect(r.ok, `${t.id}: ${r.ok === false ? r.errors.join(' ') : ''}`).toBe(true);
        if (r.ok === true) expect(`${r.subject}\n${r.body}`).not.toMatch(/\{\{|\}\}/);
      }
    }
  });

  it('British English, no fake urgency, no invented statistics or guarantees', () => {
    const text = WORKING_TEMPLATES.flatMap((t) => [t.name, t.description, ...t.steps.flatMap((s) => [s.subject, s.body])]).join('\n');
    expect(text).not.toMatch(/\b(urgent|immediately|act now|last chance|final notice|limited time|today only|guarantee\w*|\d+ ?%|best in|#1)\b/i);
    expect(text).not.toMatch(/\b(color|organization|favor|center|analyze|personalized)\b/i);
    expect(text).not.toMatch(/!/);
  });

  it('every other named template is "not available", the blank one excepted', () => {
    expect(COMING_SOON_TEMPLATES.length).toBe(workflowTemplates.length - 1 - WORKING_TEMPLATES.length);
    expect(COMING_SOON_TEMPLATES.some((t) => t.id === 'blank')).toBe(false);
  });

  it('each template asks only for details its emails use', () => {
    const t = WORKING_TEMPLATES.find((x) => x.id === 'new-lead-welcome')!;
    expect(placeholdersIn(t.steps[0].subject, t.steps[0].body)).toEqual(['name', 'company']);
  });
});
