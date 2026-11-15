import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { LedgerApi } from '@/lib/ledgerApi';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));
import { invalidateVatRegistration, useVatRegistration } from './useVatRegistration';

const setup = (autoStatus: LedgerApi['autoStatus']) => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper, api: { autoStatus } };
};

describe('useVatRegistration', () => {
  it('reads each company once through ledger_auto_status', async () => {
    const autoStatus = vi.fn(async (org: string) => ({ ok: true as const, data: { vat_registered: org === 'a', vat_registered_from: null } as never }));
    const { wrapper, api } = setup(autoStatus);
    const { result } = renderHook(() => useVatRegistration(['a', 'b', 'a', null], api), { wrapper });
    await waitFor(() => expect(result.current('b')).toEqual({ vat_registered: false, vat_registered_from: null }));
    expect(result.current('a')).toEqual({ vat_registered: true, vat_registered_from: null });
    expect(autoStatus).toHaveBeenCalledTimes(2);
  });
  it('an error (not a member, closed, MFA step-up) or a result without the key: unknown', async () => {
    const autoStatus = vi.fn(async (org: string) => (org === 'x' ? { ok: false as const, code: 'MFA_REQUIRED' } : { ok: true as const, data: { access: 'ok' } as never }));
    const { wrapper, api } = setup(autoStatus);
    const { result } = renderHook(() => useVatRegistration(['x', 'y'], api), { wrapper });
    await waitFor(() => expect(autoStatus).toHaveBeenCalledTimes(2));
    expect(result.current('x')).toBeUndefined();
    expect(result.current('y')).toBeUndefined();
  });
  it('while loading: unknown', () => {
    const { wrapper, api } = setup(() => new Promise(() => {}));
    const { result } = renderHook(() => useVatRegistration(['a'], api), { wrapper });
    expect(result.current('a')).toBeUndefined();
  });
  it('read again after the Ledger tab changes the setting (invalidateVatRegistration)', async () => {
    let yes = false;
    const autoStatus = vi.fn(async () => ({ ok: true as const, data: { vat_registered: yes, vat_registered_from: null } as never }));
    const { client, wrapper, api } = setup(autoStatus);
    const { result } = renderHook(() => useVatRegistration(['a'], api), { wrapper });
    await waitFor(() => expect(result.current('a')?.vat_registered).toBe(false));
    yes = true;
    act(() => invalidateVatRegistration(client, 'a'));
    await waitFor(() => expect(result.current('a')?.vat_registered).toBe(true));
  });
  it('without a query client: nothing is read, unknown', () => {
    const autoStatus = vi.fn();
    const { result } = renderHook(() => useVatRegistration(['a'], { autoStatus }));
    expect(result.current('a')).toBeUndefined();
    expect(autoStatus).not.toHaveBeenCalled();
  });
});
