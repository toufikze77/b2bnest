import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Mail, Book, HelpCircle, ExternalLink } from 'lucide-react';
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
      answer: "The Integration Hub lists the services you can connect today: Google Calendar, iCloud Calendar, Outlook 365, OneDrive, X (Twitter), LinkedIn, Facebook and Firecrawl for web scraping, plus HMRC from its own page. Connecting takes you to the service's own sign-in page. Other services are not available yet."
    },
    {
      question: "What does the CRM Marketing tab do?",
      answer: "It helps you plan; it never sends anything. Audiences: save a filter of your own contacts (status, source, email or LinkedIn). The count is recalculated from your current contacts, so it can change. Campaign drafts: name, objective, channel, content, dates, status and a fixed list of chosen contacts — editing an audience later won't change a campaign's contacts. \"Completed\" only means you marked the plan done. Planned content: titles with dates; \"Create task\" adds one task to the company selected in the top bar, so it appears in Tasks and Calendar and that company's members can see the task. Everything can be edited, archived and restored. Audiences, campaigns and planned content are private to you, whichever company is selected. There are no opens, clicks or replies, and Mailchimp, SendGrid and Twilio are not connected."
    },
    {
      question: "Is there a support ticketing system?",
      answer: "Support tickets are being prepared and are not switched on yet. When switched on, each company sets up its own support name, categories, optional support hours and who can help. Staff see a ticket list with search and filters, reply to customers or add private staff notes, assign tickets and change status (New, Open, Waiting for customer, Resolved, Closed). Customers the company invites can raise tickets, reply and reopen them in a simple portal; they only see their own tickets, never private notes, projects, CRM or finance, and they don't use a staff seat. Files up to 10 MB can be attached. Email notifications, email-to-ticket, AI replies and SLA timers are planned, not available. Hours are only shown if the company sets them; there is no 24/7 promise or SLA. Tickets are for everyday IT support, not patient records or other sensitive personal data."
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
      answer: "Subscriptions are billed securely by Stripe and accept all major credit and debit cards."
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Yes, you can cancel your subscription at any time from your account settings. There are no cancellation fees, and you'll retain access until the end of your billing period."
    },
    {
      question: "How do I upgrade or downgrade my plan?",
      answer: "Open the Pricing page (or Settings → Billing → 'Change plan') and choose 'Switch to' on another plan. Your existing subscription is changed — never duplicated. Upgrades start straight away and you pay the difference for the rest of the current billing period. Downgrades (a lower plan, or annual to monthly) start at the end of the period you've already paid for: you keep your current plan until then, nothing is charged now, and there's no automatic refund or credit for unused time. Annual plans stay active until their annual renewal. Settings → Billing shows any pending change, its start date and next price, and lets you keep your current plan instead. This doesn't affect your statutory rights."
    },
    {
      question: "Will I get a refund if I downgrade or cancel?",
      answer: "Downgrades and cancellations take effect at the end of your paid billing period, and you keep full access until then. We don't automatically refund or credit unused time. This doesn't affect any refund rights you have under consumer law — contact support if you think one applies."
    },
    {
      question: "Is my data secure?",
      answer: "Each company's records are kept separate, and only its members can see them. Passwords and sign-in are handled by our authentication provider, and card payments by Stripe (we never see card numbers). We don't sell your data."
    },
    {
      question: "How do I export my data?",
      answer: "You can export your data from the Dashboard or individual tool sections. We support CSV, JSON, and PDF formats for most data types."
    },
    {
      question: "What is the AI Business Advisor?",
      answer: "The AI Business Advisor in AI Studio answers business questions using an AI model and uses your monthly AI credits. Like any AI, it can be wrong, so check anything important. The help assistant on the homepage is different: it gives fixed answers to common questions and is not an AI."
    },
    {
      question: "How do workflows work?",
      answer: "In Workflows you list steps under 'Do this' and run them all when you click 'Run now'. Only email steps are switched on right now; WhatsApp, X and LinkedIn steps are switched off until their delivery has been checked. Automatic starts (schedules, form submissions, new records) aren't available yet."
    },
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
          <div className="grid gap-6 mb-12 max-w-md mx-auto">
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <Mail className="h-12 w-12 mx-auto mb-2 text-primary" />
                <CardTitle>Contact the team</CardTitle>
                <CardDescription>Send the team a message from the contact page</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" asChild>
                  <Link to="/contact">
                    Contact the team
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
            <div className="grid md:grid-cols-2 gap-6">
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
                Can't find what you're looking for? Send the team a message from the contact page.
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
