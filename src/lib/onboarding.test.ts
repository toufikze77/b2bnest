import { describe, it, expect } from 'vitest';
import { invitableRoles, safeNext, staffInviteLink, customerPortalLink, emailStatusLabel, staffInvitationState, seatsFull, canSubmitFeedback, seatSummaryText, EMAIL_OFF_NOTICE } from './onboarding';

describe('onboarding rules', () => {
  it('owners invite admin/manager/member, admins only manager/member, others nothing, never owner', () => {
    expect(invitableRoles('owner')).toEqual(['admin', 'manager', 'member']);
    expect(invitableRoles('admin')).toEqual(['manager', 'member']);
    expect(invitableRoles('manager')).toEqual([]);
    expect(invitableRoles('member')).toEqual([]);
    expect(invitableRoles('owner')).not.toContain('owner');
  });
  it('returns only to allowed in-app pages after sign-in', () => {
    expect(safeNext('/join?token=abc')).toBe('/join?token=abc');
    expect(safeNext('/support/portal?org=1')).toBe('/support/portal?org=1');
    expect(safeNext('https://evil.test')).toBe('/');
    expect(safeNext('//evil.test')).toBe('/');
    expect(safeNext('/\\evil.test')).toBe('/');
    expect(safeNext('/admin')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });
  it('builds join and portal links for the right company', () => {
    expect(staffInviteLink('https://b2bnest.online/', 'a b')).toBe('https://b2bnest.online/join?token=a%20b');
    expect(customerPortalLink('https://b2bnest.online', 'org-1')).toBe('https://b2bnest.online/support/portal?org=org-1');
  });
  it('never implies delivery while sending is off, and accepted is not delivered', () => {
    expect(emailStatusLabel('pending', false)).toBe('Invitation saved — email not sent');
    expect(emailStatusLabel(null, true)).toBe('Invitation saved — email not sent');
    expect(emailStatusLabel('accepted_by_provider', true)).toContain('not proof of delivery');
    expect(emailStatusLabel('uncertain', true)).toContain('not resent');
  });
  it('labels staff invitations', () => {
    const base = { id: '1', email: 'a@b.c', role: 'member', accepted_at: null, revoked_at: null };
    expect(staffInvitationState({ ...base, expires_at: '2026-10-20T00:00:00Z' }, Date.parse('2026-10-15T00:00:00Z'))).toBe('Pending');
    expect(staffInvitationState({ ...base, expires_at: '2026-10-10T00:00:00Z' }, Date.parse('2026-10-15T00:00:00Z'))).toBe('Expired');
    expect(staffInvitationState({ ...base, expires_at: '2026-10-20T00:00:00Z', revoked_at: 'x' })).toBe('Revoked');
    expect(staffInvitationState({ ...base, expires_at: '2026-10-20T00:00:00Z', accepted_at: 'x' })).toBe('Joined');
  });
  it('seat check counts members plus pending invitations; no limit configured means no cap', () => {
    expect(seatsFull(6, 1, 7)).toBe(true);
    expect(seatsFull(5, 1, 7)).toBe(false);
    expect(seatsFull(50, 9, null)).toBe(false);
  });
  it('feedback only on closed tickets, when switched on, once', () => {
    expect(canSubmitFeedback('closed', true, false)).toBe(true);
    expect(canSubmitFeedback('resolved', true, false)).toBe(false);
    expect(canSubmitFeedback('closed', false, false)).toBe(false);
    expect(canSubmitFeedback('closed', true, true)).toBe(false);
  });
});

describe('seat summary text (one allowance per paying owner)', () => {
  it('mentions pooling only when the plan covers several companies', () => {
    expect(seatSummaryText({ used: 7, pending: 1, seat_limit: 25, pooled_companies: 3, basis: 'subscription:professional' }))
      .toBe("Seats: 7 staff + 1 pending invitation across 3 companies on the same plan of 25. Support customers don't use seats.");
    expect(seatSummaryText({ used: 2, pending: 0, seat_limit: null, pooled_companies: 1 })).toContain('no limit set');
  });
  it('explains companies without an owner', () => {
    expect(seatSummaryText({ used: 1, pending: 0, seat_limit: null, pooled_companies: 1, basis: 'no_owner' })).toContain('no active owner');
  });
  it('email-off notice never implies sending', () => {
    expect(EMAIL_OFF_NOTICE).toMatch(/switched off/); expect(EMAIL_OFF_NOTICE).toMatch(/nothing is emailed/);
  });
});
