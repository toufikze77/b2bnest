import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useUserSettings', () => ({ useUserSettings: () => ({ settings: { currency_code: 'GBP' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({}) } }));

import ContactsView from './ContactsView';

const base = { email: null, phone: null, company: 'Acme', position: null, status: 'lead', value: null, last_contact: null, source: null, user_id: 'u1', notes: null, tags: null, created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z' };
const contacts = [{ ...base, id: 'c1', name: 'Priya Shah' }, { ...base, id: 'c2', name: 'Tom Okafor' }];
function Where() { const l = useLocation(); return <output data-testid="where">{l.search}</output>; }
const at = (search: string) => render(<MemoryRouter initialEntries={[`/crm${search}`]}><ContactsView contacts={contacts} statusColors={{}} /><Where /></MemoryRouter>);

beforeEach(() => { toast.mockClear(); });

describe('ContactsView deep link from Reports', () => {
  it('?contact=<id> opens that contact once and drops the param', async () => {
    at('?tool=crm&contact=c2');
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('Tom Okafor')).toBeInTheDocument();
    expect(screen.getByTestId('where').textContent).toBe('?tool=crm');
  });
  it('an unknown id says so and opens nothing', async () => {
    at('?contact=nope');
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "That contact couldn't be found" })));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
