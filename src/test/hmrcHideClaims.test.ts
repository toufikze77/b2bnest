// HMRC hide switch: until HMRC approves production, customer-facing copy must not say or imply that B2BNEST already
// files VAT with HMRC, is MTD compatible, or is HMRC approved or recognised. The one list is HMRC_FILING_CLAIMS below;
// it switches off only when HMRC_PRODUCTION_APPROVED (src/lib/hmrcAccess.ts) becomes true.
// A line that also says "never", "not" or "isn't" is honest wording about the same topic (for example the assistant's
// "Never say B2BNEST files VAT returns with HMRC for real").
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HMRC_PRODUCTION_APPROVED } from '@/lib/hmrcAccess';

export const HMRC_FILING_CLAIMS: { what: string; re: RegExp }[] = [
  { what: 'HMRC approval', re: /\bHMRC[- ](approved|accredited|certified)\b/i },
  { what: 'HMRC recognition', re: /\bHMRC[- ]recogni[sz]ed\b/i },
  { what: 'MTD compatible', re: /\b(MTD|Making Tax Digital)[- ](compatible|compliant|ready|approved)\b/i },
  { what: 'ready for MTD', re: /\bready for (MTD|Making Tax Digital)\b/i },
  { what: 'files your VAT return', re: /\bfiles? your VAT returns?\b/i },
  { what: 'we file or submit VAT returns', re: /\b(we|B2BNEST) (file|files|submit|submits|send|sends) (your )?VAT returns? (to|with) HMRC\b/i },
];

const ROOT = path.resolve(__dirname, '../..');
const NEGATED = /\b(never|not|isn't|n't|no)\b/i;
function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : files(p);
    return /\.(tsx?|jsx?|html|txt|md)$/.test(e.name) && !/(\.test\.|_test\.)/.test(e.name) ? [p] : [];
  });
}
// What a customer can read: the app, public files, the assistant's knowledge and the email templates in the repo.
const SCOPE = [
  ...files(path.join(ROOT, 'src')).filter((f) => !f.includes(`${path.sep}test${path.sep}`)),
  ...files(path.join(ROOT, 'public')),
  ...['index.html', 'llms.txt', 'public/llms.txt'].map((f) => path.join(ROOT, f)).filter((f) => fs.existsSync(f)),
  ...files(path.join(ROOT, 'supabase/functions/ai-assistant')),
  ...files(path.join(ROOT, 'supabase/functions/_shared')).filter((f) => /email|template/i.test(f)),
  ...['trial-email-sender', 'onboarding-email-sender', 'support-email-sender'].flatMap((d) => files(path.join(ROOT, 'supabase/functions', d))),
];

describe('no HMRC filing, MTD or approval claims while production is not approved', () => {
  it('scans the customer-facing copy', () => {
    expect(SCOPE.length).toBeGreaterThan(200);
    expect(HMRC_PRODUCTION_APPROVED).toBe(false);
  });
  for (const { what, re } of HMRC_FILING_CLAIMS) {
    it(`no "${what}" claim (${re})`, () => {
      if (HMRC_PRODUCTION_APPROVED) return;
      const hits = SCOPE.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) =>
        (re.test(line) && !NEGATED.test(line) ? [`${path.relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 120)}`] : [])));
      expect(hits).toEqual([]);
    });
  }
  it('the guard catches what it should', () => {
    const caught = (s: string) => HMRC_FILING_CLAIMS.some(({ re }) => re.test(s));
    for (const s of ['HMRC approved software', 'HMRC-recognised', 'MTD compatible', 'Making Tax Digital ready', 'B2BNEST files your VAT return', 'We submit VAT returns to HMRC'])
      expect(caught(s), s).toBe(true);
    for (const s of ['File VAT returns with HMRC on time to avoid penalties', 'Preview VAT return figures. HMRC filing is not available yet.'])
      expect(caught(s) && !NEGATED.test(s), s).toBe(false);
  });
});
