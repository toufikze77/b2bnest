import { describe, expect, it } from 'vitest';
import { activeNavTarget } from './navMatch';

const INVOICES = '/business-tools?tool=business-finance-assistant&tab=invoices';
const EXPENSES = '/business-tools?tool=business-finance-assistant&tab=expenses';
const FINANCE = '/business-tools?tool=business-finance-assistant&tab=dashboard';
const targets = ['/dashboard', '/business-tools', INVOICES, EXPENSES, FINANCE, '/business-tools?tool=integrations', '/crm'];
const aliases = [{ to: INVOICES, alsoMatches: '/business-tools?tool=business-finance-assistant' }];
const at = (search: string, path = '/business-tools') => activeNavTarget(targets, path, search, aliases);

describe('activeNavTarget', () => {
  it('every finance tab without its own menu item highlights "Invoices & quotes", not "All business tools"', () => {
    for (const tab of ['quotes', 'create', 'outgoings', 'suppliers', 'products', 'payroll', 'banking', 'reports', 'analytics', 'templates']) {
      expect(at(`?tool=business-finance-assistant&tab=${tab}`)).toBe(INVOICES);
    }
    expect(at('?tool=business-finance-assistant')).toBe(INVOICES);
    expect(at('?tool=business-finance-assistant&tab=invoices&type=quote')).toBe(INVOICES);
  });

  it('items that link to an exact tab keep winning', () => {
    expect(at('?tool=business-finance-assistant&tab=expenses')).toBe(EXPENSES);
    expect(at('?tool=business-finance-assistant&tab=dashboard')).toBe(FINANCE);
  });

  it('other pages are unchanged', () => {
    expect(at('')).toBe('/business-tools');
    expect(at('?tool=integrations')).toBe('/business-tools?tool=integrations');
    expect(at('?tool=crm')).toBe('/business-tools');
    expect(at('', '/crm')).toBe('/crm');
    expect(at('', '/nowhere')).toBeUndefined();
  });
});
