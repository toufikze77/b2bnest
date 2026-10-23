import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Fails the build if invented claims or fake-connection code come back into src or into the Edge Function prompts
// (supabase/functions), which the AI assistant repeats to customers.
const SRC = path.resolve(__dirname, '..');
const FUNCTIONS = path.resolve(__dirname, '../../supabase/functions');
const SELF = path.resolve(__filename);

// `allow`: a line that also matches it is honest wording about the same topic (e.g. "not available yet").
const HONEST = /there is no|not available|not active|not enforced|not built|preview|yourself|isn't|aren't|no longer|removed|simulated|switched off/i;
const BANNED: { what: string; re: RegExp; allow?: RegExp }[] = [
  { what: 'fake integration token', re: /placeholder_token/i },
  { what: 'invented customer count', re: /Happy Customers/ },
  { what: 'invented satisfaction figure', re: /Customer Satisfaction/ },
  { what: 'invented testimonial / author name', re: /Sarah Johnson/i },
  { what: 'certification claim', re: /\bSOC ?2\b|\bHIPAA\b|ISO 27001|PCI[- ]DSS|GDPR[- ]compliant/i },
  { what: '"trusted by" claim', re: /trusted by/i },
  { what: 'cryptocurrency positioning', re: /cryptocurrenc|bitcoin|blockchain/i },
  // A bare feature-list bullet (the old assistant prompt); article titles about GDPR rights are fine.
  { what: 'GDPR compliance claim', re: /^\s*-\s*GDPR compliance\s*$/i },
  { what: 'two-factor sign-in claim', re: /Two-factor authentication \(2FA\)/i, allow: HONEST },
  { what: 'HMRC filing claim', re: /submit\w* (VAT|PAYE|payroll|RTI)\b|file corporation tax|VAT submission|(PAYE|NI) submissions? to HMRC|RTI (reporting|submissions)|Corporation Tax filing/i, allow: HONEST },
  // Task titles such as "Schedule posts and emails" in templates are the user's own to-dos, not a product claim.
  { what: 'social post scheduling claim', re: /schedul\w* (and post )?tweets|schedul\w* (LinkedIn|Facebook) posts|schedule posts to|post scheduling|scheduled posts/i, allow: HONEST },
  { what: 'advanced automation claim', re: /drag-and-drop interface|Parallel Execution|Email Campaign Automation|retry mechanisms|Real-time workflow monitoring/i, allow: HONEST },
];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : sourceFiles(p);
    return /\.(tsx?|jsx?|css|html|json)$/.test(e.name) && p !== SELF && !/_test\.ts$|\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

// The generated Supabase types mirror the database (table and column names), not product copy.
// Test files may quote the banned phrases to check they are gone.
const files = sourceFiles(SRC).filter((f) => !f.endsWith(path.join('integrations', 'supabase', 'types.ts')));
const functionFiles = sourceFiles(FUNCTIONS);
const ROOT = path.resolve(__dirname, '../..');

describe('no invented claims in src or supabase/functions', () => {
  it('scans a real number of files', () => {
    expect(files.length).toBeGreaterThan(300);
    expect(functionFiles.length).toBeGreaterThan(50);
  });

  for (const { what, re, allow } of BANNED) {
    it(`no ${what} (${re})`, () => {
      const hits = [...files, ...functionFiles].flatMap((f) =>
        fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) =>
          (re.test(line) && !(allow && allow.test(line)) ? [`${path.relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 120)}`] : [])),
      );
      expect(hits).toEqual([]);
    });
  }
});
