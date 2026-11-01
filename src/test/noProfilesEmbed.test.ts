// Phase 28 guard: organization_members.user_id references auth.users, not public.profiles, so a PostgREST embed
// of profiles through user_id fails with 400 ("no relationship"). Read profiles with a separate query (src/lib/memberProfiles.ts).
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = path.resolve(__dirname, '..');
const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return files(p);
  return /\.(ts|tsx)$/.test(e.name) && !e.name.includes('.test.') ? [p] : [];
});

describe('no profiles:user_id embed', () => {
  it('appears nowhere in src', () => {
    const hits = files(SRC).flatMap((f) => fs.readFileSync(f, 'utf8').split('\n')
      .flatMap((line, i) => (/profiles\s*:\s*user_id/.test(line) ? [`${path.relative(SRC, f)}:${i + 1}`] : [])));
    expect(hits).toEqual([]);
  });
});
