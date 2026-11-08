import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// HMRC P7a: HMRC's terms allow software to be described as "HMRC recognised" only once HMRC lists it, and never as
// "approved", "accredited" or "certified". B2BNEST is sandbox only, so no approval, recognition or readiness claim may
// appear in app copy, Edge Function copy (emails, prompts), the AI assistant's knowledge, index.html or llms.txt.
const ROOT = path.resolve(__dirname, '../..');
const SELF = path.resolve(__filename);
const KNOWLEDGE = path.join(ROOT, 'supabase/functions/ai-assistant/knowledge.ts');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : sourceFiles(p);
    return /\.(tsx?|jsx?|html|json|txt)$/.test(e.name) && p !== SELF && !/_test\.ts$|\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const files = [
  ...sourceFiles(path.join(ROOT, 'src')).filter((f) => !f.endsWith(path.join('integrations', 'supabase', 'types.ts'))),
  ...sourceFiles(path.join(ROOT, 'supabase/functions')),
  path.join(ROOT, 'index.html'),
  path.join(ROOT, 'public/llms.txt'),
];

// A line that also matches this is an instruction or a plain negation ("Never say B2BNEST is ready for MTD").
const NEGATION = /never say|never call|never claim|don't (say|claim|call)|do not (say|claim|call)|\bis not\b|isn't|not (yet )?(approved|recogni[sz]ed|accredited|certified|ready)|no certifications/i;

const APPROVAL_CLAIMS: { what: string; re: RegExp }[] = [
  { what: 'HMRC approval / recognition / readiness', re: /HMRC[- ](approved|accredited|certified|recogni[sz]ed|ready|compliant|endorsed)/i },
  { what: 'approved / recognised by HMRC', re: /(approved|accredited|certified|recogni[sz]ed|endorsed|authori[sz]ed) by HMRC/i },
  { what: 'MTD readiness or approval', re: /(MTD|Making Tax Digital)[- ](ready|compliant|compatible|approved|accredited|certified|recogni[sz]ed)/i },
  { what: 'ready for MTD', re: /ready for (MTD|Making Tax Digital)/i },
  { what: 'accredited / certified claim', re: /\b(accredited|certified)\b/i },
];

function hits(re: RegExp, list: string[]) {
  return list.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) =>
    (re.test(line) && !NEGATION.test(line) ? [`${path.relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 120)}`] : [])));
}

describe('HMRC P7a: no approval, accreditation or readiness claims', () => {
  it('scans the app, the Edge Functions and the assistant knowledge', () => {
    expect(files.length).toBeGreaterThan(300);
    expect(files).toContain(KNOWLEDGE);
  });

  for (const { what, re } of APPROVAL_CLAIMS) {
    it(`no ${what} (${re})`, () => {
      expect(hits(re, files)).toEqual([]);
    });
  }

  it('the rules catch bad wording and let honest negations through', () => {
    const bad = ['HMRC-approved software', 'Recognised by HMRC', 'MTD-ready VAT returns', 'Fully ready for Making Tax Digital', 'An accredited provider', 'HMRC-ready workflows'];
    for (const line of bad) expect(APPROVAL_CLAIMS.some(({ re }) => re.test(line)) && !NEGATION.test(line), line).toBe(true);
    const ok = ['Never say B2BNEST is ready for Making Tax Digital.', 'B2BNEST is not approved by HMRC.', 'Request approved.'];
    for (const line of ok) expect(APPROVAL_CLAIMS.some(({ re }) => re.test(line)) && !NEGATION.test(line), line).toBe(false);
  });
});
