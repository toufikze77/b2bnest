# Privacy policy: draft wording for HMRC features (not live)

**Draft only.** The live page (`src/pages/PrivacyPolicy.tsx`) is unchanged.

- Every legal claim is marked **(adviser to confirm)**.
- Facts are taken from the code, with the file named.
- The live page today names no processors and says nothing about HMRC.

---

## Making Tax Digital and HMRC

When you use B2BNEST's HMRC features (connecting to HMRC, reading VAT obligations, sending a VAT return), we send
information to HM Revenue & Customs (HMRC) on behalf of your business. These features currently use HMRC's test
environment only: nothing is filed with HMRC for real.

### Fraud prevention information

HMRC requires software that connects to its services to send fraud prevention information with every request. We send it
only when you use an HMRC feature, and only to HMRC. It is:

- a random device identifier that B2BNEST creates and keeps in your browser;
- your browser's user agent;
- your screen size, scaling factor and colour depth, and your browser window size;
- your time zone;
- your public IP address and the time we received your request;
- that you signed in with an authenticator app, when, and a one-way reference to that authenticator (never the code itself);
- your B2BNEST user ID.

We don't store this information ourselves: it is put together for each request and sent to HMRC
(`supabase/functions/_shared/hmrc/fraudHeaders.ts`). The device identifier stays in your browser until you clear its storage.

**Why:** HMRC requires it to protect taxpayers from fraud. Our legal basis is that processing is necessary to comply
with a legal obligation and HMRC's terms of use **(adviser to confirm: Article 6(1)(c), or legitimate interests under
6(1)(f))**.

### What we keep about your HMRC use

- **Your HMRC connection:** an access token and a refresh token, encrypted, plus who connected and when. When an owner or
  admin chooses Disconnect, the tokens are deleted at once.
- **A record of each VAT return sent:** the nine box figures, the period, the time, who sent it, HMRC's answer and receipt,
  and the last three digits of the VAT number. These records can't be changed or deleted, so that there is a reliable
  record of what was sent to HMRC.
- **A security log of HMRC connection events** (connected, refreshed, disconnected, refused): event codes and user IDs
  only, never tokens or HMRC's replies.

**Purpose and legal basis:** to provide the service your business asked for (contract, Article 6(1)(b)), and to keep
tax and security records (legal obligation, Article 6(1)(c), and legitimate interests, Article 6(1)(f)) **(adviser to
confirm)**.

**What HMRC shows you (HMRC P8, once deployed):** when you check what HMRC holds for a return, or look at what you
owe, what HMRC received or your penalties, B2BNEST reads it from HMRC at that moment and shows it to you. **Nothing
new is stored**: not the amounts, not the penalties, not HMRC's copy of the return. Only a security log entry is kept
that the check happened and its result code (for example "matches"), never an amount. The receipt is built from the
record of the return you sent, without asking HMRC again.

**How long:** VAT return records and the HMRC security log are kept for [6 years after the end of the VAT period]
**(owner and adviser to decide; see `data-rights.md`)**. Connection tokens are kept only while you stay connected.

## Where your data is processed

Your account and business data are stored by Supabase in the **eu-west-2 (London)** region (the project settings,
checked 2026-11-08). Our server code (Supabase Edge Functions) may run in the data centre nearest to you **(to
confirm with Supabase for the owner's plan)**.

We use these service providers (processors) when you use the related feature **(owner to confirm which are live and
that a data processing agreement is in place with each)**:

| Provider | What for | Seen in |
| --- | --- | --- |
| Supabase | Database, sign-in, file storage, server functions | the whole app |
| Vercel | Hosting the website | `vercel.json` |
| Stripe | Payments and subscriptions | `create-subscription-checkout`, `stripe-webhook`, `customer-portal` |
| Resend | Sending emails (two-step codes, documents, onboarding, support) | `send-2fa-email`, `send-document-email`, `onboarding-email-sender` |
| OpenAI | AI assistant, AI templates and legal document drafts, business insights | `ai-assistant`, `generate-template`, `generate-legal-document`, `business-insights` |
| Firecrawl | Reading a web page you ask the AI tools to read | `firecrawl-scrape` |
| TrueLayer | Bank connections, if you connect a bank | `truelayer-integration` |
| Twilio | WhatsApp messages, if you connect WhatsApp | `whatsapp-connect` |
| HMRC | Recipient of VAT information you choose to send (not a processor) | `_shared/hmrc` |

Services you connect yourself, such as Google, Microsoft, Slack, Notion, Trello, LinkedIn, X and Facebook, receive data
only when you connect them and use that feature.

Some providers may process data outside the UK. Where they do, we rely on [UK adequacy regulations / the International
Data Transfer Agreement or Addendum] **(adviser to confirm, per provider)**.

## Your rights

You can ask for:
- a copy of your data;
- your data to be corrected;
- your data to be deleted;
- processing to be limited;
- your data to be moved to another service.

You can also object to processing. Email info@b2bnest.online. We will reply within one month **(adviser to confirm)**.

We can't delete VAT return records or the HMRC security log while we must keep them by law. We will tell you when that
applies **(adviser to confirm: Article 17(3)(b))**.

You can complain to the Information Commissioner's Office (ico.org.uk).

---

**Also for the owner (not wording):**
- Done: `src/pages/articles/SecurityGuide.tsx` no longer claims a data protection officer, compliance audits, impact
  assessments or data processing agreements, and uses info@b2bnest.online (the only confirmed mailbox).
- HMRC asks for a privacy policy URL and a terms URL for production. Today they are `https://www.b2bnest.online/privacy`
  and `https://www.b2bnest.online/terms` (routes in `src/App.tsx`). Their content needs the wording above first.
