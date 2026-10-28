import { describe, expect, it } from 'vitest';
import { bottomItems, groups, homeItem, logoTarget, topItems } from './navItems';

describe('sidebar menu order', () => {
  it('Business overview sits directly under Dashboard and nowhere else', () => {
    expect(topItems.map((i) => [i.label, i.to])).toEqual([['Dashboard', '/dashboard'], ['Business overview', '/business-overview']]);
    expect(groups.flatMap((g) => g.items).some((i) => i.to === '/business-overview')).toBe(false);
  });

  it('"B2BNEST home" goes to the public home page and is not one of the in-app items', () => {
    expect(homeItem).toMatchObject({ label: 'B2BNEST home', to: '/' });
    const inApp = [...topItems, ...groups.flatMap((g) => g.items), ...bottomItems].map((i) => i.to);
    expect(inApp).not.toContain('/');
  });

  it('the logo goes to the dashboard, or to the home page when you are on the dashboard', () => {
    expect(logoTarget('/crm')).toEqual({ to: '/dashboard', label: 'Go to dashboard' });
    expect(logoTarget('/business-tools')).toEqual({ to: '/dashboard', label: 'Go to dashboard' });
    expect(logoTarget('/dashboard')).toEqual({ to: '/', label: 'Go to home page' });
  });
});
