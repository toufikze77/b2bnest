import { describe, it, expect } from 'vitest';
import { mapSheetToContacts, splitAgainstExisting, extractLinkedIn, isUsableEmail, appendEmailPlaceholder } from './crmContactsExcel';

const H = ['Name', 'Email', 'Phone', 'Company', 'Position', 'Status', 'Value', 'Source', 'Notes'];
const NOTE = 'LinkedIn: https://www.linkedin.com/in/simon-dix-449a1895 | City: Solihull | Industry: Construction | Outreach msg: Hi Simon — café “quote”,\nline two';

describe('mapSheetToContacts', () => {
  it('keeps all nine columns, full notes, and does not mix position into company', () => {
    const { contacts } = mapSheetToContacts([H, ['Simon Dix', 'simon@hub.uk', '0121', 'HUB BUILD', 'COO', 'lead', '0', 'RocketReach', NOTE]]);
    expect(contacts[0]).toEqual({ name: 'Simon Dix', email: 'simon@hub.uk', phone: '0121', company: 'HUB BUILD', position: 'COO', status: 'lead', value: 0, source: 'RocketReach', notes: NOTE });
  });

  it('never saves placeholder emails; keeps them in notes once', () => {
    const r = mapSheetToContacts([H, ['Simon Dix', '(likely @hubbuild.uk — unverified)', '', 'HUB BUILD', 'COO', 'lead', '0', 'RR', NOTE], ['Bo', '', '', 'X', '', '', '', '', '']]);
    expect(r.contacts[0].email).toBeNull();
    expect(r.contacts[0].notes).toBe(`${NOTE}\nEmail (unverified research): (likely @hubbuild.uk — unverified)`);
    expect(r.contacts[1].email).toBeNull();
    expect(r.placeholders).toBe(1);
    expect(isUsableEmail('(likely @hubbuild.uk — unverified)')).toBe(false);
  });

  it('skips repeated name+company and rows without a name', () => {
    const r = mapSheetToContacts([H, ['Ann', '', '', 'Co', '', '', '', '', ''], ['ann ', '', '', 'co', '', '', '', '', ''], ['', 'b@x.com', '', '', '', '', '', '', '']]);
    expect(r.contacts).toHaveLength(1);
    expect(r.skipped).toBe(2);
  });

  it('reports unsupported columns instead of dropping them silently', () => {
    expect(mapSheetToContacts([['Name', 'Fax'], ['Bo', '1']]).unsupportedColumns).toEqual(['Fax']);
  });

  it('defaults unknown status to lead', () => {
    expect(mapSheetToContacts([['Name', 'Status'], ['Bo', 'weird']]).contacts[0].status).toBe('lead');
  });
});

describe('extractLinkedIn', () => {
  it('accepts only https linkedin profile links', () => {
    expect(extractLinkedIn(NOTE)).toBe('https://www.linkedin.com/in/simon-dix-449a1895');
    expect(extractLinkedIn('http://linkedin.com/in/x')).toBeNull();
    expect(extractLinkedIn('https://evil.com/linkedin.com/in/x')).toBeNull();
    expect(extractLinkedIn('javascript:alert(1)')).toBeNull();
  });
});

describe('overlap and repeat safety', () => {
  it('second file already in CRM adds no duplicates (LinkedIn, then name+company)', () => {
    const existing = [{ name: 'Simon Dix', company: 'HUB BUILD', notes: NOTE, email: '(likely @hubbuild.uk — unverified)' }, { name: 'Ann', company: 'Co', notes: null }];
    const rows = mapSheetToContacts([H, ['S. Dix', '', '', 'Hub Build Ltd', '', '', '', '', NOTE], ['ANN', '', '', 'co', '', '', '', '', ''], ['New', '', '', 'Z', '', '', '', '', '']]).contacts;
    const { fresh, overlap } = splitAgainstExisting(rows, existing);
    expect(overlap).toHaveLength(2);
    expect(fresh.map((r) => r.name)).toEqual(['New']);
  });

  it('appending the placeholder twice changes nothing', () => {
    const once = appendEmailPlaceholder('n', 'x');
    expect(appendEmailPlaceholder(once, 'x')).toBe(once);
  });
});
