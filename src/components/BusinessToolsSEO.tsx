import SEOHead from '@/components/SEOHead';

const BusinessToolsSEO = () => {
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Free Business Tools Collection - 50+ Tools for Entrepreneurs",
    "description": "Complete collection of 50+ free and affordable business tools including free QR generator, currency converter, business name generator, invoice creator, and more",
    "numberOfItems": 50,
    "itemListElement": [
      {
        "@type": "SoftwareApplication",
        "position": 1,
        "name": "Free QR Code Generator",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web Browser",
        "url": "https://b2bnest.online/business-tools?tool=qr-code-generator",
        "description": "Generate QR codes for websites, contacts, and business materials - 100% free forever",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.8",
          "ratingCount": "250"
        }
      },
      {
        "@type": "SoftwareApplication", 
        "position": 2,
        "name": "Free Currency Converter",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web Browser",
        "url": "https://b2bnest.online/business-tools?tool=currency-converter",
        "description": "Real-time currency conversion for 150+ currencies - completely free",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      },
      {
        "@type": "SoftwareApplication",
        "position": 3,
        "name": "Free Business Name Generator",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web Browser",
        "url": "https://b2bnest.online/business-tools?tool=business-name-generator",
        "description": "AI-powered business name generator with domain availability check - free tool",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      },
      {
        "@type": "SoftwareApplication",
        "position": 4,
        "name": "Free Invoice Generator",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web Browser",
        "url": "https://b2bnest.online/business-tools?tool=document-templates",
        "description": "Create professional invoices instantly - free invoice maker for small businesses",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      },
      {
        "@type": "SoftwareApplication",
        "position": 5,
        "name": "Free Time Tracker",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web Browser",
        "url": "https://b2bnest.online/business-tools?tool=time-tracker",
        "description": "Track billable hours and productivity - free time tracking tool",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      },
      {
        "@type": "SoftwareApplication",
        "position": 6,
        "name": "Free Business Card Designer",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web Browser",
        "url": "https://b2bnest.online/business-tools?tool=business-card-designer",
        "description": "Design professional business cards online - free design tool",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      },
      {
        "@type": "SoftwareApplication",
        "position": 7,
        "name": "Free Email Signature Generator",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web Browser",
        "url": "https://b2bnest.online/business-tools?tool=email-signature-generator",
        "description": "Create professional email signatures - completely free",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      },
      {
        "@type": "SoftwareApplication",
        "position": 8,
        "name": "Free ROI Calculator",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web Browser",
        "url": "https://b2bnest.online/business-tools?tool=roi-calculator",
        "description": "Calculate return on investment for business decisions - free calculator",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      },
      {
        "@type": "SoftwareApplication",
        "position": 9,
        "name": "Affordable CRM System",
        "applicationCategory": "BusinessApplication", 
        "operatingSystem": "Web Browser",
        "url": "https://b2bnest.online/business-tools?tool=crm",
        "description": "Full-featured CRM with contact management and pipeline tracking - only $9.99/month",
        "offers": {
          "@type": "Offer",
          "price": "9.99",
          "priceCurrency": "USD",
          "billingDuration": "P1M"
        }
      },
      {
        "@type": "SoftwareApplication",
        "position": 10,
        "name": "Budget Project Management",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web Browser", 
        "url": "https://b2bnest.online/business-tools?tool=project-management",
        "description": "Professional project management with Kanban boards and Gantt charts - only $9.99/month",
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
      title="50+ Free Business Tools Online | Free QR Generator, Invoice Maker & More | B2BNest"
      description="Access 50+ FREE business tools instantly - no signup required! Free QR code generator, currency converter, invoice maker, business name generator, time tracker, ROI calculator & more. Plus affordable CRM at $9.99/mo. All-in-one business toolkit for entrepreneurs and small businesses."
      keywords="free business tools, free QR code generator, free invoice generator, free business name generator, free time tracker, free currency converter, free ROI calculator, free email signature generator, free business card designer, free tools for small business, free online business tools, business tools no signup, free tools for entrepreneurs, free business calculator, affordable CRM, cheap project management, free business software, business tools under $10, free marketing tools, free financial tools, free document generator, startup tools free, entrepreneur tools free, small business free tools, free productivity tools, free business resources, no credit card required business tools, instant access business tools, free business utilities"
      schemaMarkup={schemaMarkup}
      canonicalUrl="https://b2bnest.online/business-tools"
      ogTitle="50+ Free Business Tools - QR Generator, Invoice Maker & More | No Signup"
      ogDescription="Get instant access to 50+ FREE business tools. QR generator, invoice maker, business name generator, time tracker & more. No signup required. Free forever!"
    />
  );
};

export default BusinessToolsSEO;