
import React, { useState } from 'react';
import { Building2, CreditCard, Calculator, Wifi, Phone, Shield, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ServiceProvider {
  name: string;
  description: string;
  features: string[];
  pricing: string;
  rating: number;
  website: string;
  logo?: string;
  popular?: boolean;
}

const BusinessResources = () => {
  const [selectedCategory, setSelectedCategory] = useState('banking');

  const categories = {
    banking: {
      title: 'Business Resources',
      icon: CreditCard,
      services: [
        {
          name: 'Business Bank account',
          description: 'Take your finances further with the account designed for efficiency, and built for business.',
          features: ['No monthly fees for 12 months', 'Mobile banking', 'Business credit cards'],
          pricing: '$15/month after promotional period',
          rating: 4.3,
          website: 'https://business.revolut.com/signup?promo=b2b-ref-028-H2-TXL&ext=bcc2bf37-a7ca-3f5f-a13b-fbfc4b6829b4&context=B2B_REFERRAL',
          popular: true,
          logo: '/lovable-uploads/cc883fd6-cb02-4600-8302-bc4306a1ceee.png'
        },
        {
          name: 'Mercury',
          description: 'Digital banking designed for startups and growing businesses',
          features: ['No monthly fees', 'API integration', 'Multi-user access'],
          pricing: 'Free for most accounts',
          rating: 4.7,
          website: 'https://mercury.com'
        },
        {
          name: 'Brex',
          description: 'Corporate credit cards and cash management for businesses',
          features: ['No personal guarantee', 'Expense management', 'Rewards program'],
          pricing: 'Free corporate cards',
          rating: 4.5,
          website: 'https://brex.com'
        }
      ]
    },
    accounting: {
      title: 'Accounting & Bookkeeping Software',
      icon: Calculator,
      services: [
        {
          name: 'QuickBooks Online',
          description: 'Leading accounting software for small to medium businesses',
          features: ['Invoicing', 'Expense tracking', 'Tax preparation', 'Payroll integration'],
          pricing: 'Starting at $30/month',
          rating: 4.4,
          website: 'https://quickbooks.intuit.com',
          popular: true
        },
        {
          name: 'Xero',
          description: 'Cloud-based accounting software with strong bank integration',
          features: ['Bank reconciliation', 'Multi-currency', 'Third-party integrations'],
          pricing: 'Starting at $13/month',
          rating: 4.5,
          website: 'https://xero.com'
        },
        {
          name: 'FreshBooks',
          description: 'User-friendly accounting software for service-based businesses',
          features: ['Time tracking', 'Project management', 'Client portal'],
          pricing: 'Starting at $17/month',
          rating: 4.6,
          website: 'https://freshbooks.com'
        }
      ]
    },
    connectivity: {
      title: 'Connectivity & Internet Services',
      icon: Wifi,
      services: [
        {
          name: 'Comcast Business',
          description: 'High-speed internet and networking solutions for businesses',
          features: ['Dedicated internet', '24/7 support', 'Static IP addresses'],
          pricing: 'Starting at $70/month',
          rating: 4.1,
          website: 'https://business.comcast.com'
        },
        {
          name: 'Verizon Business',
          description: 'Enterprise-grade internet and mobile solutions',
          features: ['5G networks', 'Managed security', 'Cloud solutions'],
          pricing: 'Custom pricing',
          rating: 4.2,
          website: 'https://verizon.com/business',
          popular: true
        },
        {
          name: 'AT&T Business',
          description: 'Comprehensive connectivity and communication services',
          features: ['Fiber internet', 'VoIP solutions', 'Mobile plans'],
          pricing: 'Starting at $55/month',
          rating: 4.0,
          website: 'https://att.com/business'
        }
      ]
    },
    communications: {
      title: 'Communications & Collaboration',
      icon: Phone,
      services: [
        {
          name: 'Zoom',
          description: 'Video conferencing and communication platform',
          features: ['HD video meetings', 'Screen sharing', 'Recording capabilities'],
          pricing: 'Starting at $14.99/month per license',
          rating: 4.5,
          website: 'https://zoom.us',
          popular: true
        },
        {
          name: 'Microsoft Teams',
          description: 'Integrated communication and collaboration platform',
          features: ['Chat and calling', 'File sharing', 'Office 365 integration'],
          pricing: 'Starting at $4/month per user',
          rating: 4.3,
          website: 'https://teams.microsoft.com'
        },
        {
          name: 'Slack',
          description: 'Team communication and productivity platform',
          features: ['Organized channels', 'App integrations', 'File sharing'],
          pricing: 'Starting at $7.25/month per user',
          rating: 4.4,
          website: 'https://slack.com'
        }
      ]
    },
    insurance: {
      title: 'Business Insurance',
      icon: Shield,
      services: [
        {
          name: 'Hiscox',
          description: 'Professional liability and business insurance',
          features: ['Professional liability', 'General liability', 'Cyber insurance'],
          pricing: 'Starting at $22/month',
          rating: 4.4,
          website: 'https://hiscox.com'
        },
        {
          name: 'Next Insurance',
          description: 'Digital-first business insurance platform',
          features: ['Instant quotes', 'Flexible coverage', 'Mobile app'],
          pricing: 'Starting at $7/month',
          rating: 4.6,
          website: 'https://nextinsurance.com',
          popular: true
        },
        {
          name: 'The Hartford',
          description: 'Comprehensive business insurance solutions',
          features: ['Workers compensation', 'Property insurance', 'Business auto'],
          pricing: 'Custom quotes',
          rating: 4.2,
          website: 'https://thehartford.com'
        }
      ]
    },
    legal: {
      title: 'Legal Services',
      icon: Scale,
      services: [
        {
          name: 'LegalZoom',
          description: 'Online legal services for business formation and compliance',
          features: ['Business formation', 'Legal documents', 'Attorney consultations'],
          pricing: 'Starting at $79 + state fees',
          rating: 4.3,
          website: 'https://legalzoom.com',
          popular: true
        },
        {
          name: 'Rocket Lawyer',
          description: 'Legal document creation and attorney services',
          features: ['Document templates', 'Legal advice', 'Business compliance'],
          pricing: 'Starting at $39.99/month',
          rating: 4.1,
          website: 'https://rocketlawyer.com'
        },
        {
          name: 'Nolo',
          description: 'Legal information and self-help resources',
          features: ['Legal guides', 'Form libraries', 'Attorney directory'],
          pricing: 'Varies by service',
          rating: 4.4,
          website: 'https://nolo.com'
        }
      ]
    }
  };

  const renderStarRating = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push('★');
    }
    if (hasHalfStar) {
      stars.push('☆');
    }
    while (stars.length < 5) {
      stars.push('☆');
    }

    return (
      <div className="flex items-center gap-1">
        <span className="text-yellow-500">{stars.join('')}</span>
        <span className="text-sm text-gray-600">({rating})</span>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Business Resources & Referrals</h1>
        <p className="text-gray-600 text-lg">
          Discover trusted service providers and tools to help your business succeed. 
          All recommendations are curated based on reliability, features, and user satisfaction.
        </p>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 mb-8">
          {Object.entries(categories).map(([key, category]) => {
            const Icon = category.icon;
            return (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{category.title.split(' ')[0]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {Object.entries(categories).map(([key, category]) => (
          <TabsContent key={key} value={key}>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
                <category.icon className="h-6 w-6" />
                {category.title}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.services.map((service, index) => (
                <Card key={index} className="relative h-full">
                  {service.popular && (
                    <Badge className="absolute -top-2 -right-2 bg-blue-500">
                      Popular
                    </Badge>
                  )}
                  <CardHeader>
                    {service.logo && (
                      <div className="mb-4">
                        <img 
                          src={service.logo} 
                          alt={`${service.name} logo`}
                          className="w-full h-40 object-cover rounded-lg"
                        />
                      </div>
                    )}
                    <CardTitle className="text-xl">{service.name}</CardTitle>
                    <p className="text-gray-600 text-sm">{service.description}</p>
                    {renderStarRating(service.rating)}
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Key Features:</h4>
                        <ul className="space-y-1">
                          {service.features.map((feature, featureIndex) => (
                            <li key={featureIndex} className="text-sm text-gray-600 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="border-t pt-4">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-medium">Pricing:</span>
                          <span className="text-sm text-gray-600">{service.pricing}</span>
                        </div>
                        <Button 
                          className="w-full" 
                          onClick={() => window.open(service.website, '_blank')}
                        >
                          Learn More
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-8">
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-4">Need Help Choosing?</h3>
          <p className="text-gray-600 mb-6">
            Our team can help you evaluate which services are best for your specific business needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline">
              Schedule a Consultation
            </Button>
            <Button>
              Contact Our Experts
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessResources;
