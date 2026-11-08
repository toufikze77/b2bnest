import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The owner has no appointed data protection officer, no documented audit programme and no formal impact assessments,
// and info@b2bnest.online is the only confirmed mailbox. HMRC reviews our public claims, so these must not come back
// into the Security Guide or any page's copy.
const PAGES = path.resolve(__dirname, '../pages');
const GUIDE = path.join(PAGES, 'articles', 'SecurityGuide.tsx');

function pageFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return pageFiles(p);
    return /\.(tsx?|jsx?)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const RULES: { what: string; re: RegExp }[] = [
  { what: 'data protection officer claim', re: /Data Protection Officer|\bDPO\b|dpo@b2bnest/i },
  { what: 'unconfirmed privacy mailbox', re: /privacy@b2bnest/i },
  { what: 'unproven compliance programme', re: /compliance audits|privacy impact assessments? conducted|data processing agreements with third parties/i },
];

describe('no unproven privacy or compliance claims in the pages', () => {
  const files = pageFiles(PAGES);
  it('scans the pages, including the Security Guide', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain(GUIDE);
  });

  for (const { what, re } of RULES) {
    it(`no ${what} (${re})`, () => {
      const hits = files.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) =>
        (re.test(line) ? [`${path.relative(PAGES, f)}:${i + 1}: ${line.trim().slice(0, 120)}`] : [])));
      expect(hits).toEqual([]);
    });
  }

  it('the Security Guide sends data requests to info@b2bnest.online and promises one month, not self-service', () => {
    const text = fs.readFileSync(GUIDE, 'utf8');
    expect(text).toContain('email info@b2bnest.online with your request');
    expect(text).toContain('Questions about your data? Email info@b2bnest.online.');
    expect(text).toContain('We respond within one month');
    expect(text).not.toMatch(/Export all data|Access your data at any time|respond within 30 days/);
  });

  // HMRC P7b: retention periods are the Privacy Policy's job; the article made unproven "30 days" / "90 days" claims.
  it('the Security Guide states no retention period of its own (no "30 days" or "90 days")', () => {
    const text = fs.readFileSync(GUIDE, 'utf8');
    expect(text).not.toMatch(/\b(30|90|thirty|ninety)[\s-]days?\b/i);
    expect(text).toContain('We keep data only as long as needed to run the service and meet legal requirements, as set out in our Privacy Policy.');
    expect(text).toContain('For anything else, or if that isn\'t available to you, email info@b2bnest.online with your request');
  });
});
