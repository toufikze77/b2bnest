import { Card } from "@/components/ui/card";
import SEOHead from "@/components/SEOHead";

// Import all tweet images
import businessTools2 from "@/assets/tweets/business-tools-2.png";
import businessTools3 from "@/assets/tweets/business-tools-3.png";
import businessTools4 from "@/assets/tweets/business-tools-4.png";
import businessTools5 from "@/assets/tweets/business-tools-5.png";
import businessTools6 from "@/assets/tweets/business-tools-6.png";
import businessTools7 from "@/assets/tweets/business-tools-7.png";
import businessTools8 from "@/assets/tweets/business-tools-8.png";
import businessTools9 from "@/assets/tweets/business-tools-9.png";
import businessTools10 from "@/assets/tweets/business-tools-10.png";
import b2bnToken from "@/assets/tweets/b2bn-token-1.png";
import b2bnInvestment from "@/assets/tweets/b2bn-investment-1.png";
import b2bnEcosystem from "@/assets/tweets/b2bn-ecosystem.png";
import b2bnPresale from "@/assets/tweets/b2bn-presale.png";
import b2bnSecurity from "@/assets/tweets/b2bn-security.png";
import b2bnBenefits from "@/assets/tweets/b2bn-benefits.png";
import b2bnTokenomics from "@/assets/tweets/b2bn-tokenomics.png";
import b2bnExchange from "@/assets/tweets/b2bn-exchange.png";
import b2bnRoadmap from "@/assets/tweets/b2bn-roadmap.png";
import b2bnCommunity from "@/assets/tweets/b2bn-community.png";

// New tweet-style images
import tweetInvoiceTool from "@/assets/tweets/tweet-invoice-tool.png";
import tweetTokenUtility from "@/assets/tweets/tweet-token-utility.png";
import tweetCrmIntegration from "@/assets/tweets/tweet-crm-integration.png";
import tweetPresaleAlert from "@/assets/tweets/tweet-presale-alert.png";
import tweetProjectMgmt from "@/assets/tweets/tweet-project-mgmt.png";
import tweetTokenomicsBreakdown from "@/assets/tweets/tweet-tokenomics-breakdown.png";
import tweetAiDocuments from "@/assets/tweets/tweet-ai-documents.png";
import tweetStakingRewards from "@/assets/tweets/tweet-staking-rewards.png";
import tweetDirectorySuccess from "@/assets/tweets/tweet-directory-success.png";
import tweetRoadmapUpdate from "@/assets/tweets/tweet-roadmap-update.png";
import tweetExpenseTracking from "@/assets/tweets/tweet-expense-tracking.png";
import tweetCommunityLove from "@/assets/tweets/tweet-community-love.png";
import tweetEmailSignatures from "@/assets/tweets/tweet-email-signatures.png";
import tweetSecurityAudit from "@/assets/tweets/tweet-security-audit.png";
import tweetTimeTracking from "@/assets/tweets/tweet-time-tracking.png";
import tweetExchangeListing from "@/assets/tweets/tweet-exchange-listing.png";
import tweetContractGenerator from "@/assets/tweets/tweet-contract-generator.png";
import tweetInvestorPerks from "@/assets/tweets/tweet-investor-perks.png";
import tweetMarketingCalendar from "@/assets/tweets/tweet-marketing-calendar.png";
import tweetPhantomPartnership from "@/assets/tweets/tweet-phantom-partnership.png";

const tweetImages = [
  { src: businessTools2, alt: "Business Tools - Automation Features" },
  { src: businessTools3, alt: "Business Tools - CRM Integration" },
  { src: businessTools4, alt: "Business Tools - Invoice Management" },
  { src: businessTools5, alt: "Business Tools - Project Tracking" },
  { src: businessTools6, alt: "Business Tools - Analytics Dashboard" },
  { src: businessTools7, alt: "Business Tools - Team Collaboration" },
  { src: businessTools8, alt: "Business Tools - Document Management" },
  { src: businessTools9, alt: "Business Tools - Financial Tools" },
  { src: businessTools10, alt: "Business Tools - AI Assistant" },
  { src: b2bnToken, alt: "B2BN Token Introduction" },
  { src: b2bnInvestment, alt: "B2BN Investment Opportunity" },
  { src: b2bnEcosystem, alt: "B2BN Ecosystem Overview" },
  { src: b2bnPresale, alt: "B2BN Token Presale" },
  { src: b2bnSecurity, alt: "B2BN Security Features" },
  { src: b2bnBenefits, alt: "B2BN Token Benefits" },
  { src: b2bnTokenomics, alt: "B2BN Tokenomics" },
  { src: b2bnExchange, alt: "B2BN Exchange Listing" },
  { src: b2bnRoadmap, alt: "B2BN Roadmap" },
  { src: b2bnCommunity, alt: "B2BN Community" },
  { src: tweetInvoiceTool, alt: "Tweet: AI Invoice Generator Success Story" },
  { src: tweetTokenUtility, alt: "Tweet: B2BN Token Holder Benefits" },
  { src: tweetCrmIntegration, alt: "Tweet: CRM Integration Testimonial" },
  { src: tweetPresaleAlert, alt: "Tweet: B2BN Presale Alert" },
  { src: tweetProjectMgmt, alt: "Tweet: Project Management Features" },
  { src: tweetTokenomicsBreakdown, alt: "Tweet: Tokenomics Transparency" },
  { src: tweetAiDocuments, alt: "Tweet: AI Document Analysis" },
  { src: tweetStakingRewards, alt: "Tweet: Staking Rewards Announcement" },
  { src: tweetDirectorySuccess, alt: "Tweet: Business Directory Success" },
  { src: tweetRoadmapUpdate, alt: "Tweet: B2BN Roadmap Update" },
  { src: tweetExpenseTracking, alt: "Tweet: Automated Expense Tracking" },
  { src: tweetCommunityLove, alt: "Tweet: Community Support" },
  { src: tweetEmailSignatures, alt: "Tweet: Email Signature Generator" },
  { src: tweetSecurityAudit, alt: "Tweet: Security Audit Results" },
  { src: tweetTimeTracking, alt: "Tweet: Time Tracking Feature" },
  { src: tweetExchangeListing, alt: "Tweet: Exchange Listing News" },
  { src: tweetContractGenerator, alt: "Tweet: Contract Generator Tool" },
  { src: tweetInvestorPerks, alt: "Tweet: Early Investor Perks" },
  { src: tweetMarketingCalendar, alt: "Tweet: Marketing Calendar Feature" },
  { src: tweetPhantomPartnership, alt: "Tweet: Phantom Wallet Partnership" },
];

const MarketingMaterials = () => {
  const handleDownload = async (imageSrc: string, fileName: string) => {
    try {
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(imageSrc, '_blank');
    }
  };

  return (
    <>
      <SEOHead 
        title="Marketing Materials - B2BNEST"
        description="Download marketing materials for B2BNEST business tools and B2BN token"
      />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Marketing Materials</h1>
          <p className="text-muted-foreground mb-2">
            Download and use these images for social media posts, tweets, and marketing campaigns.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            💡 Tip: Right-click any image and select "Save image as..." to download, or use the download button below each image.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tweetImages.map((image, index) => (
              <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-square relative bg-muted">
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <p className="text-sm font-medium mb-3">{image.alt}</p>
                  <button
                    onClick={() => handleDownload(image.src, `${image.alt.toLowerCase().replace(/\s+/g, '-')}.png`)}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-2 px-4 rounded transition-colors"
                  >
                    Download
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default MarketingMaterials;
