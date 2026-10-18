import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Fails the build if invented claims or fake-connection code come back into src.
const SRC = path.resolve(__dirname, '..');
const SELF = path.resolve(__filename);

const BANNED: { what: string; re: RegExp }[] = [
  { what: 'fake integration token', re: /placeholder_token/i },
  { what: 'invented customer count', re: /Happy Customers/ },
  { what: 'invented satisfaction figure', re: /Customer Satisfaction/ },
  { what: 'invented testimonial / author name', re: /Sarah Johnson/i },
  { what: 'certification claim', re: /\bSOC ?2\b|\bHIPAA\b|ISO 27001|PCI[- ]DSS|GDPR[- ]compliant/i },
  { what: '"trusted by" claim', re: /trusted by/i },
  { what: 'cryptocurrency positioning', re: /cryptocurrenc|bitcoin|blockchain/i },
];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : sourceFiles(p);
    return /\.(tsx?|jsx?|css|html|json)$/.test(e.name) && p !== SELF ? [p] : [];
  });
}

// The generated Supabase types mirror the database (table and column names), not product copy.
const files = sourceFiles(SRC).filter((f) => !f.endsWith(path.join('integrations', 'supabase', 'types.ts')));

describe('no invented claims in src', () => {
  it('scans a real number of files', () => {
    expect(files.length).toBeGreaterThan(300);
  });

  for (const { what, re } of BANNED) {
    it(`no ${what} (${re})`, () => {
      const hits = files.flatMap((f) =>
        fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) => (re.test(line) ? [`${path.relative(SRC, f)}:${i + 1}: ${line.trim().slice(0, 120)}`] : [])),
      );
      expect(hits).toEqual([]);
    });
  }
});
