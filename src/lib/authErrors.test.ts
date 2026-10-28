import { describe, expect, it } from 'vitest';
import { BANNED_MESSAGE, isBannedAuthError } from './authErrors';

describe('banned sign-in (Phase 12c)', () => {
  it('recognises the Supabase Auth code and the message fallback', () => {
    expect(isBannedAuthError({ code: 'user_banned', message: 'User is banned' })).toBe(true);
    expect(isBannedAuthError({ message: 'User is banned' })).toBe(true);
    expect(isBannedAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(false);
    expect(isBannedAuthError({ message: 'Email not confirmed' })).toBe(false);
    expect(isBannedAuthError(null)).toBe(false);
  });
  it('the message is plain and points to Contact', () => expect(BANNED_MESSAGE).toBe('This account has been suspended. Contact us.'));
});
