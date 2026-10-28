import { describe, expect, it } from 'vitest';
import { groupRuns, historyStep, RunLogRow } from './workflowRuns';

const row = (o: Partial<RunLogRow>): RunLogRow => ({
  id: Math.random().toString(36), created_at: '2026-10-28T10:00:00Z', user_id: 'u1', workflow_id: 'w1', step: 'email.send', status: 'ok', provider: 'smtp', ...o,
});

describe('run history', () => {
  it('"Sent" only for a server "ok"; anything else is never shown as sent', () => {
    expect(historyStep(row({ status: 'ok' })).statusText).toBe('Sent');
    expect(historyStep(row({ status: 'error', response_summary: { message: 'Nothing was sent.' } }))).toMatchObject({ statusText: 'Failed', detail: 'Nothing was sent.' });
    expect(historyStep(row({ status: 'unknown' }))).toMatchObject({ statusText: 'Delivery status unknown', detail: 'Delivery status unknown. Check your inbox before trying again.' });
    expect(historyStep(row({ status: 'skipped', step: 'linkedin.post' }))).toMatchObject({ statusText: 'Skipped (step not available)', label: 'Post on LinkedIn' });
    expect(historyStep(row({ status: 'weird' })).statusText).toBe('Failed');
    expect(historyStep(row({ status: 'error' })).detail).toBe('The server gave no reason.');
  });

  it('groups by run id in step order, newest run first, and keeps older rows without a run id as their own runs', () => {
    const runs = groupRuns([
      row({ run_id: 'b', step_index: 1, created_at: '2026-10-28T12:00:01Z' }),
      row({ run_id: 'b', step_index: 0, created_at: '2026-10-28T12:00:00Z' }),
      row({ run_id: null, step: 'whatsapp.send', status: 'error', created_at: '2026-10-27T09:00:00Z' }),
      row({ run_id: 'a', step_index: 0, created_at: '2026-10-28T08:00:00Z' }),
    ]);
    expect(runs.map((r) => [r.at, r.steps.map((s) => s.index)])).toEqual([
      ['2026-10-28T12:00:00Z', [0, 1]], ['2026-10-28T08:00:00Z', [0]], ['2026-10-27T09:00:00Z', [null]],
    ]);
  });

  it('keeps the latest 20 runs', () => {
    const rows = Array.from({ length: 25 }, (_, i) => row({ run_id: `r${i}`, created_at: `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00Z` }));
    const runs = groupRuns(rows);
    expect(runs).toHaveLength(20);
    expect(runs[0].at).toBe('2026-10-25T00:00:00Z');
  });
});
