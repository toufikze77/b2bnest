import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOT_AVAILABLE, OLD_TRACKER_NOTE, type TimeEntry } from '@/lib/timeTracker';

const NOW = new Date(2026, 10, 2, 12, 0, 0).getTime(); // Monday 2 Nov 2026, 12:00 local
const ago = (s: number) => new Date(NOW - s * 1000).toISOString();
const entry = (over: Partial<TimeEntry> = {}): TimeEntry => ({
  id: 'e1', user_id: 'me', project_id: null, company_id: null, description: 'Client call', start_time: ago(3909), end_time: null,
  paused_seconds: 0, paused_at: null, is_billable: true, hourly_rate_pence: null, ...over,
});
const ok = <T,>(data: T) => Promise.resolve({ data, error: null });
const EMPTY_SUMMARY = { entries: 0, total_seconds: 0, billable_seconds: 0, billable_value_pence: 0, unrated_billable_seconds: 0, by_project: [], by_day: [{ day: '2026-11-02', seconds: 0, billable_seconds: 0, value_pence: 0 }] };

const api = vi.hoisted(() => ({
  loadRunning: vi.fn(), loadEntries: vi.fn(), loadProjects: vi.fn(), loadSettings: vi.fn(), saveSettings: vi.fn(),
  timeStart: vi.fn(), timePause: vi.fn(), timeResume: vi.fn(), timeStop: vi.fn(), timeSummary: vi.fn(),
  createEntry: vi.fn(), updateEntry: vi.fn(), deleteEntry: vi.fn(),
}));
vi.mock('@/lib/timeTrackerApi', () => api);
const auth = vi.hoisted(() => ({ user: { id: 'me' }, loading: false }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
const org = vi.hoisted(() => ({ organizationId: null }));
vi.mock('@/contexts/OrganizationContext', () => ({ useActiveOrganization: () => org }));
vi.mock('recharts', async (orig) => {
  const m = await orig<typeof import('recharts')>();
  return { ...m, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div style={{ width: 600, height: 220 }}>{children}</div> };
});

import TimeTracker from './TimeTracker';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  for (const f of Object.values(api)) f.mockReset();
  api.loadRunning.mockImplementation(() => ok(null));
  api.loadProjects.mockImplementation(() => ok([{ id: 'p1', name: 'Acme website', organization_id: null }]));
  api.loadSettings.mockImplementation(() => ok(null));
  api.loadEntries.mockImplementation(() => ok([]));
  api.timeSummary.mockImplementation(() => ok(EMPTY_SUMMARY));
});
afterEach(() => { vi.useRealTimers(); });

