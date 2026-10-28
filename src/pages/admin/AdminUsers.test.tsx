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
  { id: 'u-3', name: 'Cal Coach', email: 'cal@example.test', role: 'user', is_active: true, subscribed: false, is_trial_active: false },
  { id: 'u-4', name: 'Dee Dormant', email: 'dee@example.test', role: 'user', is_active: false, subscribed: false, is_trial_active: false },
  { id: 'u-5', name: 'Eli Editor', email: 'eli@example.test', role: 'admin', is_active: true, subscribed: false, is_trial_active: false },
  { id: 'me', name: 'Me Myself', email: 'me@example.test', role: 'user', is_active: true, subscribed: false, is_trial_active: false },
];
// The Edge Function (Phase 12c)
let banReply: { data: unknown; error: unknown } = { data: { ok: true }, error: null };
const invoke = vi.fn(async (..._a: unknown[]) => banReply);
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me', email: 'me@example.test' }, loading: false }) }));
const fnError = (body: unknown, status = 409) => ({ data: null, error: { context: { status, json: async () => body } } });
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
    invoke.mockClear(); banReply = { data: { ok: true }, error: null };
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

describe('Admin users: Suspend / Reactivate (Phase 12c)', () => {
  const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;
  beforeEach(() => {
    superAdmin = true; masters = [master('u-3', 'cal@example.test', 'Cal Coach')]; calls.length = 0; toast.mockClear();
    invoke.mockClear(); banReply = { data: { ok: true }, error: null };
  });

  it('no Suspend button for your own row, super admins, admins or master accounts — with the reason instead', async () => {
    await showPage();
    await waitFor(() => expect(within(row('Cal Coach')).queryByRole('button', { name: 'Suspend' })).toBeNull());
    expect(within(row('Me Myself')).getByLabelText("You can't suspend your own account.")).toBeInTheDocument();
    expect(within(row('Ada Admin')).getByLabelText("Super admins can't be suspended.")).toBeInTheDocument();
    expect(within(row('Eli Editor')).getByLabelText("Admins can't be suspended. Remove the admin role first.")).toBeInTheDocument();
    expect(within(row('Cal Coach')).getByLabelText("Master accounts can't be suspended. Switch off unlimited access first.")).toBeInTheDocument();
    for (const n of ['Me Myself', 'Ada Admin', 'Eli Editor', 'Cal Coach']) expect(within(row(n)).queryByRole('button', { name: 'Suspend' })).toBeNull();
    expect(within(row('Ben Builder')).getByRole('button', { name: 'Suspend' })).toBeInTheDocument();
    expect(within(row('Dee Dormant')).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
  });

  it('the confirm keeps its wording, adds the sign-in line, and calls the Edge Function (never the RPC directly)', async () => {
    await showPage();
    fireEvent.click(within(row('Ben Builder')).getByRole('button', { name: 'Suspend' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Suspend this account?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('The user will lose access to B2BNest. Their data is preserved and the action can be reversed.');
    expect(dialog).toHaveTextContent('This action is recorded in the audit log.');
    expect(dialog).toHaveTextContent('They will be signed out and cannot sign in until you reactivate them.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('admin-set-user-ban', { body: { user_id: 'u-2', suspend: true } }));
    expect(calls.some((c) => c.fn === 'admin_set_user_status')).toBe(false);
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Account suspended' })));
  });

  it('Reactivate calls the Edge Function with suspend: false (no sign-in line)', async () => {
    await showPage();
    fireEvent.click(within(row('Dee Dormant')).getByRole('button', { name: 'Reactivate' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).not.toHaveTextContent('They will be signed out');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('admin-set-user-ban', { body: { user_id: 'u-4', suspend: false } }));
  });

  it.each([
    ['cannot_suspend_master', "You can't suspend a master account. Switch it off first."],
    ['cannot_suspend_super_admin', "You can't suspend a super admin."],
    ['own_account', "You can't suspend your own account."],
    ['ban_failed', 'Sign-in could not be blocked, so nothing was changed. Please try again.'],
  ])('a refusal (%s) is shown in plain language and the dialog stays open', async (code, text) => {
    banReply = fnError({ error: code });
    await showPage();
    fireEvent.click(within(row('Ben Builder')).getByRole('button', { name: 'Suspend' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(text);
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Account suspended' }));
  });

  it('when the function is not deployed yet, it says so and nothing changes', async () => {
    banReply = { data: null, error: { context: { status: 404, json: async () => { throw new Error('not json'); } } } };
    await showPage();
    fireEvent.click(within(row('Ben Builder')).getByRole('button', { name: 'Suspend' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("The suspend service isn't available yet. Nothing was changed.");
  });
});
