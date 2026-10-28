import { describe, expect, it, vi } from 'vitest';
import { confirmText, executeStep, runPlan, skippedLogRow, SimpleStep } from './workflowSteps';

const email = (to: string, subject = 'S', body = 'B'): SimpleStep => ({ id: Math.random().toString(36), kind: 'email', config: { to, subject, body } });
const x: SimpleStep = { id: 'x1', kind: 'x', config: { text: 'Hi' } };

describe('Run with these details (Phase 15)', () => {
  it('counts emails and unique recipients, and says which steps are skipped', () => {
    const plan = runPlan([email('a@x.test, B@x.test'), email('b@x.test'), x]);
    expect([plan.emails, plan.recipients, plan.skipped.length]).toEqual([2, 2, 1]);
    expect(confirmText(plan)).toBe("This will send 2 emails to 2 recipients. 1 step can't run yet and will be skipped.");
    expect(confirmText(runPlan([email('a@x.test')]))).toBe('This will send 1 email to 1 recipient.');
  });

  it('lists the placeholders used by the steps that will send, once each', () => {
    expect(runPlan([email('a@x.test', 'Hi {{name}}', '{{amount}} {{name}}'), email('b@x.test', '{{due_date}}')]).placeholders).toEqual(['name', 'amount', 'due_date']);
  });

  it('never calls the server when a placeholder has no value', async () => {
    const invoke = vi.fn();
    const r = await executeStep(email('a@x.test', 'Hi {{name}}'), null, invoke, { runId: 'r', stepIndex: 0, values: {} });
    expect(r).toEqual({ ok: false, message: "Customer's name ({{name}}) needs a value. Nothing was sent." });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('sends only the values used, trimmed', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
    await executeStep(email('a@x.test', 'Hi {{name}}'), 'w1', invoke, { runId: 'r1', stepIndex: 3, values: { name: '  Sam ', amount: 'unused' } });
    expect(invoke.mock.calls[0][1]).toMatchObject({ subject: 'Hi Sam', values: { name: 'Sam' }, runId: 'r1', stepIndex: 3, workflowId: 'w1' });
  });

  it('a skipped step\'s history row is status "skipped", provider "none", with no message content', () => {
    expect(skippedLogRow(x, { runId: 'r1', stepIndex: 2, values: { name: 'Sam' } }, 'u1', 'w1')).toEqual({
      user_id: 'u1', workflow_id: 'w1', run_id: 'r1', step_index: 2, step: 'x.post', status: 'skipped', provider: 'none',
    });
  });
});
