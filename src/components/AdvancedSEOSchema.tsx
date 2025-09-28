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
      "description": "Comprehensive collection of 50+ free and affordable business tools designed for entrepreneurs, startups, and small businesses",
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
          "description": "20+ completely free business tools including QR generator, currency converter, business name generator, domain checker, and more"
        },
        {
          "@type": "Offer",
          "name": "Premium Tools Package", 
          "price": "9.99",
          "priceCurrency": "USD",
          "priceValidUntil": "2025-12-31",
          "availability": "https://schema.org/InStock",
          "billingDuration": "P1M",
          "description": "30+ premium business tools including CRM, project management, AI assistants, financial tracking, HMRC integration, and advanced features"
        }
      ],
      "review": {
        "@type": "Review",
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "4.8",
          "bestRating": "5"
        },
        "author": {
          "@type": "Person",
          "name": "Business Tools Review"
        }
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "reviewCount": "150",
        "bestRating": "5"
      }
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
      "description": "All-in-one business tools platform offering free and premium solutions for entrepreneurs and small businesses",
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
        "description": "Freemium model with extensive free tools and affordable premium features"
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