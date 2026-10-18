import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let selectResult: { data: unknown; error: unknown };
const upserts: unknown[] = [];
const user = { id: 'user-a' };
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve(selectResult) }),
      upsert: (row: unknown) => { upserts.push(row); return Promise.resolve({ data: null, error: null }); },
    }),
  },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user }) }));
const toast = vi.fn();
const toastApi = { toast };
vi.mock('@/hooks/use-toast', () => ({ useToast: () => toastApi }));

import { InAppNotificationPreferences } from './InAppNotificationPreferences';

beforeEach(() => { upserts.length = 0; });

describe('InAppNotificationPreferences', () => {
  it('is hidden while the preferences table does not exist (database change not applied)', async () => {
    selectResult = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.notification_type_prefs' in the schema cache" } };
    const { container } = render(<InAppNotificationPreferences />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows four switches, on by default, and saves a change for the signed-in user', async () => {
    selectResult = { data: [{ type: 'quote_update', in_app: false }], error: null };
    render(<InAppNotificationPreferences />);
    const overdue = await screen.findByRole('switch', { name: 'Overdue invoices' });
    expect(overdue).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Quote status changes' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Note reminders' })).toBeChecked();
    expect(screen.getByText(/never send an email/)).toBeInTheDocument();
    fireEvent.click(overdue);
    await waitFor(() => expect(upserts).toHaveLength(1));
    expect(upserts[0]).toMatchObject({ user_id: 'user-a', type: 'invoice_overdue', in_app: false });
  });

  it('other load errors show Try again instead of hiding', async () => {
    selectResult = { data: null, error: { code: '500', message: 'boom' } };
    render(<InAppNotificationPreferences />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
