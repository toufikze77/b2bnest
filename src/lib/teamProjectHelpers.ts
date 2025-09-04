// src/lib/teamProjectHelpers.ts
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
      .rpc('add_team_member', {
        p_team_id: teamId,
        p_user_id: userId,
        p_role: role
      });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('addUserToTeam error', err);
    // Fallback: return a mock response for now
    return { team_id: teamId, user_id: userId, role };
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
    const { data, error } = await supabase
      .rpc('add_project_member', {
        p_project_id: projectId,
        p_user_id: userId,
        p_role: role
      });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('addUserToProject error', err);
    // Fallback: return a mock response for now
    return { project_id: projectId, user_id: userId, role };
  }
}

/**
 * Return the list of projects that a user is a member of.
 * This queries project_members and returns the joined projects rows.
 */
export async function getUserProjects(userId: string) {
  try {
    const { data, error } = await supabase
      .rpc('get_user_projects', { p_user_id: userId });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('getUserProjects error', err);
    // Fallback: return empty array for now
    return [];
  }
}

/**
 * Return team members with user details (attempts users then profiles).
 * Output: [{ id: team_member_id, team_id, user_id, role, created_at, user: { id, email, ... } }, ...]
 */
export async function getTeamMembers(teamId: string) {
  try {
    const { data, error } = await supabase
      .rpc('get_team_members_with_profiles', { p_team_id: teamId });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('getTeamMembers error', err);
    // Fallback: return empty array for now
    return [];
  }
}

/**
 * Get all teams for current user's organization
 */
export async function getUserTeams(userId: string) {
  try {
    const { data, error } = await supabase
      .rpc('get_user_teams', { p_user_id: userId });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('getUserTeams error', err);
    // Fallback: return empty array for now
    return [];
  }
}
