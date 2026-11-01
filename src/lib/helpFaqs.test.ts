import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOOL_FAQS } from '@/lib/helpFaqs';
import { CREDITS_PER_DOCUMENT, docTypesFor } from '@/lib/legalDocuments';
import { HISTORY_MAX } from '@/lib/legalHistory';

// Phase 30b: the Help answers about Phases 24-30 say only what the code does.
const answer = (q: string) => TOOL_FAQS.find((f) => f.question === q)!.answer;
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

describe('Help: tools, documents and two-step sign-in', () => {
  it('has the requested questions, each answered in 2 to 4 sentences', () => {
    for (const q of ['Can B2BNEST write contracts for me?', 'How many AI credits does a contract use?', 'Is the generated contract legal advice?',
      'Can I scan the QR codes?', 'Where are my coupons / cash flow entries saved?', 'How do I turn on two-step sign-in?',
      'I lost my phone; how do I get into my account?']) expect(TOOL_FAQS.map((f) => f.question)).toContain(q);
    for (const f of TOOL_FAQS) {
      const sentences = f.answer.replace(/(Settings|Business Tools) →/g, '$1 to').split(/(?<=[.!?])\s+(?=[A-Z"])/).length;
      expect(sentences, f.question).toBeGreaterThanOrEqual(2);
      expect(sentences, f.question).toBeLessThanOrEqual(4);
    }
  });

  it('contracts: written by AI, counts from the catalogue, the function\'s credit cost', () => {
    const c = answer('Can B2BNEST write contracts for me?');
    expect(c).toContain('with AI from the details you type in');
    expect(c).toContain(`There are ${docTypesFor('contract').length} UK contract types`);
    expect(c).toContain(`drafts ${docTypesFor('legal_notice').length} notices`);
    expect(c).toContain('England and Wales unless you choose Scotland or Northern Ireland');
    expect(answer('How many AI credits does a contract use?')).toContain(`uses ${CREDITS_PER_DOCUMENT} AI credits`);
    expect(answer('How many AI credits does a contract use?')).toContain('the credits are given back');
  });

  it('never says a document is legal advice or compliant', () => {
    expect(answer('Is the generated contract legal advice?')).toMatch(/^No\. .*solicitor/);
    const all = TOOL_FAQS.map((f) => f.answer).join(' ');
    expect(all).not.toMatch(/\bcompliant\b|approved|guarantee|legally binding|ready-to-sign/i);
  });

  it('QR codes: real, and every type the generator has is named', () => {
    const qr = answer('Can I scan the QR codes?');
    expect(qr).toContain('makes real QR codes');
    expect(qr).toContain('PNG or SVG');
    expect(read('lib/qrContent.ts')).toContain("export type QrType = 'url' | 'text' | 'email' | 'phone' | 'sms' | 'whatsapp' | 'wifi' | 'vcard';");
    for (const t of ['web address', 'text', 'email', 'phone number', 'SMS', 'WhatsApp', 'Wi-Fi', 'contact card']) expect(qr).toContain(t);
    expect(read('lib/qrContent.ts')).toContain("import QRCode from 'qrcode';");
  });

  it('browser-only storage, two-step sign-in and the lost-phone route', () => {
    expect(answer('Where are my coupons / cash flow entries saved?')).toMatch(/^In this browser only\./);
    expect(answer('Where are my coupons / cash flow entries saved?')).toContain(`The last ${HISTORY_MAX} contracts`);
    expect(answer('How do I turn on two-step sign-in?')).toContain('Settings → Security');
    expect(answer('How do I turn on two-step sign-in?')).toContain('There is no SMS option.');
    expect(answer('I lost my phone; how do I get into my account?')).toContain('contact support@b2bnest.online: a platform administrator checks it is really you');
  });

  it('the labels the answers quote are the ones on screen', () => {
    const setup = read('components/twoStep/TwoStepSetup.tsx');
    expect(setup).toContain("'Set up an authenticator app'");
    expect(setup).toContain('Turn on</Button>');
    expect(read('pages/Settings.tsx')).toContain('<Lock className="h-4 w-4" />Security</TabsTrigger>');
    expect(read('lib/billingView.ts')).toContain(`"You don't have a paid plan yet."`);
    const coupon = read('components/CouponGenerator.tsx');
    for (const t of ['>Generate<', '>Validate<', '>Manage (', '>Import / Export<']) expect(coupon).toContain(t);
    expect(coupon).toContain('localStorage.setItem');
    expect(read('components/CashFlowTracker.tsx')).toContain('localStorage.setItem');
  });

  it('the Help page shows these questions; the guide article uses the real credit cost and history size', () => {
    expect(read('pages/Help.tsx')).toContain('...TOOL_FAQS');
    const guide = read('pages/articles/BusinessToolsGuide.tsx');
    expect(guide).toContain(`Each document uses ${CREDITS_PER_DOCUMENT} AI credits`);
    expect(guide).toContain(`The last ${HISTORY_MAX} documents`);
    expect(guide).not.toContain('ready-to-sign');
    expect(read('pages/articles/FinancialToolsGuide.tsx')).not.toContain('Fixed income and expense categories');
  });
});
