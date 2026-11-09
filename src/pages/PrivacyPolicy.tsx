import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// HMRC P7d (9 Nov 2026): every statement here is backed by the code or the database (docs/hmrc-p7d/README.md and
// docs/hmrc-p7/privacy-wording.md, which lists what was deliberately not published and why). No legal basis is named
// where none is confirmed, and nothing about roles, archives or deletion timelines that isn't proven.
export const PRIVACY_LAST_UPDATED = "9 November 2026";
export const PRIVACY_CONTACT = "info@b2bnest.online";

type Section = { id: string; title: string; intro?: string; items: React.ReactNode[] };

const PrivacyPolicy = () => {
  const sections: Section[] = [
    {
      id: "collect",
      title: "Information we collect",
      items: [
        "Account information: your name, email address and sign-in details. If you turn on two-step sign-in, the authenticator app you set up.",
        "Business records you enter: for example invoices, quotes, expenses, payroll, customers, projects, notes, documents, rotas and time records, kept for your company.",
        "Usage of some features: for example which templates you view or use, and the AI credits you use.",
        "Communication data: messages you send to our support team.",
        "Payment records: your plan and payment status. Payments are handled by Stripe, our payment provider.",
      ],
    },
    {
      id: "use",
      title: "How we use your information",
      items: [
        "To provide the service your business asked for: your account, your company's records and the tools you use.",
        "To take payments for your plan and AI credits.",
        "To send you messages about your account, such as sign-in codes, invitations and replies to support requests. Marketing emails only if you agree, and you can opt out in Settings or from the email.",
        "To keep the service secure, and to keep security and tax records.",
        "To answer your questions and improve the service.",
      ],
    },
    {
      id: "sharing",
      title: "Information sharing",
      items: [
        "We do not sell, trade or rent your personal information.",
        "We share information with service providers who help us run the platform, only as needed for the feature you use. Your database, sign-in and file storage are hosted by Supabase in London (UK). Payments go through Stripe.",
        "Services you connect yourself (for example Google, Microsoft or Slack) receive data only when you connect them and use that feature.",
        "When you use our HMRC features, we send information to HM Revenue & Customs (HMRC) for your business. See “Making Tax Digital and HMRC” below.",
        "We may disclose information if the law requires it.",
      ],
    },
    {
      id: "hmrc",
      title: "Making Tax Digital and HMRC",
      intro:
        "B2BNEST's HMRC features (connecting to HMRC, reading VAT obligations, sending a VAT return, and checking what HMRC holds) currently use HMRC's test environment only: nothing is filed with HMRC for real.",
      items: [
        <>
          <strong>Fraud prevention information.</strong> HMRC requires software that connects to its services to send fraud prevention
          information with each request. We send it only when you use an HMRC feature, and only to HMRC: a random device identifier that
          B2BNEST keeps in your browser; your browser's user agent; your screen size, scaling and colour depth and your window size; your
          time zone; your public IP address and the time of your request; whether you signed in with an authenticator app, when, and a
          one-way reference to it (never the code); and your B2BNEST user ID. We put it together for each request and don't store it
          ourselves. The device identifier stays in your browser until you clear its storage.
        </>,
        <>
          <strong>What we keep about your HMRC use.</strong> Your HMRC connection: an access token and a refresh token, encrypted, and
          who connected and when. When an owner or admin chooses Disconnect, the tokens are deleted at once. A record of each VAT
          return sent: the nine box figures, the period, the time, who sent it, HMRC's answer and receipt, and the last three digits of
          the VAT number. A security log of HMRC events (for example connected, refreshed, disconnected, refused): event codes and user
          IDs only, never tokens or HMRC's replies.
        </>,
        <>
          <strong>Records of returns sent can't be changed or deleted</strong>, by you or by us, so that there is a reliable record of
          what was sent to HMRC.
        </>,
        <>
          <strong>What HMRC shows you is not stored.</strong> When you look at what HMRC holds for a return, what you owe, what HMRC
          received or your penalties, we read it from HMRC at that moment and show it to you. We keep only a security log entry that the
          check happened and its result code, never the amounts. The receipt for a return is made from our record of what you sent,
          without asking HMRC again.
        </>,
      ],
    },
    {
      id: "retention",
      title: "How long we keep information",
      items: [
        "Your account and business records: while your account and your company exist, until you delete them (see “Your data: download and delete” below).",
        "HMRC connection tokens: only while your company stays connected to HMRC.",
        "Records of VAT returns sent and the HMRC security log: our retention period is 6 years after the end of the VAT period they relate to. For HMRC's test environment, the retention period is 12 months.",
        "Keeping your own VAT records is your business's legal duty, not ours. Download your data before you close your company or delete your account.",
      ],
    },
    {
      id: "security",
      title: "Data security",
      items: [
        "Data travels to and from B2BNEST encrypted (HTTPS).",
        "Each company's records are kept separate by database access rules: people only see the companies they belong to.",
        "HMRC tokens are encrypted, and never sent to your browser.",
        "You can protect your account with two-step sign-in using an authenticator app.",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-lg text-gray-600" data-testid="privacy-updated">Last updated: {PRIVACY_LAST_UPDATED}</p>
        </div>

        <Card className="bg-white shadow-lg mb-8">
          <CardContent className="p-8">
            <p className="text-lg text-gray-700 mb-6">
              B2BNEST is operated by Edeals Master Ltd (Company No. 15242148). This Privacy Policy explains what information we collect
              when you use B2BNEST, how we use it, how long we keep it, and how you can download or delete it.
            </p>
            <p className="text-gray-700">If anything here is unclear, email {PRIVACY_CONTACT}.</p>
          </CardContent>
        </Card>

        <div className="space-y-8">
          {sections.map((section) => (
            <Card key={section.id} className="bg-white shadow-lg" data-testid={`privacy-${section.id}`}>
              <CardHeader>
                <h2 className="text-2xl font-semibold leading-none tracking-tight text-gray-900">{section.title}</h2>
              </CardHeader>
              <CardContent>
                {section.intro && <p className="text-gray-700 mb-4">{section.intro}</p>}
                <ul className="space-y-3">
                  {section.items.map((item, i) => (
                    <li key={i} className="text-gray-700 flex items-start">
                      <span className="text-blue-600 mr-3 mt-1" aria-hidden="true">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}

          <Card className="bg-white shadow-lg" data-testid="privacy-your-data">
            <CardHeader>
              <h2 className="text-2xl font-semibold leading-none tracking-tight text-gray-900">Your data: download and delete</h2>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-700">
              <p>
                Signed in, go to <Link to="/settings?tab=data" className="text-blue-700 underline">Settings &gt; Your data</Link>. For your
                protection, each of these asks you to sign in again (your password, or your authenticator code if you use one):
              </p>
              <ul className="space-y-3">
                <li className="flex items-start"><span className="text-blue-600 mr-3 mt-1" aria-hidden="true">•</span><span><strong>Download my data:</strong> a ZIP file of your own data.</span></li>
                <li className="flex items-start"><span className="text-blue-600 mr-3 mt-1" aria-hidden="true">•</span><span><strong>Download company data:</strong> a ZIP file of your company's records, including invoices, expenses, bills and VAT returns sent (company owners and admins).</span></li>
                <li className="flex items-start"><span className="text-blue-600 mr-3 mt-1" aria-hidden="true">•</span><span><strong>Close this company:</strong> the company and its records can no longer be used (company owners).</span></li>
                <li className="flex items-start"><span className="text-blue-600 mr-3 mt-1" aria-hidden="true">•</span><span><strong>Delete my account:</strong> your account is removed. Records of VAT returns sent and the HMRC security log are kept for the retention period above and show &ldquo;Deleted user&rdquo; instead of your name. If you are the last owner of a company that has other members, or you still have a paid subscription, you'll be asked to sort that out first.</span></li>
              </ul>
              <p>
                You can correct your details in the app at any time. For anything else, including a request we haven't covered here, email{" "}
                <strong>{PRIVACY_CONTACT}</strong>. We respond within one month.
              </p>
              <p>You can also complain to the Information Commissioner's Office (ico.org.uk).</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-blue-50 shadow-lg mt-8" data-testid="privacy-contact">
          <CardHeader>
            <h2 className="text-2xl font-semibold leading-none tracking-tight text-gray-900">Contact us</h2>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">For any question about this Privacy Policy or your data, contact us:</p>
            <div className="space-y-2 text-gray-700">
              <p><strong>Edeals Master Ltd</strong> (Company No. 15242148) trading as B2BNEST</p>
              <p>Incorporated in England & Wales on 27 October 2023</p>
              <p>Email: {PRIVACY_CONTACT}</p>
              <p>Registered office: 6a-6b Calvert Road, Hastings, England, TN34 3NG</p>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
