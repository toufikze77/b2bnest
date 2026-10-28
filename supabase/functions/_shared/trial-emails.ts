// Phase 13: the three trial emails, in ONE place (plain text + simple HTML). Used by the trial-email-sender Edge
// Function, by scripts/preview-trial-emails.mjs, and by the tests. No Deno or browser APIs, so it runs everywhere.
//
// Honest copy only: no countdowns, no discounts, no scarcity. "Nothing is deleted" is true: Phase 12 checked that no
// job, database function or Edge Function deletes data when a trial ends (docs/phase12/README.md).
// Prices come from the plan catalogue (./plans.ts, which src/test/planCatalogue.test.ts keeps identical to
// src/lib/plans.ts, the Pricing page). Nothing here hard-codes a price.
import { PLAN_CATALOG } from "./plans.ts";

/** The production site. Every link in every email starts with this, and has no tracking parameters. */
export const SITE_URL = "https://www.b2bnest.online";

/** Registered details, as on the Privacy Policy and Terms pages (src/pages/PrivacyPolicy.tsx). Owner: confirm before sending. */
export const COMPANY = {
  legalName: "Edeals Master Ltd",
  companyNumber: "15242148",
  tradingAs: "B2BNEST",
  registeredOffice: "6a-6b Calvert Road, Hastings, England, TN34 3NG",
  contactEmail: "support@b2bnest.online",
} as const;

export const BRAND = { navy: "#001A4C", blue: "#0069FF" } as const;
/** The owner's original wordmark (public/brand/png). PNG, because many email apps block SVG. */
export const LOGO_URL = `${SITE_URL}/brand/png/b2bnest-wordmark-color-600w.png`;

export type TrialEmailKind = "ending_soon" | "ended" | "follow_up";
export const TRIAL_EMAIL_KINDS: TrialEmailKind[] = ["ending_soon", "ended", "follow_up"];

export const LINKS = {
  pricing: `${SITE_URL}/pricing`,
  contact: `${SITE_URL}/contact`,
  help: `${SITE_URL}/help`,
  unsubscribe: (token: string) => `${SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}`,
};

export interface TrialEmailInput {
  kind: TrialEmailKind;
  to: string;
  firstName?: string | null;
  trialEndsAt: string; // ISO
  daysLeft: number;
  unsubscribeToken: string;
}
export interface RenderedEmail { subject: string; text: string; html: string; unsubscribeUrl: string }

const pounds = (pence: number) => `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
/** One line per plan, straight from the catalogue: "Solo: £19 a month or £190 a year". */
export const planLines = () =>
  Object.values(PLAN_CATALOG).map((p) => `${p.name}: ${pounds(p.prices.month.amount)} a month or ${pounds(p.prices.year.amount)} a year`);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
/** "Sunday 1 November 2026" (UK time), built from parts so it reads the same in Deno and Node. */
const longDate = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })
    .formatToParts(new Date(iso));
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")} ${get("year")}`;
};

type Block = { p: string } | { button: { label: string; href: string } } | { list: string[] } | { link: { before: string; label: string; href: string; after?: string } };

function content(i: TrialEmailInput): { subject: string; blocks: Block[] } {
  const date = longDate(i.trialEndsAt);
  const days = Math.max(1, Math.round(i.daysLeft));
  if (i.kind === "ending_soon") {
    return {
      subject: days === 1 ? "Your B2BNEST trial ends tomorrow" : `Your B2BNEST trial ends in ${days} days`,
      blocks: [
        { p: `Your free trial of B2BNEST ends on ${date}${days === 1 ? ", tomorrow" : `, in ${days} days`}.` },
        { p: "After that, you choose a plan to keep using B2BNEST. Until then, everything stays open to you." },
        { p: "Nothing is deleted when the trial ends. Your information stays in your account." },
        { p: "You didn't need a card to try B2BNEST, and nothing is charged unless you choose a plan." },
        { button: { label: "See plans and prices", href: LINKS.pricing } },
        { link: { before: "Questions? ", label: "Contact us", href: LINKS.contact, after: "." } },
      ],
    };
  }
  if (i.kind === "ended") {
    return {
      subject: "Your B2BNEST trial has ended",
      blocks: [
        { p: `Your free trial of B2BNEST ended on ${date}.` },
        { p: "Your information is waiting for you. Nothing has been deleted." },
        { p: "To keep using B2BNEST, choose a plan:" },
        { list: planLines() },
        { button: { label: "Choose a plan", href: LINKS.pricing } },
        { link: { before: "Not sure which plan fits, or have a question? ", label: "Contact the team", href: LINKS.contact, after: "." } },
      ],
    };
  }
  return {
    subject: "Your B2BNEST information is still here",
    blocks: [
      { p: `Your B2BNEST trial ended on ${date}. Your information is still in your account, and you can pick up where you left off when you choose a plan.` },
      { button: { label: "See plans", href: LINKS.pricing } },
      { link: { before: "If something didn't work for you, or you have a question, ", label: "contact us", href: LINKS.contact, after: "." } },
    ],
  };
}

