import SEOHead from '@/components/SEOHead';

// Phase 12: no "free forever", "no signup" or invented prices. Every new account gets a 14-day free trial of all
// features; after 14 days you choose a plan (see /pricing). Prices live only in src/lib/plans.ts.
const TOOLS: { name: string; tool: string; description: string }[] = [
  { name: 'QR Code Generator', tool: 'qr-code-generator', description: 'Make QR codes for websites, contact details and printed materials.' },
  { name: 'Currency Converter', tool: 'currency-converter', description: 'Convert between currencies.' },
  { name: 'Time Tracker', tool: 'time-tracker', description: 'Track time spent on work.' },
  { name: 'Contract Generator', tool: 'contract-generator', description: 'Draft a simple business contract to review and edit.' },
  { name: 'Cash Flow Tracker', tool: 'cash-flow-tracker', description: 'Note money in and out for the last 30 days.' },
  { name: 'ROI Calculator', tool: 'roi-calculator', description: 'Work out the return on an investment.' },
];

const BusinessToolsSEO = () => {
  const schemaMarkup = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'B2BNEST business tools',
    description: 'Quick business tools inside B2BNEST. Every new account gets a 14-day free trial of all features; after 14 days you choose a plan.',
    itemListElement: TOOLS.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      url: `https://b2bnest.online/business-tools?tool=${t.tool}`,
      description: t.description,
    })),
  };

  return (
    <SEOHead
      title="Business Tools | B2BNEST"
      description="QR codes, currency converter, time tracker, ROI calculator and more, inside B2BNEST. Every new account gets a 14-day free trial of all features; after 14 days you choose a plan."
      keywords="business tools, QR code generator, currency converter, time tracker, ROI calculator, contract generator, cash flow tracker, small business tools UK"
      schemaMarkup={schemaMarkup}
      canonicalUrl="https://b2bnest.online/business-tools"
      ogTitle="Business Tools | B2BNEST"
      ogDescription="Quick business tools inside B2BNEST. Try every feature free for 14 days; after 14 days you choose a plan."
    />
  );
};

export default BusinessToolsSEO;
