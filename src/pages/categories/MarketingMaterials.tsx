import { Card } from "@/components/ui/card";
import SEOHead from "@/components/SEOHead";

// Import marketing promo images focused on Business & AI tools
import promoInvoiceGenerator from "@/assets/tweets/promo-invoice-generator.png";
import promoCrmSystem from "@/assets/tweets/promo-crm-system.png";
import promoProjectManagement from "@/assets/tweets/promo-project-management.png";
import promoAiDocuments from "@/assets/tweets/promo-ai-documents.png";
import promoTimeTracker from "@/assets/tweets/promo-time-tracker.png";
import promoContractGenerator from "@/assets/tweets/promo-contract-generator.png";
import promoHmrcIntegration from "@/assets/tweets/promo-hmrc-integration.png";
import promoRoiCalculator from "@/assets/tweets/promo-roi-calculator.png";
import promoCashFlow from "@/assets/tweets/promo-cash-flow.png";
import promoQrCodes from "@/assets/tweets/promo-qr-codes.png";
import promoPrivacyPolicy from "@/assets/tweets/promo-privacy-policy.png";
import promoSurveys from "@/assets/tweets/promo-surveys.png";

const marketingMaterials = [
  {
    src: promoInvoiceGenerator,
    title: "AI Invoice Generator",
    category: "Business Tools",
    description: "Create and send professional invoices in seconds with AI-powered templates.",
  },
  {
    src: promoCrmSystem,
    title: "Smart CRM Workspace",
    category: "Business Tools",
    description: "Track leads, deals, and client activity in one centralized CRM dashboard.",
  },
  {
    src: promoProjectManagement,
    title: "Project Management Hub",
    category: "Business Tools",
    description: "Plan projects, assign tasks, and follow progress with timelines and boards.",
  },
  {
    src: promoAiDocuments,
    title: "AI Document Assistant",
    category: "AI Tools",
    description: "Analyze, summarize, and extract key points from business documents using AI.",
  },
  {
    src: promoTimeTracker,
    title: "Time Tracking & Billing",
    category: "Business Tools",
    description: "Log billable hours and turn your tracked time into invoices automatically.",
  },
  {
    src: promoContractGenerator,
    title: "Contract Generator",
    category: "AI Tools",
    description: "Draft clean, ready-to-edit business contracts from simple prompts.",
  },
  {
    src: promoHmrcIntegration,
    title: "HMRC Integration",
    category: "Business Tools",
    description: "Connect your finances and stay compliant with HMRC-ready workflows.",
  },
  {
    src: promoRoiCalculator,
    title: "ROI Calculator",
    category: "AI Tools",
    description: "Estimate campaign ROI and forecast business impact with simple inputs.",
  },
  {
    src: promoCashFlow,
    title: "Cash Flow Dashboard",
    category: "Business Tools",
    description: "Monitor income, expenses, and runway with live cash flow insights.",
  },
  {
    src: promoQrCodes,
    title: "Smart QR Code Generator",
    category: "Business Tools",
    description: "Create branded QR codes for payments, menus, lead capture, and more.",
  },
  {
    src: promoPrivacyPolicy,
    title: "Privacy Policy Generator",
    category: "AI Tools",
    description: "Generate customizable privacy policies for your website or app.",
  },
  {
    src: promoSurveys,
    title: "Customer Survey Builder",
    category: "Business Tools",
    description: "Create branded surveys to collect feedback from customers and teams.",
  },
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
            {marketingMaterials.map((item, index) => (
              <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-square relative bg-muted">
                  <img
                    src={item.src}
                    alt={`${item.title} - ${item.category} promo image`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-4">
                  <h2 className="text-base font-semibold mb-1">{item.title}</h2>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    {item.category}
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    {item.description}
                  </p>
                  <button
                    onClick={() =>
                      handleDownload(
                        item.src,
                        `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`
                      )
                    }
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-2 px-4 rounded transition-colors"
                  >
                    Download image
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
