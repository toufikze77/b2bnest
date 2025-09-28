import SEOHead from '@/components/SEOHead';

const BusinessToolsSEO = () => {
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Affordable Business Tools Collection",
    "description": "Complete collection of free and affordable business tools for entrepreneurs",
    "numberOfItems": 50,
    "itemListElement": [
      {
        "@type": "SoftwareApplication",
        "position": 1,
        "name": "Free QR Code Generator",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web Browser",
        "url": "https://b2bnest.online/business-tools?tool=qr-code-generator",
        "description": "Generate QR codes for websites, contacts, and more - completely free",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      },
      {
        "@type": "SoftwareApplication", 
        "position": 2,
        "name": "Free Currency Converter",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web Browser",
        "url": "https://b2bnest.online/business-tools?tool=currency-converter",
        "description": "Convert currencies with real-time exchange rates - free tool",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      },
      {
        "@type": "SoftwareApplication",
        "position": 3,
        "name": "Affordable CRM System",
        "applicationCategory": "BusinessApplication", 
        "operatingSystem": "Web Browser",
        "url": "https://b2bnest.online/business-tools?tool=crm",
        "description": "Full-featured CRM system at an affordable price for small businesses",
        "offers": {
          "@type": "Offer",
          "price": "9.99",
          "priceCurrency": "USD",
          "billingDuration": "P1M"
        }
      },
      {
        "@type": "SoftwareApplication",
        "position": 4,
        "name": "Budget Project Management",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web Browser", 
        "url": "https://b2bnest.online/business-tools?tool=project-management",
        "description": "Professional project management tools at budget-friendly prices",
        "offers": {
          "@type": "Offer",
          "price": "9.99",
          "priceCurrency": "USD",
          "billingDuration": "P1M"
        }
      }
    ]
  };

  return (
    <SEOHead
      title="50+ Free & Affordable Business Tools | B2BNest"
      description="Discover the most comprehensive collection of free and affordable business tools. From free QR generators to budget CRM systems - everything your business needs without breaking the bank. Try 20+ tools free!"
      keywords="free business tools, affordable business software, cheap business tools, budget business solutions, free CRM, free project management, affordable SaaS tools, business tools under $10, free generators, budget entrepreneurship tools"
      schemaMarkup={schemaMarkup}
      ogTitle="Complete Collection of Free & Affordable Business Tools"
      ogDescription="50+ business tools starting at $0. Free QR generator, currency converter, business name generator + affordable CRM, project management & more."
    />
  );
};

export default BusinessToolsSEO;