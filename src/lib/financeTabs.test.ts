import { describe, expect, it } from 'vitest';
import { archiveViewsFromSearch, searchWithArchive } from './financeTabs';

describe('Archive view in the URL', () => {
  it('reads each tab on its own; missing or unknown values mean Active', () => {
    expect(archiveViewsFromSearch('?tab=invoices&archive=invoices')).toEqual({ quotes: false, invoices: true });
    expect(archiveViewsFromSearch('?archive=quotes,invoices')).toEqual({ quotes: true, invoices: true });
    expect(archiveViewsFromSearch('?archive=quotes')).toEqual({ quotes: true, invoices: false });
    expect(archiveViewsFromSearch('?archive=1')).toEqual({ quotes: false, invoices: false });
    expect(archiveViewsFromSearch('?archive=bogus')).toEqual({ quotes: false, invoices: false });
    expect(archiveViewsFromSearch('')).toEqual({ quotes: false, invoices: false });
  });
  it('writes the switch, keeps every other param, and drops the param when both are Active', () => {
    const s = 'tool=business-finance-assistant&tab=invoices';
    expect(searchWithArchive(s, 'invoices', true)).toBe('tool=business-finance-assistant&tab=invoices&archive=invoices');
    expect(searchWithArchive(`${s}&archive=quotes`, 'invoices', true)).toBe('tool=business-finance-assistant&tab=invoices&archive=quotes%2Cinvoices');
    expect(searchWithArchive(`${s}&archive=quotes%2Cinvoices`, 'quotes', false)).toBe('tool=business-finance-assistant&tab=invoices&archive=invoices');
    expect(searchWithArchive(`${s}&archive=invoices`, 'invoices', false)).toBe(s);
    expect(searchWithArchive(`${s}&archive=bogus`, 'quotes', false)).toBe(s);
  });
});
