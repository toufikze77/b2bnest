import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Phase 12c: profiles.is_active (Suspend) changes only through the admin-set-user-ban Edge Function, which calls
// admin_set_user_status as the signed-in super admin and keeps the Auth ban in step. The app never writes the flag.
const SRC = path.resolve(__dirname, '..');
const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return e.name === 'test' ? [] : files(p);
  return /\.(tsx?|jsx?)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !p.endsWith(path.join('integrations', 'supabase', 'types.ts')) ? [p] : [];
});

/** Each write to `profiles` (update / upsert / insert within the same chained call) that names is_active. */
export function profileActiveWrites(text: string): string[] {
  const hits: string[] = [];
  const re = /from\(\s*['"]profiles['"]\s*\)/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const chain = text.slice(m.index, m.index + 600).split(/;\s*\n/)[0];
    if (/\.(update|upsert|insert)\(/.test(chain) && /\bis_active\b/.test(chain)) hits.push(chain.slice(0, 120).replace(/\s+/g, ' '));
  }
  return hits;
}

describe('no code path writes profiles.is_active as the user', () => {
  it('scans the app', () => expect(files(SRC).length).toBeGreaterThan(300));

  it('no update / upsert / insert on profiles names is_active', () => {
    const hits = files(SRC).flatMap((f) => profileActiveWrites(fs.readFileSync(f, 'utf8')).map((h) => `${path.relative(SRC, f)}: ${h}`));
    expect(hits).toEqual([]);
  });

  it('admin_set_user_status is never called from the browser (only through the Edge Function)', () => {
    const hits = files(SRC).filter((f) => /\(\s*['"]admin_set_user_status['"]/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(SRC, f));
    expect(hits).toEqual([]);
  });

  it('the call detector matches rpc / adminRpc calls, not comments', () => {
    const re = /\(\s*['"]admin_set_user_status['"]/;
    expect(re.test("adminRpc('admin_set_user_status', { _user_id })")).toBe(true);
    expect(re.test('supabase.rpc("admin_set_user_status", {})')).toBe(true);
    expect(re.test('// goes through admin_set_user_status as the caller')).toBe(false);
  });

  it('the Admin page suspends through admin-set-user-ban', () => {
    expect(fs.readFileSync(path.join(SRC, 'lib', 'suspendAccount.ts'), 'utf8')).toContain("functions.invoke('admin-set-user-ban'");
  });

  it('the detector catches a write and ignores reads and other tables', () => {
    expect(profileActiveWrites("supabase.from('profiles').update({ is_active: true }).eq('id', id);")).toHaveLength(1);
    expect(profileActiveWrites("supabase.from('profiles').select('is_active').eq('id', id);")).toHaveLength(0);
    expect(profileActiveWrites("supabase.from('suppliers').update({ is_active: true });")).toHaveLength(0);
  });
});
