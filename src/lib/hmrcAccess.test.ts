// HMRC hide switch: what the browser decides from the person's own role and the setting. The server decides for real.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({ roles: [] as unknown[], rolesError: null as unknown, setting: undefined as unknown, settingError: null as unknown, throws: false, calls: [] as string[], rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => {
  const from = (t: string) => {
    const chain: Record<string, unknown> = {};
    const res = () => {
      if (st.throws) throw new Error('down');
      return t === 'user_roles' ? { data: st.rolesError ? null : st.roles, error: st.rolesError } : { data: st.setting === undefined ? null : { value: st.setting }, error: st.settingError };
    };
    for (const m of ['select', 'eq', 'in']) chain[m] = (...a: unknown[]) => { st.calls.push(`${t}.${m}:${JSON.stringify(a)}`); return chain; };
    chain.maybeSingle = async () => res();
    chain.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => { try { return Promise.resolve(res()).then(ok, bad); } catch (e) { return Promise.reject(e).then(ok, bad); } };
    return chain;
  };
  return { supabase: { from, rpc: (...a: unknown[]) => st.rpc(...a) } };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, loading: false }) }));

import { fetchHmrcAccessStatus, fetchHmrcCustomerAccess, HMRC_COMING_SOON, setHmrcCustomerAccess } from './hmrcAccess';

beforeEach(() => { st.roles = []; st.rolesError = null; st.setting = undefined; st.settingError = null; st.throws = false; st.calls = []; st.rpc.mockReset(); });

describe('who may use the HMRC features', () => {
  it('a platform super_admin or admin always may (the owner keeps testing)', async () => {
    st.roles = [{ role: 'admin' }]; st.setting = 'hidden';
    expect(await fetchHmrcCustomerAccess('u1')).toEqual({ state: 'hidden', tester: true, canUse: true });
    expect(st.calls.some((c) => c.startsWith('user_roles.in') && c.includes('super_admin') && c.includes('"admin"'))).toBe(true);
    expect(st.calls.some((c) => c.startsWith('user_roles.eq') && c.includes('u1'))).toBe(true);
  });
  it('a customer only when the setting is exactly "visible"', async () => {
    st.setting = 'visible';
    expect(await fetchHmrcCustomerAccess('u1')).toEqual({ state: 'visible', tester: false, canUse: true });
    for (const s of ['hidden', 'Visible', true, { state: 'visible' }, null]) {
      st.setting = s;
      expect((await fetchHmrcCustomerAccess('u1')).canUse, JSON.stringify(s)).toBe(false);
    }
  });
  it('missing, unreadable or failing: hidden (fail closed); signed out: hidden', async () => {
    expect(await fetchHmrcCustomerAccess('u1')).toEqual({ state: 'hidden', tester: false, canUse: false });
    st.setting = 'visible'; st.settingError = { code: '42501' };
    expect((await fetchHmrcCustomerAccess('u1')).canUse).toBe(false);
    st.throws = true;
    expect((await fetchHmrcCustomerAccess('u1')).canUse).toBe(false);
    expect(await fetchHmrcCustomerAccess(null)).toEqual({ state: 'hidden', tester: false, canUse: false });
  });
  it('the line has no dates, promises or approval claims', () => {
    expect(HMRC_COMING_SOON).toBe('Sending VAT returns to HMRC straight from B2BNEST is coming soon. You can still prepare your figures and download them.');
    expect(HMRC_COMING_SOON.replace('B2BNEST', '')).not.toMatch(/\d|approved|recogni|MTD|compatible|will be/i); // no date or number
  });
});

describe('the owner\'s control', () => {
  it('reads the state, who and when; not set up and errors are plain', async () => {
    st.rpc.mockResolvedValue({ data: [{ state: 'visible', updated_at: '2026-11-09T10:00:00Z', updated_by_email: 'owner@example.test' }], error: null });
    expect(await fetchHmrcAccessStatus()).toEqual({ state: 'visible', updated_at: '2026-11-09T10:00:00Z', updated_by_email: 'owner@example.test' });
    st.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    expect(await fetchHmrcAccessStatus()).toBe('not_set_up');
    st.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Not authorized' } });
    expect(await fetchHmrcAccessStatus()).toBe('error');
  });
  it('flips through hmrc_set_customer_access only', async () => {
    st.rpc.mockResolvedValue({ data: 'hidden', error: null });
    expect(await setHmrcCustomerAccess('hidden')).toEqual({ ok: true });
    expect(st.rpc).toHaveBeenCalledWith('hmrc_set_customer_access', { p_state: 'hidden' });
    st.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'MFA_REQUIRED' } });
    expect(await setHmrcCustomerAccess('visible')).toEqual({ ok: false, message: 'Sign in with your authenticator code first.' });
    st.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Not authorized' } });
    expect(await setHmrcCustomerAccess('visible')).toEqual({ ok: false, message: 'Only a super admin can change this.' });
  });
});