describe('Time Tracker (Phase 31)', () => {
  it('after a refresh, a running timer shows the time since its stored start (from the clock, not a counter)', async () => {
    api.loadRunning.mockImplementation(() => ok(entry()));
    render(<TimeTracker />);
    expect(await screen.findByTestId('timer-clock')).toHaveTextContent('1:05:09');
    expect(screen.getByText(/Started 2 Nov 2026 at 10:54/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pause/ })).toBeInTheDocument();
  });

  it('a paused timer shows Resume and leaves out the time paused', async () => {
    api.loadRunning.mockImplementation(() => ok(entry({ start_time: ago(3600), paused_seconds: 300, paused_at: ago(600) })));
    render(<TimeTracker />);
    expect(await screen.findByTestId('timer-clock')).toHaveTextContent('0:45:00');
    expect(screen.getByText(/· Paused/)).toBeInTheDocument();
    api.timeResume.mockImplementation(() => ok(entry({ start_time: ago(3600), paused_seconds: 900 })));
    fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
    await waitFor(() => expect(screen.getByTestId('timer-announce')).toHaveTextContent('Timer resumed'));
    expect(screen.getByTestId('timer-clock')).toHaveTextContent('0:45:00');
  });

  it('keyboard: Start is a real, focusable submit button; Enter in the form starts the timer and it is announced', async () => {
    render(<TimeTracker />);
    const start = await screen.findByRole('button', { name: /Start/ });
    expect(start).toHaveAttribute('type', 'submit');
    start.focus();
    expect(document.activeElement).toBe(start);
    fireEvent.change(screen.getByLabelText('What are you working on?'), { target: { value: 'Invoices' } });
    fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'p1' } });
    api.timeStart.mockImplementation(() => ok(entry({ start_time: new Date(NOW).toISOString(), project_id: 'p1', description: 'Invoices' })));
    fireEvent.submit(screen.getByRole('form', { name: 'Start a timer' }));
    await waitFor(() => expect(screen.getByTestId('timer-announce')).toHaveTextContent('Timer started'));
    expect(api.timeStart).toHaveBeenCalledWith({ projectId: 'p1', description: 'Invoices', billable: true, ratePence: null, companyId: null });
    expect(screen.getByTestId('timer-clock')).toHaveTextContent('0:00:00');
    expect(screen.getByText('Acme website · Invoices')).toBeInTheDocument();
  });

  it('needs a project or a description; a bad rate is refused before anything is sent', async () => {
    render(<TimeTracker />);
    fireEvent.submit(await screen.findByRole('form', { name: 'Start a timer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a project or describe the task.');
    fireEvent.change(screen.getByLabelText('What are you working on?'), { target: { value: 'Work' } });
    fireEvent.change(screen.getByLabelText('Rate (£ an hour)'), { target: { value: '12.345' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Start a timer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter an hourly rate between £0 and £10,000');
    expect(api.timeStart).not.toHaveBeenCalled();
  });

  it('stopping under a minute asks first; "Save anyway" saves and announces it', async () => {
    api.loadRunning.mockImplementation(() => ok(entry({ start_time: ago(20) })));
    api.timeStop.mockImplementationOnce(() => ok({ success: false, needs_confirmation: true, worked_seconds: 20 }));
    render(<TimeTracker />);
    fireEvent.click(await screen.findByRole('button', { name: /Stop/ }));
    expect(await screen.findByTestId('short-stop')).toHaveTextContent('This entry is under a minute (20 seconds). Save it anyway?');
    expect(api.timeStop).toHaveBeenLastCalledWith(false, null);
    api.timeStop.mockImplementationOnce(() => ok({ success: true, entry: entry({ start_time: ago(20), end_time: new Date(NOW).toISOString() }) }));
    api.loadRunning.mockImplementation(() => ok(null)); // stopped on the server too
    fireEvent.click(screen.getByRole('button', { name: 'Save anyway' }));
    await waitFor(() => expect(screen.getByTestId('timer-announce')).toHaveTextContent('Timer stopped. 0h 00m saved.'));
    expect(api.timeStop).toHaveBeenLastCalledWith(true, null);
    expect(screen.queryByTestId('timer-running')).toBeNull();
  });

  it('a timer left over 24 hours asks when it stopped, and sends that time', async () => {
    api.loadRunning.mockImplementation(() => ok(entry({ start_time: ago(26 * 3600) })));
    api.timeStop.mockImplementationOnce(() => ok({ success: false, error: 'over_24_hours', start_time: ago(26 * 3600) }));
    render(<TimeTracker />);
    fireEvent.click(await screen.findByRole('button', { name: /Stop/ }));
    expect(await screen.findByTestId('over-24')).toHaveTextContent('more than 24 hours');
    api.timeStop.mockImplementationOnce(() => ok({ success: true, entry: entry({ start_time: ago(26 * 3600), end_time: ago(18 * 3600) }) }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop at this time' }));
    await waitFor(() => expect(api.timeStop).toHaveBeenLastCalledWith(true, ago(18 * 3600)));
  });

  it('empty range: clear empty states, zeros, no NaN', async () => {
    render(<TimeTracker />);
    expect(await screen.findByTestId('entries-empty')).toHaveTextContent('No entries in this range.');
    expect(screen.getByText('No time recorded in this range yet.')).toBeInTheDocument();
    expect(screen.getByText(OLD_TRACKER_NOTE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export CSV/ })).toBeDisabled();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|undefined/);
  });

  it('entries: duration as 1h 05m, value only with a rate, overlaps flagged', async () => {
    api.loadEntries.mockImplementation(() => ok([
      entry({ id: 'a', description: 'Design', start_time: ago(7200), end_time: ago(3300), hourly_rate_pence: 3000 }),
      entry({ id: 'b', description: 'Emails', start_time: ago(4000), end_time: ago(2800) }),
      entry({ id: 'c', description: 'Admin', start_time: ago(1000), end_time: ago(400), is_billable: false, hourly_rate_pence: 5000 }),
    ]));
    api.timeSummary.mockImplementation(() => ok({ ...EMPTY_SUMMARY, entries: 3, total_seconds: 5700, billable_seconds: 5100, billable_value_pence: 3250, unrated_billable_seconds: 1200,
      by_day: [{ day: '2026-11-02', seconds: 5700, billable_seconds: 5100, value_pence: 3250 }], by_project: [{ project_id: null, project_name: null, seconds: 5700, billable_seconds: 5100, value_pence: 3250, entries: 3 }] }));
    render(<TimeTracker />);
    const rows = await screen.findAllByTestId('entry-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('1h 05m')).toBeInTheDocument();
    expect(within(rows[0]).getByText('£32.50')).toBeInTheDocument();
    expect(within(rows[1]).getByText('No rate')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Overlaps another entry')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Overlaps another entry')).toBeInTheDocument();
    expect(within(rows[2]).queryByText('Overlaps another entry')).toBeNull();
    expect(within(rows[2]).queryByText(/£/)).toBeNull();
    expect(screen.getByText('20m billable with no rate, not valued'.replace('20m', '0h 20m'))).toBeInTheDocument();
    expect(screen.getByText('£32.50', { selector: 'p.text-2xl' })).toBeInTheDocument();
  });

  it('add entry: the future and more than 24 hours are refused before saving', async () => {
    render(<TimeTracker />);
    fireEvent.click(await screen.findByRole('button', { name: /Add entry/ }));
    const form = screen.getByTestId('entry-editor');
    fireEvent.change(within(form).getByLabelText('Description'), { target: { value: 'Late work' } });
    fireEvent.change(within(form).getByLabelText('Start (24-hour)'), { target: { value: '13:00' } });
    fireEvent.change(within(form).getByLabelText('End (24-hour)'), { target: { value: '14:00' } });
    fireEvent.submit(form);
    expect(await within(form).findByRole('alert')).toHaveTextContent("Entries can't be in the future.");
    fireEvent.change(within(form).getByLabelText('Start (24-hour)'), { target: { value: '09:00' } });
    fireEvent.click(within(form).getByLabelText('Duration'));
    fireEvent.change(within(form).getByRole('textbox', { name: 'Duration' }), { target: { value: '25h 00m' } });
    fireEvent.submit(form);
    expect(await within(form).findByRole('alert')).toHaveTextContent(/can't be|future/);
    expect(api.createEntry).not.toHaveBeenCalled();
    fireEvent.change(within(form).getByRole('textbox', { name: 'Duration' }), { target: { value: '1h 05m' } });
    api.createEntry.mockImplementation(() => ok(null));
    fireEvent.submit(form);
    await waitFor(() => expect(api.createEntry).toHaveBeenCalledTimes(1));
    const [, , fields] = api.createEntry.mock.calls[0];
    expect((new Date(fields.end_time).getTime() - new Date(fields.start_time).getTime()) / 1000).toBe(3900);
    expect(fields.description).toBe('Late work');
  });

  it('before the Phase 31 database update: says so and offers no controls', async () => {
    api.loadRunning.mockImplementation(() => Promise.resolve({ data: null, error: { code: '42703', message: 'column project_time_entries.paused_seconds does not exist' } }));
    render(<TimeTracker />);
    expect(await screen.findByTestId('time-not-available')).toHaveTextContent(NOT_AVAILABLE);
    expect(screen.queryByRole('button', { name: /Start/ })).toBeNull();
  });

  it('a refused write shows the server reason in plain words', async () => {
    api.timeStart.mockImplementation(() => Promise.resolve({ data: null, error: { message: 'TIMER_ALREADY_RUNNING' } }));
    render(<TimeTracker />);
    fireEvent.change(await screen.findByLabelText('What are you working on?'), { target: { value: 'x' } });
    await act(async () => { fireEvent.submit(screen.getByRole('form', { name: 'Start a timer' })); });
    expect(await screen.findByRole('alert')).toHaveTextContent('A timer is already running. Stop it before starting another.');
  });
});
