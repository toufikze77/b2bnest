import { INDUSTRIES, TEMPLATE_CATEGORIES } from '@/data/workspaceTemplates';
import { getTemplateAvailability } from '@/lib/templateKind';
import { TEMPLATE_TYPE_LABELS, TemplateType, WorkspaceTemplate } from '@/types/workspaceTemplate';

/** Templates a customer can actually use today. Unavailable definitions stay admin-only. */
export function customerTemplates(all: WorkspaceTemplate[]): WorkspaceTemplate[] {
  return all.filter((t) => getTemplateAvailability(t).available);
}

export interface CatalogueCategory {
  id: string;
  name: string;
  count: number;
  subcategories: { name: string; count: number }[];
}

export interface CatalogueNav {
  categories: CatalogueCategory[];
  industries: string[];
  types: TemplateType[];
  quick: { featured: number; ai: number; free: number };
  total: number;
}

/**
 * Build every customer-facing menu, chip, filter and count from the templates
 * passed in (which must already be customer-usable). Empty parents, empty
 * subcategories, industries and types with zero templates are omitted.
 */
export function buildCatalogueNav(templates: WorkspaceTemplate[]): CatalogueNav {
  const categories: CatalogueCategory[] = [];
  for (const cat of TEMPLATE_CATEGORIES) {
    const inCat = templates.filter((t) => t.category === cat.id);
    if (inCat.length === 0) continue;
    const subcategories = cat.subcategories
      .map((name) => ({ name, count: inCat.filter((t) => t.subcategory === name).length }))
      .filter((s) => s.count > 0);
    categories.push({ id: cat.id, name: cat.name, count: inCat.length, subcategories });
  }
  const industries = INDUSTRIES.filter((i) => templates.some((t) => t.industries.includes(i)));
  const types = (Object.keys(TEMPLATE_TYPE_LABELS) as TemplateType[]).filter((ty) =>
    templates.some((t) => t.templateType === ty),
  );
  return {
    categories,
    industries,
    types,
    quick: {
      featured: templates.filter((t) => t.featured).length,
      ai: templates.filter((t) => t.isAiPowered).length,
      free: templates.filter((t) => t.plan === 'free').length,
    },
    total: templates.length,
  };
}

/** True when a requested category/subcategory (e.g. from an old link) has usable templates. */
export function isCategoryAvailable(nav: CatalogueNav, category: string | null, sub?: string | null): boolean {
  if (!category) return true;
  const c = nav.categories.find((x) => x.id === category);
  if (!c) return false;
  return !sub || c.subcategories.some((s) => s.name === sub);
}
