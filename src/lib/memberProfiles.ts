import { supabase } from '@/integrations/supabase/client';

/**
 * Phase 28: organization_members.user_id references auth.users, not public.profiles, so PostgREST cannot embed
 * profiles through the user_id foreign key (it answered 400 "no relationship"). Members and their profiles are read with two plain
 * queries instead, and each member gets `profiles` attached in the same shape as before (or null).
 */
export interface MemberProfile { id: string; display_name: string | null; email: string | null; full_name: string | null }
export interface MemberRow { id: string; user_id: string; role: string; created_at: string; organization_id: string }
export type MemberWithProfile = MemberRow & { profiles: MemberProfile | null };

export const MEMBER_COLUMNS = 'id, user_id, role, created_at, organization_id';
export const PROFILE_COLUMNS = 'id, display_name, email, full_name';

/** Attaches profiles to members. If the profiles read fails, logs once and returns the members with profiles: null. */
export async function attachProfiles(members: MemberRow[]): Promise<MemberWithProfile[]> {
  const userIds = [...new Set(members.map((m) => m.user_id).filter(Boolean))];
  const byId = new Map<string, MemberProfile>();
  if (userIds.length > 0) {
    const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).in('id', userIds);
    if (error) console.error('Could not load member profiles:', error.message);
    else for (const p of (data ?? []) as MemberProfile[]) byId.set(p.id, p);
  }
  return members.map((m) => ({ ...m, profiles: byId.get(m.user_id) ?? null }));
}

/** Active members of the given organizations, with profiles attached. Throws only if the members query fails. */
export async function fetchActiveMembersWithProfiles(organizationIds: string[]): Promise<MemberWithProfile[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select(MEMBER_COLUMNS)
    .in('organization_id', organizationIds)
    .eq('is_active', true);
  if (error) throw error;
  return attachProfiles((data ?? []) as MemberRow[]);
}
