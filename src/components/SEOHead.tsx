import { useEffect } from 'react';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: string;
  ogTitle?: string;
  ogDescription?: string;
  noIndex?: boolean;
  schemaMarkup?: any;
}

const SEOHead = ({
  title = "B2BNest - Professional Business Document Templates & Tools",
  description = "Access 10,000+ professional business document templates, AI-powered tools, CRM, project management, and business resources. Streamline your workflow and ensure compliance.",
  keywords = "business templates, document templates, business forms, legal documents, HR templates, financial forms, marketing materials, business tools, CRM, project management, SaaS deals, lifetime deals, business software, startup tools, entrepreneur resources, digital marketing tools, productivity software, app discovery, growth hacking, marketing automation, affiliate marketing, B2B SaaS, free business tools, tech discounts, online business, founder tools, business growth, software curation, software reviews, deal aggregator",
  canonical,
  canonicalUrl,
  ogImage = "https://b2bnest.com/lovable-uploads/86c25eed-4258-4e9e-9fd3-c368f065e452.png",
  ogType = "website",
  ogTitle,
  ogDescription,
  noIndex = false,
  schemaMarkup
}: SEOHeadProps) => {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Update meta tags
    const updateMetaTag = (name: string, content: string, property = false) => {
      const attribute = property ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // Basic meta tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    
    if (noIndex) {
      updateMetaTag('robots', 'noindex, nofollow');
    } else {
      updateMetaTag('robots', 'index, follow');
    }

    // Open Graph tags
    updateMetaTag('og:title', ogTitle || title, true);
    updateMetaTag('og:description', ogDescription || description, true);
    updateMetaTag('og:type', ogType, true);
    updateMetaTag('og:image', ogImage, true);
    
    // Twitter tags
    updateMetaTag('twitter:title', ogTitle || title, true);
    updateMetaTag('twitter:description', ogDescription || description, true);
    updateMetaTag('twitter:image', ogImage, true);

    // Canonical URL
    const canonicalHref = canonicalUrl || canonical;
    if (canonicalHref) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', canonicalHref);
    }

    // Schema markup
    if (schemaMarkup) {
      let script = document.querySelector('script[type="application/ld+json"]');
      if (!script) {
        script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(schemaMarkup);
    }

    // Update URL in Open Graph
    const currentUrl = window.location.href;
    updateMetaTag('og:url', currentUrl, true);
    updateMetaTag('twitter:url', currentUrl, true);
  }, [title, description, keywords, canonical, canonicalUrl, ogImage, ogType, ogTitle, ogDescription, noIndex, schemaMarkup]);

  return null;
};

export default SEOHead;