import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Phase 12b: owner access comes only from the server (my_access_state(): owner role or a master account switched on
// in the Admin portal). No personal email may be hard-coded in the app. Tests and docs may mention them.
const SRC = path.resolve(__dirname, '..');
const OWNER_EMAILS = /toufikze@gmail\.com|toufik\.zemri@outlook\.com/i;
const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return e.name === 'test' ? [] : files(p);
  return /\.(tsx?|jsx?|json|css|html)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
});

describe('no hard-coded owner emails in src', () => {
  it('scans the app', () => expect(files(SRC).length).toBeGreaterThan(300));

  it('neither owner email appears outside tests and docs', () => {
    const hits = files(SRC).filter((f) => OWNER_EMAILS.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(SRC, f));
    expect(hits).toEqual([]);
  });

  it('the pattern catches either email in any case', () => {
    expect(OWNER_EMAILS.test("const x = ['Toufikze@Gmail.com']")).toBe(true);
    expect(OWNER_EMAILS.test('toufik.zemri@outlook.com')).toBe(true);
    expect(OWNER_EMAILS.test('someone@else.test')).toBe(false);
  });
});
