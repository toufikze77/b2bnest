import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({ invoke: vi.fn(), listFactors: vi.fn(), verify: vi.fn(), signIn: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => st.invoke(...a) },
    auth: { mfa: { listFactors: () => st.listFactors(), challengeAndVerify: (a: unknown) => st.verify(a) }, signInWithPassword: (a: unknown) => st.signIn(a) },
  },
}));
import { checkAccountDeletion, closeCompany, confirmIdentity, deleteAccount, downloadData, NOT_AVAILABLE } from './dataRights';

const httpError = (status: number, body: unknown) => ({ context: { status, json: async () => body } });

beforeEach(() => { for (const f of Object.values(st)) f.mockReset(); });

describe('dataRights (HMRC P7b)', () => {
  it('before the functions are deployed: 404, a network failure or a throw all become "not available yet"', async () => {
    st.invoke.mockResolvedValueOnce({ data: null, error: httpError(404, null) });
    expect(await checkAccountDeletion()).toMatchObject({ ok: false, code: 'not_available', message: NOT_AVAILABLE });
    st.invoke.mockResolvedValueOnce({ data: null, error: { message: 'Failed to send a request to the Edge Function' } });
    expect(await checkAccountDeletion()).toMatchObject({ code: 'not_available' });
    st.invoke.mockRejectedValueOnce(new Error('boom'));
    expect(await downloadData('account')).toMatchObject({ code: 'not_available' });
    st.invoke.mockResolvedValueOnce({ data: null, error: httpError(503, { ok: false, code: 'not_available', message: 'x' }) });
    expect(await downloadData('company', 'org-x')).toMatchObject({ code: 'not_available' });
  });

  it('the server\'s own plain message is shown (refusals with their list, limits, re-confirmation)', async () => {
    st.invoke.mockResolvedValueOnce({ data: null, error: httpError(409, { ok: false, code: 'refused', message: 'A. B.', messages: ['A.', 'B.'] }) });
    expect(await checkAccountDeletion()).toEqual({ ok: false, code: 'refused', message: 'A. B.', messages: ['A.', 'B.'] });
    st.invoke.mockResolvedValueOnce({ data: null, error: httpError(401, { ok: false, code: 'reauth_required', message: 'Confirm it is you.', confirm_with: 'sign_in' }) });
    expect(await deleteAccount('a@example.test')).toEqual({ ok: false, code: 'reauth_required', message: 'Confirm it is you.', confirm_with: 'sign_in' });
    expect(st.invoke).toHaveBeenLastCalledWith('account-delete', { body: { action: 'delete', email: 'a@example.test', downloaded: true } });
    st.invoke.mockResolvedValueOnce({ data: { ok: true, closed: true, message: 'Closed.' }, error: null });
    expect(await closeCompany('org-x', 'Company X')).toMatchObject({ ok: true, message: 'Closed.' });
    expect(st.invoke).toHaveBeenLastCalledWith('company-close', { body: { action: 'close', company_id: 'org-x', name: 'Company X', downloaded: true } });
  });

  it('a download saves the ZIP the server returned', async () => {
    const created = vi.fn(() => 'blob:x'); const revoked = vi.fn();
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    st.invoke.mockResolvedValueOnce({ data: new Blob(['PK']), error: null });
    const r = await downloadData('company', 'org-x');
    expect(r).toMatchObject({ ok: true });
    expect((r as { filename: string }).filename).toMatch(/^b2bnest-company-data-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(st.invoke).toHaveBeenCalledWith('data-export', { body: { scope: 'company', company_id: 'org-x' } });
    expect(click).toHaveBeenCalled();
    expect(revoked).toHaveBeenCalledWith('blob:x');
    click.mockRestore();
  });

  it('confirming who you are: a fresh authenticator code, or signing in again; the password never goes to our functions', async () => {
    st.listFactors.mockResolvedValue({ data: { all: [{ id: 'f1', factor_type: 'totp', status: 'verified' }] } });
    st.verify.mockResolvedValueOnce({ error: null });
    expect(await confirmIdentity('authenticator', { code: '123456' })).toBeNull();
    expect(st.verify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' });
    st.verify.mockResolvedValueOnce({ error: { code: 'mfa_verification_failed', message: 'Invalid' } });
    expect(await confirmIdentity('authenticator', { code: '000000' })).toMatch(/That code didn't work/);
    st.signIn.mockResolvedValueOnce({ error: null });
    expect(await confirmIdentity('sign_in', { email: 'a@example.test', password: 'pw' })).toBeNull();
    expect(st.signIn).toHaveBeenCalledWith({ email: 'a@example.test', password: 'pw' });
    st.signIn.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } });
    expect(await confirmIdentity('sign_in', { email: 'a@example.test', password: 'bad' })).toMatch(/That password didn't work/);
    expect(await confirmIdentity('sign_in', { email: 'a@example.test' })).toBe('Enter your password.');
    expect(st.invoke).not.toHaveBeenCalled();
  });
});
