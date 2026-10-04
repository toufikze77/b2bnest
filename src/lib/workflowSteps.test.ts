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

import { executeStep, NOT_YET_AVAILABLE, STEP_DEFINITIONS } from './workflowSteps';

describe('workflow execution (mocked server, nothing is sent)', () => {
  it('offers exactly the four supported actions', () => {
    expect(STEP_DEFINITIONS.map((d) => d.kind).sort()).toEqual(['email', 'linkedin', 'whatsapp', 'x']);
  });
  const email = { id: 'e', kind: 'email' as const, config: { to: 'a@b.co', subject: 's', body: 'b' } };
  const wa = { id: 'w', kind: 'whatsapp' as const, config: { to: '+447700900123', body: 'b' } };
  it('reports success only when the server confirms it', async () => {
    expect(await executeStep(email, null, async () => ({ data: { success: true }, error: null }))).toEqual({ ok: true, message: 'Accepted by the email provider (inbox delivery not confirmed)' });
    expect((await executeStep(email, null, async () => ({ data: {}, error: null }))).ok).toBe(false);
    expect((await executeStep(email, null, async () => ({ data: null, error: null }))).ok).toBe(false);
    expect((await executeStep(email, null, async () => ({ data: { success: false, error: 'X not connected' }, error: null })))).toEqual({ ok: false, message: 'X not connected' });
  });
  it('turns server errors and thrown errors into failures', async () => {
    const err = Object.assign(new Error('Edge function returned 500'), { context: { json: async () => ({ error: 'Provider refused' }) } });
    expect(await executeStep(email, null, async () => ({ data: null, error: err }))).toEqual({ ok: false, message: 'Provider refused' });
    expect((await executeStep(email, null, async () => { throw new Error('offline'); })).ok).toBe(false);
  });
  it('never runs unverified X, LinkedIn or WhatsApp steps', async () => {
    let calls = 0; const inv = async () => { calls++; return { data: { success: true, ok: true, results: [{ ok: true }] }, error: null }; };
    for (const s of [wa, { id: 'x', kind: 'x' as const, config: { text: 'hi' } }, { id: 'l', kind: 'linkedin' as const, config: { text: 'hi' } }])
      expect(await executeStep(s, null, inv)).toEqual({ ok: false, message: NOT_YET_AVAILABLE });
    expect(calls).toBe(0);
    expect(STEP_DEFINITIONS.filter((d) => d.verified).map((d) => d.kind)).toEqual(['email']);
  });
});

describe('unknown outcomes', () => {
  it('says delivery status is unknown when there is no readable server answer', async () => {
    const email = { id: 'e', kind: 'email' as const, config: { to: 'a@b.co', subject: 's', body: 'b' } };
    expect((await executeStep(email, null, async () => ({ data: null, error: new Error('fetch failed') }))).message).toBe('Delivery status unknown. Check your inbox before trying again.');
    expect((await executeStep(email, null, async () => { throw new Error('offline'); })).message).toBe('Delivery status unknown. Check your inbox before trying again.');
  });
});
