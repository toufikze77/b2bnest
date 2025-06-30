
import React from 'react';
import { Download, FileText, Video, Image, Headphones, Star, CheckCircle, ArrowRight, Users, Clock, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

const PLR = () => {
  const navigate = useNavigate();

  const contentTypes = [
    {
      icon: FileText,
      title: 'eBooks & Articles',
      description: 'Ready-to-use written content including business guides, marketing materials, and industry reports',
      count: '500+ Items',
      color: 'bg-blue-500'
    },
    {
      icon: Video,
      title: 'Video Content',
      description: 'Training videos, webinars, and promotional materials you can rebrand as your own',
      count: '200+ Videos',
      color: 'bg-purple-500'
    },
    {
      icon: Image,
      title: 'Graphics & Templates',
      description: 'Professional graphics, social media templates, and marketing materials',
      count: '1000+ Graphics',
      color: 'bg-green-500'
    },
    {
      icon: Headphones,
      title: 'Audio Content',
      description: 'Podcasts, audiobooks, and background music for your business needs',
      count: '150+ Tracks',
      color: 'bg-orange-500'
    }
  ];

  const benefits = [
    {
      icon: DollarSign,
      title: 'Save Time & Money',
      description: 'Get professional content without hiring expensive copywriters or designers'
    },
    {
      icon: Users,
      title: 'Build Your Brand',
      description: 'Customize and rebrand content to match your business identity'
    },
    {
      icon: Clock,
      title: 'Instant Access',
      description: 'Download and use content immediately - no waiting periods'
    },
    {
      icon: CheckCircle,
      title: 'Full Rights',
      description: 'Edit, modify, and sell the content as if you created it yourself'
    }
  ];

  const featuredContent = [
    {
      title: 'Complete Business Startup Guide',
      type: 'eBook',
      pages: '150 pages',
      rating: 4.9,
      image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&h=250&fit=crop'
    },
    {
      title: 'Social Media Marketing Mastery',
      type: 'Video Course',
      duration: '5 hours',
      rating: 4.8,
      image: 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=400&h=250&fit=crop'
    },
    {
      title: 'Professional Business Templates',
      type: 'Graphics Pack',
      items: '50 templates',
      rating: 4.7,
      image: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&h=250&fit=crop'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Back to Home
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <Badge className="mb-4 bg-blue-100 text-blue-800 px-4 py-2">
            Private Label Rights Content
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Premium PLR Content for Your Business
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Access thousands of high-quality, ready-to-use business content that you can customize, 
            rebrand, and sell as your own. Save time and money while building your content library.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="px-8 py-3">
              Browse Content Library
            </Button>
            <Button variant="outline" size="lg" className="px-8 py-3">
              Learn About PLR
            </Button>
          </div>
        </div>
      </section>

      {/* What is PLR Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">What is Private Label Rights (PLR)?</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              PLR content gives you the legal right to modify, rebrand, and resell digital content 
              as if you created it yourself. It's the fastest way to build a content library for your business.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <Card key={index} className="text-center">
                  <CardHeader>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-lg">{benefit.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">{benefit.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Content Types Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Content Types Available</h2>
            <p className="text-lg text-gray-600">
              Choose from a wide variety of professional content types to suit your business needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {contentTypes.map((type, index) => {
              const Icon = type.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${type.color}`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{type.title}</CardTitle>
                        <Badge variant="outline" className="mt-1">
                          {type.count}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">{type.description}</p>
                    <Button variant="outline" className="w-full">
                      Browse {type.title}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Content Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Featured PLR Content</h2>
            <p className="text-lg text-gray-600">
              Popular content that's helping businesses grow their online presence
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredContent.map((content, index) => (
              <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-video">
                  <img 
                    src={content.image} 
                    alt={content.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{content.type}</Badge>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">{content.rating}</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg">{content.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-600">
                      {content.pages || content.duration || content.items}
                    </span>
                    <Download className="h-4 w-4 text-gray-400" />
                  </div>
                  <Button className="w-full">
                    Get This Content
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">How PLR Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Choose Content</h3>
              <p className="text-gray-600">Browse our library and select the PLR content that fits your needs</p>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Customize & Brand</h3>
              <p className="text-gray-600">Edit, modify, and add your branding to make it uniquely yours</p>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Use & Profit</h3>
              <p className="text-gray-600">Publish, sell, or use the content for your business growth</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Building Your Content Library?</h2>
          <p className="text-xl mb-8">
            Join thousands of entrepreneurs who are saving time and money with our premium PLR content
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="px-8 py-3">
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" className="px-8 py-3 text-white border-white hover:bg-white hover:text-blue-600">
              View Pricing Plans
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PLR;
