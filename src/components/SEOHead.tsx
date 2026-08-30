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

const SITE_URL = "https://www.b2bnest.online";

const SEOHead = ({
  title = "B2BNest — Affordable Business Tools & Free AI",
  description = "50+ free and affordable business tools in one platform: AI documents, CRM, invoicing, and financial tracking for modern entrepreneurs.",
  keywords = "affordable business tools, free business tools, free CRM, free project management, free invoice generator, affordable SaaS, business automation, small business tools",
  canonical,
  canonicalUrl,
  ogImage = `${SITE_URL}/og-image.jpg`,
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

    // Canonical / social URL — always self-referencing for the current route
    const routeUrl = `${SITE_URL}${window.location.pathname.replace(/\/+$/, '') || '/'}`;
    const canonicalHref = canonicalUrl || canonical || routeUrl;
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonicalHref);

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

    // Open Graph / Twitter URLs mirror the canonical so previews attribute
    // each route to itself instead of the homepage
    updateMetaTag('og:url', canonicalHref, true);
    updateMetaTag('twitter:url', canonicalHref, true);
  }, [title, description, keywords, canonical, canonicalUrl, ogImage, ogType, ogTitle, ogDescription, noIndex, schemaMarkup]);

  return null;
};

export default SEOHead;