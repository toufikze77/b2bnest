// src/lib/supabase/teamProjectHelpers.ts
import { supabase } from '@/integrations/supabase/client';

/**
 * Add (or upsert) a user into team_members.
 * Uses upsert with onConflict so it is idempotent.
 */
export async function addUserToTeam(
  teamId: string,
  userId: string,
  role: string = 'member'
) {
  try {
    const payload = { team_id: teamId, user_id: userId, role };
    const { data, error } = await supabase
      .from('team_members')
      .upsert([payload], { onConflict: ['team_id', 'user_id'] })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('addUserToTeam error', err);
    throw err;
  }
}

/**
 * Add (or upsert) a user into project_members.
 */
export async function addUserToProject(
  projectId: string,
  userId: string,
  role: string = 'contributor'
) {
  try {
    const payload = { project_id: projectId, user_id: userId, role };
    const { data, error } = await supabase
      .from('project_members')
      .upsert([payload], { onConflict: ['project_id', 'user_id'] })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('addUserToProject error', err);
    throw err;
  }
}

/**
 * Return the list of projects that a user is a member of.
 * This queries project_members and returns the joined projects rows.
 */
export async function getUserProjects(userId: string) {
  try {
    const { data, error } = await supabase
      .from('project_members')
      .select('project_id, projects(*)')
      .eq('user_id', userId);

    if (error) throw error;
    // data is an array of { project_id, projects: { ... } }
    return (data || []).map((row: any) => row.projects).filter(Boolean);
  } catch (err) {
    console.error('getUserProjects error', err);
    throw err;
  }
}

/**
 * Return team members with user details (attempts users then profiles).
 * Output: [{ id: team_member_id, team_id, user_id, role, created_at, user: { id, email, ... } }, ...]
 */
export async function getTeamMembers(teamId: string) {
  try {
    // 1) get the team_members rows
    const { data: members, error: membersErr } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId);

    if (membersErr) throw membersErr;
    if (!members || members.length === 0) return [];

    const userIds = members.map((m: any) => m.user_id);

    // 2) try to fetch from 'users' table (or auth.users via a view)
    let { data: usersData, error: usersErr } = await supabase
      .from('users')
      .select('id, email, raw_user_meta_data')
      .in('id', userIds);

    // 3) fallback to 'profiles' if 'users' table doesn't exist / returned nothing
    if (!usersData || usersData.length === 0) {
      const resp = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);
      usersData = resp.data || [];
      usersErr = resp.error;
    }

    // 4) merge team_members + user info
    const merged = (members || []).map((m: any) => ({
      ...m,
      user: (usersData || []).find((u: any) => u.id === m.user_id) || null,
    }));

    return merged;
  } catch (err) {
    console.error('getTeamMembers error', err);
    throw err;
  }
}
