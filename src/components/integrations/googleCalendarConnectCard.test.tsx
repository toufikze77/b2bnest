// Google Calendar card: back from Google on the Integrations tab, a "connected" message once, and the flag removed.
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: st.toastSuccess, error: st.toastError } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async () => ({ data: [{ integration_name: 'google_calendar', is_connected: true, metadata: { email: 'p@example.test' } }], error: null }),
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    from: () => ({ delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) }),
  },
}));

import GoogleCalendarConnectCard from './GoogleCalendarConnectCard';
import { CONNECTED_TEXT } from '@/lib/calendarSync';

function Loc() { const l = useLocation(); return <div data-testid="loc">{l.search}</div>; }

describe('GoogleCalendarConnectCard after Google', () => {
  it('?tool=integrations&google_connected=true: one success message, then only ?tool=integrations stays', async () => {
    render(<MemoryRouter initialEntries={['/business-tools?tool=integrations&google_connected=true']}><GoogleCalendarConnectCard userId="u1" /><Loc /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('?tool=integrations'));
    expect(st.toastSuccess).toHaveBeenCalledTimes(1);
    expect(st.toastSuccess).toHaveBeenCalledWith(CONNECTED_TEXT);
    expect(await screen.findByText('Connected')).toBeInTheDocument();
  });
  it('without the flag: no message, the address is left alone', async () => {
    st.toastSuccess.mockClear();
    render(<MemoryRouter initialEntries={['/business-tools?tool=integrations']}><GoogleCalendarConnectCard userId="u1" /><Loc /></MemoryRouter>);
    await screen.findByText('Connected');
    expect(st.toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByTestId('loc').textContent).toBe('?tool=integrations');
  });
});
