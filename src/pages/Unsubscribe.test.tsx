import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isPaywallExempt, isSuspendedExempt } from '@/lib/access';

const rpc = vi.fn(async (..._a: unknown[]) => ({ data: null, error: null as unknown }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));

import Unsubscribe, { UNSUBSCRIBE_FAILED, UNSUBSCRIBED_TEXT, UNSUBSCRIBED_TITLE } from './Unsubscribe';

const VALID = 'd'.repeat(64);
const visit = (search: string) => render(<MemoryRouter initialEntries={[`/unsubscribe${search}`]}><Unsubscribe /></MemoryRouter>);

describe('/unsubscribe (public, one click)', () => {
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: null, error: null }); });

  it('a valid token: records the opt-out once and confirms', async () => {
    visit(`?token=${VALID}`);
    expect(await screen.findByRole('heading', { level: 1, name: UNSUBSCRIBED_TITLE })).toBeInTheDocument();
    expect(screen.getByText(UNSUBSCRIBED_TEXT)).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('email_unsubscribe', { _token: VALID });
  });

  it('an invalid token gets exactly the same answer (the database answers the same; nothing is revealed)', async () => {
    const { container: valid } = visit(`?token=${VALID}`);
    await screen.findByText(UNSUBSCRIBED_TEXT);
    const validText = valid.textContent;
    for (const search of [`?token=${'e'.repeat(64)}`, '?token=not-a-token', '']) {
      const { container, unmount } = render(<MemoryRouter initialEntries={[`/unsubscribe${search}`]}><Unsubscribe /></MemoryRouter>);
      await waitFor(() => expect(container.textContent).toBe(validText));
      unmount();
    }
  });

  it('a malformed or missing token is not even sent to the server', async () => {
    visit('?token=abc');
    await screen.findByText(UNSUBSCRIBED_TEXT);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('clicking the link again: the same confirmation (the server keeps one opt-out)', async () => {
    for (let i = 0; i < 2; i++) {
      const { unmount } = visit(`?token=${VALID}`);
      await screen.findByText(UNSUBSCRIBED_TEXT);
      unmount();
    }
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('if the server cannot be reached, it says so honestly instead of claiming success', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
    visit(`?token=${VALID}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(UNSUBSCRIBE_FAILED);
    expect(screen.queryByText(UNSUBSCRIBED_TEXT)).toBeNull();
  });

  it('works for everyone: not blocked by the paywall or the suspended screen', () => {
    expect(isPaywallExempt('/unsubscribe')).toBe(true);
    expect(isSuspendedExempt('/unsubscribe')).toBe(true);
  });
});
