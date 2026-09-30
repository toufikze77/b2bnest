import { describe, it, expect } from 'vitest';
import { BUILT_IN_TEMPLATES, TEMPLATE_CATEGORIES } from '@/data/workspaceTemplates';
import { getTemplateAvailability } from '@/lib/templateKind';
import { buildCatalogueNav, customerTemplates, isCategoryAvailable } from './templateCatalogue';
import type { WorkspaceTemplate } from '@/types/workspaceTemplate';

const base = BUILT_IN_TEMPLATES.find((t) => getTemplateAvailability(t).available)!;
const mk = (o: Partial<WorkspaceTemplate>): WorkspaceTemplate => ({ ...base, ...o } as WorkspaceTemplate);

describe('customer template catalogue', () => {
  it('hides categories with zero usable templates (real data)', () => {
    const nav = buildCatalogueNav(customerTemplates(BUILT_IN_TEMPLATES));
    for (const c of nav.categories) {
      expect(c.count).toBeGreaterThan(0);
      for (const s of c.subcategories) expect(s.count).toBeGreaterThan(0);
    }
    const shown = new Set(nav.categories.map((c) => c.id));
    for (const cat of TEMPLATE_CATEGORIES) {
      const usable = customerTemplates(BUILT_IN_TEMPLATES).some((t) => t.category === cat.id);
      expect(shown.has(cat.id)).toBe(usable);
    }
    expect(nav.total).toBe(customerTemplates(BUILT_IN_TEMPLATES).length);
  });

  it('mixed category counts only available templates', () => {
    const cat = TEMPLATE_CATEGORIES[0];
    const avail = mk({ slug: 'a', category: cat.id, subcategory: cat.subcategories[0] });
    const unavail = mk({ slug: 'b', category: cat.id, subcategory: cat.subcategories[1] ?? 'x', templateType: 'automation' as any });
    const nav = buildCatalogueNav(customerTemplates([avail, unavail]));
    expect(nav.categories).toHaveLength(1);
    expect(nav.categories[0].count).toBe(1);
    expect(nav.categories[0].subcategories.map((s) => s.name)).toEqual([cat.subcategories[0]]);
  });

  it('fully unavailable category disappears; old link reported unavailable', () => {
    const cat = TEMPLATE_CATEGORIES[1];
    const nav = buildCatalogueNav(customerTemplates([mk({ slug: 'z', category: cat.id, templateType: 'dashboard' as any })]));
    expect(nav.categories).toHaveLength(0);
    expect(isCategoryAvailable(nav, cat.id)).toBe(false);
    expect(isCategoryAvailable(nav, null)).toBe(true);
  });

  it('admin list keeps unavailable definitions', () => {
    const unavailable = BUILT_IN_TEMPLATES.filter((t) => !getTemplateAvailability(t).available);
    expect(unavailable.length).toBeGreaterThan(0);
    expect(customerTemplates(BUILT_IN_TEMPLATES)).not.toEqual(expect.arrayContaining([unavailable[0]]));
    expect(BUILT_IN_TEMPLATES).toEqual(expect.arrayContaining(unavailable));
  });
});
