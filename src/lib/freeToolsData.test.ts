import { describe, expect, it } from 'vitest';
import { COST_ITEMS, costsCsv, parseAmount, STRUCTURES, totals } from '@/lib/costCalculator';
import { daysUntil, dueText, formatDay, loadGoals, STORAGE_KEY as GOALS_KEY, toDay } from '@/lib/goals';
import { loadSurveys, move, STORAGE_KEY as SURVEYS_KEY, surveyErrors, surveyText, type Survey } from '@/lib/surveys';
import { complianceItems } from '@/lib/compliance';
import { SETUP_STEPS } from '@/lib/setupChecklist';
import { GOV } from '@/data/ukOfficialLinks';
import { FREE_TOOL_IDS, isOpenFreeToolLocation } from '@/lib/freeTools';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('free tools list (Phase 38)', () => {
  it('the seven newly free tools and the five already free', () => {
    expect([...FREE_TOOL_IDS].sort()).toEqual(['best-practices', 'business-resources', 'compliance', 'cost-calculator', 'coupon-generator', 'currency-converter',
      'customer-survey-builder', 'goal-tracker', 'notepro', 'qr-code-generator', 'roi-calculator', 'setup-checklist']);
    expect(isOpenFreeToolLocation('/business-tools', '?tool=roi-calculator')).toBe(true);
    expect(isOpenFreeToolLocation('/business-tools/', '?tool=compliance')).toBe(true);
    expect(isOpenFreeToolLocation('/business-tools', '?tool=business-finance-assistant')).toBe(false);
    expect(isOpenFreeToolLocation('/business-tools', '')).toBe(false);
    expect(isOpenFreeToolLocation('/business-tools', '?tool=notepro')).toBe(false); // saved to the account
    expect(isOpenFreeToolLocation('/crm', '?tool=roi-calculator')).toBe(false);
  });
});

