import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NOT_AVAILABLE, NOT_LINKED, type LeaveRequest } from '@/lib/rotaLeave';

const rota = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));
const auth = vi.hoisted(() => ({ user: { id: 'u-sam' } }));
vi.mock('@/hooks/useRota', () => ({ useRota: () => rota.value, PREVIEW_EMPLOYEE_LIMIT: 3 }));
const api = vi.hoisted(() => ({
  myEmployee: vi.fn(), listRequests: vi.fn(), pendingCount: vi.fn(), allowances: vi.fn(), setAllowance: vi.fn(), leaveYearStartMonth: vi.fn(),
  createRequest: vi.fn(), decideRequest: vi.fn(), cancelRequest: vi.fn(), balance: vi.fn(), calendar: vi.fn(), setLeaveYearStart: vi.fn(),
  linkEmployee: vi.fn(), linkCandidates: vi.fn(),
}));
vi.mock('@/lib/rotaLeaveApi', () => api);

import Holiday from './Holiday';

const ok = <T,>(data: T) => Promise.resolve({ data, error: null });
const EMPLOYEES = [
  { id: 'e-sam', organization_id: 'o1', user_id: 'u-sam', full_name: 'Sam Staff', is_active: true },
  { id: 'e-tia', organization_id: 'o1', user_id: 'u-tia', full_name: 'Tia Team', is_active: true },
  { id: 'e-una', organization_id: 'o1', user_id: null, full_name: 'Una Unlinked', is_active: true },
];
const req = (over: Partial<LeaveRequest> = {}): LeaveRequest => ({
  id: 'r1', company_id: 'o1', employee_id: 'e-sam', requester_user_id: 'u-sam', start_date: '2030-03-04', end_date: '2030-03-08', start_half: 'full', end_half: 'full',
  kind: 'annual', note: null, status: 'pending', change_requested: false, decided_by: null, decided_at: null, decision_note: null, cancelled_at: null, created_at: '2030-01-01T00:00:00Z', ...over,
});
const BAL = { leave_year: 2030, start_month: 1, year_start: '2030-01-01', year_end: '2030-12-31', used_days: 5, pending_days: 1 };
const show = () => render(<MemoryRouter initialEntries={['/rota/holiday']}><Holiday /></MemoryRouter>);
const staff = () => { rota.value = { user: auth.user, organizationId: 'o1', employees: EMPLOYEES, isAdmin: false, isLeaveManager: false, orgLoading: false, isRotaPremium: true }; };
const manager = () => { rota.value = { user: auth.user, organizationId: 'o1', employees: EMPLOYEES, isAdmin: true, isLeaveManager: true, orgLoading: false, isRotaPremium: true }; };

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset();
  staff();
  api.myEmployee.mockImplementation(() => ok({ id: 'e-sam', full_name: 'Sam Staff' }));
  api.listRequests.mockImplementation(() => ok([]));
  api.calendar.mockImplementation(() => ok([]));
  api.balance.mockImplementation(() => ok({ ...BAL, allowance_days: null, remaining_days: null }));
  api.pendingCount.mockImplementation(() => Promise.resolve({ data: null, error: null, count: 0 }));
  api.leaveYearStartMonth.mockImplementation(() => Promise.resolve(1));
  api.allowances.mockImplementation(() => ok([]));
  api.linkCandidates.mockImplementation(() => ok([]));
});

