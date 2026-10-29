// Run history for Workflow Studio, read from public.workflow_run_logs through the user's own session.
// RLS: a user reads only their own rows (user_id = auth.uid()). Rows hold counts and the server's reason only, never
// recipient addresses or message text (docs/phase15/README.md).
import { EMAIL_STATUS_UNKNOWN } from '@/lib/workflowSteps';

export interface RunLogRow {
  id: string; created_at: string; user_id: string; workflow_id: string | null; step: string; status: string; provider: string;
  run_id?: string | null; step_index?: number | null;
  request_summary?: { recipients?: number } | null;
  response_summary?: { code?: string; message?: string; error?: string } | null;
}

export type StepStatus = 'sent' | 'failed' | 'unknown' | 'skipped';
export interface HistoryStep { key: string; index: number | null; label: string; status: StepStatus; statusText: string; detail: string | null; recipients: number | null }
export interface HistoryRun { key: string; at: string; steps: HistoryStep[] }

export const HISTORY_RUNS = 20;
/** Rows fetched for 20 runs of up to 10 steps. */
export const HISTORY_ROWS = HISTORY_RUNS * 10;

const STEP_LABELS: Record<string, string> = {
  'email.send': 'Send an email', 'whatsapp.send': 'Send a WhatsApp message', 'x.post': 'Post on X (Twitter)', 'linkedin.post': 'Post on LinkedIn',
};

export const STATUS_TEXT: Record<StepStatus, string> = {
  sent: 'Sent', failed: 'Failed', unknown: 'Delivery status unknown', skipped: 'Skipped (step not available)',
};

/**
 * Phase 19: a step the server refused before sending (plan doesn't include workflows, trial ended, plan check failed).
 * Stored as 'skipped' with the server's own message; shown with that message, never as "step not available".
 */
export const SKIPPED_REFUSED_TEXT = 'Skipped (not sent)';

/** Plain status for one row. "Sent" only when the server recorded 'ok'. */
export function historyStep(row: RunLogRow): HistoryStep {
  const status: StepStatus = row.status === 'ok' ? 'sent' : row.status === 'unknown' ? 'unknown' : row.status === 'skipped' ? 'skipped' : 'failed';
  const reason = row.response_summary?.message || row.response_summary?.error || row.response_summary?.code || null;
  // Browser-written skips (switched-off steps) carry no message; server refusals always do.
  const refused = status === 'skipped' && row.provider === 'none' && !!row.response_summary?.message;
  const detail = status === 'sent'
    ? (row.step === 'email.send' ? 'Accepted by the email provider. Inbox delivery isn\'t confirmed.' : null)
    : status === 'unknown' ? EMAIL_STATUS_UNKNOWN
    : status === 'failed' ? (reason ?? 'The server gave no reason.')
    : refused ? (row.response_summary?.message as string)
    : 'This step hasn\'t been verified yet, so it was not run.';
  const n = Number(row.request_summary?.recipients);
  return {
    key: row.id, index: Number.isInteger(row.step_index) ? (row.step_index as number) : null,
    label: STEP_LABELS[row.step] ?? row.step, status, statusText: refused ? SKIPPED_REFUSED_TEXT : STATUS_TEXT[status], detail,
    recipients: row.step === 'email.send' && Number.isInteger(n) && n > 0 ? n : null,
  };
}

/** Groups rows (newest first) into runs by run_id; rows without one (written before Phase 15) are a run each. */
export function groupRuns(rows: RunLogRow[], limit = HISTORY_RUNS): HistoryRun[] {
  const runs = new Map<string, { at: string; rows: RunLogRow[] }>();
  for (const row of rows) {
    const key = row.run_id || `row:${row.id}`;
    const run = runs.get(key);
    if (run) { run.rows.push(row); if (row.created_at < run.at) run.at = row.created_at; } else runs.set(key, { at: row.created_at, rows: [row] });
  }
  return [...runs.entries()]
    .map(([key, r]) => ({
      key, at: r.at,
      steps: r.rows.slice().sort((a, b) => (a.step_index ?? 0) - (b.step_index ?? 0) || a.created_at.localeCompare(b.created_at)).map(historyStep),
    }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/** e.g. "28 Oct 2026, 14:05". */
export const runTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
