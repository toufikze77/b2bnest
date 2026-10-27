import SEOHead from '@/components/SEOHead';
import BusinessResources, { GUIDANCE, REFERRALS } from '@/components/BusinessResources';

const URL = 'https://www.b2bnest.online/business-resources';
export const BUSINESS_RESOURCES_TITLE = 'Free Resources for UK Small Businesses | B2BNEST';
export const BUSINESS_RESOURCES_DESCRIPTION =
  'Official GOV.UK and HMRC guidance for UK small businesses: starting up, VAT, PAYE, employing staff, data protection and funding. Free to read, no account needed.';

/** Public page: no sign-in and no Supabase calls. */
const BusinessResourcesPage = () => {
  const items = [...GUIDANCE.flatMap((s) => s.links.map((l) => ({ name: l.title, url: l.url }))), ...REFERRALS.map((r) => ({ name: r.name, url: r.url }))];
  const schemaMarkup = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${URL}#webpage`, url: URL, name: BUSINESS_RESOURCES_TITLE, description: BUSINESS_RESOURCES_DESCRIPTION, inLanguage: 'en-GB',
        isPartOf: { '@type': 'WebSite', name: 'B2BNEST', url: 'https://www.b2bnest.online/' } },
      { '@type': 'ItemList', '@id': `${URL}#resources`, name: 'Resources for UK small businesses',
        itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: it.url })) },
    ],
  };
  return (
    <>
      <SEOHead
        title={BUSINESS_RESOURCES_TITLE}
        description={BUSINESS_RESOURCES_DESCRIPTION}
        keywords="UK small business resources, GOV.UK business guidance, HMRC guidance, register for VAT, PAYE for employers, set up a limited company, sole trader"
        canonicalUrl={URL}
        schemaMarkup={schemaMarkup}
      />
      <BusinessResources headingLevel="h1" />
    </>
  );
};

export default BusinessResourcesPage;
