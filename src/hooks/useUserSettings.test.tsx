import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let reply: { data: unknown; error: unknown } = { data: null, error: null };
const updates: unknown[] = [];
const authUser = { id: 'u1' };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: authUser }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => reply }) }),
      update: (v: unknown) => ({ eq: async () => { updates.push(v); return { error: null }; } }),
    }),
  },
}));

import { UserSettingsProvider, useUserSettings } from './useUserSettings';
import { useAccountCurrency } from './useAccountCurrency';

let api: ReturnType<typeof useUserSettings>;
const Probe = () => {
  api = useUserSettings();
  const cur = useAccountCurrency();
  return <p data-testid="cur">{api.loading ? 'loading' : `[${cur}]`}</p>;
};
const mount = () => render(<UserSettingsProvider><Probe /></UserSettingsProvider>);
const profile = (currency_code: string | null) => ({ data: { currency_code, timezone: null, country_code: null, language_code: null, date_format: null, time_format: null, theme: null }, error: null });

beforeEach(() => { updates.length = 0; });

describe('useUserSettings currency', () => {
  it('uses the stored profile currency', async () => {
    reply = profile('gbp');
    mount();
    await waitFor(() => expect(screen.getByTestId('cur')).toHaveTextContent('[GBP]'));
  });

  it('an empty profile value stays empty — not USD', async () => {
    reply = profile(null);
    mount();
    await waitFor(() => expect(screen.getByTestId('cur')).toHaveTextContent('[]'));
  });

  it('a failed load does not invent USD', async () => {
    reply = { data: null, error: { message: 'offline' } };
    mount();
    await waitFor(() => expect(screen.getByTestId('cur')).toHaveTextContent('[]'));
    expect(api.settings).toBeNull();
  });

  it('a failed re-fetch keeps the stored currency', async () => {
    reply = profile('GBP');
    mount();
    await waitFor(() => expect(screen.getByTestId('cur')).toHaveTextContent('[GBP]'));
    reply = { data: null, error: { message: 'offline' } };
    await act(async () => { await api.refresh(); });
    expect(screen.getByTestId('cur')).toHaveTextContent('[GBP]');
  });

  it('updateSettings saves and updates every reader at once', async () => {
    reply = profile('USD');
    mount();
    await waitFor(() => expect(screen.getByTestId('cur')).toHaveTextContent('[USD]'));
    await act(async () => { await api.updateSettings({ currency_code: 'GBP' }); });
    expect(updates).toEqual([{ currency_code: 'GBP' }]);
    expect(screen.getByTestId('cur')).toHaveTextContent('[GBP]');
  });
});
