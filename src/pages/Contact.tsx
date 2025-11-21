import React from 'react';
import { Home, Mail, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ContactForm from '@/components/ContactForm';
import Footer from '@/components/Footer';
import PinkSaleCTA from '@/components/PinkSaleCTA';

const Contact = () => {
  const navigate = useNavigate();

  const contactInfo = [
    {
      icon: Mail,
      title: 'Email',
      description: 'Send us an email',
      value: 'support@b2bnest.online',
      action: () => window.open('mailto:support@b2bnest.online'),
    },
    {
      icon: MapPin,
      title: 'Address',
      description: 'Visit our office',
      value: '1 St Katharine\'s Way, London E1W 1UN',
      action: () => window.open('https://maps.google.com/?q=1+St+Katharine\'s+Way,+London+E1W+1UN'),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Go Back Home
            </Button>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-6">Contact Us</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Have questions about our business documents? Need support? We're here to help you succeed.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {/* Contact Information */}
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Get in Touch</h2>
            <div className="space-y-4">
              {contactInfo.map((info, index) => {
                const IconComponent = info.icon;
                return (
                  <Card 
                    key={index} 
                    className={`${info.action ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                    onClick={info.action || undefined}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <IconComponent className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{info.title}</h3>
                          <p className="text-sm text-gray-600 mb-1">{info.description}</p>
                          <p className="text-sm font-medium text-gray-900">{info.value}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardHeader>
                <CardTitle className="text-lg">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/help')}
                >
                  Help Center
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/knowledge-base')}
                >
                  Knowledge Base
                </Button>
              </CardContent>
            </Card>

            <Card className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardHeader>
                <CardTitle className="text-lg">Business Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Monday - Friday</span>
                    <span>9:00 AM - 6:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday</span>
                    <span>10:00 AM - 4:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sunday</span>
                    <span>Closed</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">All times are GMT</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <ContactForm />
          </div>
        </div>

        {/* Additional Information */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Why Contact Us?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <h3 className="font-semibold text-lg mb-2">Technical Support</h3>
                <p className="text-gray-600">
                  Need help with downloads, customization, or technical issues? Our support team is ready to assist.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Custom Documents</h3>
                <p className="text-gray-600">
                  Looking for a specific document not in our library? Let us know and we'll see how we can help.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Business Partnerships</h3>
                <p className="text-gray-600">
                  Interested in partnering with us or bulk licensing? We'd love to discuss opportunities.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* PinkSale CTA */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <PinkSaleCTA variant="large" />
      </div>

      <Footer />
    </div>
  );
};

export default Contact;