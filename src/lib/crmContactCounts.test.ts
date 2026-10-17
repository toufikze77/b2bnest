import { describe, expect, it } from 'vitest';
import { contactStatus, contactStatusCounts } from './crmContactCounts';

describe('contactStatusCounts', () => {
  it('counts each status from the loaded contacts; missing status counts as lead; other statuses only in all', () => {
    expect(contactStatusCounts([{ status: 'lead' }, { status: null }, { status: 'Prospect' }, { status: 'customer' }, { status: 'partner' }]))
      .toEqual({ all: 5, lead: 2, prospect: 1, customer: 1 });
    expect(contactStatusCounts([])).toEqual({ all: 0, lead: 0, prospect: 0, customer: 0 });
    expect(contactStatus({ status: null })).toBe('lead');
  });
});
