import { useEffect } from 'react';

interface AdvancedSEOSchemaProps {
  page?: 'home' | 'business-tools' | 'pricing' | 'about';
}

const AdvancedSEOSchema = ({ page = 'home' }: AdvancedSEOSchemaProps) => {
  useEffect(() => {
    // Remove existing schema scripts to avoid duplicates
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"][data-seo-schema]');
    existingScripts.forEach(script => script.remove());

    // Product catalog schema for all business tools
    const productCatalogSchema = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "B2BNest Business Tools Suite",
      "description": "Business tools for entrepreneurs, startups and small businesses: some quick tools without an account, the full workspace with a 14-day free trial and then a paid plan",
      "category": "Business Software",
      "brand": {
        "@type": "Brand",
        "name": "B2BNest"
      },
      "offers": [
        {
          "@type": "Offer",
          "name": "Free Tools Package",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "description": "Free business tools including QR generator, currency converter, business name generator, domain checker, and more"
        },
        {
          "@type": "Offer",
          "name": "Premium Tools Package", 
          "price": "19",
          "priceCurrency": "GBP",
          "availability": "https://schema.org/InStock",
          "billingDuration": "P1M",
          "description": "Paid plans (Solo, Business, Scale) including invoicing, CRM, project management, AI tools and financial tracking"
        }
      ]
    };

    // Breadcrumb navigation schema
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://b2bnest.online/"
        },
        {
          "@type": "ListItem", 
          "position": 2,
          "name": "Business Tools",
          "item": "https://b2bnest.online/business-tools"
        }
      ]
    };

    // Service schema for the platform
    const serviceSchema = {
      "@context": "https://schema.org",
      "@type": "Service",
      "name": "Affordable Business Tools Platform",
      "description": "All-in-one business workspace for entrepreneurs and small businesses: a 14-day free trial of all features, then a paid plan",
      "provider": {
        "@type": "Organization",
        "name": "B2BNest"
      },
      "areaServed": "Worldwide",
      "availableChannel": {
        "@type": "ServiceChannel",
        "serviceUrl": "https://b2bnest.online/",
        "serviceSmsNumber": null,
        "servicePhone": null
      },
      "category": "Business Software Services",
      "offers": {
        "@type": "Offer",
        "priceCurrency": "USD",
        "price": "0",
        "description": "Some quick tools can be used without an account. The full workspace has a 14-day free trial, then you choose a paid plan"
      }
    };

    // Create and inject schema scripts
    const schemas = [productCatalogSchema, breadcrumbSchema, serviceSchema];
    
    schemas.forEach((schema, index) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-seo-schema', 'true');
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    });

    // Cleanup function to remove scripts when component unmounts
    return () => {
      const schemaScripts = document.querySelectorAll('script[data-seo-schema]');
      schemaScripts.forEach(script => script.remove());
    };
  }, [page]);

  return null;
};

export default AdvancedSEOSchema;