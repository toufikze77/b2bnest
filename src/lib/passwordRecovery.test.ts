// Reading password reset links without keeping any token, and the messages for a refused password change.
import { describe, expect, it } from 'vitest';
import { clearRecoveryMark, hasRecoveryMark, markRecovery, passwordUpdateMessage, readRecoveryLink } from './passwordRecovery';

describe('readRecoveryLink', () => {
  it('a recovery session in the hash: noted, the token value itself is not kept', () => {
    const link = readRecoveryLink('https://www.b2bnest.online/reset-password#access_token=SECRET&refresh_token=R&type=recovery');
    expect(link).toEqual({ isRecovery: true, hasTokens: true, hasCode: false, error: null });
    expect(JSON.stringify(link)).not.toContain('SECRET');
  });
  it('a PKCE code, an error in the hash or the query, and no link', () => {
    expect(readRecoveryLink('https://x.test/reset-password?code=abc').hasCode).toBe(true);
    expect(readRecoveryLink('https://x.test/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid').error)
      .toEqual({ code: 'otp_expired', description: 'Email link is invalid' });
    expect(readRecoveryLink('https://x.test/reset-password?error=access_denied').error?.code).toBe('access_denied');
    expect(readRecoveryLink('https://x.test/reset-password')).toEqual({ isRecovery: false, hasTokens: false, hasCode: false, error: null });
  });
});

describe('recovery mark', () => {
  it('lasts an hour and is cleared after the change', () => {
    markRecovery(1_000);
    expect(hasRecoveryMark(1_000 + 59 * 60 * 1000)).toBe(true);
    expect(hasRecoveryMark(1_000 + 61 * 60 * 1000)).toBe(false);
    clearRecoveryMark();
    expect(hasRecoveryMark(1_000)).toBe(false);
  });
});

describe('passwordUpdateMessage', () => {
  it('plain words for two-step, an ended session and a reused password', () => {
    expect(passwordUpdateMessage({ code: 'insufficient_aal', message: 'AAL2 session is required' })).toEqual({ kind: 'two_step', text: 'You also need your two-step code; use the recovery steps in Help.' });
    expect(passwordUpdateMessage({ message: 'Auth session missing!' }).kind).toBe('expired');
    expect(passwordUpdateMessage({ code: 'same_password', message: 'x' }).text).toBe('Your new password must be different from your old one.');
    expect(passwordUpdateMessage({ code: 'weak_password', message: 'Password is known to be weak' }).text).toBe('Password is known to be weak');
  });
});
