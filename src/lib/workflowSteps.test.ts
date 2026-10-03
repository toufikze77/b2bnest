import { describe, it, expect } from 'vitest';
import { parseSavedSteps, serializeSteps, validateStep } from './workflowSteps';

describe('workflow steps', () => {
  it('flags old builder steps that cannot run and keeps runnable ones', () => {
    const parsed = parseSavedSteps([
      { id: 'a', type: 'trigger', name: 'Client Signup' },
      { id: 'b', type: 'action', name: 'Generate Contracts' },
      { id: 'c', type: 'integration', name: 'Send Email (Resend)', config: { to: 'a@b.co', subject: 'Hi', body: 'x', from: 'z' } },
      { id: 'd', type: 'integration', name: 'Slack Message' },
    ]);
    expect(parsed.unsupported).toEqual(['Client Signup', 'Generate Contracts', 'Slack Message']);
    expect(parsed.steps).toEqual([{ id: 'c', kind: 'email', config: { to: 'a@b.co', subject: 'Hi', body: 'x' } }]);
  });

  it('round-trips a saved simple workflow', () => {
    const steps = [{ id: 's1', kind: 'whatsapp' as const, config: { to: '+447700900123', body: 'Hello' } }];
    const parsed = parseSavedSteps(serializeSteps(steps));
    expect(parsed.unsupported).toEqual([]);
    expect(parsed.steps).toEqual(steps);
  });

  it('handles missing or malformed data', () => {
    expect(parseSavedSteps(null)).toEqual({ steps: [], unsupported: [] });
  });

  it('validates fields before running', () => {
    expect(validateStep({ id: '1', kind: 'email', config: { to: 'bad', subject: 's', body: 'b' } })).toMatch(/addresses/);
    expect(validateStep({ id: '1', kind: 'whatsapp', config: { to: '07700', body: 'b' } })).toMatch(/international/);
    expect(validateStep({ id: '1', kind: 'x', config: { text: 'x'.repeat(281) } })).toMatch(/280/);
    expect(validateStep({ id: '1', kind: 'linkedin', config: { text: '' } })).toMatch(/required/);
    expect(validateStep({ id: '1', kind: 'email', config: { to: 'a@b.co, c@d.co', subject: 's', body: 'b' } })).toBeNull();
  });
});

import { executeStep, STEP_DEFINITIONS } from './workflowSteps';

describe('workflow execution (mocked server, nothing is sent)', () => {
  it('offers exactly the four supported actions', () => {
    expect(STEP_DEFINITIONS.map((d) => d.kind).sort()).toEqual(['email', 'linkedin', 'whatsapp', 'x']);
  });
  const email = { id: 'e', kind: 'email' as const, config: { to: 'a@b.co', subject: 's', body: 'b' } };
  const wa = { id: 'w', kind: 'whatsapp' as const, config: { to: '+447700900123', body: 'b' } };
  it('reports success only when the server confirms it', async () => {
    expect(await executeStep(email, null, async () => ({ data: { success: true }, error: null }))).toEqual({ ok: true, message: 'Email sent' });
    expect((await executeStep(email, null, async () => ({ data: {}, error: null }))).ok).toBe(false);
    expect((await executeStep(email, null, async () => ({ data: null, error: null }))).ok).toBe(false);
    expect((await executeStep(email, null, async () => ({ data: { success: false, error: 'X not connected' }, error: null })))).toEqual({ ok: false, message: 'X not connected' });
  });
  it('turns server errors, thrown errors and WhatsApp failures into failures', async () => {
    const err = Object.assign(new Error('Edge function returned 500'), { context: { json: async () => ({ error: 'Twitter not connected' }) } });
    expect(await executeStep({ id: 'x', kind: 'x', config: { text: 'hi' } }, null, async () => ({ data: null, error: err }))).toEqual({ ok: false, message: 'Twitter not connected' });
    expect((await executeStep(email, null, async () => { throw new Error('offline'); })).ok).toBe(false);
    expect((await executeStep(wa, null, async () => ({ data: { ok: true, results: [{ ok: false, error: 'whatsapp_not_connected' }] }, error: null })))).toEqual({ ok: false, message: 'whatsapp_not_connected' });
    expect((await executeStep(wa, null, async () => ({ data: { ok: true, results: [] }, error: null }))).ok).toBe(false);
  });
});
