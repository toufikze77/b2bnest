import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

// Stored rows as production may still hold them: fake "connected" rows written with the old placeholder token for
// services that never had a connection flow, plus one real, connected Google Calendar row.
const ROWS = [
  { integration_name: 'zapier', is_connected: true, metadata: null },
  { integration_name: 'stripe', is_connected: true, metadata: null },
  { integration_name: 'slack', is_connected: true, metadata: null },
  { integration_name: 'notion', is_connected: true, metadata: null },
  { integration_name: 'google_calendar', is_connected: true, metadata: { email: 'sam@example.com' } },
];
const user = { id: 'u1' };
const rpc = vi.fn(async () => ({ data: ROWS, error: null }));
const chain: Record<string, unknown> = {};
['select', 'eq', 'order', 'limit'].forEach((m) => { chain[m] = () => chain; });
chain.maybeSingle = async () => ({ data: null, error: null });
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...(a as [])), from: () => chain, functions: { invoke: vi.fn() }, auth: { getUser: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user }) }));
vi.mock('@/components/integrations/FirecrawlComponent', () => ({ FirecrawlComponent: () => null }));

import IntegrationHub from './IntegrationHub';

describe('Integration Hub (the integrations page users see)', () => {
  it('shows "Connected" only for a service with a real connection flow and a stored connection', async () => {
    render(<MemoryRouter><IntegrationHub /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText('Connected')).toHaveLength(1));
    const badge = screen.getByText('Connected');
    expect(badge.closest('[class*="card"], div')?.parentElement?.textContent).toMatch(/Google Calendar/);
    // Services that only ever had the fake placeholder connection are not offered at all.
    for (const name of [/zapier/i, /stripe/i, /slack/i, /notion/i, /make \(integromat\)/i, /webhooks/i, /plaid/i, /clickup/i, /zoom/i, /teams/i, /google meet/i, /calendly/i]) {
      expect(screen.queryByText(name)).toBeNull();
    }
  });

  it('does not claim the stored credentials are encrypted', () => {
    render(<MemoryRouter><IntegrationHub /></MemoryRouter>);
    expect(document.body.textContent).not.toMatch(/encrypted/i);
    expect(screen.getByText(/takes you to the service's own sign-in page/)).toBeInTheDocument();
  });
});
