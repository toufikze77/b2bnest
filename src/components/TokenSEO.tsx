import SEOHead from '@/components/SEOHead';

interface TokenSEOProps {
  page?: 'presale' | 'tokenomics' | 'whitepaper' | 'home';
}

const TokenSEO = ({ page = 'home' }: TokenSEOProps) => {
  const seoConfig = {
    presale: {
      title: "B2BNEST Presale | Buy B2BNEST Token - Best New Crypto 2025",
      description: "Invest in B2BNEST presale - a promising blockchain project for B2B transactions. Secure blockchain token with real utility. Join the B2BNEST crypto presale now!",
      keywords: "B2BNEST presale, buy B2BNEST, invest in B2BNEST, B2BNEST token, B2BNEST crypto, best new crypto 2025, promising blockchain projects, secure blockchain token, real utility crypto token",
      canonical: "https://b2bnest.online/fundraising",
      schema: {
        "@context": "https://schema.org",
        "@type": "FinancialProduct",
        "name": "B2BNEST Token Presale",
        "description": "B2BNEST token presale - decentralized finance project for cross-border business transactions with staking and yield farming capabilities",
        "provider": {
          "@type": "Organization",
          "name": "B2BNest",
          "url": "https://b2bnest.online"
        },
        "offers": {
          "@type": "Offer",
          "availability": "https://schema.org/InStock",
          "price": "0.0001",
          "priceCurrency": "ETH",
          "url": "https://b2bnest.online/fundraising"
        }
      }
    },
    tokenomics: {
      title: "B2BNEST Tokenomics | Staking B2BNEST Token & Yield Farming",
      description: "Complete B2BNEST tokenomics breakdown. Learn about staking B2BNEST token, yield farming rewards, B2BNEST utility token benefits, and token distribution model.",
      keywords: "B2BNEST tokenomics, staking B2BNEST token, yield farming B2BNEST, B2BNEST utility token, B2BNEST token, crypto for B2B transactions, decentralized finance project",
      canonical: "https://b2bnest.online/tokenomics",
      schema: {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": "B2BNEST Tokenomics - Complete Token Economics Guide",
        "description": "Comprehensive guide to B2BNEST tokenomics including staking rewards, yield farming, token distribution, and utility features",
        "author": {
          "@type": "Organization",
          "name": "B2BNest"
        },
        "publisher": {
          "@type": "Organization",
          "name": "B2BNest",
          "logo": {
            "@type": "ImageObject",
            "url": "https://b2bnest.online/lovable-uploads/86c25eed-4258-4e9e-9fd3-c368f065e452.png"
          }
        }
      }
    },
    whitepaper: {
      title: "B2BNEST Whitepaper | B2BNEST Roadmap & Crypto Project Audit",
      description: "Read the complete B2BNEST whitepaper. Explore B2BNEST roadmap, crypto project audit & security details, and technical architecture of this cross-border business token.",
      keywords: "B2BNEST whitepaper, B2BNEST roadmap, crypto project audit & security, B2BNEST token, cross-border business token, decentralized finance project, secure blockchain token",
      canonical: "https://b2bnest.online/whitepaper",
      schema: {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": "B2BNEST Whitepaper - Technical Documentation",
        "description": "Official B2BNEST whitepaper covering technology, roadmap, security audit, and implementation details",
        "author": {
          "@type": "Organization",
          "name": "B2BNest"
        },
        "publisher": {
          "@type": "Organization",
          "name": "B2BNest",
          "logo": {
            "@type": "ImageObject",
            "url": "https://b2bnest.online/lovable-uploads/86c25eed-4258-4e9e-9fd3-c368f065e452.png"
          }
        }
      }
    },
    home: {
      title: "B2BNEST Token | Best New Crypto 2025 - Real Utility Blockchain Project",
      description: "B2BNEST crypto - a promising blockchain project for B2B transactions. Buy B2BNEST token in presale. Features staking, yield farming, and cross-border business solutions. Audited & secure.",
      keywords: "B2BNEST token, B2BNEST crypto, best new crypto 2025, promising blockchain projects, buy B2BNEST, invest in B2BNEST, real utility crypto token, crypto for B2B transactions, staking B2BNEST token, decentralized finance project, cross-border business token, B2BNEST listing exchanges",
      canonical: "https://b2bnest.online",
      schema: {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "B2BNest",
        "description": "B2BNEST - A decentralized finance project providing real utility crypto token for cross-border business transactions with AI-powered tools",
        "url": "https://b2bnest.online",
        "logo": "https://b2bnest.online/lovable-uploads/86c25eed-4258-4e9e-9fd3-c368f065e452.png",
        "sameAs": [
          "https://www.linkedin.com/company/aiplatform/about/?viewAsMember=true",
          "https://twitter.com/B2BNEST"
        ],
        "offers": {
          "@type": "Offer",
          "name": "B2BNEST Token Presale",
          "url": "https://b2bnest.online/fundraising"
        }
      }
    }
  };

  const config = seoConfig[page];

  return (
    <SEOHead
      title={config.title}
      description={config.description}
      keywords={config.keywords}
      canonicalUrl={config.canonical}
      schemaMarkup={config.schema}
      ogTitle={config.title}
      ogDescription={config.description}
    />
  );
};

export default TokenSEO;
