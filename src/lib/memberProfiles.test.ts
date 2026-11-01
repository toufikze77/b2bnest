// Phase 28: organization members and their profiles are read with two plain queries (no profiles:user_id embed).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const st = vi.hoisted(() => ({
  calls: [] as { table: string; select: string; filters: [string, string, unknown][] }[],
  members: [] as Record<string, unknown>[],
  profiles: [] as Record<string, unknown>[],
  profilesError: null as null | { message: string },
  membersError: null as null | { message: string },
}));
vi.mock('@/integrations/supabase/client', () => {
  const from = (table: string) => {
    const call = { table, select: '', filters: [] as [string, string, unknown][] };
    st.calls.push(call);
    const b: Record<string, unknown> = {};
    b.select = (cols: string) => { call.select = cols; return b; };
    b.in = (col: string, v: unknown) => { call.filters.push(['in', col, v]); return b; };
    b.eq = (col: string, v: unknown) => { call.filters.push(['eq', col, v]); return b; };
    b.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(
      table === 'organization_members' ? { data: st.membersError ? null : st.members, error: st.membersError }
        : { data: st.profilesError ? null : st.profiles, error: st.profilesError }).then(ok, bad);
    return b;
  };
  return { supabase: { from } };
});

import { attachProfiles, fetchActiveMembersWithProfiles } from './memberProfiles';
import { getTeamMembers } from './teamProjectHelpers';

const m = (id: string, user: string, org = 'o1') => ({ id, user_id: user, role: 'member', created_at: '2026-11-01T00:00:00Z', organization_id: org });
const p = (id: string, name: string) => ({ id, display_name: name, email: `${id}@example.test`, full_name: `${name} Full` });

beforeEach(() => {
  st.calls.length = 0;
  st.members = [m('m1', 'u1'), m('m2', 'u2'), m('m3', 'u1', 'o2')];
  st.profiles = [p('u1', 'Ana')];
  st.profilesError = null; st.membersError = null;
});

describe('fetchActiveMembersWithProfiles (ProjectManagement fetchTeams)', () => {
  it('members come back with profiles attached; a member with no profile row gets profiles: null', async () => {
    const rows = await fetchActiveMembersWithProfiles(['o1', 'o2']);
    expect(rows.map((r) => [r.id, r.profiles?.display_name ?? null])).toEqual([['m1', 'Ana'], ['m2', null], ['m3', 'Ana']]);
    expect(rows[0].profiles).toEqual({ id: 'u1', display_name: 'Ana', email: 'u1@example.test', full_name: 'Ana Full' });
  });

  it('keeps the filters (organization ids, is_active = true) and asks for distinct user ids only', async () => {
    await fetchActiveMembersWithProfiles(['o1', 'o2']);
    const [members, profiles] = st.calls;
    expect(members).toEqual({ table: 'organization_members', select: 'id, user_id, role, created_at, organization_id', filters: [['in', 'organization_id', ['o1', 'o2']], ['eq', 'is_active', true]] });
    expect(profiles).toEqual({ table: 'profiles', select: 'id, display_name, email, full_name', filters: [['in', 'id', ['u1', 'u2']]] });
  });

  it('a failing profiles query still returns the members (profiles: null), logged once, never throws', async () => {
    st.profilesError = { message: 'boom' };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rows = await fetchActiveMembersWithProfiles(['o1']);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.profiles === null)).toBe(true);
    expect(err).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });

  it('no members: the profiles table is not queried', async () => {
    st.members = [];
    expect(await fetchActiveMembersWithProfiles(['o1'])).toEqual([]);
    expect(st.calls.map((c) => c.table)).toEqual(['organization_members']);
    expect(await attachProfiles([])).toEqual([]);
  });

  it('no query string contains profiles:user_id', async () => {
    await fetchActiveMembersWithProfiles(['o1']);
    await getTeamMembers('o1');
    expect(st.calls.length).toBeGreaterThan(0);
    for (const c of st.calls) expect(c.select).not.toContain('profiles:user_id');
  });
});

describe('getTeamMembers (teamProjectHelpers)', () => {
  it('same output shape as before: user filled from the profile, or null when there is no profile row', async () => {
    st.members = [m('m1', 'u1'), m('m2', 'u2')];
    const rows = await getTeamMembers('o1');
    expect(rows).toEqual([
      { id: 'm1', team_id: 'o1', user_id: 'u1', role: 'member', created_at: '2026-11-01T00:00:00Z', user: { id: 'u1', email: 'u1@example.test', full_name: 'Ana Full', display_name: 'Ana' } },
      { id: 'm2', team_id: 'o1', user_id: 'u2', role: 'member', created_at: '2026-11-01T00:00:00Z', user: null },
    ]);
    expect(st.calls[0].filters).toEqual([['in', 'organization_id', ['o1']], ['eq', 'is_active', true]]);
  });

  it('a failing profiles query still returns the members, with user: null', async () => {
    st.profilesError = { message: 'boom' };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rows = await getTeamMembers('o1');
    expect(rows.map((r) => [r.id, r.user])).toEqual([['m1', null], ['m2', null], ['m3', null]]);
    err.mockRestore();
  });
});
