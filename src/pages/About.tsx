import { FileText, Users, Shield, Award, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import VideoTutorialSection from "@/components/fundraising/VideoTutorialSection";
import { Helmet } from "react-helmet"; // for meta tags

const About = () => {
  const navigate = useNavigate();
  
  const values = [
    {
      icon: FileText,
      title: "AI-Powered Automation",
      description: "Our intelligent automation tools streamline business processes, boost efficiency, and improve productivity."
    },
    {
      icon: Users,
      title: "Customer-Centric",
      description: "We design AI tools for real business needs, providing intuitive workflows and exceptional automation support."
    },
    {
      icon: Shield,
      title: "Security First",
      description: "We safeguard your business data with enterprise-grade security, encryption, and privacy-focused automation."
    },
    {
      icon: Award,
      title: "Excellence",
      description: "We deliver excellence in AI technology, customer service, and results for every client."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* SEO Metadata */}
      <Helmet>
        <title>About B2BNEST | AI-Powered Business Automation Platform</title>
        <meta
          name="description"
          content="Learn about B2BNEST, a global AI-powered automation platform by Edeals Master Ltd. Discover our mission, values, and how we help businesses streamline operations."
        />
        <script type="application/ld+json">{`
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "B2BNEST",
            "url": "https://www.b2bnest.online",
            "logo": "https://www.b2bnest.online/logo.png",
            "sameAs": [
              "https://www.facebook.com/b2bnest",
              "https://twitter.com/b2bnest"
            ],
            "foundingDate": "2024",
            "founders": [
              {
                "@type": "Person",
                "name": "Edeals Master Ltd Team"
              }
            ],
            "contactPoint": [{
              "@type": "ContactPoint",
              "email": "admin@b2bnest.online",
              "contactType": "customer support"
            }]
          }
        `}</script>
      </Helmet>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {/* Hero Section */}
        <header className="text-center mb-16">
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Back to Home
            </Button>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-6">About B2BNEST</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            B2BNEST, operated by Edeals Master Ltd, is a <strong>global AI-powered automation platform</strong> helping businesses streamline operations, reduce manual tasks, and achieve growth with intelligent workflow solutions.
          </p>
        </header>

        {/* Mission Section */}
        <section aria-labelledby="mission" className="mb-16">
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle id="mission" className="text-3xl text-center">Our Mission</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-gray-700 text-center max-w-4xl mx-auto">
                At B2BNEST, we believe every business should access intelligent automation tools. Our mission is to make <strong>AI business automation</strong> simple, affordable, and impactful—helping companies of all sizes optimize workflows, cut costs, and focus on strategic growth.
              </p>
              <div className="mt-8 p-6 bg-blue-50 rounded-lg text-center">
                <p className="text-lg text-gray-700 mb-2">
                  <strong>Need help or have questions?</strong>
                </p>
                <p className="text-gray-600">
                  Contact us at <a href="mailto:admin@b2bnest.online" className="text-blue-600 hover:underline font-medium">admin@b2bnest.online</a>
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Values Section */}
        <section aria-labelledby="values" className="mb-16">
          <h2 id="values" className="text-3xl font-bold text-center text-gray-900 mb-12">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => {
              const IconComponent = value.icon;
              return (
                <Card key={index} className="bg-white shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader className="text-center">
                    <div
                      className="mx-auto bg-blue-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-4"
                      role="img"
                      aria-label={value.title}
                    >
                      <IconComponent className="h-8 w-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-xl">{value.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-center">
                      {value.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Story Section */}
        <article aria-labelledby="story" className="mb-16">
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg">
            <CardHeader>
              <CardTitle id="story" className="text-3xl text-center">Our Story</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 text-lg text-gray-700">
                <p>
                  Founded in 2024, our <strong>AI-powered business automation platform</strong> was born from the need to eliminate repetitive tasks and manual processes for businesses worldwide.
                </p>
                <p>
                  Our founders envisioned a future where <strong>AI workflow automation</strong> was accessible to startups, SMEs, and enterprises alike—bridging the gap between innovation and everyday operations.
                </p>
                <p>
                  Today, B2BNEST empowers companies in multiple industries to automate workflows, leverage AI insights, and gain a competitive edge in the digital marketplace.
                </p>
              </div>
            </CardContent>
          </Card>
        </article>

        {/* Video Section */}
        <section aria-labelledby="learn-more" className="mb-16">
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle id="learn-more" className="text-3xl text-center">Learn More About Our Platform</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <VideoTutorialSection />
            </CardContent>
          </Card>
        </section>

        {/* Commitment Section */}
        <section aria-labelledby="commitment" className="mb-16">
          <h2 id="commitment" className="text-3xl font-bold text-center text-gray-900 mb-12">Our Commitment</h2>
          <Card className="bg-white shadow-lg">
            <CardContent className="p-8">
              <p className="text-lg text-gray-700 text-center max-w-4xl mx-auto">
                We are committed to evolving our <strong>AI automation platform</strong> with cutting-edge tools and world-class support—helping your business succeed at every stage of its automation journey.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* FAQ Section */}
        <section aria-labelledby="faq" className="mb-16">
          <h2 id="faq" className="text-3xl font-bold text-center text-gray-900 mb-12">Frequently Asked Questions</h2>
          <div className="space-y-8 max-w-4xl mx-auto text-lg text-gray-700">
            <div>
              <h3 className="font-semibold">What industries does B2BNEST serve?</h3>
              <p>We work with clients in retail, manufacturing, logistics, finance, healthcare, and more—anywhere intelligent automation can save time and resources.</p>
            </div>
            <div>
              <h3 className="font-semibold">Do I need technical skills to use B2BNEST?</h3>
              <p>No. Our platform is designed to be user-friendly, with pre-built workflows and an intuitive interface for non-technical users.</p>
            </div>
            <div>
              <h3 className="font-semibold">Is my business data secure?</h3>
              <p>Yes. We implement enterprise-grade encryption and follow industry best practices to ensure the security and privacy of your information.</p>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
};

export default About;