describe('Cost Calculator: UK structures, no invented fees', () => {
  it('sole trader, partnership, limited company and LLP; no US terms; no fee figures in the data', () => {
    expect(STRUCTURES.map((s) => s.label)).toEqual(['Sole trader', 'Partnership', 'Limited company', 'Limited liability partnership (LLP)']);
    const src = fs.readFileSync(path.resolve(__dirname, 'costCalculator.ts'), 'utf8');
    expect(src).not.toMatch(/\bLLC\b|\bEIN\b|\bIRS\b|State Filing|Registered Agent|\$\d/);
    expect(src).not.toMatch(/£\s?\d/); // no fee is written into the calculator
    expect(fs.existsSync(path.resolve(__dirname, '../components/calculator/businessCostsData.ts'))).toBe(false);
    for (const items of Object.values(COST_ITEMS)) for (const it of items.filter((i) => i.required)) expect(it.link, it.name).toMatch(/^https:\/\/www\.gov\.uk\//);
  });
  it('totals what was typed: required always, optional only when included', () => {
    const items = COST_ITEMS.limited_company;
    const t = totals(items, { incorporation: '100', confirmation: '£1,000.50', bank: '20', accountant: 'abc' }, { bank: true, accountant: true });
    expect(t).toEqual({ requiredPence: 110050, optionalPence: 2000, totalPence: 112050, requiredMissing: 1 });
    expect(parseAmount('12.345')).toBe('invalid');
    expect(parseAmount('')).toBeNull();
  });
  it('CSV through the export helper', () => {
    const csv = costsCsv(COST_ITEMS.sole_trader, { sa: '0', bank: '=1+1' }, {});
    expect(csv.split('\r\n')[0]).toBe('Item,Required or optional,Included,Amount (GBP),Official page');
    expect(csv).toContain(`Register for Self Assessment with HMRC,Required,Yes,0,${GOV.soleTrader}`);
    expect(csv).toContain('Business bank account,Optional,No,,');
  });
});

describe('Goal Tracker helpers', () => {
  it('due text in words, by calendar day; dates as 2 Nov 2026', () => {
    expect(formatDay('2026-11-02')).toBe('2 Nov 2026');
    expect(daysUntil('2026-11-10', '2026-11-03')).toBe(7);
    expect(dueText({ targetDate: '2026-11-01', isCompleted: false }, '2026-11-03')).toBe('Overdue by 2 days');
    expect(dueText({ targetDate: '2026-11-02', isCompleted: false }, '2026-11-03')).toBe('Overdue by 1 day');
    expect(dueText({ targetDate: '2026-11-03', isCompleted: false }, '2026-11-03')).toBe('Due today');
    expect(dueText({ targetDate: '2026-11-04', isCompleted: false }, '2026-11-03')).toBe('1 day left');
    expect(dueText({ targetDate: '2026-11-01', isCompleted: true }, '2026-11-03')).toBe('Completed');
    expect(toDay('2026-11-02T00:00:00.000Z')).toMatch(/^2026-11-0[12]$/);
    expect(toDay('rubbish')).toBeNull();
  });
  it('corrupt or old saved goals are handled, not crashing', () => {
    localStorage.setItem(GOALS_KEY, '{oops');
    expect(loadGoals()).toEqual([]);
    localStorage.setItem(GOALS_KEY, JSON.stringify([
      { id: '1', title: 'Old format', targetDate: '2026-12-01', progress: 130, category: 'Nope' },
      { id: '2', title: 'Bad date', targetDate: 'nonsense' }, null, 'x', { id: 3, title: 'bad id' },
    ]));
    expect(loadGoals()).toEqual([{ id: '1', title: 'Old format', description: '', targetDate: '2026-12-01', progress: 100, category: 'Business', isCompleted: true, createdAt: '' }]);
    localStorage.clear();
  });
});

describe('Survey Builder helpers', () => {
  const s: Survey = { id: 's', title: 'After purchase', description: 'Two minutes', updatedAt: '', questions: [
    { id: 'a', type: 'rating', question: 'How did we do?', options: [], required: true },
    { id: 'b', type: 'multiple-choice', question: 'Where did you hear of us?', options: ['Search', 'A friend', ''], required: false },
  ] };
  it('reorder, errors, plain text', () => {
    expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(surveyErrors({ title: ' ', questions: [{ id: 'x', type: 'multiple-choice', question: '', options: ['one'], required: false }] }))
      .toEqual(['Give the survey a title.', 'Question 1 has no text.', 'Question 1 needs at least two options.']);
    expect(surveyText(s)).toBe('After purchase\nTwo minutes\n\n1. How did we do? (required)\n   1  2  3  4  5\n\n2. Where did you hear of us?\n   - Search\n   - A friend\n');
  });
  it('corrupt storage is ignored', () => {
    localStorage.setItem(SURVEYS_KEY, 'nope');
    expect(loadSurveys()).toEqual([]);
    localStorage.setItem(SURVEYS_KEY, JSON.stringify([s, { id: 'z' }, { id: 'y', title: 't', questions: [{ id: 'q', type: 'video', question: 'x' }] }]));
    expect(loadSurveys().map((x) => [x.id, x.questions.length])).toEqual([['s', 2], ['y', 0]]);
    localStorage.clear();
  });
});

describe('Setup Checklist and Compliance Checker: UK only, official sources', () => {
  it('no US wording; links go to GOV.UK', () => {
    for (const f of ['../components/BusinessSetupChecklist.tsx', '../components/ComplianceChecker.tsx', '../components/BestPracticesGuide.tsx']) {
      const src = fs.readFileSync(path.resolve(__dirname, f), 'utf8');
      expect(src, f).not.toMatch(/\bEIN\b|\bIRS\b|\bLLC\b|I-9|Workers' Compensation|California|Texas|\$\d|legally-sound|proven strategies/);
    }
    for (const s of SETUP_STEPS.filter((x) => x.link)) expect(s.link!.url).toMatch(/^https:\/\/www\.gov\.uk\//);
    expect(SETUP_STEPS.map((s) => s.id)).toEqual(expect.arrayContaining(['hmrc', 'companies-house', 'bank', 'insurance', 'data']));
  });
  it('compliance items depend on the answers, and every item has an official source', () => {
    expect(complianceItems({ structure: '', employs: '', personalData: '', vatTurnover: '' })).toEqual([]);
    const all = complianceItems({ structure: 'limited_company', employs: 'yes', personalData: 'yes', vatTurnover: 'yes' });
    expect(all.map((i) => i.id)).toEqual(['ch', 'records', 'vat', 'mtd', 'employing', 'paye', 'nmw', 'pensions', 'data']);
    for (const i of all) expect(Object.values(GOV)).toContain(i.source.url);
    expect(complianceItems({ structure: 'sole_trader', employs: 'no', personalData: 'no', vatTurnover: 'no' }).map((i) => i.id)).toEqual(['sa']);
  });
});
