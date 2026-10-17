import { describe, expect, it } from 'vitest';
import { groups, topItems } from './navItems';

describe('sidebar menu order', () => {
  it('Business overview sits directly under Dashboard and nowhere else', () => {
    expect(topItems.map((i) => [i.label, i.to])).toEqual([['Dashboard', '/dashboard'], ['Business overview', '/business-overview']]);
    expect(groups.flatMap((g) => g.items).some((i) => i.to === '/business-overview')).toBe(false);
  });
});
