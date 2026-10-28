import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked server: admin_list_users, list_master_access, set_master_access.
let superAdmin = true;
let masters: { user_id: string; email: string; display_name: string; granted_at: string; note: string | null }[] = [];
let setError: { code?: string; message: string } | null = null;
let listMissing = false;
const calls: { fn: string; args: Record<string, unknown> }[] = [];
const USERS = [
  { id: 'u-1', name: 'Ada Admin', email: 'ada@example.test', role: 'super_admin', is_active: true, subscribed: false, is_trial_active: false },
  { id: 'u-2', name: 'Ben Builder', email: 'ben@example.test', role: 'user', is_active: true, subscribed: false, is_trial_active: false },
];
vi.mock('@/lib/adminApi', () => ({
  adminRpc: async (fn: string, args: Record<string, unknown> = {}) => {
    calls.push({ fn, args });
    if (fn === 'admin_list_users') return { rows: USERS, total: USERS.length };
    if (fn === 'list_master_access') {
      if (listMissing) throw { code: 'PGRST202', message: 'Could not find the function public.list_master_access' };
      return masters;
    }
    if (fn === 'set_master_access') {
      if (setError) throw setError;
      return { user_id: args._user_id, enabled: args._enabled, changed: true };
    }
    return null;
  },
  logAdminAction: async () => undefined,
  downloadCsv: () => undefined,
}));
vi.mock('@/hooks/useSuperAdmin', () => ({ useSuperAdmin: () => ({ isSuperAdmin: superAdmin, loading: false }) }));
const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/components/admin/AdminPageHeader', () => ({ default: ({ title }: { title: string }) => <h1>{title}</h1> }));

import AdminUsers from './AdminUsers';
import { LAST_MASTER_MESSAGE, MASTER_ON_EXPLAINER, NOT_INSTALLED_MESSAGE, masterErrorMessage } from '@/lib/masterAccess';

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.scrollIntoView ??= () => {};

const showPage = async () => {
  render(<AdminUsers />);
  await screen.findByText('Ada Admin');
};
const master = (id: string, email: string, name: string) => ({ user_id: id, email, display_name: name, granted_at: '2026-10-28T09:00:00Z', note: null });

describe('Admin users: master-account switch', () => {
  beforeEach(() => {
    superAdmin = true; masters = []; setError = null; listMissing = false; calls.length = 0; toast.mockClear();
  });

  it('super admins see an "Unlimited access" switch per user and a badge on master accounts', async () => {
    masters = [master('u-1', 'ada@example.test', 'Ada Admin')];
    await showPage();
    expect(screen.getByRole('columnheader', { name: 'Unlimited access' })).toBeInTheDocument();
    const on = await screen.findByRole('switch', { name: 'Unlimited access (master account) for ada@example.test' });
    await waitFor(() => expect(on).toBeChecked());
    expect(screen.getByRole('switch', { name: 'Unlimited access (master account) for ben@example.test' })).not.toBeChecked();
    const adaRow = screen.getByText('Ada Admin').closest('tr')!;
    expect(within(adaRow as HTMLElement).getByText('Master account')).toBeInTheDocument();
    expect(within(screen.getByText('Ben Builder').closest('tr') as HTMLElement).queryByText('Master account')).toBeNull();
  });

  it('the switch is hidden from anyone who is not a super admin (and the list is never asked for)', async () => {
    superAdmin = false;
    await showPage();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Unlimited access' })).toBeNull();
    expect(calls.some((c) => c.fn === 'list_master_access')).toBe(false);
  });

  it('switching on asks first, explains it plainly, sends the note, and nothing happens on Cancel', async () => {
    masters = [master('u-1', 'ada@example.test', 'Ada Admin')];
    await showPage();
    fireEvent.click(screen.getByRole('switch', { name: /for ben@example\.test/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Switch on unlimited access?')).toBeInTheDocument();
    expect(within(dialog).getByText(MASTER_ON_EXPLAINER)).toBeInTheDocument();
    expect(MASTER_ON_EXPLAINER).toMatch(/^This person will never see the paywall until you switch it off\./);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(calls.some((c) => c.fn === 'set_master_access')).toBe(false);

    fireEvent.click(screen.getByRole('switch', { name: /for ben@example\.test/ }));
    const again = await screen.findByRole('alertdialog');
    fireEvent.change(within(again).getByLabelText('Note (optional)'), { target: { value: '  Partner account  ' } });
    fireEvent.click(within(again).getByRole('button', { name: 'Switch on' }));
    await waitFor(() => expect(calls.find((c) => c.fn === 'set_master_access')?.args).toEqual({ _user_id: 'u-2', _enabled: true, _note: 'Partner account' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Unlimited access switched on' })));
  });

  it('removing the last master account shows a plain error and keeps the dialog open', async () => {
    masters = [master('u-1', 'ada@example.test', 'Ada Admin')];
    setError = { code: 'P0001', message: "last_master_account: you can't remove the last master account" };
    await showPage();
    const sw = await screen.findByRole('switch', { name: /for ada@example\.test/ });
    await waitFor(() => expect(sw).toBeChecked());
    fireEvent.click(sw);
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Switch off unlimited access?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Switch off' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(LAST_MASTER_MESSAGE);
    expect(LAST_MASTER_MESSAGE).toBe("You can't remove the last master account. Switch someone else on first.");
  });

  it('before the database change is applied: a plain notice, and the switches are disabled', async () => {
    listMissing = true;
    await showPage();
    expect(await screen.findByText(NOT_INSTALLED_MESSAGE)).toBeInTheDocument();
    for (const s of screen.getAllByRole('switch')) expect(s).toBeDisabled();
  });

  it('the "Master accounts" filter lists only master accounts, with their note', async () => {
    masters = [master('u-9', 'mia@example.test', 'Mia Master'), { ...master('u-1', 'ada@example.test', 'Ada Admin'), note: 'Owner' }];
    await showPage();
    fireEvent.pointerDown(screen.getByRole('combobox', { name: 'Filter by status' }), { button: 0, pointerType: 'mouse' });
    fireEvent.click(await screen.findByRole('option', { name: 'Master accounts' }));
    expect(await screen.findByText('Mia Master')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Ben Builder')).toBeNull());
    expect(screen.getByText('Note: Owner')).toBeInTheDocument();
    expect(screen.getByText('2 master accounts')).toBeInTheDocument();
    expect(screen.getAllByText('Master account')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Suspend/ })).toBeNull();
  });

  it('non-super-admins do not get the "Master accounts" filter', async () => {
    superAdmin = false;
    await showPage();
    fireEvent.pointerDown(screen.getByRole('combobox', { name: 'Filter by status' }), { button: 0, pointerType: 'mouse' });
    expect(await screen.findByRole('option', { name: 'Trial' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Master accounts' })).toBeNull();
  });

  it('server errors become plain language', () => {
    expect(masterErrorMessage({ code: '42501', message: 'only a super admin can change master accounts' })).toBe('Only a super admin can change master accounts.');
    expect(masterErrorMessage({ code: 'P0002', message: 'no such user' })).toBe('This account no longer exists.');
    expect(masterErrorMessage({ code: '22001', message: 'the note can be at most 300 characters' })).toBe('The note can be at most 300 characters.');
    expect(masterErrorMessage(new Error('network'))).toBe("Unlimited access wasn't changed. Please try again.");
  });
});
