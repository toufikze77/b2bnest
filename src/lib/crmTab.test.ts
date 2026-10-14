import { describe, it, expect } from 'vitest';
import { readCrmTab, writeCrmTab } from './crmTab';

const p = (s: string) => new URLSearchParams(s);

describe('CRM tab in URL', () => {
  it('reads marketing from a direct link', () => expect(readCrmTab(p('tab=marketing'))).toBe('marketing'));
  it('defaults to contacts with no tab', () => expect(readCrmTab(p(''))).toBe('contacts'));
  it('falls back to contacts for invalid values', () => expect(readCrmTab(p('tab=bogus'))).toBe('contacts'));
  it('keeps other params when switching tab', () =>
    expect(writeCrmTab(p('q=acme&status=lead'), 'marketing').toString()).toBe('q=acme&status=lead&tab=marketing'));
  it('removes tab param for the default tab', () =>
    expect(writeCrmTab(p('tab=marketing&q=x'), 'contacts').toString()).toBe('q=x'));
});