function footer(i: TrialEmailInput, unsub: string) {
  return {
    sentTo: `This email was sent to ${oneLine(i.to)} because you started a free trial of B2BNEST. We send at most three emails about your trial.`,
    unsub: "Don't want these emails? Unsubscribe with one click (no sign-in needed):",
    company: `${COMPANY.legalName} (Company No. ${COMPANY.companyNumber}), trading as ${COMPANY.tradingAs}. Registered office: ${COMPANY.registeredOffice}. ${COMPANY.contactEmail}`,
    unsubUrl: unsub,
  };
}

export function renderTrialEmail(i: TrialEmailInput): RenderedEmail {
  const { subject, blocks } = content(i);
  const unsubscribeUrl = LINKS.unsubscribe(i.unsubscribeToken);
  const f = footer(i, unsubscribeUrl);
  const name = i.firstName ? oneLine(i.firstName).slice(0, 60) : "";
  const hello = name ? `Hello ${name},` : "Hello,";

  const textBody = blocks.map((b) =>
    "p" in b ? b.p
    : "button" in b ? `${b.button.label}: ${b.button.href}`
    : "list" in b ? b.list.map((l) => `- ${l}`).join("\n")
    : `${b.link.before}${b.link.label}: ${b.link.href}`); // no full stop after a URL in plain text
  const text = [hello, "", ...textBody.flatMap((t) => [t, ""]), "The B2BNEST team", "", "-- ", f.sentTo, `${f.unsub} ${f.unsubUrl}`, f.company, ""].join("\n");

  const P = `margin:0 0 16px;font-size:16px;line-height:1.5;color:#1f2937`;
  const htmlBody = blocks.map((b) =>
    "p" in b ? `<p style="${P}">${esc(b.p)}</p>`
    : "button" in b ? `<p style="margin:24px 0"><a href="${esc(b.button.href)}" style="display:inline-block;background:${BRAND.blue};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;line-height:1;padding:14px 22px;border-radius:8px">${esc(b.button.label)}</a></p>`
    : "list" in b ? `<ul style="margin:0 0 16px;padding-left:20px;font-size:16px;line-height:1.6;color:#1f2937">${b.list.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`
    : `<p style="${P}">${esc(b.link.before)}<a href="${esc(b.link.href)}" style="color:${BRAND.blue}">${esc(b.link.label)}</a>${esc(b.link.after ?? "")}</p>`).join("\n");
  const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f5f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
<tr><td style="background:${BRAND.navy};height:8px;line-height:8px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:24px 24px 4px"><img src="${esc(LOGO_URL)}" width="180" alt="B2BNEST" style="display:block;width:180px;max-width:60%;height:auto;border:0"></td></tr>
<tr><td style="padding:16px 24px 8px">
<p style="${P}">${esc(hello)}</p>
${htmlBody}
<p style="${P}">The B2BNEST team</p>
</td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #e5e7eb;font-size:13px;line-height:1.5;color:#4b5563">
<p style="margin:0 0 8px">${esc(f.sentTo)}</p>
<p style="margin:0 0 8px">${esc(f.unsub)} <a href="${esc(f.unsubUrl)}" style="color:${BRAND.blue}">Unsubscribe</a></p>
<p style="margin:0">${esc(f.company)}</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
  return { subject, text, html, unsubscribeUrl };
}
