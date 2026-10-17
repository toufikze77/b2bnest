import { describe, it, expect } from 'vitest';
import { invitableRoles, safeNext, staffInviteLink, customerPortalLink, emailStatusLabel, staffInvitationState, seatsFull, canSubmitFeedback, seatSummaryText, EMAIL_OFF_NOTICE, confirmationRedirect, supabaseRedirectAllowed, authUrlWithNext } from './onboarding';

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
    expect(seatSummaryText({ used: 7, pending: 1, seat_limit: 25, pooled_companies: 3, basis: 'subscription:professional', enforced: true }))
      .toBe("Seats: 7 staff + 1 pending invitation across 3 companies on the same plan of 25. Support customers don't use seats.");
    expect(seatSummaryText({ used: 2, pending: 0, seat_limit: null, pooled_companies: 1 })).toContain("aren't switched on");
  });
  it('never shows a limit as active while caps are off', () => {
    expect(seatSummaryText({ used: 3, pending: 0, seat_limit: 25, pooled_companies: 1, enforced: false })).not.toContain('of 25');
  });
  it('explains companies without a billing owner', () => {
    expect(seatSummaryText({ used: 1, pending: 0, seat_limit: null, pooled_companies: 1, basis: 'no_billing_owner' })).toContain('no billing owner');
  });
  it('email-off notice never implies sending', () => {
    expect(EMAIL_OFF_NOTICE).toMatch(/switched off/); expect(EMAIL_OFF_NOTICE).toMatch(/nothing is emailed/);
  });
});

// Proposed production allow-list (docs/onboarding-2026-10-15/AUTH-CALLBACKS.md) — exact entries, no broad /**.
const PROD = ['https://www.b2bnest.online/join?token=*', 'https://www.b2bnest.online/support/portal?org=*',
  'https://www.b2bnest.online/support/portal', 'https://www.b2bnest.online/support-desk', 'https://www.b2bnest.online/settings*',
  'https://www.b2bnest.online/', 'https://www.b2bnest.online/reset-password'];
const TOKEN = 'a'.repeat(32) + '0123456789abcdef0123456789abcdef', ORG = '136792c5-1268-482f-ae83-b2da315403fd', TICKET = 'f0000000-0000-0000-0000-000000000001';

describe('Supabase redirect matching (documented semantics)', () => {
  it('matches the documented examples', () => {
    expect(supabaseRedirectAllowed('http://localhost:3000/foo', ['http://localhost:3000/*'])).toBe(true);
    expect(supabaseRedirectAllowed('http://localhost:3000/foo/bar', ['http://localhost:3000/*'])).toBe(false);
    expect(supabaseRedirectAllowed('http://localhost:3000/foo/bar', ['http://localhost:3000/**'])).toBe(true);
    expect(supabaseRedirectAllowed('http://localhost:3000/a', ['http://localhost:3000/?'])).toBe(true);
    expect(supabaseRedirectAllowed('http://localhost:3000/foo', ['http://localhost:3000/?'])).toBe(false);
  });
});

describe('sign-up confirmation keeps the invitation / portal destination', () => {
  const flows: [string, string][] = [
    ['staff invitation', `/join?token=${TOKEN}`],
    ['customer invitation', `/support/portal?org=${ORG}`],
    ['ticket email link', `/support/portal?org=${ORG}&ticket=${TICKET}`],
    ['members tab', '/settings?tab=members'],
  ];
  it.each(flows)('%s: /auth?next= → confirmation URL is exact and allow-listed', (_n, path) => {
    const authPage = authUrlWithNext(path);                       // what JoinCompany / ProtectedRoute navigate to
    const search = authPage.slice(authPage.indexOf('?'));
    const url = confirmationRedirect('https://www.b2bnest.online', search);
    expect(url).toBe(`https://www.b2bnest.online${path}`);
    expect(supabaseRedirectAllowed(url, PROD)).toBe(true);
  });
  it('unsafe or foreign destinations fall back to home, which is also allow-listed', () => {
    for (const bad of ['//evil.example/join', 'https://evil.example/', '/admin', '/join\\x', '/dashboard']) {
      const url = confirmationRedirect('https://www.b2bnest.online', `?next=${encodeURIComponent(bad)}`);
      expect(url).toBe('https://www.b2bnest.online/');
    }
  });
  it('the exact entries do not allow other pages or hosts', () => {
    for (const u of ['https://www.b2bnest.online/admin', 'https://www.b2bnest.online/join/x?token=1', 'https://evil.example/join?token=1',
      'https://www.b2bnest.online.evil.example/', `https://www.b2bnest.online/join?token=${TOKEN}.evil`]) {
      expect(supabaseRedirectAllowed(u, PROD)).toBe(false);
    }
  });
  it('a Vercel preview host needs its own entries (production entries do not cover it)', () => {
    const preview = confirmationRedirect('https://b2bnest-git-claude-onboarding-rev2-toufik-s-projects.vercel.app', `?next=${encodeURIComponent('/join?token=' + TOKEN)}`);
    expect(supabaseRedirectAllowed(preview, PROD)).toBe(false);
    expect(supabaseRedirectAllowed(preview, ['https://b2bnest-git-*-toufik-s-projects.vercel.app/join?token=*'])).toBe(true);
  });
  it('localhost stays http, other hosts are forced to https', () => {
    expect(confirmationRedirect('http://localhost:8080', '')).toBe('http://localhost:8080/');
    expect(confirmationRedirect('http://www.b2bnest.online', '')).toBe('https://www.b2bnest.online/');
  });
});
