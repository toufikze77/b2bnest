// HMRC P7b: a new table can't silently miss "Download my data" / "Download company data". Every table the repo knows
// (the generated types, and every docs/*/proposal.sql) that has user_id, organization_id or company_id must be exported
// (supabase/functions/_shared/data-rights/tables.ts) or listed in NOT_EXPORTED with a reason.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_TABLES, COMPANY_CHILD_TABLES, COMPANY_TABLES, exportedTables, NOT_EXPORTED, SENSITIVE_COLUMN,
} from '../../supabase/functions/_shared/data-rights/tables';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const KEYS = ['user_id', 'organization_id', 'company_id'];

/** table -> its columns, from the generated types and from every proposal's CREATE TABLE. */
function knownTables(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (t: string, cols: string[]) => { const s = out.get(t) ?? new Set<string>(); cols.forEach((c) => s.add(c)); out.set(t, s); };
  const types = read('src/integrations/supabase/types.ts');
  const pub = types.slice(types.indexOf('public: {'));
  const tables = pub.slice(pub.indexOf('Tables: {'), pub.indexOf('Views: {'));
  for (const m of tables.matchAll(/^ {6}([a-z_0-9]+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/gm)) {
    add(m[1], [...m[2].matchAll(/^ {10}([a-z_0-9]+)\??:/gm)].map((x) => x[1]));
  }
  for (const d of readdirSync(join(root, 'docs'))) {
    const p = `docs/${d}/proposal.sql`;
    if (!existsSync(join(root, p))) continue;
    // A CREATE TABLE body has no ';' of its own, so it ends at the first one (some tables are written on one line).
    for (const m of read(p).matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\."?([a-z_0-9]+)"?\s*\(([^;]*)\)\s*;/gi)) {
      add(m[1].toLowerCase(), [...m[2].matchAll(/(?:^|[(,\n])\s*"?([a-z_0-9]+)"?\s+(?:uuid|text|bigint|integer|jsonb|boolean|date|timestamptz|numeric)\b/gi)].map((x) => x[1].toLowerCase()));
    }
  }
  return out;
}

const unclassified = (known: Map<string, Set<string>>, exported: Set<string>, excluded: Set<string>) =>
  [...known].filter(([t, cols]) => KEYS.some((k) => cols.has(k)) && !exported.has(t) && !excluded.has(t)).map(([t]) => t).sort();

describe('data export coverage', () => {
  const known = knownTables();
  const exported = exportedTables();
  const excluded = new Set(Object.keys(NOT_EXPORTED));

  it('reads a real number of tables, including the newest ones', () => {
    expect(known.size).toBeGreaterThan(140);
    expect(known.get('hmrc_vat_submissions')?.has('organization_id')).toBe(true);
    expect(known.get('data_rights_requests')?.has('user_id')).toBe(true);
  });

  it('every table with user_id, organization_id or company_id is exported or excluded with a reason', () => {
    expect(unclassified(known, exported, excluded), 'add it to ACCOUNT_TABLES / COMPANY_TABLES in _shared/data-rights/tables.ts, or to NOT_EXPORTED with a reason').toEqual([]);
  });

  it('the guard catches a gap: a made-up new table is reported', () => {
    const plus = new Map(known).set('zz_new_customer_notes', new Set(['id', 'user_id', 'note']));
    expect(unclassified(plus, exported, excluded)).toEqual(['zz_new_customer_notes']);
  });

  it('no table is both exported and excluded; every exclusion has a real reason; no stale names', () => {
    expect([...exported].filter((t) => excluded.has(t))).toEqual([]);
    for (const [t, why] of Object.entries(NOT_EXPORTED)) expect(why.length, t).toBeGreaterThan(30);
    expect([...exported, ...excluded].filter((t) => !known.has(t)), 'names in tables.ts that no table has').toEqual([]);
  });

  it('every filter column exists on its table', () => {
    for (const t of ACCOUNT_TABLES) {
      expect(known.get(t.table)?.has(t.by), `${t.table}.${t.by}`).toBe(true);
      if (t.personalOnly) expect(known.get(t.table)?.has(t.personalOnly), `${t.table}.${t.personalOnly}`).toBe(true);
    }
    for (const t of COMPANY_TABLES) expect(known.get(t.table)?.has(t.by), `${t.table}.${t.by}`).toBe(true);
    for (const c of COMPANY_CHILD_TABLES) expect(known.get(c.table)?.has(c.fk), `${c.table}.${c.fk}`).toBe(true);
  });

  it('no secret column can leave: every token, secret or password column the repo knows is caught', () => {
    const risky = [...known].flatMap(([t, cols]) => [...cols].filter((c) => /token|secret|password|api_?key|_enc$|totp/i.test(c)).map((c) => `${t}.${c}`));
    expect(risky.length).toBeGreaterThan(5);
    const allowed = new Set(['ai_credit_ledger.prompt_tokens', 'ai_credit_ledger.completion_tokens', 'hmrc_integrations.token_type', 'user_integrations.token_type',
      'integration_settings.token_type', 'support_settings.token_type']);
    const leaks = risky.filter((tc) => !allowed.has(tc) && !SENSITIVE_COLUMN.test(tc.split('.')[1]));
    expect(leaks, 'a token, secret or password column SENSITIVE_COLUMN does not catch').toEqual([]);
    const conn = COMPANY_TABLES.find((t) => t.table === 'hmrc_connections');
    expect(conn?.select?.split(',').some((c) => SENSITIVE_COLUMN.test(c))).toBe(false);
  });
});
