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
