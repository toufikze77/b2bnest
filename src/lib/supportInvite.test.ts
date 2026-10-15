import { describe, it, expect } from 'vitest';
import { repeatInviteMessage } from './supportTicket';
const base = { email: 'a@x.com', user_id: null, revoked_at: null, expires_at: null };
describe('repeat invitations', () => {
  it('new email is allowed', () => expect(repeatInviteMessage([base], 'b@x.com')).toBeNull());
  it('matches case-insensitively', () => expect(repeatInviteMessage([base], ' A@X.com ')).toMatch(/already invited/));
  it('revoked access is never silently restored', () => expect(repeatInviteMessage([{ ...base, revoked_at: 'x' }], 'a@x.com')).toMatch(/access was removed/));
  it('expired points to extend', () => expect(repeatInviteMessage([{ ...base, expires_at: '2000-01-01' }], 'a@x.com')).toMatch(/Extend/));
  it('signed up says has access', () => expect(repeatInviteMessage([{ ...base, user_id: 'u' }], 'a@x.com')).toMatch(/already has portal access/));
});