describe('Rota → Holiday (Phase 32)', () => {
  it('before the database update: says so, no controls', async () => {
    api.listRequests.mockImplementation(() => Promise.resolve({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.rota_leave_requests'" } }));
    show();
    expect(await screen.findByTestId('leave-not-available')).toHaveTextContent(NOT_AVAILABLE);
    expect(screen.queryByRole('button', { name: 'Send request' })).toBeNull();
  });

  it('staff: empty states, no balance without an allowance (never invented), no manager tools', async () => {
    show();
    expect(await screen.findByTestId('my-empty')).toHaveTextContent("You haven't asked for any holiday yet.");
    expect(screen.getByTestId('away-empty')).toHaveTextContent('No approved holiday in the next 90 days.');
    const bal = screen.getByTestId('leave-balance');
    expect(bal).toHaveTextContent('No allowance set, so no balance is shown.');
    expect(bal).not.toHaveTextContent(/Remaining/);
    expect(bal).toHaveTextContent('5.6 weeks');
    expect(screen.queryByTestId('leave-queue')).toBeNull();
    expect(screen.queryByText('Allowances')).toBeNull();
    expect(screen.queryByText('Export approved holiday')).toBeNull();
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });

  it('staff with an allowance: used, waiting and remaining', async () => {
    api.balance.mockImplementation(() => ok({ ...BAL, allowance_days: 25, remaining_days: 19 }));
    show();
    const bal = await screen.findByTestId('leave-balance');
    await waitFor(() => expect(bal).toHaveTextContent('Allowance: 25 days'));
    expect(bal).toHaveTextContent('Used: 5 days');
    expect(bal).toHaveTextContent('Waiting for approval: 1 day');
    expect(bal).toHaveTextContent('Remaining if those are approved: 19 days');
  });

  it('staff not linked to an employee row: told how to get linked, no request form', async () => {
    api.myEmployee.mockImplementation(() => ok(null));
    show();
    expect(await screen.findByTestId('leave-not-linked')).toHaveTextContent(NOT_LINKED);
    expect(screen.queryByRole('button', { name: 'Send request' })).toBeNull();
  });

  it('keyboard: the request is a form (Enter submits); working days shown; the request is sent and announced', async () => {
    api.calendar.mockImplementation(() => ok([{ request_id: 'x', employee_id: 'e-tia', full_name: 'Tia Team', start_date: '2030-03-05', end_date: '2030-03-05', start_half: 'full', end_half: 'full' }]));
    api.createRequest.mockImplementation(() => ok({}));
    show();
    fireEvent.change(await screen.findByLabelText('First day'), { target: { value: '2030-03-04' } });
    fireEvent.change(screen.getByLabelText('Last day (leave empty for one day)'), { target: { value: '2030-03-10' } });
    fireEvent.change(screen.getByLabelText('First day', { selector: 'select' }), { target: { value: 'pm' } });
    expect(screen.getByTestId('leave-preview')).toHaveTextContent('Working days: 4.5 days (7 days in the calendar). 1 other is off these days.');
    expect(screen.getByText(/Bank holidays are not subtracted yet/)).toBeInTheDocument();
    const send = screen.getByRole('button', { name: 'Send request' });
    expect(send).toHaveAttribute('type', 'submit');
    fireEvent.submit(screen.getByRole('form', { name: 'Ask for holiday' }));
    await waitFor(() => expect(api.createRequest).toHaveBeenCalledWith({ employeeId: 'e-sam', start: '2030-03-04', end: '2030-03-10', startHalf: 'pm', endHalf: 'full', kind: 'annual', note: '' }));
    expect(await screen.findByTestId('leave-announce')).toHaveTextContent('Request sent. A manager will decide it.');
  });

  it('a past start date is refused before sending (staff)', async () => {
    show();
    fireEvent.change(await screen.findByLabelText('First day'), { target: { value: '2001-01-01' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Ask for holiday' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Holiday can't start in the past");
    expect(api.createRequest).not.toHaveBeenCalled();
  });

  it('staff see their status with the reason, and can cancel a pending request', async () => {
    api.listRequests.mockImplementation(() => ok([req({ id: 'r1' }), req({ id: 'r2', start_date: '2030-04-01', end_date: '2030-04-01', status: 'declined', change_requested: true, decision_note: 'Move it a week', decided_at: 'x' })]));
    api.cancelRequest.mockImplementation(() => ok({}));
    show();
    const items = await screen.findAllByTestId('my-request');
    expect(items[0]).toHaveTextContent('4 Mar 2030 to 8 Mar 2030 · Annual holiday');
    expect(items[0]).toHaveTextContent('Waiting for a manager');
    expect(items[1]).toHaveTextContent('Change requested: Move it a week');
    expect(within(items[1]).queryByRole('button')).toBeNull();
    fireEvent.click(within(items[0]).getByRole('button', { name: 'Cancel request' }));
    await waitFor(() => expect(api.cancelRequest).toHaveBeenCalledWith('r1'));
  });

  it('managers: a queue with others off these days, decide with a reason, allowances, linking, export', async () => {
    manager();
    api.listRequests.mockImplementation(() => ok([req({ id: 'r1', employee_id: 'e-tia', note: 'Wedding' })]));
    api.calendar.mockImplementation(() => ok([
      { request_id: 'a', employee_id: 'e-sam', full_name: 'Sam Staff', start_date: '2030-03-06', end_date: '2030-03-06', start_half: 'full', end_half: 'full' },
      { request_id: 'b', employee_id: 'e-una', full_name: 'Una Unlinked', start_date: '2030-03-01', end_date: '2030-03-04', start_half: 'full', end_half: 'full' },
    ]));
    api.linkCandidates.mockImplementation(() => ok([{ user_id: 'u-una', role: 'member', name: 'Una', email: 'una@example.test', linked_employee_id: null, suggested_employee_id: 'e-una' }]));
    api.decideRequest.mockImplementation(() => ok({}));
    show();
    const item = await screen.findByTestId('queue-item');
    expect(item).toHaveTextContent('Tia Team: 4 Mar 2030 to 8 Mar 2030 · Annual holiday · 5 days working');
    expect(item).toHaveTextContent('Note: Wedding');
    expect(item).toHaveTextContent('2 others are off these days');
    fireEvent.change(within(item).getByLabelText('Reason (optional, shown to them)'), { target: { value: 'Busy week' } });
    fireEvent.click(within(item).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(api.decideRequest).toHaveBeenCalledWith('r1', 'decline', 'Busy week'));
    expect(screen.getByText('Allowances')).toBeInTheDocument();
    const link = await screen.findByTestId('link-row');
    expect(within(link).getByRole('combobox', { name: 'Employee for Una' })).toHaveValue('e-una');
    expect(within(link).getByRole('option', { name: 'Una Unlinked (suggested: same email)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export CSV/ })).toBeInTheDocument();
  });

  it('managers: an empty queue says so', async () => {
    manager();
    show();
    expect(await screen.findByTestId('queue-empty')).toHaveTextContent('No requests waiting.');
  });
});
