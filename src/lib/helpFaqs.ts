// Phase 30b: Help questions about Phases 24-30. Counts, credits and wording come from the code they describe (the
// generate-legal-document catalogue, CREDITS_PER_DOCUMENT, the two-step texts), so helpFaqs.test.ts can hold them to it.
import { CREDITS_PER_DOCUMENT, docTypesFor, JURISDICTIONS } from '@/lib/legalDocuments';
import { HISTORY_MAX } from '@/lib/legalHistory';
import { TWO_STEP_APPS } from '@/lib/twoStep';

export interface Faq { question: string; answer: string }

const [defaultLaw, ...otherLaws] = JURISDICTIONS.map((j) => j.label);

export const TOOL_FAQS: Faq[] = [
  {
    question: 'Can B2BNEST write contracts for me?',
    answer: `Yes. Business Tools → Contract Generator drafts a contract with AI from the details you type in, under the law of ${defaultLaw} unless you choose ${otherLaws.join(' or ')}. There are ${docTypesFor('contract').length} UK contract types, such as a service agreement, an employment contract or an NDA, and the Privacy & Legal Notices Generator drafts ${docTypesFor('legal_notice').length} notices, such as a website privacy policy or a cookie policy. Anything you leave out appears as a [placeholder] for you to fill in.`,
  },
  {
    question: 'How many AI credits does a contract use?',
    answer: `Each contract or legal notice uses ${CREDITS_PER_DOCUMENT} AI credits from your monthly allowance. If the AI fails or doesn't produce a usable document, the credits are given back. Your remaining credits are shown after each document.`,
  },
  {
    question: 'Is the generated contract legal advice?',
    answer: `No. It is a draft written by AI from the details you give, and no lawyer has checked it. Have a qualified solicitor check it before you rely on it. You can edit it, copy it, or download it as PDF, Word or Markdown first.`,
  },
  {
    question: 'Can I scan the QR codes?',
    answer: 'Yes. The QR Code Generator makes real QR codes that phone cameras and QR apps can scan, for a web address, text, email, phone number, SMS, WhatsApp message, Wi-Fi network or contact card. You can download them as PNG or SVG, and they are created in your browser.',
  },
  {
    question: 'Where are my coupons / cash flow entries saved?',
    answer: `In this browser only. Create Coupon and the Cash Flow Tracker keep their data in this browser on this device, not on B2BNEST's servers, so it doesn't appear on your other devices or for your team, and clearing your browser data deletes it. Use Import / Export (CSV) in Create Coupon to keep a copy. The last ${HISTORY_MAX} contracts and notices of each generator are also kept in this browser only.`,
  },
  {
    question: 'How do I turn on two-step sign-in?',
    answer: `Go to Settings → Security and choose "Set up an authenticator app". Scan the QR code with an authenticator app (${TWO_STEP_APPS}), then enter the 6-digit code it shows and choose "Turn on". From then on, signing in needs your password and a code from the app. There is no SMS option.`,
  },
  {
    question: 'I lost my phone; how do I get into my account?',
    answer: 'If you added a backup phone, sign in with that one. If not, contact support@b2bnest.online: a platform administrator checks it is really you and then resets your two-step sign-in, so you can sign in with your password and set it up again. There is no self-service reset.',
  },
  {
    question: 'Do I need an account to use the tools?',
    answer: 'You can look at the public pages, including Pricing, Help, the Knowledge base and the lists of tools and templates, without signing in. Using a tool, a template or AI Studio, and the dashboard, needs you to sign in. In Settings → Billing, an account without a paid plan sees "You don\'t have a paid plan yet." and a View plans button.',
  },
];
