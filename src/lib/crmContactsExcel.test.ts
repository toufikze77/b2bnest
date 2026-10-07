import { describe, it, expect } from 'vitest';
import { mapSheetToContacts } from './crmContactsExcel';

describe('mapSheetToContacts', () => {
  it('maps headers, skips rows without a name and duplicate emails', () => {
    const { contacts, skipped } = mapSheetToContacts([
      ['Full Name', 'E-mail', 'Status', 'Amount'],
      ['Ann', 'ANN@x.com', 'Customer', '£1,200'],
      ['', 'b@x.com', '', ''],
      ['Ann 2', 'ann@x.com', '', ''],
    ]);
    expect(skipped).toBe(2);
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ name: 'Ann', email: 'ann@x.com', status: 'customer', value: 1200 });
  });

  it('defaults unknown status to lead', () => {
    expect(mapSheetToContacts([['Name', 'Status'], ['Bo', 'weird']]).contacts[0].status).toBe('lead');
  });
});
