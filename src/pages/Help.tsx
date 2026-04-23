import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Mail, MessageCircle, Book, HelpCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';

const Help = () => {
  const faqs = [
    {
      question: "How do I get started with B2BNEST?",
      answer: "Getting started is easy! Sign up for a free account, explore our Business Tools, and choose the features that best suit your needs. We offer a 14-day free trial for premium features."
    },
    {
      question: "What integrations do you support?",
      answer: "We support Google Calendar, iCloud Calendar, Outlook 365, OneDrive, Twitter, LinkedIn, Facebook, HMRC, and Firecrawl for web scraping. More integrations are being added regularly."
    },
    {
      question: "How do I connect my HMRC account?",
      answer: "First, go to Settings → HMRC tab and enter your HMRC Client ID and Client Secret (obtained from the HMRC Developer Hub at developer.service.hmrc.gov.uk). Save the settings, then navigate to Business Tools → HMRC Integration and click 'Connect to HMRC Government Gateway'. If you see 'missing Client ID in setting', it means you need to configure your credentials in Settings → HMRC first."
    },
    {
      question: "Where do I get my HMRC Client ID and Secret?",
      answer: "Register at the HMRC Developer Hub (developer.service.hmrc.gov.uk), create a new application, select the APIs you need (VAT, PAYE, etc.), and you'll receive a Client ID and Client Secret. Enter these in B2BNEST under Settings → HMRC tab."
    },
    {
      question: "How do I configure email notifications?",
      answer: "Go to Settings → Notifications tab. You can toggle individual notification types (task assigned, completed, overdue, comments, etc.) and set reminder timing for due dates."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards, PayPal, and cryptocurrency payments through our secure payment gateway."
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Yes, you can cancel your subscription at any time from your account settings. There are no cancellation fees, and you'll retain access until the end of your billing period."
    },
    {
      question: "How do I upgrade or downgrade my plan?",
      answer: "Go to Settings > Subscription, select your desired plan, and click 'Change Plan'. Changes take effect immediately, and we'll prorate the difference."
    },
    {
      question: "Is my data secure?",
      answer: "Absolutely. We use enterprise-grade encryption, secure OAuth connections, and follow GDPR compliance. Your data is stored securely and never shared with third parties."
    },
    {
      question: "How do I export my data?",
      answer: "You can export your data from the Dashboard or individual tool sections. We support CSV, JSON, and PDF formats for most data types."
    },
    {
      question: "What is the AI Assistant?",
      answer: "Our AI Assistant helps you with platform navigation, feature explanations, and business advice. It's powered by advanced AI and has knowledge of all B2BNEST features."
    },
    {
      question: "How do workflows work?",
      answer: "Workflows allow you to automate tasks using visual drag-and-drop builders. Connect triggers (like 'new invoice') to actions (like 'send email' or 'post to Twitter') to create powerful automations."
    },
    {
      question: "What is the B2BN Staking & Rewards Portal?",
      answer: "The Staking Portal lets B2BN holders lock tokens to earn from real platform revenue — not interest. It's a halal-compatible profit-sharing model: users stake tokens to access tools and support the platform, the platform generates revenue (SaaS, AI tools, services), and a portion is shared with participants. Tiers: Bronze (1k+ B2BN, 1x weight), Silver (10k+, 1.5x), Gold (50k+, 2.5x), Diamond (250k+, 4x)."
    },
    {
      question: "Is B2BN staking halal? How is it different from interest?",
      answer: "Yes — our staking model is structured as profit-sharing (mudarabah-style), not interest (riba). There is NO fixed APY and NO guaranteed return. Rewards come from real platform revenue (SaaS subscriptions, AI tool usage, service fees) and are variable — they depend on actual business activity that month. Earn from real business activity, not interest."
    },
    {
      question: "How do staking lock periods and share weight multipliers work?",
      answer: "Each tier has a base revenue share weight (1x to 4x). Longer lock periods boost it: 30 days = 1x, 90 days = 1.25x, 180 days = 1.5x, 1 year = 2x. Your final weight = tier weight × lock multiplier. Higher weight = larger slice of the monthly profit-share pool. Tokens automatically unlock at the end of the lock period and can be unstaked from the My Stakes tab."
    },
    {
      question: "How are staking rewards calculated and distributed?",
      answer: "Each month, a portion of platform revenue is allocated to the staker pool. Your share = (your stake × your weight) / (total weighted stakes across all participants) × monthly revenue pool. Rewards drop in the Rewards tab and include variable B2BN profit share, fixed monthly AI credits (per your tier), and tier perks. Click Claim to credit them to your account."
    },
    {
      question: "Are returns guaranteed? What if revenue is low one month?",
      answer: "No — returns are NOT guaranteed. This is the key feature of the halal-compatible model. If platform revenue is low in a given month, profit-share distributions will be lower (or zero). If revenue is high, distributions will be larger. Your tier credits (AI credits) are fixed per month, but the B2BN profit share is variable. This is the difference between profit-sharing and interest."
    },
    {
      question: "Is staking safe? Can I lose my tokens?",
      answer: "Your stake records are protected by enterprise-grade RLS — only you can view, create, and modify your own stakes. Tokens are committed for the lock period you choose; you cannot unstake early. Smart contract settlement is handled separately on-chain. Profit-share amounts are variable and not guaranteed. Always do your own research."
    }
  ];

  const resources = [
    {
      title: "Knowledge Base",
      description: "Comprehensive guides and tutorials",
      icon: Book,
      link: "/knowledge-base"
    },
    {
      title: "Video Tutorials",
      description: "Learn through step-by-step videos",
      icon: ExternalLink,
      link: "https://www.youtube.com/@B2BNEST"
    },
    {
      title: "API Documentation",
      description: "Developer resources and API docs",
      icon: ExternalLink,
      link: "https://docs.b2bnest.online"
    }
  ];

  return (
    <>
      <SEOHead 
        title="Help Center | B2BNEST Support"
        description="Get help with B2BNEST features, integrations, and account management. Browse FAQs, contact support, and access our knowledge base."
        keywords="help center, support, FAQ, customer service, documentation, guides"
      />
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <HelpCircle className="h-16 w-16 mx-auto mb-4 text-primary" />
            <h1 className="text-4xl font-bold mb-4">Help Center</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Find answers to common questions and get the support you need
            </p>
          </div>

          {/* Contact Options */}
          <div className="grid md:grid-cols-2 gap-6 mb-12 max-w-3xl mx-auto">
            <Card className="text-center hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <MessageCircle className="h-12 w-12 mx-auto mb-2 text-primary" />
                <CardTitle>Live Chat</CardTitle>
                <CardDescription>Get instant help from our team</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => {
                  // Integrate with your live chat service
                  window.open('https://tawk.to/chat/b2bnest', '_blank');
                }}>
                  Start Chat
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Available Mon-Fri, 9am-6pm GMT
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <Mail className="h-12 w-12 mx-auto mb-2 text-primary" />
                <CardTitle>Email Support</CardTitle>
                <CardDescription>We'll respond within 24 hours</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" asChild>
                  <Link to="/contact">
                    Send Email
                  </Link>
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  support@b2bnest.online
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Resources */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-center">Quick Resources</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {resources.map((resource, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <resource.icon className="h-8 w-8 mb-2 text-primary" />
                    <CardTitle>{resource.title}</CardTitle>
                    <CardDescription>{resource.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline" asChild>
                      {resource.link.startsWith('http') ? (
                        <a href={resource.link} target="_blank" rel="noopener noreferrer">
                          Visit Resource
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                      ) : (
                        <Link to={resource.link}>
                          Browse Now
                        </Link>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* FAQs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Frequently Asked Questions</CardTitle>
              <CardDescription>Find quick answers to common questions</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Still Need Help */}
          <Card className="mt-12 bg-primary/5 border-primary/20">
            <CardContent className="text-center py-8">
              <h3 className="text-2xl font-bold mb-4">Still Need Help?</h3>
              <p className="text-muted-foreground mb-6">
                Can't find what you're looking for? Our support team is here to help.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Button asChild size="lg">
                  <Link to="/contact">Contact Support</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/knowledge-base">Browse Knowledge Base</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Help;
