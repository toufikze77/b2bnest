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
  // Phase 11b: support is not a plan feature, and these were never built. Removed from every plan list.
  { what: 'removed plan claim (support / integrations / white-label / account manager / SLA)', re: /priority support|\bemail support\b|mobile app access|custom integrations|custom AI integrations|custom AI model training|white-label|white label AI|dedicated account manager|training (&|and) onboarding|SLA guarantee/i },
  { what: 'advanced automation claim', re: /drag-and-drop interface|Parallel Execution|Email Campaign Automation|retry mechanisms|Real-time workflow monitoring/i, allow: HONEST },
  // Phase 17: the project "automation rules" dialog showed success for rules that never ran.
  { what: 'fake automation success', re: /created and activated|would trigger correctly/i },
  // Phase 18: workflow emails now carry the sender's own Reply-To, so the Phase 17 stop-gap warning is no longer true.
  // Phase 18: there is no free tier (owner decision); every account gets a 14-day trial, then chooses a plan.
  { what: '"free account" / freemium wording', re: /free account|freemium model with extensive free tools|offering free and premium/i },
  // Phase 19 (owner decision 28 Oct 2026): workflows are in Business and Scale (and the trial), not in every plan.
  { what: 'workflows-in-every-plan claim', re: /workflows? (are |is )?(included )?in (all|every) plans?|every plan includes (Workflow|workflows)|Solo (plan )?includes (Workflow|workflows)/i },
  // Phase 20: AI Studio says only what it does (example figures; fixed guidance; no invented impact statistics).
  { what: 'AI Studio overclaim', re: /automate complex workflows|More Relevant Content|Faster Task Completion|Reduced Manual Work|AI personalization settings|full power of AI-driven business automation|Customize your AI experience/i },
  // Phase 21 (owner decision): no promise unless the code does it today. The two-step sign-in line is sign-in copy,
  // left for the owner (lib/twoStep.ts, SecurityGuide.tsx), so it is the one allowed "coming soon".
  { what: '"coming soon" promise', re: /coming soon/i, allow: /Coming soon: we'll tell you|TWO_STEP_COMING_SOON/ },
  { what: 'unbuilt collaboration / payroll / VAT claim', re: /video conferenc|team chat|P45 and P60 generation|Workplace pension compliance|Student loan deductions|Statutory payments \(SSP, SMP, SPP\)<|Flat Rate Scheme support|Reverse charge transactions|Net present value|Internal rate of return|auto-calculates based on your data|Connect your first account|mentioned you|Powered by GPT-4|would be calculated here in production|planned, not available/i, allow: /There is no team chat/ },
  { what: 'uptime / always-on promise', re: /99\.9\d*% uptime|\b24\/7 support|round-the-clock support/i },
  { what: 'stale "replies go to B2BNEST" warning', re: /(repl(y|ies) go(es)? to B2BNEST|reply goes to B2BNEST), not (to )?you/i },
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
const functionFiles = [...sourceFiles(FUNCTIONS), path.resolve(__dirname, '../../index.html'), path.resolve(__dirname, '../../public/llms.txt')];
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

  // Phase 12 (owner decision 27 Oct 2026): no permanent free tier. "Free forever", "free plan" or "no credit card" may only
  // appear on a page that also says the trial ends after 14 days.
  const FREE_TIER = /free forever|free plan|no credit card/i;
  const TRIAL_ENDS = /after 14 days|14-day (free )?trial[^\n]*(ends|then you choose|choose a plan)|trial (has )?ends? after 14 days/i;
  it('no "free forever" / "free plan" / "no credit card" unless the same page says the trial ends after 14 days', () => {
    const hits = [...files, ...functionFiles].flatMap((f) => {
      const text = fs.readFileSync(f, 'utf8');
      if (!FREE_TIER.test(text) || TRIAL_ENDS.test(text)) return [];
      return text.split('\n').flatMap((line, i) => (FREE_TIER.test(line) ? [`${path.relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 120)}`] : []));
    });
    expect(hits).toEqual([]);
  });

  it('the free-tier rule catches a bad page and passes an honest one', () => {
    expect(FREE_TIER.test('Start on our free plan')).toBe(true);
    expect(TRIAL_ENDS.test('Start on our free plan')).toBe(false);
    expect(TRIAL_ENDS.test('No card is needed. After 14 days you choose a plan to continue.')).toBe(true);
  });

  // Phase 12: no star ratings or "Starting at $X/month" style prices for third-party products we can't verify.
  it('no invented ratings or third-party "Starting at" prices', () => {
    const re = /\brating:\s*[1-9](\.\d)?\b|Starting at \$|\b\d\.\d\s*\/\s*5\b|\b(reviewCount|downloads):\s*[1-9]/;
    const hits = [...files, ...functionFiles].flatMap((f) =>
      fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) => (re.test(line) ? [`${path.relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 120)}`] : [])));
    expect(hits).toEqual([]);
  });

  // Phase 13: the trial emails are scanned as files above (supabase/functions/_shared/trial-emails.ts); here their
  // RENDERED text is checked too, since prices and dates are filled in at send time.
  it('rendered trial emails pass every claims rule', async () => {
    const { renderTrialEmail, TRIAL_EMAIL_KINDS } = await import('../../supabase/functions/_shared/trial-emails.ts');
    for (const kind of TRIAL_EMAIL_KINDS) {
      const m = renderTrialEmail({ kind, to: 'a@example.test', firstName: 'Sam', trialEndsAt: '2026-11-01T09:00:00Z', daysLeft: 3, unsubscribeToken: 'c'.repeat(64) });
      const out = `${m.subject}\n${m.text}`;
      for (const { what, re, allow } of BANNED) {
        for (const line of out.split('\n')) expect(re.test(line) && !(allow && allow.test(line)), `${kind}: ${what}: ${line}`).toBe(false);
      }
      expect(FREE_TIER.test(out) && !TRIAL_ENDS.test(out), `${kind}: free-tier wording`).toBe(false);
    }
  });

  // Phase 17: the workflows guide and the workflow FAQ, as customers read them (rendered), pass every rule, and any
  // sentence about starting by itself / schedules / automatic is a "not yet" sentence.
  it('the workflows guide and workflow FAQ pass every claims rule, and never promise automatic starts', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { MemoryRouter } = await import('react-router-dom');
    const { default: WorkflowGuide } = await import('../pages/articles/WorkflowGuide');
    const { WORKFLOW_FAQS } = await import('../lib/workflowGuide');
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(WorkflowGuide)));
    const chunks = [
      ...html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, '').split(/<[^>]+>/).map((t) => t.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim()).filter(Boolean),
      ...WORKFLOW_FAQS.flatMap((f) => [f.question, f.answer]),
    ];
    expect(chunks.join(' ')).toContain('Workflows guide');
    for (const line of chunks) {
      for (const { what, re, allow } of BANNED) expect(re.test(line) && !(allow && allow.test(line)), `${what}: ${line}`).toBe(false);
      expect(FREE_TIER.test(line), `free-tier wording: ${line}`).toBe(false);
      for (const sentence of line.split(/(?<=[.!?])\s+/)) {
        // Questions ("Can workflows start by themselves?") promise nothing; statements must be negative.
        if (!sentence.trim().endsWith('?') && /schedul|automatic|by itself|by themselves|on its own/i.test(sentence)) {
          expect(sentence, `automatic-start promise: ${sentence}`).toMatch(/\bnot\b|\bno\b|\bnothing\b|n't|never|only when|not yet/i);
        }
      }
    }
  });

  // Phase 18: "replies go to your own account email" is only said because the server really sets that Reply-To: the
  // address comes from the authenticated user (replyToAddress), never the request body, and buildMessage writes it.
  it('workflow copy about replies going to the sender is backed by the server code', async () => {
    const fn = (f: string) => fs.readFileSync(path.join(FUNCTIONS, f), 'utf8');
    const request = fn('workflow-send-email/request.ts');
    expect(request).toMatch(/const replyTo = replyToAddress\(user\);/);
    expect(request).toMatch(/\.\.\.\(replyTo \? \{ replyTo \} : \{\}\)/);
    expect(request).not.toMatch(/body\.(replyTo|reply_to|from)\b|body\[["']reply/i);
    expect(fn('workflow-send-email/index.ts')).toMatch(/email_confirmed_at: data\.user\.email_confirmed_at/);
    expect(fn('workflow-send-email/smtp.ts')).toMatch(/`Reply-To: \$\{mail\.replyTo\}`/);
    const { WORKFLOW_FAQS } = await import('../lib/workflowGuide');
    expect(WORKFLOW_FAQS.find((f) => f.question === 'Where do replies go?')!.answer).toMatch(/^To your own account email\./);
  });

  // Phase 15: the Workflow Studio templates are scanned as files above; their text with details filled in is checked too.
  it('Workflow Studio templates pass every claims rule once filled in', async () => {
    const { WORKING_TEMPLATES } = await import('../lib/workflowEmailTemplates');
    const { PLACEHOLDERS, renderTemplate } = await import('../../supabase/functions/_shared/placeholders.ts');
    const values = Object.fromEntries(PLACEHOLDERS.map((p) => [p.key, p.example]));
    for (const t of WORKING_TEMPLATES) {
      for (const step of t.steps) {
        const r = renderTemplate(step, values);
        expect(r.ok, t.id).toBe(true);
        const out = r.ok === true ? `${t.name}\n${t.description}\n${r.subject}\n${r.body}` : '';
        for (const { what, re, allow } of BANNED) {
          for (const line of out.split('\n')) expect(re.test(line) && !(allow && allow.test(line)), `${t.id}: ${what}: ${line}`).toBe(false);
        }
        expect(FREE_TIER.test(out), `${t.id}: free-tier wording`).toBe(false);
      }
    }
  });
});

// Phase 20: the AI Studio honesty labels exist where customers see them, and the AI functions no longer make up a
// "fallback" analysis or silently pick an industry.
describe('AI Studio honesty (Phase 20)', () => {
  const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  it('example-figures and general-guidance labels are shown on the screens', async () => {
    const { EXAMPLE_FIGURES_LABEL, PERSONALIZATION_NOTE } = await import('../lib/aiStudio');
    expect(EXAMPLE_FIGURES_LABEL).toBe('Based on example figures, not your business data');
    expect(PERSONALIZATION_NOTE).toMatch(/aren't written by AI and aren't based on your business data/);
    expect(read('src/components/ai/IntelligentAnalytics.tsx')).toMatch(/EXAMPLE_FIGURES_LABEL/);
    expect(read('src/components/ai/IntelligentAnalytics.tsx')).toMatch(/resultLabel\(/);
    expect(read('src/components/ai/SmartPersonalization.tsx')).toMatch(/PERSONALIZATION_NOTE/);
  });
  it("no silent 'technology' / 'growth' and no fabricated fallback analysis", () => {
    expect(read('src/components/ai/IntelligentAnalytics.tsx')).not.toMatch(/industry: 'technology'|businessStage: 'growth'/);
    const fn = read('supabase/functions/business-insights/handler.ts') + read('supabase/functions/business-insights/index.ts');
    expect(fn).not.toMatch(/Failed to parse AI response|replace\(\/```/);
    expect(fn).toMatch(/response_format: \{ type: "json_object" \}/);
  });
});

// Phase 21: the financial tools guide says only what the finance and payroll screens do.
describe('Financial tools guide (Phase 21)', () => {
  const guide = fs.readFileSync(path.join(ROOT, 'src/pages/articles/FinancialToolsGuide.tsx'), 'utf8');
  it('states the real limits', () => {
    for (const t of [
      'Entries are kept in this browser only (up to 50)', 'Bank accounts are not connected', 'Payback period, NPV and IRR are not calculated',
      "Receipts can't be attached yet", 'The VAT figures in B2BNEST are examples, not your data',
      'Not available yet: pensions, student loans, statutory payments (SSP, SMP, SPP), P45 and P60', "Year-to-date figures aren't included yet",
    ]) expect(guide, t).toContain(t);
  });
  it('makes none of the old unbuilt claims', () => {
    for (const t of ['Connect your bank accounts', 'automatic transaction imports', 'budget limits and alerts', 'Export reports to Excel/PDF',
      'Upload receipt', 'Mark as billable', 'Budget vs. actual', 'Vendor spending analysis', 'Generate payslips (PDF or email)', 'Approve payroll',
      'pensions</li>', 'all categories', 'MTD-enabled business account']) expect(guide, t).not.toContain(t);
  });
});

// Phase 22 (owner decision): Admin shows the customer plan names (Solo, Business, Scale) and never a "Free" tier. No
// string or JSX text in Admin may BE a raw tier name or "Free"/"Paid" as a plan label, and no `|| 'free'` fallbacks.
// Code identifiers and internal filter values ('free' as a value sent to the server) are not labels and are allowed.
describe('Admin plan names (Phase 22)', () => {
  const adminFiles = ['src/pages/admin', 'src/components/admin'].flatMap((d) =>
    fs.readdirSync(path.join(ROOT, d)).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f)).map((f) => path.join(d, f)));
  // Template prices ("Free" template, no credits) are about templates, not account plans.
  const ALLOWED = [/SelectItem value="free">Free<\/SelectItem>/, /plan: 'free',/];
  it('no raw tier name or "Free" as a printed plan label', () => {
    expect(adminFiles.length).toBeGreaterThan(10);
    const hits = adminFiles.flatMap((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').flatMap((line, i) => {
      if (ALLOWED.some((a) => a.test(line))) return [];
      const label = />\s*(Free|FREE|Starter|Professional|Enterprise|Paid)\s*</.test(line)
        || /label[:=]\s*['"{`]+\s*(Free|Starter|Professional|Enterprise)\b/.test(line)
        || /\|\|\s*['"](free|Free|Paid|FREE)['"]/.test(line)
        || /['"](Free Users|Free)['"]\s*[,}]/.test(line);
      return label ? [`${f}:${i + 1}: ${line.trim().slice(0, 120)}`] : [];
    }));
    expect(hits).toEqual([]);
  });
  it('the guard catches the old wording', () => {
    const old = ["<TableCell>{s.plan || 'free'}</TableCell>", "<AdminStatCard label=\"Free\" value={1} />", "{ label: 'Free Users', value: 1 },"];
    const caught = old.filter((line) => /\|\|\s*['"](free|Free|Paid|FREE)['"]/.test(line) || /label[:=]\s*['"{`]+\s*(Free|Starter|Professional|Enterprise)\b/.test(line));
    expect(caught).toHaveLength(3);
  });
});
