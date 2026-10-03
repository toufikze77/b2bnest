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
