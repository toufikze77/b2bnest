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
];

const MarketingMaterials = () => {
  const handleDownload = (imageSrc: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <p className="text-muted-foreground mb-8">
            Download and use these images for social media posts, tweets, and marketing campaigns.
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
