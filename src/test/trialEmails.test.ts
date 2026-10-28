import { describe, expect, it } from 'vitest';
import { PLANS } from '@/lib/plans';
import { COMPANY, LINKS, planLines, renderTrialEmail, SITE_URL, TRIAL_EMAIL_KINDS, type TrialEmailKind } from '../../supabase/functions/_shared/trial-emails.ts';

// Phase 13: the three trial emails (supabase/functions/_shared/trial-emails.ts).
const TOKEN = 'b'.repeat(64);
const render = (kind: TrialEmailKind, over: Record<string, unknown> = {}) =>
  renderTrialEmail({ kind, to: 'person@example.test', firstName: 'Sam', trialEndsAt: '2026-11-01T09:00:00Z', daysLeft: 3, unsubscribeToken: TOKEN, ...over });
const all = () => TRIAL_EMAIL_KINDS.map((k) => [k, render(k)] as const);
const linksIn = (s: string) => [...s.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0].replace(/[.,]$/, ''));

describe('trial emails: prices come from the one catalogue', () => {
  it('"has ended" lists every plan with today\'s price from src/lib/plans.ts, in order', () => {
    const { text, html } = render('ended');
    for (const p of PLANS) {
      const line = `${p.name}: £${p.monthly} a month or £${p.annual} a year`;
      expect(text).toContain(line);
      expect(html).toContain(line);
    }
    expect(planLines()).toEqual(PLANS.map((p) => `${p.name}: £${p.monthly} a month or £${p.annual} a year`));
  });

  it('no other price appears in any email', () => {
    const allowed = new Set(PLANS.flatMap((p) => [`£${p.monthly}`, `£${p.annual}`]));
    for (const [, m] of all()) for (const price of `${m.text} ${m.html}`.match(/£\d+(\.\d+)?/g) ?? []) expect(allowed.has(price), price).toBe(true);
  });
});

describe('trial emails: links', () => {
  it('every link in every email is well-formed, on the production site, with no tracking parameters', () => {
    expect(SITE_URL).toBe('https://www.b2bnest.online');
    for (const [kind, m] of all()) {
      const links = [...linksIn(m.text), ...linksIn(m.html)];
      expect(links.length, kind).toBeGreaterThan(2);
      for (const l of links) {
        const u = new URL(l);
        expect(`${u.protocol}//${u.host}`, l).toBe(SITE_URL);
        expect(l, l).not.toMatch(/utm_|[?&](ref|source|campaign)=/i);
        if (u.searchParams.size) expect([...u.searchParams.keys()], l).toEqual(['token']);
      }
    }
  });

  it('each email has the Pricing link, the contact link and its own unsubscribe link', () => {
    for (const [kind, m] of all()) {
      expect(m.text, kind).toContain(LINKS.pricing);
      expect(m.text, kind).toContain(LINKS.contact);
      expect(m.unsubscribeUrl).toBe(`${SITE_URL}/unsubscribe?token=${TOKEN}`);
      expect(m.text).toContain(m.unsubscribeUrl);
      expect(m.html).toContain(`href="${m.unsubscribeUrl}"`);
    }
  });
});

describe('trial emails: honest copy', () => {
  it('subjects', () => {
    expect(render('ending_soon').subject).toBe('Your B2BNEST trial ends in 3 days');
    expect(render('ending_soon', { daysLeft: 1 }).subject).toBe('Your B2BNEST trial ends tomorrow');
    expect(render('ended').subject).toBe('Your B2BNEST trial has ended');
    expect(render('follow_up').subject).toBe('Your B2BNEST information is still here');
  });

  it('email 1: the date, what happens at the end, nothing deleted, no card needed', () => {
    const { text } = render('ending_soon');
    expect(text).toContain('Sunday 1 November 2026, in 3 days');
    expect(text).toContain('After that, you choose a plan to keep using B2BNEST.');
    expect(text).toContain('Nothing is deleted when the trial ends.');
    expect(text).toContain("You didn't need a card to try B2BNEST");
  });

  it('email 3: short, one link to plans, one line on getting help, no discount', () => {
    const { text } = render('follow_up');
    expect(linksIn(text.split('\n-- \n')[0]).filter((l) => l === LINKS.pricing)).toHaveLength(1);
    expect(text).toMatch(/contact us/i);
    expect(text.split('\n-- \n')[0].length).toBeLessThan(600);
  });

  it('every email: sent-to line, why, the three-email limit, unsubscribe, company details', () => {
    for (const [kind, m] of all()) {
      expect(m.text, kind).toContain('This email was sent to person@example.test because you started a free trial of B2BNEST.');
      expect(m.text).toContain('We send at most three emails about your trial.');
      expect(m.text).toContain('Unsubscribe with one click');
      expect(m.text).toContain(`${COMPANY.legalName} (Company No. ${COMPANY.companyNumber}), trading as B2BNEST. Registered office: ${COMPANY.registeredOffice}.`);
    }
  });

  it('company details match the legal pages (nothing invented)', async () => {
    const fs = await import('node:fs');
    const privacy = fs.readFileSync('src/pages/PrivacyPolicy.tsx', 'utf8');
    expect(privacy).toContain(`${COMPANY.legalName}</strong> (Company No. ${COMPANY.companyNumber})`);
    expect(privacy).toContain(`Registered office: ${COMPANY.registeredOffice}`);
  });

  it('no fake urgency, countdown pressure, discounts or scarcity', () => {
    const PRESSURE = /hurry|last chance|act now|don'?t miss|only \d+ (left|spots)|limited (time|offer)|expires? (soon|today)|today only|\d+% off|discount|free gift|before it'?s too late|!{2,}|⏰|🔥/i;
    for (const [kind, m] of all()) {
      expect(m.text, kind).not.toMatch(PRESSURE);
      expect(m.subject, kind).not.toMatch(/!/);
    }
  });

  it('names and addresses are escaped in the HTML', () => {
    const m = render('ended', { firstName: '<script>x</script>', to: 'a"b@example.test' });
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;');
  });

  it('brand colours and the original logo only', () => {
    for (const [, m] of all()) {
      expect(m.html).toContain('#001A4C');
      expect(m.html).toContain('#0069FF');
      expect(m.html).toContain(`${SITE_URL}/brand/png/b2bnest-wordmark-color-600w.png`);
      expect([...m.html.matchAll(/<img /g)]).toHaveLength(1);
    }
  });
});
