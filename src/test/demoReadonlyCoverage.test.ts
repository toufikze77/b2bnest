// Demo read-only: a new table cannot forget the guard. Every table the repo creates (migrations, the generated types,
// docs/*/proposal.sql) must be guarded or on the allow-list in docs/demo-readonly/tables.json (or be known not to exist
// in production), and the lists in proposal.sql and check-coverage.sql must be exactly that file's lists.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const lists = JSON.parse(read('docs/demo-readonly/tables.json')) as {
  guarded: string[]; allowed: Record<string, string>; not_in_production: Record<string, string>;
};
const guarded = new Set(lists.guarded);
const allowed = new Set(Object.keys(lists.allowed));
const absent = new Set(Object.keys(lists.not_in_production));

const sqlArray = (sql: string, name: string) => {
  const m = new RegExp(`${name} text\\[\\] := ARRAY\\[([\\s\\S]*?)\\];`).exec(sql);
  if (!m) throw new Error(`${name} not found`);
  return [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]);
};

function tablesInRepo(): Set<string> {
  const found = new Set<string>();
  const types = read('src/integrations/supabase/types.ts');
  const pub = types.slice(types.indexOf('public: {'));
  const tables = pub.slice(pub.indexOf('Tables: {'), pub.indexOf('Views: {'));
  for (const m of tables.matchAll(/^ {6}([a-z_0-9]+): \{\n {8}Row/gm)) found.add(m[1]);
  for (const f of readdirSync(join(root, 'supabase/migrations')).filter((x) => x.endsWith('.sql'))) {
    for (const m of read(`supabase/migrations/${f}`).matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?\s*\(/gi)) found.add(m[1].toLowerCase());
  }
  for (const d of readdirSync(join(root, 'docs'))) {
    const p = `docs/${d}/proposal.sql`;
    if (!existsSync(join(root, p))) continue;
    for (const m of read(p).matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\."?([a-z_0-9]+)"?/gi)) found.add(m[1].toLowerCase());
  }
  return found;
}

describe('demo read-only coverage', () => {
  it('every table the repo creates is guarded, allowed (with a reason) or known not to be in production', () => {
    const unclassified = [...tablesInRepo()].filter((t) => !guarded.has(t) && !allowed.has(t) && !absent.has(t)).sort();
    expect(unclassified, 'add the table to "guarded" in docs/demo-readonly/tables.json (and a trigger), or to "allowed" with a reason').toEqual([]);
  });

  it('a table is never both guarded and allowed; every allowed table has a reason', () => {
    expect([...guarded].filter((t) => allowed.has(t))).toEqual([]);
    for (const [t, why] of Object.entries(lists.allowed)) expect(why.length, t).toBeGreaterThan(20);
    expect(guarded.size).toBe(133);
    expect(allowed.size).toBe(13);
  });

  it('proposal.sql and check-coverage.sql use exactly the lists in tables.json', () => {
    const proposal = read('docs/demo-readonly/proposal.sql');
    expect(sqlArray(proposal, 'v_guarded')).toEqual(lists.guarded);
    expect(sqlArray(proposal, 'v_allowed').sort()).toEqual([...allowed].sort());
    expect(sqlArray(read('docs/demo-readonly/check-coverage.sql'), 'v_allowed').sort()).toEqual([...allowed].sort());
  });

  it('the guard fails a known gap: a made-up new table is reported', () => {
    const fake = new Set([...tablesInRepo(), 'new_feature_items']);
    expect([...fake].filter((t) => !guarded.has(t) && !allowed.has(t) && !absent.has(t))).toEqual(['new_feature_items']);
  });

});
