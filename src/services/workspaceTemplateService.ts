import { supabase } from '@/integrations/supabase/client';
import { BUILT_IN_TEMPLATES } from '@/data/workspaceTemplates';
import { TemplateUsage, WorkspaceTemplate } from '@/types/workspaceTemplate';

export type TemplateEvent = 'view' | 'preview' | 'use_click' | 'created';

export interface CatalogRow {
  id: string;
  slug: string;
  is_custom: boolean;
  status: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const mergeRow = (base: WorkspaceTemplate | null, row: CatalogRow): WorkspaceTemplate | null => {
  const patch = (row.data ?? {}) as Partial<WorkspaceTemplate>;
  if (!base && !row.is_custom) return null;
  const merged: WorkspaceTemplate = {
    ...(base ??
      ({
        id: row.id,
        slug: row.slug,
        name: row.slug,
        description: '',
        longDescription: '',
        category: 'business-management',
        subcategory: '',
        industries: [],
        templateType: 'board',
        tags: [],
        isAiPowered: false,
        aiFeatures: [],
        automations: [],
        features: [],
        whoItsFor: [],
        helpsYouManage: [],
        exampleWorkflow: [],
        plan: 'free',
        status: 'published',
        featured: false,
        isCustom: true,
        previewImages: [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        boards: [],
      } as WorkspaceTemplate)),
    ...patch,
    id: row.id,
    slug: row.slug,
    isCustom: row.is_custom,
    status: row.status as WorkspaceTemplate['status'],
    createdAt: (patch.createdAt as string) ?? base?.createdAt ?? row.created_at,
    updatedAt: row.updated_at,
  };
  merged.isAiPowered = merged.aiFeatures.length > 0 ? true : !!merged.isAiPowered;
  return merged;
};

/** Built-in catalog merged with admin overrides and admin-created templates. */
export const loadTemplates = async (options?: { includeUnpublished?: boolean }): Promise<WorkspaceTemplate[]> => {
  const { data, error } = await supabase
    .from('template_catalog')
    .select('id, slug, is_custom, status, data, created_at, updated_at');

  const rows = (error || !data ? [] : (data as unknown as CatalogRow[]));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const merged: WorkspaceTemplate[] = [];

  for (const base of BUILT_IN_TEMPLATES) {
    const row = bySlug.get(base.slug);
    if (!row) {
      merged.push(base);
      continue;
    }
    bySlug.delete(base.slug);
    const t = mergeRow(base, row);
    if (t) merged.push(t);
  }

  for (const row of bySlug.values()) {
    const t = mergeRow(null, row);
    if (t) merged.push(t);
  }

  return options?.includeUnpublished ? merged : merged.filter((t) => t.status === 'published');
};

/** Real usage counts from template_events — never invented. */
export const loadUsage = async (): Promise<Record<string, TemplateUsage>> => {
  const { data, error } = await supabase.rpc('template_usage_counts');
  if (error || !data) return {};
  const map: Record<string, TemplateUsage> = {};
  for (const row of data as Array<{
    slug: string;
    views: number;
    previews: number;
    use_clicks: number;
    created_count: number;
  }>) {
    map[row.slug] = {
      views: Number(row.views) || 0,
      previews: Number(row.previews) || 0,
      useClicks: Number(row.use_clicks) || 0,
      created: Number(row.created_count) || 0,
    };
  }
  return map;
};

export const logTemplateEvent = async (slug: string, event: TemplateEvent) => {
  try {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from('template_events').insert({
      template_slug: slug,
      event_type: event,
      user_id: auth?.user?.id ?? null,
    });
  } catch {
    /* analytics must never block the UI */
  }
};

// ───────────── Admin operations ─────────────

export const upsertTemplate = async (template: WorkspaceTemplate) => {
  const { data: auth } = await supabase.auth.getUser();
  const { slug, status, isCustom, id, ...rest } = template;
  const payload = {
    slug,
    status,
    is_custom: isCustom,
    data: { ...rest, slug } as unknown as Record<string, unknown>,
    created_by: auth?.user?.id ?? null,
  };
  const { error } = await supabase.from('template_catalog').upsert(payload as never, { onConflict: 'slug' });
  if (error) throw new Error(error.message);
};

export const deleteTemplateOverride = async (slug: string) => {
  const { error } = await supabase.from('template_catalog').delete().eq('slug', slug);
  if (error) throw new Error(error.message);
};

export const loadTemplateEvents = async (limit = 500) => {
  const { data, error } = await supabase
    .from('template_events')
    .select('template_slug, event_type, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
};
