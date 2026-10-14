import { supabase } from '@/integrations/supabase/client';
import type { AudienceFilter } from '@/lib/marketingAudience';

/**
 * Marketing planning records (saved audiences, campaign drafts, planned content).
 * Private to the creator: the database rules only return rows where user_id = the signed-in user.
 * Nothing here sends or tracks messages.
 */
// The tables are introduced by a reviewed migration; until applied they are absent from generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type Audience = { id: string; name: string; filter: AudienceFilter; archived_at: string | null; updated_at: string };
export type CampaignStatus = 'draft' | 'planned' | 'completed';
export type Channel = 'email' | 'linkedin' | 'phone' | 'event' | 'other';
export type Campaign = {
  id: string; name: string; objective: string | null; channel: Channel; content: string | null;
  status: CampaignStatus; start_date: string | null; end_date: string | null;
  audience_id: string | null; contact_ids: string[]; archived_at: string | null; updated_at: string;
};
export type ContentItem = {
  id: string; title: string; channel: Channel | null; planned_for: string | null; campaign_id: string | null;
  todo_id: string | null; archived_at: string | null; updated_at: string;
};
export type Table = 'marketing_audiences' | 'marketing_campaigns' | 'marketing_content_items';

export class NotEnabledError extends Error {
  constructor() { super('Saving marketing plans is not switched on yet. It needs an approved database update.'); }
}

const friendly = (e: { code?: string; message?: string }): Error => {
  if (e.code === 'PGRST205' || e.code === '42P01' || /does not exist|schema cache/i.test(e.message || '')) return new NotEnabledError();
  if (e.code === '23514') return new Error('Please check the fields: names cannot be blank and the end date cannot be before the start date.');
  if (e.code === '23505') return new Error('This planned content is already linked to a task.');
  return new Error(e.message || 'Could not save. Your changes are still in the form — please try again.');
};

export async function listAll(): Promise<{ audiences: Audience[]; campaigns: Campaign[]; content: ContentItem[] }> {
  const [a, c, i] = await Promise.all([
    db.from('marketing_audiences').select('*').order('updated_at', { ascending: false }),
    db.from('marketing_campaigns').select('*').order('updated_at', { ascending: false }),
    db.from('marketing_content_items').select('*').order('planned_for', { ascending: true, nullsFirst: false }),
  ]);
  const err = a.error || c.error || i.error;
  if (err) throw friendly(err);
  return { audiences: a.data, campaigns: c.data, content: i.data };
}

export async function save<T extends { id?: string }>(table: Table, row: T): Promise<void> {
  const { id, ...fields } = row;
  const q = id
    ? db.from(table).update(fields).eq('id', id).select('id')
    : db.from(table).insert(fields).select('id');
  const { data, error } = await q;
  if (error) throw friendly(error);
  if (!data?.length) throw new Error('Nothing was saved — the record may have been removed. Refresh and try again.');
}

export const setArchived = (table: Table, id: string, archived: boolean) =>
  save(table, { id, archived_at: archived ? new Date().toISOString() : null });

/** Tasks the signed-in user can still open (others are hidden). */
export async function visibleTasks(ids: string[]): Promise<Record<string, { title: string; organization_id: string | null }>> {
  if (!ids.length) return {};
  const { data } = await supabase.from('todos').select('id, title, organization_id').in('id', ids);
  return Object.fromEntries((data || []).map((t) => [t.id, t]));
}

/**
 * Creates ONE follow-up task in the given company for a planned-content item.
 * Retry-safe: re-reads the item first and skips if already linked; the database also allows
 * a task to be linked only once. If linking fails, the just-created task is removed.
 */
export async function createFollowUpTask(item: ContentItem, userId: string, organizationId: string): Promise<void> {
  const fresh = await db.from('marketing_content_items').select('todo_id').eq('id', item.id).maybeSingle();
  if (fresh.error) throw friendly(fresh.error);
  if (fresh.data?.todo_id) return;
  const { data: todo, error } = await supabase.from('todos').insert({
    title: `Content: ${item.title}`.slice(0, 200),
    description: 'Follow-up from a Marketing plan. Nothing is sent automatically.',
    status: 'todo', priority: 'medium', user_id: userId, reporter_id: userId,
    organization_id: organizationId, due_date: item.planned_for,
  }).select('id').single();
  if (error) throw friendly(error);
  const link = await db.from('marketing_content_items').update({ todo_id: todo.id }).eq('id', item.id).is('todo_id', null).select('id');
  if (link.error || !link.data?.length) {
    await supabase.from('todos').delete().eq('id', todo.id);
    if (link.error) throw friendly(link.error);
  }
}
