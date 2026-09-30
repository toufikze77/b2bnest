import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// The server keeps a copy of the schema (Deno imports). This fails if the two drift.
const body = (s: string) => s.slice(s.indexOf('export const AI_TEMPLATE_SCHEMA_VERSION'), s.indexOf('const COLORS') > 0 ? s.indexOf('const COLORS') : undefined).trim();
describe('schema copy', () => {
  it('server schema matches app schema', () => {
    const app = readFileSync('src/lib/aiTemplateSchema.ts', 'utf8');
    const srv = readFileSync('supabase/functions/generate-template/schema.ts', 'utf8');
    expect(body(srv)).toBe(body(app));
  });
});
