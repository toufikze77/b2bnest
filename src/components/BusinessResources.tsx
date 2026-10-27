import { Link } from 'react-router-dom';
import { ExternalLink, Landmark, Receipt, Users, ShieldCheck, Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Public, free page (Phase 12): no sign-in, no Supabase calls. Guidance links go to official GOV.UK pages only
// (HMRC's guidance lives on GOV.UK). B2BNEST does not file anything with HMRC for you.
// Each URL was confirmed on 27 Oct 2026 through search results (gov.uk could not be opened directly from the
// build environment); see the Phase 12 PR for the list.

export const REFERRAL_DISCLOSURE = 'We may earn a commission if you sign up through this link. It does not change the price you pay.';
export const REFERRAL_REL = 'sponsored noopener noreferrer';

export interface GuidanceLink { title: string; url: string; summary: string }
export interface GuidanceSection { id: string; title: string; icon: typeof Landmark; links: GuidanceLink[] }

export const GUIDANCE: GuidanceSection[] = [
  {
    id: 'starting', title: 'Starting a business', icon: Landmark, links: [
      { title: 'Set up a business', url: 'https://www.gov.uk/set-up-business', summary: 'Choose a structure, a name and what to register.' },
      { title: 'Set up as a sole trader: step by step', url: 'https://www.gov.uk/set-up-as-sole-trader', summary: 'Register for Self Assessment and keep records.' },
      { title: 'Set up a limited company: step by step', url: 'https://www.gov.uk/set-up-limited-company', summary: 'Directors, shareholders, registered address and tax.' },
    ],
  },
  {
    id: 'tax', title: 'Tax and HMRC', icon: Receipt, links: [
      { title: 'How to register for VAT', url: 'https://www.gov.uk/register-for-vat/how-register-for-vat', summary: 'What you need and how to register.' },
      { title: 'Making Tax Digital for VAT', url: 'https://www.gov.uk/government/collections/making-tax-digital-for-vat', summary: "HMRC's guidance on digital records and returns." },
      { title: 'HMRC online services: sign in or set up an account', url: 'https://www.gov.uk/log-in-register-hmrc-online-services', summary: 'Your own HMRC account for VAT, PAYE and Corporation Tax.' },
      { title: 'Company and accounting records', url: 'https://www.gov.uk/running-a-limited-company/company-and-accounting-records', summary: 'What a limited company must keep, and for how long.' },
    ],
  },
  {
    id: 'employing', title: 'Employing people', icon: Users, links: [
      { title: 'Employing staff for the first time', url: 'https://www.gov.uk/employing-staff', summary: 'The steps in order, from pay to insurance.' },
      { title: 'PAYE and payroll for employers', url: 'https://www.gov.uk/paye-for-employers', summary: 'When to register and what payroll involves.' },
      { title: 'The National Minimum Wage and Living Wage', url: 'https://www.gov.uk/national-minimum-wage', summary: 'Who it applies to; check the current rates.' },
      { title: 'Workplace pensions for employers', url: 'https://www.gov.uk/workplace-pensions-employers', summary: 'Automatic enrolment duties.' },
    ],
  },
  {
    id: 'running', title: 'Data, support and funding', icon: ShieldCheck, links: [
      { title: 'Data protection and your business', url: 'https://www.gov.uk/data-protection-your-business', summary: 'Using customer and staff personal data.' },
      { title: 'Finance and support for your business', url: 'https://www.gov.uk/business-finance-support', summary: 'Government-backed finance and support schemes.' },
      { title: 'Get help and support for your business', url: 'https://www.gov.uk/get-business-support', summary: 'Free advice, including local growth hubs.' },
      { title: 'Business and self-employed', url: 'https://www.gov.uk/browse/business', summary: 'Every GOV.UK business topic in one place.' },
    ],
  },
];

// Owner to confirm both referral programmes are active and that these links are allowed to be published.
export const REFERRALS: { name: string; provider: string; description: string; url: string }[] = [
  {
    name: 'Revolut Business account', provider: 'Revolut',
    description: 'A business bank account from Revolut. Check fees, plans and eligibility on Revolut’s website.',
    url: 'https://business.revolut.com/signup?promo=b2b-ref-028-H2-TXL&ext=bcc2bf37-a7ca-3f5f-a13b-fbfc4b6829b4&context=B2B_REFERRAL',
  },
  {
    name: 'Hostinger website hosting', provider: 'Hostinger',
    description: 'Website and email hosting from Hostinger. Current prices and offers are on Hostinger’s website.',
    url: 'https://hostinger.co.uk?REFERRALCODE=TDWTOUFIKWBH',
  },
];

const linkClass = 'inline-flex items-start gap-1.5 font-semibold text-brand-blue underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring rounded-sm';

/** `headingLevel` h1 on the public /business-resources page; h2 inside the /business-tools tab. */
const BusinessResources = ({ headingLevel = 'h2' }: { headingLevel?: 'h1' | 'h2' }) => {
  const Heading = headingLevel;
  const Sub = headingLevel === 'h1' ? 'h2' : 'h3';
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="max-w-3xl">
        <Heading className="text-3xl font-bold text-brand-navy dark:text-foreground sm:text-4xl">Free resources for UK small businesses</Heading>
        <p className="mt-4 text-lg text-muted-foreground">
          Official GOV.UK and HMRC guidance for starting a business, tax, employing people and getting support. Free to read, no account needed.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          These links open the official guidance. B2BNEST does not file anything with HMRC for you.
        </p>
      </header>

      <p className="mt-6 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground" data-testid="disclosure-top">
        <strong>Referral links:</strong> the partner offers at the end of this page are referral links. {REFERRAL_DISCLOSURE}
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {GUIDANCE.map(({ id, title, icon: Icon, links }) => (
          <section key={id} aria-labelledby={`res-${id}`} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <Sub id={`res-${id}`} className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Icon className="h-5 w-5 text-brand-blue" aria-hidden="true" />{title}
            </Sub>
            <ul className="mt-4 space-y-4">
              {links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    <span>{l.title}</span><ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="sr-only"> (GOV.UK, opens in a new tab)</span>
                  </a>
                  <p className="mt-0.5 text-sm text-muted-foreground">{l.summary}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section aria-labelledby="res-partners" className="mt-10">
        <Sub id="res-partners" className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Handshake className="h-5 w-5 text-brand-blue" aria-hidden="true" />Partner offers
        </Sub>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {REFERRALS.map((r) => (
            <article key={r.provider} className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="font-semibold text-foreground">{r.name}</p>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{r.description}</p>
              <a href={r.url} target="_blank" rel={REFERRAL_REL} className={`${linkClass} mt-4`}>
                <span>Visit {r.provider}</span><ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="sr-only"> (referral link, opens in a new tab)</span>
              </a>
              <p className="mt-2 text-xs text-muted-foreground" data-testid="disclosure-link">{REFERRAL_DISCLOSURE}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="res-cta" className="mt-12 rounded-2xl bg-brand-navy px-6 py-8 text-center text-white">
        <Sub id="res-cta" className="text-2xl font-bold">Run your business in one place</Sub>
        <p className="mx-auto mt-2 max-w-2xl text-white/85">
          Every new account gets a 14-day free trial of all features. No card is needed. After 14 days you choose a plan to continue.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild className="bg-brand-blue text-white hover:bg-brand-blue/90"><Link to="/auth?mode=signup">Try B2BNEST free for 14 days</Link></Button>
          <Button asChild variant="outline" className="border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link to="/pricing">See plans and prices</Link></Button>
        </div>
      </section>
    </div>
  );
};

export default BusinessResources;
