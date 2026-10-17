import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
const authUser = { id: 'u1' };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: authUser }) }));

/** Chainable Supabase stand-in: every call is recorded, and awaiting the chain gives `respond(table, calls)`. */
const db = vi.hoisted(() => ({
  calls: [] as unknown[][],
  respond: (_table: string, _calls: unknown[][]): { data?: unknown; error: unknown } => ({ data: [], error: null }),
}));
vi.mock('@/integrations/supabase/client', () => {
  const from = (table: string) => {
    const calls: unknown[][] = [];
    const chain: Record<string, unknown> = new Proxy({}, {
      get(_t, k: string) {
        if (k === 'then') return (res: (v: unknown) => void) => res(db.respond(table, calls));
        return (...a: unknown[]) => { calls.push([k, ...a]); db.calls.push([table, k, ...a]); return chain; };
      },
    });
    return chain;
  };
  return { supabase: { from } };
});

import EmployeeList from './EmployeeList';
import PayrollUK from './PayrollUK';

const employees = [
  { id: 'pe1', firstName: 'Priya', lastName: 'Shah', niNumber: 'QQ123456C', taxCode: '1257L', niCategory: 'A', annualSalary: 32000, payFrequency: 'MTH' as const },
  { id: 'pe2', firstName: 'Tom', lastName: 'Okafor', taxCode: 'BR', niCategory: 'A', annualSalary: 18000, payFrequency: 'WK' as const },
];

beforeEach(() => {
  db.calls.length = 0;
  db.respond = () => ({ data: [], error: null });
  Object.values(toast).forEach((f) => f.mockClear());
  localStorage.clear();
});

describe('EmployeeList', () => {
  it('shows labelled Add, Edit and Delete controls for every employee', () => {
    render(<EmployeeList employees={employees} onEmployeesUpdated={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Add employee/ })).toBeInTheDocument();
    for (const n of ['Priya Shah', 'Tom Okafor']) {
      expect(screen.getAllByRole('button', { name: `Edit ${n}` }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: `Delete ${n}` }).length).toBeGreaterThan(0);
    }
  });

  it('Edit opens the form prefilled with that employee', async () => {
    render(<EmployeeList employees={employees} onEmployeesUpdated={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit Tom Okafor' })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByDisplayValue('Okafor')).toBeInTheDocument();
  });

  it('Delete asks first and deletes only that employee for this user', async () => {
    const updated = vi.fn();
    render(<EmployeeList employees={employees} onEmployeesUpdated={updated} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete Priya Shah' })[0]);
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete employee “Priya Shah”?');
    expect(db.calls).toEqual([]);
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete employee' }));
    await waitFor(() => expect(updated).toHaveBeenCalled());
    expect(db.calls).toEqual([['payroll_employees', 'delete'], ['payroll_employees', 'eq', 'id', 'pe1'], ['payroll_employees', 'eq', 'user_id', 'u1']]);
  });

  it('a failed delete shows the error and does not refresh the list', async () => {
    db.respond = () => ({ error: { message: 'Simulated network error' } });
    const updated = vi.fn();
    render(<EmployeeList employees={employees} onEmployeesUpdated={updated} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete Tom Okafor' })[0]);
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete employee' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('Nothing was changed');
    expect(updated).not.toHaveBeenCalled();
  });

  it('with no employees, says so and offers Add employee', () => {
    render(<EmployeeList employees={[]} onEmployeesUpdated={vi.fn()} />);
    expect(screen.getByText('No employees yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Add employee/ })).toHaveLength(2);
  });
});

describe('PayrollUK', () => {
  it('a failed load shows an error with Retry, not "No employees yet"; Retry loads again', async () => {
    let fail = true;
    db.respond = (table) => (table === 'payroll_employees' && fail ? { data: null, error: { message: 'Simulated network error' } } : { data: [], error: null });
    render(<PayrollUK />);
    expect(await screen.findByText("Payroll data couldn't be loaded")).toBeInTheDocument();
    expect(screen.queryByText('No employees yet')).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No employees yet')).toBeInTheDocument();
  });

  it('shows the demo notice at the top and no second page heading', async () => {
    render(<PayrollUK />);
    expect(screen.getByRole('note')).toHaveTextContent('This is a demo payroll system');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Payroll (UK)' })).toBeInTheDocument();
    await screen.findByText('No employees yet');
  });

  it('the four sub-tabs are reachable with the keyboard (arrow keys move and select)', async () => {
    render(<PayrollUK />);
    await screen.findByText('No employees yet');
    const list = screen.getByRole('tablist', { name: 'Payroll sections' });
    const tabs = within(list).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Employees', 'Pay runs', 'History', 'Settings']);
    tabs[0].focus();
    for (const [i, name] of [[1, 'Pay runs'], [2, 'History'], [3, 'Settings']] as const) {
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
      await waitFor(() => expect(document.activeElement).toBe(tabs[i]));
      expect(tabs[i]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[i]).toHaveTextContent(name);
    }
    expect(screen.getByLabelText('PAYE Reference')).toBeInTheDocument();
  });
});
