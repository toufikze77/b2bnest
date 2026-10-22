import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// .env.production and .env.development are committed. They may only ever hold the two PUBLIC browser settings; this
// fails if anything else (a secret, a service-role key, an SMTP or OAuth value) is added to either.
// .env.development exists because Lovable's preview runs the dev server (development mode), which never reads
// .env.production; without it Lovable showed "B2BNEST can't start".
const read = (name: string) => fs.readFileSync(path.resolve(__dirname, '../../' + name), 'utf8');
const parse = (file: string) => file
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] as const;
  });

describe.each(['.env.production', '.env.development'])('%s (committed public build settings)', (name) => {
  const file = read(name);
  const entries = parse(file);
  const env = Object.fromEntries(entries);

  it('starts with the public-settings warning', () => {
    expect(file.split('\n')[0]).toBe('# Public browser settings only. Never put secrets in this file.');
  });

  it('contains exactly VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY and nothing else', () => {
    expect(entries.map(([k]) => k)).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']);
  });

  it('the URL is a Supabase project URL', () => {
    expect(env.VITE_SUPABASE_URL).toMatch(/^https:\/\/[a-z0-9]{20}\.supabase\.co$/);
  });

  it('the key is a publishable key, never a secret or service-role key', () => {
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
    expect(key).toMatch(/^sb_publishable_[A-Za-z0-9_-]+$/);
    expect(key).not.toMatch(/^sb_secret_/);
    expect(key).not.toMatch(/^eyJ/); // no JWTs at all (a service-role key is a JWT)
  });
});

describe('.env.development', () => {
  it('holds exactly the same public values as .env.production', () => {
    expect(read('.env.development')).toBe(read('.env.production'));
  });
});
