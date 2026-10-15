import { describe, it, expect } from 'vitest';
import { validateFile, attachmentPath, customerCanReopen, customerCanReply, validateTicket, STATUS_LABEL } from './supportTicket';

describe('support ticket rules', () => {
  it('uses exactly the five agreed statuses', () => {
    expect(Object.values(STATUS_LABEL)).toEqual(['New', 'Open', 'Waiting for customer', 'Resolved', 'Closed']);
  });
  it('rejects files over 10 MB', () => {
    expect(validateFile({ name: 'a.pdf', size: 10 * 1024 * 1024 + 1, type: 'application/pdf' })).toMatch(/10 MB/);
    expect(validateFile({ name: 'a.pdf', size: 10 * 1024 * 1024, type: 'application/pdf' })).toBeNull();
  });
  it('rejects executables', () => {
    expect(validateFile({ name: 'x.exe', size: 10, type: 'application/x-msdownload' })).not.toBeNull();
  });
  it('builds a path the database accepts and strips unsafe characters', () => {
    expect(attachmentPath('o', 't', '../my file<>.png', 'r')).toBe('o/t/r-.._my_file_.png');
  });
  it('customers can reopen only resolved or closed tickets, and cannot reply on closed', () => {
    expect(customerCanReopen('resolved')).toBe(true);
    expect(customerCanReopen('closed')).toBe(true);
    expect(customerCanReopen('open')).toBe(false);
    expect(customerCanReply('closed')).toBe(false);
    expect(customerCanReply('waiting_customer')).toBe(true);
  });
  it('requires subject and description', () => {
    expect(validateTicket(' ', 'x')).not.toBeNull();
    expect(validateTicket('x', '')).not.toBeNull();
    expect(validateTicket('x', 'y')).toBeNull();
  });
});

import { eligibleAgents, invitationState } from './supportTicket';
describe('agent and invitation rules', () => {
  it('only offers non-admin members who are not already agents', () => {
    const m = [{ user_id: 'o', role: 'owner' }, { user_id: 'a', role: 'admin' }, { user_id: 'g', role: 'member' }, { user_id: 'n', role: 'manager' }, { user_id: 's', role: 'member' }];
    expect(eligibleAgents(m, ['g']).map((x) => x.user_id)).toEqual(['n', 's']);
  });
  it('labels invitations', () => {
    expect(invitationState({ user_id: null, revoked_at: null, expires_at: '2000-01-01T00:00:00Z' })).toBe('Invitation expired');
    expect(invitationState({ user_id: 'x', revoked_at: null, expires_at: '2000-01-01T00:00:00Z' })).toBe('Signed up');
    expect(invitationState({ user_id: 'x', revoked_at: '2026-01-01', expires_at: null })).toBe('Access removed');
  });
});
