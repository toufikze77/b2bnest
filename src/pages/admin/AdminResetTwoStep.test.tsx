// Phase 25: Admin → Users → Reset two-step sign-in (super admins only; a typed reason is required; own account hidden).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let superAdmin = true;
const USERS = [
  { id: 'u-2', name: 'Ben Builder', email: 'ben@example.test', role: 'user', is_active: true, subscribed: false },
  { id: 'me', name: 'Me Myself', email: 'me@example.test', role: 'super_admin', is_active: true, subscribed: false },
];
let reply: { data: unknown; error: unknown } = { data: { ok: true, removed: 2 }, error: null };
const invoke = vi.fn(async (..._a: unknown[]) => reply);
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me', email: 'me@example.test' }, loading: false }) }));
vi.mock('@/lib/adminApi', () => ({
  adminRpc: async (fn: string) => (fn === 'admin_list_users' ? { rows: USERS, total: USERS.length } : []),
  logAdminAction: async () => undefined,
  downloadCsv: () => undefined,
}));
vi.mock('@/hooks/useSuperAdmin', () => ({ useSuperAdmin: () => ({ isSuperAdmin: superAdmin, loading: false }) }));
const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/components/admin/AdminPageHeader', () => ({ default: ({ title }: { title: string }) => <h1>{title}</h1> }));

import AdminUsers from './AdminUsers';

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.scrollIntoView ??= () => {};

const openUser = async (name: string) => {
  render(<AdminUsers />);
  fireEvent.click(await screen.findByText(name));
};

describe('Admin users: reset two-step sign-in', () => {
  beforeEach(() => { superAdmin = true; reply = { data: { ok: true, removed: 2 }, error: null }; invoke.mockClear(); toast.mockClear(); });

  it('needs a typed reason, then calls admin-reset-mfa with the user and the reason', async () => {
    await openUser('Ben Builder');
    fireEvent.click(await screen.findByRole('button', { name: 'Reset two-step sign-in' }));
    const dialog = await screen.findByTestId('reset-two-step-dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Reset two-step sign-in' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Reason (required)'), { target: { value: 'abc' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Reason (required)'), { target: { value: '  Called back on known number  ' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('admin-reset-mfa', { body: { user_id: 'u-2', reason: 'Called back on known number' } }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Two-step sign-in reset' })));
  });

  it('a refusal from the server is shown in plain words and the dialog stays open', async () => {
    reply = { data: null, error: { context: { status: 403, json: async () => ({ error: 'mfa_required' }) } } };
    await openUser('Ben Builder');
    fireEvent.click(await screen.findByRole('button', { name: 'Reset two-step sign-in' }));
    const dialog = await screen.findByTestId('reset-two-step-dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason (required)'), { target: { value: 'Checked by phone' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset two-step sign-in' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Enter your own two-step code first');
  });

  it('not offered for your own account', async () => {
    await openUser('Me Myself');
    await screen.findByText('Platform role');
    expect(screen.queryByRole('button', { name: 'Reset two-step sign-in' })).toBeNull();
  });

  it('not offered to anyone who is not a super admin', async () => {
    superAdmin = false;
    await openUser('Ben Builder');
    await screen.findByText('Platform role');
    expect(screen.queryByRole('button', { name: 'Reset two-step sign-in' })).toBeNull();
  });
});
